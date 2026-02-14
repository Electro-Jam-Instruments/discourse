# Issue #46: Replace NAVIGATION_GUARD_MS with Cloaking Cycle Guard

## Problem Summary

`post-stream-navigation.js` uses `NAVIGATION_GUARD_MS = 150` with `performance.now()` to block `handleFocusIn` state changes after keyboard navigation. This timing hack masks a race condition between keyboard navigation and IntersectionObserver-triggered cloaking updates.

## The Causal Chain (Current Behavior)

```
Arrow Down pressed
  1. handleKeydown → focusNextRow → focusRowByElement(nextRow)
  2.   _isNavigating = true                          [boolean guard ON]
  3.   _navigationTimestamp = performance.now()       [timestamp guard SET]
  4.   row.focus()                                    [browser fires focusin synchronously]
  5.   scrollRowIntoView(row)                         [instant scroll, triggers IntersectionObserver]
  6.   queueMicrotask(() => _isNavigating = false)    [schedule microtask to clear boolean]
  7. --- synchronous JS done ---
  8. --- microtask: _isNavigating = false ---         [boolean guard OFF]
  9. --- macrotask (~50-150ms): IO callback fires --- [IntersectionObserver]
  10.  trackCloakedPosts()
  11.    debounced #updateCloakBoundaries (10ms debounce)
  12.  #setCloakingBoundaries(above, below)
  13.    requestAnimationFrame(() => {
  14.      this.cloakAbove = above;   [Ember @tracked property change]
  15.      this.cloakBelow = below;   [Ember @tracked property change]
  16.    })
  17. --- Ember re-render triggered ---
  18.  post-stream template re-evaluates
  19.  Posts get `post-stream--cloaked` class toggled
  20.  DOM nodes added/removed
  21.  Browser may fire focusin on different element  [PROBLEM]
  22.  handleFocusIn fires with wrong row
  23.    → TIMESTAMP GUARD blocks it (line 747)       [150ms hasn't elapsed]
```

Without the timestamp guard at step 23, `handleFocusIn` would see a focus change to the wrong row and corrupt `activeRowId`, causing focus jumping.

## Key Timing Details

- Steps 1-8: Synchronous + microtask (~0-1ms)
- Step 9: IO callback: 50-150ms after scroll
- Steps 10-12: IO callback processing + debounce: 10ms
- Steps 13-16: requestAnimationFrame: next frame (~16ms)
- Steps 17-21: Ember re-render: 16-32ms
- **Total from navigation to problematic focus event: ~90-210ms**
- **Current guard: 150ms** (covers most but not all cases)

## Proposed Fix: Cloaking Cycle Guard

### Core Idea

Replace the timestamp-based guard with a **counter** that tracks cloaking update cycles. Each time cloaking boundaries change, increment a counter. During navigation, record the current counter value. In `handleFocusIn`, block focus changes until the counter advances past the navigation-triggered cloaking updates.

### Mechanism

1. **`post-stream.gjs`** increments a cloaking cycle counter each time `setCloakingBoundaries` updates the tracked properties
2. **`post-stream-navigation.js`** reads the counter at navigation start and records it
3. **`handleFocusIn`** compares the recorded counter to the current counter to decide if focus changes are caused by navigation-triggered cloaking

### Implementation Details

#### Change 1: post-stream.gjs - Add cloaking cycle counter

The `setCloakingBoundaries` action already guards against no-op updates. When it does update, we increment a counter that is passed to the navigation modifier:

```javascript
// New tracked property
@tracked _cloakCycle = 0;

@action
setCloakingBoundaries(above, below) {
  requestAnimationFrame(() => {
    if (this.cloakAbove === above && this.cloakBelow === below) {
      return; // no change
    }
    this.cloakAbove = above;
    this.cloakBelow = below;
    this._cloakCycle++;
  });
}
```

Pass `_cloakCycle` to the navigation modifier:

```handlebars
{{PostStreamNavigation
  lastReadPostNumber=@lastReadPostNumber
  cloakCycle=this._cloakCycle
}}
```

#### Change 2: post-stream-navigation.js - Replace timestamp with cycle comparison

**Remove:**
```javascript
const NAVIGATION_GUARD_MS = 150;
```

**Remove from instance properties:**
```javascript
_navigationTimestamp = 0;
```

**Add to instance properties:**
```javascript
_navigationCloakCycle = 0;  // cloakCycle value at last navigation
```

**Update `modify()` to capture the cloakCycle:**
```javascript
modify(element, positional, named) {
  // ... existing setup ...
  this.options = { ...this.options, ...named };
  this._currentCloakCycle = named.cloakCycle || 0;
  // ... rest of modify ...
}
```

**Update `focusRowByElement()`:**
```javascript
focusRowByElement(row) {
  if (!row) return;

  this._userHasInteractedWithStream = true;

  // Set DUAL navigation guards BEFORE any state changes:
  // 1. Boolean flag for synchronous focus events (cleared via microtask)
  // 2. Cloaking cycle snapshot for async IO/Ember re-render focus events
  this._isNavigating = true;
  this._navigationCloakCycle = this._currentCloakCycle;

  this.activeRowId = this.getRowId(row);
  this.activeFocusableIndex = -1;
  this.inDocumentMode = false;
  this.updateTabindices();
  this.updateCloakingPrevention(row);

  row.focus();
  this.scrollRowIntoView(row);

  queueMicrotask(() => {
    this._isNavigating = false;
  });
}
```

**Update `handleFocusIn()` guard:**
```javascript
handleFocusIn(event) {
  const row = event.target.closest(this.options.rowSelector);
  if (row) {
    const newRowId = this.getRowId(row);
    if (newRowId && newRowId !== this.activeRowId) {
      // Guard 1: Boolean flag (handles synchronous focus events during navigation)
      if (this._isNavigating) {
        return;
      }

      // Guard 2: Cloaking cycle check (handles async IO/Ember re-render focus events)
      // After navigation, scrollRowIntoView triggers IntersectionObserver which triggers
      // cloaking boundary updates (incrementing cloakCycle). Those updates cause Ember
      // re-renders that add/remove DOM nodes, which can fire spurious focus events.
      // We block focus changes until the cloaking cycle has settled past the navigation.
      //
      // Why +1: The navigation scroll causes AT MOST one cloaking boundary update.
      // The IO fires, updates boundaries, Ember re-renders. If cloakCycle hasn't
      // advanced beyond navigationCloakCycle + 1, the re-render is still settling.
      if (this._currentCloakCycle <= this._navigationCloakCycle + 1) {
        return;
      }

      // Legitimate focus change (mouse click, Tab, etc.)
      this._userHasInteractedWithStream = true;
      this.activeRowId = newRowId;
      this._lastNavigationDirection = 0;
      this.updateTabindices();
      this.updateCloakingPrevention(row);
    }
    // ... rest of focusable tracking ...
  }
}
```

**Update `focusFirstUnreadPost()` guard:**
```javascript
// Replace:
// const msSinceNav = performance.now() - this._navigationTimestamp;
// if (this._navigationTimestamp > 0 && msSinceNav < NAVIGATION_GUARD_MS * 2) {

// With:
if (this._currentCloakCycle <= this._navigationCloakCycle + 1 &&
    this._navigationCloakCycle > 0) {
  console.log(`[A11Y-NAV] focusFirstUnreadPost: ABORTED - cloaking still settling`);
  return;
}
```

**Update `handleGlobalFocusIn()` (debug logging):**
```javascript
// Replace performance.now() check with cloakCycle check
handleGlobalFocusIn(event) {
  // Only log shortly after navigation (when cloaking is still settling)
  if (this._currentCloakCycle > this._navigationCloakCycle + 2) {
    return; // Well past navigation, probably legitimate
  }
  // ... rest of debug logging ...
}
```

### Why `+1` is Correct

The navigation scroll triggers **at most one** cloaking boundary update per navigation action:

1. `scrollRowIntoView()` scrolls to new position
2. IO detects new intersection state
3. `trackCloakedPosts()` fires for entering/leaving posts
4. `#updateCloakBoundaries()` debounced at 10ms
5. `setCloakingBoundaries()` in rAF increments `_cloakCycle` by 1
6. Ember re-renders with new boundaries

So `_currentCloakCycle === _navigationCloakCycle + 1` means "the cloaking update caused by our scroll just happened." We block until the cycle advances **past** this (i.e., `> _navigationCloakCycle + 1`), meaning either:
- A subsequent user action triggered another cloaking change (legitimate)
- No cloaking change happened (guard passes immediately for non-scroll navigations)

### Edge Cases

**No scroll needed (row already visible):**
- `scrollRowIntoView()` does nothing
- IO doesn't fire
- `_cloakCycle` stays the same
- Guard: `_currentCloakCycle <= _navigationCloakCycle + 1` → `cycle <= cycle + 1` → true
- BUT this is fine because if no scroll happened, there won't be spurious focus events either
- The boolean `_isNavigating` flag handles synchronous focus events during `row.focus()`
- After microtask clears the boolean, no more spurious events will arrive (no scroll = no IO)
- **Wait, this means legitimate mouse clicks AFTER navigation (with no scroll) would be blocked!**

**Fix for no-scroll case:**
We need a way to detect when the cloaking has settled. If no scroll happened, the guard should clear quickly. Add a settlement mechanism:

```javascript
focusRowByElement(row) {
  // ... existing code ...
  this._isNavigating = true;
  this._navigationCloakCycle = this._currentCloakCycle;

  // ... focus and scroll ...

  queueMicrotask(() => {
    this._isNavigating = false;
    // If no cloaking change happened by next rAF, navigation is fully settled
    requestAnimationFrame(() => {
      if (this._currentCloakCycle === this._navigationCloakCycle) {
        // No cloaking happened - mark as settled by advancing our snapshot
        // This ensures handleFocusIn won't block legitimate subsequent focus events
        this._navigationCloakCycle = -1; // sentinel: "no active navigation guard"
      }
    });
  });
}
```

And update the guard:
```javascript
// Guard 2: Cloaking cycle check
if (this._navigationCloakCycle >= 0 &&
    this._currentCloakCycle <= this._navigationCloakCycle + 1) {
  return;
}
```

**Rapid arrow keypresses:**
- Each keypress calls `focusRowByElement()` which sets `_navigationCloakCycle = _currentCloakCycle`
- Multiple rapid presses: each one resets the snapshot
- Only the final cloaking update after the last keypress matters
- The guard stays active until that final cloaking settles
- This matches the current timestamp behavior (each keypress resets the timestamp)

**Mouse click between cloaking cycles:**
- User navigates with arrow, then immediately clicks a post
- `handleFocusIn` fires with the clicked row
- Guard checks: is `_currentCloakCycle <= _navigationCloakCycle + 1`?
- If cloaking hasn't updated yet: blocked (same as current 150ms guard)
- If cloaking already settled: allowed
- The settlement rAF from the no-scroll case also helps here

### Files Changed

| File | Change |
|------|--------|
| `frontend/discourse/app/components/post-stream.gjs` | Add `_cloakCycle` tracked property, increment in `setCloakingBoundaries`, pass to modifier |
| `frontend/discourse/app/modifiers/post-stream-navigation.js` | Replace `NAVIGATION_GUARD_MS`/`_navigationTimestamp`/`performance.now()` with `_navigationCloakCycle`/`_currentCloakCycle` comparison |

### What's NOT Changed

- The `_isNavigating` boolean flag + microtask clearing stays (it handles synchronous events)
- The `_userHasInteractedWithStream` flag stays
- The `_lastNavigationDirection` / directional fallback stays
- The `updateCloakingPrevention()` / `preventCloaking()` mechanism stays
- All existing cloaking infrastructure in `post-stream-viewport-tracker.js` is untouched

### Risk Assessment

**Lower risk:**
- Only 2 files changed
- The cloaking infrastructure is read-only from our perspective
- The Ember re-render chain is unchanged
- The boolean guard still handles synchronous events (most common case)

**Higher risk:**
- The "+1" assumption (one cloaking update per scroll) needs validation
- The no-scroll settlement mechanism adds complexity
- Edge case: what if two IO callbacks fire (one for leaving, one for entering) causing two cloaking updates? Then `+1` is insufficient and we'd need `+2`
- Testing required with rapid navigation through 10+ posts in a long topic
