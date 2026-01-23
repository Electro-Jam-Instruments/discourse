# Focus Jumping Fix Proposal - Attempt 11

## Executive Summary

After ULTRATHINK analysis of the console log evidence, we identified **TWO REMAINING ISSUES** that the previous fix (blocking grid-navigation from stealing focus) did NOT address:

1. **Issue 1: `focusFirstUnreadPost` Guard Failure** - The callback still fires and steals focus when user navigates TO the header row
2. **Issue 2: `restoreFocusState` Bouncing** - The focus-history service causes focus to bounce 6 times between posts

Both issues stem from **external code calling `element.focus()` on posts** AFTER the user has intentionally navigated elsewhere.

---

## Issue 1: focusFirstUnreadPost Guard Failure

### Console Log Evidence

```
focusRowByElement: newRowId=header, prevActiveRowId=1
focusFirstUnreadPost: lastRead=9, targetPost=10, targetIndex=-1, rows.length=4
focusFirstUnreadPost: target not found, using fallbackIndex=1
```

The user pressed Up Arrow to navigate TO the header row. Then `focusFirstUnreadPost` STILL FIRED and moved focus to post 1.

### Root Cause Analysis

#### Current Guards (Lines 169-189 in post-stream-navigation.js):

```javascript
focusFirstUnreadPost(lastReadPostNumber) {
  // GUARD 1: Don't auto-focus if user has already started navigating away from header
  if (this.activeRowId !== "header") {
    return;
  }

  // GUARD 2: Don't auto-focus if user has navigated recently
  const msSinceNav = performance.now() - this._navigationTimestamp;
  if (this._navigationTimestamp > 0 && msSinceNav < NAVIGATION_GUARD_MS * 2) {
    return;
  }

  // GUARD 3: Don't auto-focus if focus is already somewhere useful in the post stream
  const activeElement = document.activeElement;
  if (activeElement && this.element.contains(activeElement)) {
    return;
  }
  // ... rest of function
}
```

#### Why Each Guard Failed:

| Guard | Condition | Failure Reason |
|-------|-----------|----------------|
| GUARD 1 | `activeRowId !== "header"` | PASSES when user navigates TO header (activeRowId IS "header") |
| GUARD 2 | `msSinceNav < 300ms` | PASSES because RAF + afterRender scheduling means 100ms+ has passed |
| GUARD 3 | `this.element.contains(activeElement)` | This guard is INVERTED - it aborts when focus is IN the stream, but the user IS in the stream (at header) |

#### The Fundamental Problem

The guards were designed for the scenario: **user navigated AWAY from header** (e.g., to post 3).

But the NEW scenario is: **user navigated TO header** (from post 1).

In both cases:
- `activeRowId === "header"` (GUARD 1 passes)
- Focus IS in the post stream (GUARD 3 logic is inverted - should ABORT but doesn't)

### Deep Dive: What Should Happen?

**Intent of `focusFirstUnreadPost`:**
- Purpose: Help keyboard users land on meaningful content when entering a topic
- Trigger: First load of post stream, keyboard mode active
- Target: First unread post (or post 1 if all read)

**When should it run?**
- ONLY on **initial page load**, before user has interacted with the post stream
- NOT after user has started navigating (even if they returned to header)

**When should it abort?**
- If user has navigated at ALL in the post stream (regardless of current position)
- If user clicked/tapped anywhere
- If focus is anywhere meaningful (not body)

### Proposed Solution: Track "User Has Interacted" State

The core issue is using `activeRowId` and timestamps as proxies for "has user started navigating?". These are insufficient because:
- `activeRowId` can be "header" even after navigation (if user navigated back)
- Timestamps decay - the callback may fire minutes later on slow loads

**Better approach:** Track a boolean `_userHasInteracted` flag.

---

## Issue 2: restoreFocusState Bouncing

### Console Log Evidence

```
handleFocusIn: STATE CHANGE 1 --> 4
  - CALL STACK: ...at r.restoreFocusState (chunk...js:250:12029)
handleFocusIn: STATE CHANGE 4 --> 1
handleFocusIn: STATE CHANGE 1 --> 4
handleFocusIn: STATE CHANGE 4 --> 1
handleFocusIn: STATE CHANGE 1 --> 4
handleFocusIn: STATE CHANGE 4 --> 1
```

Focus bounced SIX TIMES between posts 1 and 4.

### Root Cause Analysis

#### The restoreFocusState Code (focus-history.js):

```javascript
restoreFocusState(url) {
  const state = this.focusStack.get(url);
  if (!state || !state.keyboardMode) {
    return false;
  }
  try {
    const element = document.querySelector(state.selector);
    if (element) {
      element.focus();  // <-- This steals focus unconditionally!
      return true;
    }
  } catch (e) {
    console.warn("Focus restoration failed...");
  }
  return false;
}
```

#### The Caller (focus-history-tracking.js):

```javascript
window.navigation.addEventListener("navigatesuccess", () => {
  requestAnimationFrame(() => {
    setTimeout(() => {
      focusHistory.restoreFocusState(location.href);  // Fires 100ms after navigation
    }, 100);
  });
});
```

#### Why It Causes Bouncing

**Scenario:**
1. User was focused on post 4, navigated to a topic
2. User presses browser back
3. `navigatesuccess` fires, schedules `restoreFocusState()` for 100ms later
4. User starts navigating with arrow keys, focus on post 1
5. 100ms passes, `restoreFocusState()` fires
6. It finds saved state for post 4 and calls `element.focus()`
7. Our `handleFocusIn` sees the change, updates state
8. BUT the saved state selector may match MULTIPLE elements or have side effects
9. Focus bounces back and forth

**The deeper issue:** `restoreFocusState` fires based on URL, not based on whether the user WANTS focus restored.

### When Should Focus Restoration Run?

**Intent of focus restoration:**
- Purpose: Return keyboard users to their previous position when using browser back/forward
- Trigger: Browser back/forward navigation (Alt+Left/Right or browser buttons)
- Target: Element that was focused before navigating away

**When should it run?**
- ONLY immediately after browser back/forward
- ONLY if user hasn't already interacted with the page
- ONLY if focus is on body/undefined (not if user already has focus somewhere)

**When should it abort?**
- If user has started interacting (keypress, click) after navigation completed
- If focus is already somewhere meaningful in the page
- If the page has changed significantly (target element gone)

---

## Detailed Fix Options Analysis

### Issue 1 Fix Options

#### Option A: Add "User Interacted" Boolean Flag (RECOMMENDED)

**Approach:** Track whether user has interacted with the post stream at all.

```javascript
// New property
_userHasInteractedWithStream = false;

// Set on any navigation or focus change
focusRowByElement(row) {
  this._userHasInteractedWithStream = true;
  // ... existing code
}

handleFocusIn(event) {
  this._userHasInteractedWithStream = true;
  // ... existing code
}

// Guard in focusFirstUnreadPost
focusFirstUnreadPost(lastReadPostNumber) {
  // GUARD: User has already interacted - don't auto-focus
  if (this._userHasInteractedWithStream) {
    console.log(`[A11Y-NAV] focusFirstUnreadPost: ABORTED - user already interacted`);
    return;
  }

  // ... rest of function
}
```

**Pros:**
- Simple, clear intent
- No timing issues - once set, stays set
- Covers ALL interaction scenarios (navigation, click, Tab, etc.)

**Cons:**
- Adds another property to track
- Need to ensure it's set in all interaction paths

**Risk Assessment:** LOW - This is purely additive, no changes to existing logic flow.

---

#### Option B: Check Document.activeElement More Thoroughly

**Approach:** Abort if focus is ANYWHERE except body.

```javascript
focusFirstUnreadPost(lastReadPostNumber) {
  // GUARD: Abort if focus is anywhere meaningful (not body)
  const activeElement = document.activeElement;
  if (activeElement && activeElement !== document.body && activeElement !== document.documentElement) {
    console.log(`[A11Y-NAV] focusFirstUnreadPost: ABORTED - focus already on ${activeElement.tagName}`);
    return;
  }
  // ... rest of function
}
```

**Pros:**
- Uses browser's authoritative focus state
- No additional state to track

**Cons:**
- Timing-dependent - focus might be on body during re-render
- Header row IS in the post stream, so "contains" check passes
- May have race conditions with focus transitions

**Risk Assessment:** MEDIUM - May have edge cases where focus is temporarily on body.

---

#### Option C: Use a "Completed Navigation Count" Guard

**Approach:** Track how many navigation actions have occurred.

```javascript
_navigationCount = 0;
_savedNavigationCountAtSchedule = 0;

scheduleInitialFocus(lastReadPostNumber) {
  this.initialFocusComplete = true;
  this._savedNavigationCountAtSchedule = this._navigationCount;

  schedule("afterRender", () => {
    requestAnimationFrame(() => {
      // GUARD: Navigation occurred since scheduling
      if (this._navigationCount > this._savedNavigationCountAtSchedule) {
        console.log(`[A11Y-NAV] focusFirstUnreadPost: ABORTED - navigation occurred since schedule`);
        return;
      }
      this.focusFirstUnreadPost(lastReadPostNumber);
    });
  });
}

focusRowByElement(row) {
  this._navigationCount++;
  // ... existing code
}
```

**Pros:**
- Very precise - counts exact navigation events
- Handles the "navigate, then return to header" case

**Cons:**
- More complex
- Navigation count might wrap (unlikely in practice)

**Risk Assessment:** MEDIUM - More moving parts.

---

### Issue 2 Fix Options

#### Option A: Check Focus Before Restoring (RECOMMENDED)

**Approach:** Only restore if focus is on body.

```javascript
// In focus-history.js
restoreFocusState(url) {
  // GUARD: Don't restore if user already has focus somewhere
  const currentFocus = document.activeElement;
  if (currentFocus && currentFocus !== document.body && currentFocus !== document.documentElement) {
    console.log(`[Focus History] restoreFocusState: ABORTED - focus already on ${currentFocus.tagName}`);
    return false;
  }

  const state = this.focusStack.get(url);
  if (!state || !state.keyboardMode) {
    return false;
  }

  try {
    const element = document.querySelector(state.selector);
    if (element) {
      element.focus();
      return true;
    }
  } catch (e) {
    console.warn("Focus restoration failed for selector:", state.selector, e);
  }

  return false;
}
```

**Pros:**
- Simple, direct check
- Respects user's current focus choice
- No coordination needed between services

**Cons:**
- Race condition if focus is temporarily on body during render

**Risk Assessment:** LOW - Standard pattern for focus restoration.

---

#### Option B: Track "User Interaction After Navigation" in Focus History Service

**Approach:** Clear saved state on first user interaction after navigation.

```javascript
// In focus-history.js
@tracked _interactionAfterNavigation = false;

// In focus-history-tracking.js
window.navigation.addEventListener("navigatesuccess", () => {
  focusHistory._interactionAfterNavigation = false;  // Reset

  requestAnimationFrame(() => {
    setTimeout(() => {
      if (!focusHistory._interactionAfterNavigation) {
        focusHistory.restoreFocusState(location.href);
      }
    }, 100);
  });
});

// Track interactions
document.addEventListener("keydown", () => {
  focusHistory._interactionAfterNavigation = true;
}, { capture: true });

document.addEventListener("mousedown", () => {
  focusHistory._interactionAfterNavigation = true;
}, { capture: true });
```

**Pros:**
- Very explicit about intent
- Handles case where user starts navigating before 100ms timeout

**Cons:**
- More complex
- keydown/mousedown listeners already exist for keyboardMode tracking

**Risk Assessment:** MEDIUM - Adds complexity but handles edge cases better.

---

#### Option C: Coordinate via Service Communication

**Approach:** Post-stream-navigation informs focus-history service when it's handling navigation.

```javascript
// In post-stream-navigation.js
@service focusHistory;

focusRowByElement(row) {
  // Tell focus-history we're handling focus
  this.focusHistory.activeNavigationRegion = 'post-stream';
  // ... existing code
}

// In focus-history.js
restoreFocusState(url) {
  // GUARD: Another component is handling focus
  if (this.activeNavigationRegion) {
    console.log(`[Focus History] restoreFocusState: DEFERRED to ${this.activeNavigationRegion}`);
    return false;
  }
  // ... existing code
}
```

**Pros:**
- Explicit coordination
- Can be extended for multiple navigation regions

**Cons:**
- Tight coupling between services
- Need to clear `activeNavigationRegion` at right time

**Risk Assessment:** MEDIUM-HIGH - Introduces coupling.

---

#### Option D: Remove the 100ms Delay and Use MutationObserver

**Approach:** Instead of arbitrary timeout, wait for DOM to stabilize.

```javascript
window.navigation.addEventListener("navigatesuccess", () => {
  // Wait for DOM to stabilize
  const observer = new MutationObserver((mutations, obs) => {
    obs.disconnect();
    // Check if focus is still on body
    if (document.activeElement === document.body) {
      focusHistory.restoreFocusState(location.href);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Fallback timeout
  setTimeout(() => {
    observer.disconnect();
  }, 500);
});
```

**Pros:**
- No arbitrary timing
- DOM-driven

**Cons:**
- MutationObserver can fire many times
- More complex
- Still needs focus check

**Risk Assessment:** MEDIUM-HIGH - Complexity vs. minimal benefit.

---

## Recommended Solution

### For Issue 1: Option A - User Interaction Flag

**Implementation:**

```javascript
// In post-stream-navigation.js

// NEW PROPERTY - tracks if user has interacted with the stream
_userHasInteractedWithStream = false;

// Set flag on ANY user interaction
focusRowByElement(row) {
  this._userHasInteractedWithStream = true;  // ADD THIS
  // ... existing code
}

handleFocusIn(event) {
  // Only set interaction flag if this is a user-initiated focus
  // (not blocked by navigation guards)
  if (!this._isNavigating) {
    this._userHasInteractedWithStream = true;  // ADD THIS
  }
  // ... existing code
}

// UPDATE the guard in focusFirstUnreadPost
focusFirstUnreadPost(lastReadPostNumber) {
  // GUARD 0 (NEW): User has already interacted with the stream
  if (this._userHasInteractedWithStream) {
    console.log(`[A11Y-NAV] focusFirstUnreadPost: ABORTED - user already interacted with stream`);
    return;
  }

  // GUARD 1: Don't auto-focus if user has already started navigating away from header
  if (this.activeRowId !== "header") {
    console.log(`[A11Y-NAV] focusFirstUnreadPost: ABORTED - user already navigated to ${this.activeRowId}`);
    return;
  }

  // ... rest of guards and logic
}
```

**Justification:**
- The flag is set BEFORE any navigation action completes
- Covers arrow key navigation, mouse clicks, Tab focus, everything
- Once set, never cleared (for this page load) - no timing issues
- Simple to reason about

---

### For Issue 2: Option A - Check Focus Before Restoring

**Implementation:**

```javascript
// In focus-history.js

restoreFocusState(url) {
  // GUARD (NEW): Don't restore if user already has focus somewhere meaningful
  const currentFocus = document.activeElement;
  if (currentFocus &&
      currentFocus !== document.body &&
      currentFocus !== document.documentElement) {
    console.log(`[Focus History] restoreFocusState: ABORTED - focus already on ${currentFocus.tagName}`);
    return false;
  }

  const state = this.focusStack.get(url);
  if (!state || !state.keyboardMode) {
    return false;
  }

  try {
    const element = document.querySelector(state.selector);
    if (element) {
      element.focus();
      return true;
    }
  } catch (e) {
    console.warn("Focus restoration failed for selector:", state.selector, e);
  }

  return false;
}
```

**Justification:**
- Standard pattern for focus restoration
- If user already has focus somewhere, they've made an intentional choice
- No coordination needed - just respects browser's focus state
- Handles all edge cases where user interacted before 100ms timeout

---

## Combined Fix Summary

### File 1: post-stream-navigation.js

**Changes:**
1. Add `_userHasInteractedWithStream = false;` property
2. Set flag in `focusRowByElement()` and `handleFocusIn()`
3. Add GUARD 0 to `focusFirstUnreadPost()` checking the flag

### File 2: focus-history.js

**Changes:**
1. Add focus check at start of `restoreFocusState()`
2. Abort if `document.activeElement` is not body

---

## Edge Cases Analysis

### Edge Case 1: User Tabs Into Stream, Then Browser Back

**Scenario:**
1. User Tabs into post stream (sets `_userHasInteractedWithStream = true`)
2. User clicks a link to navigate away
3. User presses Alt+Left to go back
4. `focusFirstUnreadPost` scheduled again (new page load)

**Expected Behavior:** This is a NEW page load, so `_userHasInteractedWithStream` should be `false` again.

**Why It Works:** The modifier is re-instantiated on page change, so all properties reset.

---

### Edge Case 2: Focus on Body During Ember Re-render

**Scenario:**
1. User is focused on post 4
2. Ember re-renders, briefly moves focus to body
3. `restoreFocusState` runs during this window
4. Might restore to old saved position

**Expected Behavior:** Should NOT restore if re-render is transient.

**Why It Works:** The 100ms timeout in `focus-history-tracking.js` means Ember re-render should complete before restoration runs. If focus is back on a post by then, the guard will abort.

---

### Edge Case 3: Multiple Rapid Browser Back/Forward

**Scenario:**
1. User presses Alt+Left rapidly 3 times
2. Each triggers `navigatesuccess` and schedules restoration
3. Multiple restoration calls queued

**Expected Behavior:** Only the relevant one should execute.

**Why It Works:** Each restoration checks current focus. Once one restores focus (or user lands somewhere), the others see focus is not on body and abort.

---

### Edge Case 4: Post Stream Loads Slowly

**Scenario:**
1. User navigates to topic via keyboard
2. Post stream takes 2 seconds to load
3. User waits patiently
4. `focusFirstUnreadPost` should run

**Expected Behavior:** Auto-focus should work if user hasn't interacted.

**Why It Works:** Flag is only set on interaction, not on time. Passive waiting doesn't set the flag.

---

## Implementation Confidence

| Issue | Fix | Confidence | Risk |
|-------|-----|------------|------|
| Issue 1 (focusFirstUnreadPost) | User interaction flag | 95% | LOW |
| Issue 2 (restoreFocusState) | Focus check guard | 90% | LOW |
| Combined | Both fixes together | 92% | LOW |

**Why High Confidence:**
- Both fixes are additive (new guards, not changes to existing logic)
- Both use standard patterns (interaction flags, focus checks)
- Both have clear abort conditions with logging
- No timing dependencies between the fixes

---

## Testing Plan

### Test Case 1: Navigate TO Header

1. Open a topic
2. Wait for auto-focus to land on first unread
3. Press Up Arrow repeatedly until at header
4. Verify focus stays on header (no jump to post 1)

**Expected Log:**
```
focusRowByElement: newRowId=header, prevActiveRowId=1
focusFirstUnreadPost: ABORTED - user already interacted with stream
```

---

### Test Case 2: Browser Back Focus Restoration

1. Focus on a topic row in topic list
2. Press Enter to open topic
3. Navigate to post 5 using arrow keys
4. Press Alt+Left to go back to topic list
5. Press Alt+Right to return to topic
6. Verify focus goes to post 5 (restored) OR stays where it was

**Expected Log (if focus already on something):**
```
restoreFocusState: ABORTED - focus already on ARTICLE
```

**Expected Log (if focus on body):**
```
restoreFocusState: restored focus to post 5
```

---

### Test Case 3: No Bouncing

1. Open a topic
2. Navigate with arrow keys
3. Monitor console for `handleFocusIn: STATE CHANGE` patterns
4. Verify no bouncing (should see sequential changes only)

**Bad Pattern (what we're fixing):**
```
handleFocusIn: STATE CHANGE 1 --> 4
handleFocusIn: STATE CHANGE 4 --> 1
handleFocusIn: STATE CHANGE 1 --> 4
```

**Good Pattern (expected after fix):**
```
focusRowByElement: newRowId=2
focusRowByElement: newRowId=3
focusRowByElement: newRowId=4
```

---

## Rollback Plan

If the fix causes new issues:

1. **For Issue 1:** Remove the `_userHasInteractedWithStream` check in `focusFirstUnreadPost()` - this just re-enables the old behavior

2. **For Issue 2:** Remove the focus check in `restoreFocusState()` - this just re-enables unconditional restoration

Both changes are isolated and can be reverted independently.

---

## Files to Modify

| File | Change Type | Lines Changed |
|------|-------------|---------------|
| `frontend/discourse/app/modifiers/post-stream-navigation.js` | Add property, modify 2 methods, add guard | ~15 lines |
| `frontend/discourse/app/services/focus-history.js` | Add guard | ~8 lines |

---

## References

- Previous fix history: `docs/bugs/focus-jumping-fix-history.md`
- Root cause analysis: `docs/research/focus-jumping-root-cause-analysis.md`
- Focus history design: `docs/accessibility/12-focus-history-restoration.md`
- Auto-focus design: `docs/accessibility/14-auto-focus-first-unread.md`
