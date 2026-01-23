# Focus Jumping Bug: Root Cause Analysis

## Executive Summary

After 10+ fix attempts across multiple debugging sessions, we identified the TRUE root cause of the focus jumping bug in Discourse post stream navigation. **The problem was NOT timing, race conditions, or cloaking** - it was multiple navigation modifiers on the same page competing for focus.

---

## The Root Cause

The `grid-navigation` modifier on the **suggested topics grid** (at the bottom of topic pages) was stealing focus from the post stream.

### Evidence from Console Logs

Call stack analysis showed TWO DIFFERENT modifiers calling focus methods:

**Post-stream-navigation (correct):**
```
at u.focusRowByElement (chunk...js:242:7493)
at u.focusNextRow (chunk...js:242:13518)
at u.handleKeydown (chunk...js:242:10117)
```

**Grid-navigation stealing focus (the bug):**
```
at a.focusRow (chunk...js:248:33473)  <-- DIFFERENT modifier!
at https://...js:248:30836
```

The different class names (`u` vs `a`) and line numbers proved these were separate modifier instances.

### The Sequence

1. User navigates in post stream with arrow keys
2. Scrolling brings suggested topics grid into/out of view
3. Ember re-renders the suggested topics grid
4. `grid-navigation.modify()` runs on the suggested topics grid
5. It sees `focusHistory.keyboardMode=true` and `initialFocusComplete=false`
6. It calls `scheduleInitialFocus()` → `focusRow()` via requestAnimationFrame
7. **Focus gets stolen to suggested topics grid**
8. Our `focusFirstUnreadPost()` fires and moves focus back to post 1
9. User perceives focus "jumping" unpredictably

---

## Why Previous Fixes Didn't Work

We tried many approaches targeting the wrong root cause:

### Attempt 1-4: Timing Guards
- Microtask-based `_isNavigating` flag
- Timestamp-based guards (`NAVIGATION_GUARD_MS`)
- Scheduled callback guards

**Why they failed:** The focus stealing happened from a DIFFERENT modifier, not from within our own navigation flow. Guards inside post-stream-navigation couldn't prevent grid-navigation from calling its own `focusRow()`.

### Attempt 5-6: modify() Lifecycle Changes
- Removing tabindex updates from `modify()`
- Using post-number-based navigation instead of index-based

**Why they partially helped:** Reduced some race conditions, but didn't address the core issue of cross-modifier interference.

### Attempt 7: Instant Scroll
- Changed from `behavior: "smooth"` to `behavior: "instant"`

**Why it helped:** Reduced the window for interference but didn't prevent it entirely.

### Attempt 8-9: Focus Event Blocking
- Blocking external focus changes in `handleFocusIn()`

**Why it failed:** By the time `handleFocusIn` ran, focus had already been stolen.

---

## The Correct Fix (Commit b00f793693)

### Fix 1: grid-navigation.js

Added check in `scheduleInitialFocus()` to skip if focus is already in another navigation region:

```javascript
scheduleInitialFocus() {
  requestAnimationFrame(() => {
    // CRITICAL: Don't steal focus from other navigation regions
    const activeElement = document.activeElement;
    if (activeElement && activeElement !== document.body) {
      const inOtherGrid = activeElement.closest('[role="grid"]');
      const inPostStream = activeElement.closest('.post-stream');
      const inToolbar = activeElement.closest('[role="toolbar"]');
      const inTree = activeElement.closest('[role="tree"]');

      // Only skip if focus is in ANOTHER grid (not this one)
      if ((inOtherGrid && inOtherGrid !== this.element) || inPostStream || inToolbar || inTree) {
        return; // Don't steal focus
      }
    }
    // ... proceed with auto-focus
  });
}
```

### Fix 2: post-stream-navigation.js

Added multiple guards to `focusFirstUnreadPost()`:

```javascript
focusFirstUnreadPost(lastReadPostNumber) {
  // GUARD 1: Skip if user already navigated away from header
  if (this.activeRowId !== "header") {
    return;
  }

  // GUARD 2: Skip if recent navigation (even if they came back to header)
  const msSinceNav = performance.now() - this._navigationTimestamp;
  if (this._navigationTimestamp > 0 && msSinceNav < NAVIGATION_GUARD_MS * 2) {
    return;
  }

  // GUARD 3: Skip if focus already in post stream
  const activeElement = document.activeElement;
  if (activeElement && this.element.contains(activeElement)) {
    return;
  }
  // ... proceed with auto-focus
}
```

---

## Potential Code Simplifications

Now that we know the true root cause, some previous fixes may be unnecessary:

### Consider Keeping
1. **Instant scroll** (`behavior: "instant"`) - Reduces animation-related issues
2. **Post-number-based navigation** - More robust than index-based
3. **Initial tabindex setup only once** - Cleaner architecture

### Consider Removing/Simplifying
1. **Microtask-based navigation guards** - May be overkill now
2. **Timestamp-based guards in handleFocusIn** - The cross-modifier issue is now fixed at source
3. **Excessive console logging** - Can be reduced/removed for production

### Still Needed
1. **Cloaking prevention** - Still needed for virtualization
2. **Directional fallback** - Still needed for cloaked row handling

---

## Key Debugging Technique

The breakthrough came from adding a **global focus listener with call stacks**:

```javascript
handleGlobalFocusIn(event) {
  const stack = new Error().stack;
  console.log(`[A11Y-GLOBAL-FOCUS]   CALL STACK: ${stack}`);
}
document.addEventListener("focusin", this.handleGlobalFocusIn, true);
```

This captured ALL focus events on the page, not just those in our element, revealing the true source of focus changes.

---

## Lessons Learned

1. **Multiple navigation modifiers can interfere** - Each auto-focusing modifier needs to check if focus is already in another navigation region

2. **Console log call stacks are invaluable** - Using `new Error().stack` helped identify the actual source of focus changes

3. **The bug might not be where you think** - We spent sessions optimizing post-stream-navigation when the problem was in grid-navigation

4. **Class names in minified code help** - Different class names (`u` vs `a`) in call stacks proved different instances

5. **Guard the source, not just the receiver** - Fixing grid-navigation to not steal focus is cleaner than having post-stream-navigation try to block it

---

## Files Modified

- `frontend/discourse/app/modifiers/grid-navigation.js` - Added focus-check guard
- `frontend/discourse/app/modifiers/post-stream-navigation.js` - Added additional guards to focusFirstUnreadPost

---

## Status

**ATTEMPT 10 DEPLOYED - ADDITIONAL ISSUES FOUND**

Attempt 10 (blocking grid-navigation from stealing focus) was deployed. Testing revealed TWO additional root causes:

1. **focusFirstUnreadPost guard failure** - Guards didn't cover "navigate TO header" case
2. **restoreFocusState bouncing** - Focus-history service steals focus 100ms after navigation

See **Attempt 11** in `docs/bugs/focus-jumping-fix-history.md` for the complete fix.

---

## Additional Root Causes (Discovered After Attempt 10)

### Root Cause 2: focusFirstUnreadPost Guard Logic Flaw

The guards in `focusFirstUnreadPost()` were designed for when user navigates AWAY from header:

```javascript
// GUARD 1: Skip if activeRowId !== "header"
// GUARD 3: Skip if focus is in post stream (INVERTED LOGIC!)
```

But when user navigates TO header:
- `activeRowId === "header"` → GUARD 1 passes
- Focus IS in post stream → GUARD 3 passes (logic was inverted - should have ABORTED)

**Fix:** Add `_userHasInteractedWithStream` flag that's set on ANY user interaction and checked as GUARD 0.

### Root Cause 3: restoreFocusState Unconditional Focus

The focus-history service fires `restoreFocusState()` 100ms after navigation:

```javascript
// In focus-history-tracking.js
setTimeout(() => {
  focusHistory.restoreFocusState(location.href);  // Fires unconditionally!
}, 100);
```

If user has already focused something within that 100ms, this steals focus back to the saved position.

**Fix:** Add focus check at start of `restoreFocusState()` - abort if `document.activeElement` is not body.

---

## Complete Root Cause Summary

The focus jumping bug had **THREE distinct root causes**:

| Root Cause | Discovered In | Fixed In |
|------------|---------------|----------|
| Multiple navigation modifiers competing for focus | Attempt 10 | Attempt 10 |
| focusFirstUnreadPost firing after user navigated to header | Attempt 11 | Attempt 11 |
| restoreFocusState stealing focus after user started navigating | Attempt 11 | Attempt 11 |

All three required separate fixes. The bug manifested as a single symptom (focus jumping) but had multiple independent causes.
