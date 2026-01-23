# Focus Jumping Bug - Complete Fix History

## Problem Statement

When navigating posts with arrow keys in the post stream, focus jumps unexpectedly to different posts instead of moving sequentially. This makes keyboard navigation unusable for screen reader users.

---

## Fix Attempt Timeline

### Attempt 1: Directional Cloaking Fallback
**Commit:** `489b991b23`
**Date:** 2026-01-19
**Status:** PARTIALLY FIXED

**Problem Addressed:** When the currently focused post gets cloaked (virtualized), the fallback logic would find the "closest" visible post, which might be in the wrong direction.

**Solution:** Added `_lastNavigationDirection` flag (-1 for up, 1 for down, 0 for no preference) to find fallback posts in the correct direction.

**Result:** Helped with directional consistency but didn't fix the core race condition.

---

### Attempt 2: Debug Logging
**Commits:** `0f44ac4401`, `8284f3617c`
**Date:** 2026-01-19
**Status:** DIAGNOSTIC ONLY

**Added console logging to:**
- `focusRow()` / `focusRowByElement()`
- `focusNextRow()` / `focusPreviousRow()`
- `handleFocusIn()` / `handleFocusOut()`
- `modify()` lifecycle
- `focusFirstUnreadPost()` scheduled callback

**Result:** Revealed multiple race conditions in the logs.

---

### Attempt 3: Scheduled Callback Guard
**Commit:** `cde6f1b99e`
**Date:** 2026-01-19
**Status:** FIXED THIS SPECIFIC BUG

**Problem Addressed:** `focusFirstUnreadPost()` was scheduled via `schedule("afterRender")` + `requestAnimationFrame` and could fire AFTER user started navigating, stealing focus mid-navigation.

**Solution:** Added guard to abort if `activeRowId !== "header"`:
```javascript
focusFirstUnreadPost(lastReadPostNumber) {
  if (this.activeRowId !== "header") {
    console.log(`[A11Y-NAV] focusFirstUnreadPost: ABORTED - user already navigated to ${this.activeRowId}`);
    return;
  }
  // ... rest of function
}
```

**Result:** Fixed the scheduled callback interference, but other race conditions remained.

---

### Attempt 4: Pre-captured Rows Array
**Commit:** `cde6f1b99e` (same commit)
**Date:** 2026-01-19
**Status:** PARTIALLY FIXED

**Problem Addressed:** The `this.rows` getter queries the DOM each time it's called. If cloaking changes between capturing rows and using them, indices become invalid.

**Solution:** Capture rows once at navigation start and pass through all methods:
```javascript
focusNextRow() {
  const rows = this.rows; // Capture ONCE
  const currentIndex = this.getActiveRowIndex(rows);
  // ... use same rows array throughout
}
```

**Result:** Reduced race conditions but didn't eliminate them entirely.

---

### Attempt 5: Navigation Guard with Microtask Timing
**Commit:** `caac5650df`
**Date:** 2026-01-22
**Status:** PARTIALLY FIXED

**Problem Addressed:** `modify()` runs on every Ember re-render (including cloaking changes) and was calling `updateTabindices()` which corrupted navigation state.

**Solution:** Added `_isNavigating` flag cleared via `queueMicrotask()`:
```javascript
focusRowWithArray(rows, index) {
  this._isNavigating = true;
  try {
    // ... focus operations
    row.focus();
    this.scrollRowIntoView(row);
  } finally {
    queueMicrotask(() => {
      this._isNavigating = false;
    });
  }
}

modify(element, positional, named) {
  if (this._isNavigating) {
    return; // Skip tabindex updates during navigation
  }
  // ...
}
```

**Why microtask timing:** JavaScript execution order is:
1. Current synchronous code completes
2. Microtasks run (Promise.then, queueMicrotask)
3. Next macrotask (setTimeout, new events)

The flag stays true until AFTER any synchronously-triggered `modify()` runs.

**Result:** Helped during active navigation but didn't protect against post-navigation cloaking events.

---

### Attempt 6: Remove modify() tabindex updates entirely
**Commit:** `567d9879e6`
**Date:** 2026-01-22
**Status:** CORE FIX

**Problem Addressed:** The `modify()` method runs on EVERY Ember re-render. Even with guards, it was still causing issues because cloaking events happen continuously during scrolling.

**Solution:** Removed ALL tabindex updates from `modify()` body - only run once during initial setup:
```javascript
modify(element, positional, named) {
  if (this.element !== element) {
    // SETUP - only runs once when modifier first attaches
    this.cleanup();
    this.element = element;
    // ... setup listeners ...

    // CRITICAL: Only set up tabindices ONCE during initial setup
    console.log(`[A11Y-NAV] modify(): SETUP - running initial tabindex setup`);
    this.updateTabindices();
    this.setInternalTabindices();
  }

  this.options = { ...this.options, ...named };

  // IMPORTANT: NO tabindex updates on re-renders
}
```

**Result:** Eliminated the modify() race condition entirely. Tabindices now only updated by:
1. Initial setup (once)
2. `focusRowByElement()` during keyboard navigation
3. `handleFocusIn()` for mouse/Tab focus

---

### Attempt 7: Pure Post-Number Navigation
**Commit:** `567d9879e6` (same commit)
**Date:** 2026-01-22
**Status:** ARCHITECTURAL IMPROVEMENT

**Problem Addressed:** Index-based navigation is fragile because indices change when rows are cloaked/uncloaked.

**Solution:** Navigate by post number instead of array index:
```javascript
focusNextRow() {
  const rows = this.rows;
  this._lastNavigationDirection = 1;

  // Find current row BY POST NUMBER directly
  const currentRow = this.findRowByPostNumber(rows, this.activeRowId);

  if (currentRow) {
    // Current row is visible - get next in array
    const currentIndex = rows.indexOf(currentRow);
    const nextIndex = currentIndex + 1;
    if (nextIndex < rows.length) {
      this.focusRowByElement(rows[nextIndex]);
    }
  } else {
    // Current row is cloaked - find proxy in navigation direction
    const proxy = this.findProxyRow(rows, this.activeRowId, 1);
    if (proxy) {
      this.focusRowByElement(proxy);
    }
  }
}
```

New helper methods:
- `findRowByPostNumber(rows, postNumber)` - Direct lookup by post number
- `findProxyRow(rows, targetPostNumber, direction)` - Find best visible row when target is cloaked
- `focusRowByElement(row)` - Core focus method all navigation uses

**Result:** More robust navigation that doesn't depend on volatile array indices.

---

### Attempt 8: Instant Scroll (Remove Smooth Animation)
**Commit:** `2f04e67d4a`
**Date:** 2026-01-22
**Status:** CORE FIX

**Problem Addressed:** `scrollRowIntoView()` used `behavior: "smooth"` which takes ~300ms. During animation:
1. IntersectionObserver callbacks fire
2. Cloaking boundaries change
3. Ember re-renders
4. Race condition window during entire animation

**Solution:** Change to instant scroll:
```javascript
scrollRowIntoView(row) {
  // ...
  if (rowRect.top < scrollMarginTop) {
    const scrollY = window.scrollY + rowRect.top - scrollMarginTop;
    // CRITICAL: Use instant scroll to avoid race conditions
    window.scrollTo({ top: scrollY, behavior: "instant" });
  } else if (rowRect.bottom > viewportHeight) {
    const scrollY = window.scrollY + rowRect.bottom - viewportHeight + 20;
    // CRITICAL: Use instant scroll to avoid race conditions
    window.scrollTo({ top: scrollY, behavior: "instant" });
  }
}
```

**Result:** Eliminated the 300ms race condition window. Scroll completes synchronously.

---

### Attempt 9: Block External Focus Changes in handleFocusIn
**Commit:** `c8e21dd9e0`
**Date:** 2026-01-22
**Status:** DID NOT FIX

**Problem Addressed:** Console logs showed `handleFocusIn: 1 → 9` - something OUTSIDE our navigation code was moving focus (likely Discourse's scroll-to-post or NVDA). This corrupted navigation state.

**Solution:** Use `_isNavigating` flag to block `handleFocusIn` during keyboard navigation:
```javascript
handleFocusIn(event) {
  const row = event.target.closest(this.options.rowSelector);

  if (row) {
    const newRowId = this.getRowId(row);
    if (newRowId && newRowId !== this.activeRowId) {
      // GUARD: Skip state update during keyboard navigation
      if (this._isNavigating) {
        console.log(`[A11Y-NAV] handleFocusIn: BLOCKED ${this.activeRowId} → ${newRowId} (navigation in progress)`);
        return;
      }
      // ... rest of state update
    }
  }
}
```

The `_isNavigating` flag is:
- Set `true` at start of `focusRowByElement()`
- Cleared via `queueMicrotask()` after focus/scroll complete

**Result:** Focus jumping still occurs. The microtask timing may not be sufficient to catch all external focus changes, or the root cause is elsewhere.

---

## Current State of the Code

### Key Properties
```javascript
activeRowId = "header";           // Track by post number, not index
activeFocusableIndex = -1;        // -1 = row itself focused
inDocumentMode = false;           // For reading post content
initialFocusComplete = false;     // Guard for auto-focus
_preventedCloakingPostId = null;  // Cloaking prevention
_lastNavigationDirection = 0;     // -1=up, 1=down, 0=none
_isNavigating = false;            // Navigation guard flag
```

### Key Methods
- `focusRowByElement(row)` - Core focus method with navigation guard
- `focusNextRow()` / `focusPreviousRow()` - Pure post-number navigation
- `findRowByPostNumber(rows, postNumber)` - Direct row lookup
- `findProxyRow(rows, targetPostNumber, direction)` - Cloaked row fallback
- `handleFocusIn(event)` - Mouse/Tab focus tracking with navigation guard
- `scrollRowIntoView(row)` - Instant scroll (no animation)

### What modify() Does Now
```javascript
modify(element, positional, named) {
  if (this.element !== element) {
    // SETUP ONLY - runs once
    this.updateTabindices();
    this.setInternalTabindices();
  }
  // NO tabindex updates on re-renders
}
```

---

## Known Remaining Issues

1. **External focus changes** - Discourse's scroll-to-post, NVDA, or other code calling `focus()` directly can still interfere if it happens BETWEEN keystrokes (when `_isNavigating=false`)

2. **Header row edge cases** - The header row has `rowId="header"` instead of a numeric post number, which requires special handling in several places

3. **J/K keyboard shortcuts** - Discourse's built-in J/K navigation bypasses our modifier entirely (LOW priority - screen reader users use arrow keys)

---

## Debugging Tips

### Console Log Patterns

**Good navigation (sequential):**
```
focusNextRow: VISIBLE - index 0 → 1
focusRowByElement: newRowId=1, prevActiveRowId=header
focusNextRow: VISIBLE - index 1 → 2
focusRowByElement: newRowId=2, prevActiveRowId=1
```

**Bad navigation (focus jumping):**
```
focusNextRow: VISIBLE - index 0 → 1
handleFocusIn: 1 → 9, direction was -1, resetting to 0  ← EXTERNAL FOCUS CHANGE
focusPreviousRow: VISIBLE - index 6 → 5  ← INDEX MISMATCH
```

**Navigation guard working:**
```
focusRowByElement: newRowId=2, prevActiveRowId=1
handleFocusIn: BLOCKED 2 → 5 (navigation in progress)  ← BLOCKED!
```

### Key Things to Watch
1. `handleFocusIn` changing state unexpectedly
2. Index numbers not matching post numbers
3. `modify()` running during navigation (shouldn't update tabindices)
4. `focusFirstUnreadPost: ABORTED` appearing (guard working)

---

## Files Modified

- `frontend/discourse/app/modifiers/post-stream-navigation.js` - Main navigation modifier
- `frontend/discourse/app/modifiers/post-stream-viewport-tracker.js` - Cloaking prevention API
- `docs/bugs/focus-jumping-session-2026-01-19.md` - Original session notes
- `docs/research/ultrathink-header-analysis-*.md` - ULTRATHINK agent analysis

---

---

### Attempt 10: Block grid-navigation from stealing focus
**Commit:** `b00f793693`
**Date:** 2026-01-22
**Status:** DEPLOYED - TESTING

**Problem Addressed:** Console logs with call stacks revealed the TRUE root cause: The `grid-navigation` modifier on the **suggested topics grid** (at bottom of topic pages) was calling `focusRow()` and stealing focus from the post stream.

**The sequence captured in logs:**
1. User navigates to header row in post stream
2. Scrolling triggers Ember re-render of suggested topics grid
3. Suggested topics' `grid-navigation.modify()` sees `keyboardMode=true` and `initialFocusComplete=false`
4. It calls `scheduleInitialFocus()` → `focusRow()` via requestAnimationFrame
5. Focus stolen to suggested topics grid
6. Then `focusFirstUnreadPost` fires and moves focus to post 1

**Solution:** Two-part fix:

1. **grid-navigation.js** - Check if focus is already in another navigation region before auto-focusing:
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

      if ((inOtherGrid && inOtherGrid !== this.element) || inPostStream || inToolbar || inTree) {
        return; // Don't steal focus
      }
    }
    // ... proceed with auto-focus
  });
}
```

2. **post-stream-navigation.js** - Add multiple guards to `focusFirstUnreadPost()`:
   - GUARD 1: Skip if `activeRowId !== "header"` (existing)
   - GUARD 2: Skip if recent navigation (timestamp check)
   - GUARD 3: Skip if focus already in post stream

**Result:** Deployed, awaiting testing.

---

## Summary: Current Status (2026-01-22)

**STATUS: FIX DEPLOYED - TESTING IN PROGRESS**

Root cause identified via console log analysis with call stacks. The focus jumping was NOT caused by:
- Cloaking/virtualization directly
- IntersectionObserver timing
- Ember re-render race conditions
- NVDA moving focus

**The actual root cause:** Multiple grid-navigation instances on the same page competing for focus. When scrolling in the post stream brought the suggested topics grid into view, its auto-focus logic would fire and steal focus.

### What We Learned

- The `modify()` lifecycle runs on EVERY Ember re-render, not just when args change
- Multiple navigation modifiers on the same page can interfere with each other
- Auto-focus logic needs to check if focus is already in a navigation region
- Call stack logging (`new Error().stack`) was crucial for identifying the true source
- The issue was NOT timing/race conditions - it was architectural (multiple competing modifiers)

### Key Debugging Technique

Added `handleGlobalFocusIn` to capture ALL focus events with call stacks:
```javascript
handleGlobalFocusIn(event) {
  const stack = new Error().stack;
  console.log(`[A11Y-GLOBAL-FOCUS]   CALL STACK: ${stack}`);
}
document.addEventListener("focusin", this.handleGlobalFocusIn, true);
```

This revealed `a.focusRow` at a DIFFERENT line number than `u.focusRowByElement`, proving it was a different modifier instance.

---

### Attempt 11: User Interaction Flag + Focus Check Guards
**Commit:** `765a3a9fb4`
**Date:** 2026-01-22
**Status:** ✅ FIXED - VERIFIED BY USER TESTING

**Problem Addressed:** Console log analysis after Attempt 10 deployment revealed TWO remaining issues:

1. **Issue 1: `focusFirstUnreadPost` guard failure** - When user navigates TO the header row (not away from it), `activeRowId === "header"` so GUARD 1 passes, and focus IS in post stream so GUARD 3 passes (logic was inverted). The callback would then steal focus to post 1.

2. **Issue 2: `restoreFocusState` bouncing** - The focus-history service fires 100ms after navigation via `setTimeout`. If user started navigating within that 100ms, `restoreFocusState()` would call `element.focus()` unconditionally, causing focus to bounce 6 times between posts.

**Console Evidence:**
```
focusRowByElement: newRowId=header, prevActiveRowId=1
focusFirstUnreadPost: lastRead=9, targetPost=10, targetIndex=-1
focusFirstUnreadPost: target not found, using fallbackIndex=1  ← STEALING FOCUS!

handleFocusIn: STATE CHANGE 1 --> 4
  CALL STACK: ...at r.restoreFocusState (chunk...js:250:12029)
handleFocusIn: STATE CHANGE 4 --> 1
handleFocusIn: STATE CHANGE 1 --> 4  ← BOUNCING!
```

**Solution:** Two-part fix based on ULTRATHINK agent analysis:

1. **post-stream-navigation.js** - Add `_userHasInteractedWithStream` flag:
```javascript
// New property
_userHasInteractedWithStream = false;

// Set on any user interaction
focusRowByElement(row) {
  this._userHasInteractedWithStream = true;  // NEW
  // ... existing code
}

handleFocusIn(event) {
  // Only when not blocked by navigation guards
  this._userHasInteractedWithStream = true;  // NEW
  // ... existing code
}

// New guard in focusFirstUnreadPost
focusFirstUnreadPost(lastReadPostNumber) {
  // GUARD 0 (NEW): User has already interacted with the stream
  if (this._userHasInteractedWithStream) {
    console.log(`[A11Y-NAV] focusFirstUnreadPost: ABORTED - user already interacted with stream`);
    return;
  }
  // ... existing guards
}
```

2. **focus-history.js** - Add focus check guard to `restoreFocusState()`:
```javascript
restoreFocusState(url) {
  // GUARD (NEW): Don't restore if user already has focus somewhere meaningful
  const currentFocus = document.activeElement;
  if (currentFocus &&
      currentFocus !== document.body &&
      currentFocus !== document.documentElement) {
    console.log(`[Focus History] restoreFocusState: ABORTED - focus already on ${currentFocus.tagName}`);
    return false;
  }
  // ... existing code
}
```

**Why These Fixes Work:**
- The `_userHasInteractedWithStream` flag is set BEFORE any navigation action completes
- Once set, it never clears (for this page load) - no timing issues
- The focus check in `restoreFocusState()` respects user's current focus choice
- Both fixes are purely additive - no changes to existing logic flow

**Result:** ✅ SUCCESS - User tested on 2026-01-22 and confirmed focus jumping is no longer reproducible.

---

## What We Kept vs. Removed

### Fixes KEPT (Still Essential)

| Fix | Reason to Keep |
|-----|----------------|
| **Attempt 1: Directional Cloaking Fallback** | Still needed - when target row is cloaked, finds fallback in correct direction |
| **Attempt 4: Pre-captured Rows Array** | Still needed - prevents index drift during navigation |
| **Attempt 5: Navigation Guard (_isNavigating flag)** | Still needed - prevents handleFocusIn from corrupting state during keyboard nav |
| **Attempt 6: Remove modify() tabindex updates** | CRITICAL - prevents Ember re-render race conditions |
| **Attempt 7: Post-Number Navigation** | CRITICAL - stable IDs survive cloaking, unlike array indices |
| **Attempt 8: Instant Scroll** | CRITICAL - eliminates 300ms race condition window |
| **Attempt 9: Timestamp Guard (NAVIGATION_GUARD_MS)** | Still needed - catches IntersectionObserver macrotask delays |
| **Attempt 10: grid-navigation focus check** | CRITICAL - prevents suggested topics grid from stealing focus |

### Fixes ENHANCED (Built Upon)

| Original Fix | Enhancement in Attempt 11 |
|--------------|---------------------------|
| **Attempt 3: focusFirstUnreadPost guard** | Added GUARD 0 (`_userHasInteractedWithStream`) before existing guards |
| **Attempt 9: handleFocusIn blocking** | Added interaction flag setting when focus changes are allowed |

### Nothing Was Removed

All previous fixes address DIFFERENT aspects of the focus jumping problem:
- **Attempts 1, 4, 7:** Handle cloaking/virtualization
- **Attempts 5, 6, 9:** Handle Ember re-render timing
- **Attempt 8:** Handle scroll animation timing
- **Attempt 10:** Handle cross-modifier interference
- **Attempt 11:** Handle auto-focus callbacks that fire after user interaction

The bug had MULTIPLE root causes that each required their own fix. Removing any previous fix would re-introduce that specific failure mode.

---

## Current Architecture Summary

### State Tracking Properties
```javascript
activeRowId = "header";                    // Track by post number (stable across cloaking)
activeFocusableIndex = -1;                 // -1 = row itself focused
inDocumentMode = false;                    // For reading post content
initialFocusComplete = false;              // Guard for auto-focus scheduling
_preventedCloakingPostIds = new Set();     // Cloaking prevention window
_lastNavigationDirection = 0;              // -1=up, 1=down, 0=none (for fallback)
_isNavigating = false;                     // Boolean guard (microtask timing)
_navigationTimestamp = 0;                  // Timestamp guard (macrotask timing)
_userHasInteractedWithStream = false;      // NEW: Permanent interaction flag
```

### Guard Layers

1. **focusRowByElement()** - Sets `_isNavigating=true` + timestamp BEFORE focus
2. **handleFocusIn()** - Dual guard (boolean + timestamp) blocks external focus changes
3. **focusFirstUnreadPost()** - Four guards: interaction flag, activeRowId, timestamp, contains check
4. **grid-navigation.scheduleInitialFocus()** - Checks if focus is in another nav region
5. **focus-history.restoreFocusState()** - Checks if focus is already somewhere meaningful

### Files Modified (All Attempts)

| File | Purpose |
|------|---------|
| `frontend/discourse/app/modifiers/post-stream-navigation.js` | Main navigation modifier |
| `frontend/discourse/app/modifiers/grid-navigation.js` | Suggested topics grid (Attempt 10) |
| `frontend/discourse/app/services/focus-history.js` | Focus restoration service (Attempt 11) |
| `frontend/discourse/app/modifiers/post-stream-viewport-tracker.js` | Cloaking prevention API |

---

## Debugging Reference

### Expected Console Patterns After All Fixes

**Initial page load (no interaction yet):**
```
modify(): SETUP - running initial tabindex setup
modify(): SCHEDULING INITIAL FOCUS
focusFirstUnreadPost: lastRead=5, targetPost=6, targetIndex=3
focusRowByElement: newRowId=6, prevActiveRowId=header
```

**User navigates with arrow keys:**
```
focusRowByElement: newRowId=7, prevActiveRowId=6
focusRowByElement: newRowId=8, prevActiveRowId=7
```

**User navigates to header, auto-focus blocked:**
```
focusRowByElement: newRowId=header, prevActiveRowId=1
focusFirstUnreadPost: ABORTED - user already interacted with stream
```

**Browser back, focus restoration blocked:**
```
[Focus History] restoreFocusState: ABORTED - focus already on ARTICLE
```

**grid-navigation respects existing focus:**
```
[grid-navigation] scheduleInitialFocus: ABORTED - focus in other navigation region
```
