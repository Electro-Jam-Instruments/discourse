# Post-Stream Navigation Timing Analysis

## Executive Summary

This document provides a comprehensive timing analysis of the focus-jumping bug in `post-stream-navigation.js`. Despite multiple fix attempts using `queueMicrotask()`, navigation guards, and cloaking state checks, the bug persists. This analysis identifies **why** by mapping the exact execution order of all events in the JavaScript event loop.

**Key Finding:** The fundamental issue is that **cloaking events are asynchronous and delayed**, while navigation is synchronous. The gap between these two timing models creates unavoidable race condition windows.

---

## System Architecture Overview

### Two Independent Systems

```
+----------------------------------+       +----------------------------------+
|  Post Stream Navigation          |       |  Post Stream Viewport Tracker    |
|  (post-stream-navigation.js)     |       |  (post-stream-viewport-tracker.js)|
+----------------------------------+       +----------------------------------+
|                                  |       |                                  |
|  State:                          |       |  State:                          |
|  - activeRowId                   |       |  - #uncloakedPostNumbers         |
|  - _isNavigating                 |       |  - #cloakedPostsStyle            |
|  - _lastNavigationDirection      |       |  - #postsOnScreen                |
|                                  |       |                                  |
|  Triggers:                       |       |  Triggers:                       |
|  - keydown events (Arrow keys)   |       |  - IntersectionObserver          |
|  - focusin/focusout events       |       |  - scroll events                 |
|  - Ember modify() lifecycle      |       |  - resize events                 |
|                                  |       |                                  |
+----------------------------------+       +----------------------------------+
            |                                          |
            |                                          |
            v                                          v
+--------------------------------------------------------------------------+
|                          Ember Rendering System                           |
|                                                                          |
|  - Triggers modify() on tracked property changes                         |
|  - Cloaking boundaries cause DOM changes                                  |
|  - DOM changes trigger focusout when element is removed                   |
+--------------------------------------------------------------------------+
```

### Critical Interaction Point

The cloaking system (`post-stream-viewport-tracker.js`) removes DOM elements that the navigation system (`post-stream-navigation.js`) expects to exist. When a focused element is removed:

1. Browser fires `focusout` event
2. Browser moves focus to `<body>`
3. Navigation modifier may try to recover
4. Ember may trigger `modify()` due to DOM changes
5. `updateTabindices()` runs with stale state

---

## Detailed Timing Diagram: Arrow Key Navigation

### Scenario: User presses Arrow Down while post 5 is focused

```
Timeline (microseconds approximation)

T+0     T+100   T+200   T+300   T+500   T+1000  T+2000  T+5000  T+10000
|       |       |       |       |       |       |       |       |
+-------+-------+-------+-------+-------+-------+-------+-------+

=== T+0: KEYDOWN EVENT ===
User presses ArrowDown
|
v

+-----------------------------------------------------------------------+
| SYNCHRONOUS EXECUTION BLOCK (Current Task)                             |
+-----------------------------------------------------------------------+
|                                                                       |
| T+0    handleKeydown() receives event                                 |
|        |                                                              |
| T+1    focusNextRow() called                                          |
|        |                                                              |
| T+2    | const rows = this.rows              // Capture: [3,4,5,6,7]  |
|        |                                                              |
| T+3    | this._lastNavigationDirection = 1   // Set direction DOWN    |
|        |                                                              |
| T+4    | const targetIsCloaked = ...         // Check if post 5 visible|
|        |                                                              |
| T+5    | const currentIndex = this.getActiveRowIndex(rows)            |
|        |   // Uses same rows array, finds post 5 at index 2           |
|        |                                                              |
| T+6    | const newIndex = getNextIndex(rows, 2, false)  // Returns 3  |
|        |                                                              |
| T+7    | this.focusRowWithArray(rows, 3)                              |
|        |   |                                                          |
| T+8    |   | this._isNavigating = true        // GUARD SET            |
|        |   |                                                          |
| T+9    |   | this.activeRowId = "6"           // Update state         |
|        |   |                                                          |
| T+10   |   | this.updateTabindices()          // Set tabindex="0"     |
|        |   |   |                              // on post 6            |
|        |   |   |                                                      |
| T+11   |   |   | rows.forEach(...)            // Uses captured array  |
|        |   |                                                          |
| T+12   |   | this.updateCloakingPrevention(row)                       |
|        |   |   |                                                      |
| T+13   |   |   | preventCloaking(6, true)     // Prevent cloaking     |
|        |   |                                                          |
| T+14   |   | row.focus()                      // FOCUS POST 6         |
|        |   |   |                                                      |
|        |   |   +-- Browser schedules focusin event (queued)           |
|        |   |                                                          |
| T+15   |   | this.scrollRowIntoView(row)                              |
|        |   |   |                                                      |
|        |   |   | window.scrollTo({ behavior: "smooth" })              |
|        |   |   |   |                                                  |
|        |   |   |   +-- Browser schedules scroll (async)               |
|        |   |                                                          |
| T+16   |   | finally block: queueMicrotask(() => {                    |
|        |       |   this._isNavigating = false                         |
|        |       | })                                                   |
|        |       |                                                      |
|        |       +-- Microtask QUEUED (will run after sync code)        |
|                                                                       |
| T+17   event.preventDefault()                                         |
| T+18   event.stopPropagation()                                        |
|                                                                       |
+-----------------------------------------------------------------------+
        |
        | Synchronous code complete
        v
+-----------------------------------------------------------------------+
| MICROTASK QUEUE (Runs before next macrotask)                           |
+-----------------------------------------------------------------------+
|                                                                       |
| T+19   queueMicrotask callback executes                               |
|        |                                                              |
|        | this._isNavigating = false          // GUARD CLEARED         |
|        |                                                              |
+-----------------------------------------------------------------------+
        |
        | Microtasks complete
        v
+-----------------------------------------------------------------------+
| EVENT QUEUE (Macrotasks)                                               |
+-----------------------------------------------------------------------+
|                                                                       |
| T+20   focusin event fires on post 6                                  |
|        |                                                              |
|        | handleFocusIn() runs                                         |
|        |   |                                                          |
|        |   | activeRowId already "6", no change                       |
|        |                                                              |
+-----------------------------------------------------------------------+
        |
        | Time passes (scroll animation running)
        v
```

### Key Observation at T+19

At T+19, `_isNavigating` becomes `false`. This is the **end of protection**. Any subsequent `modify()` calls will NOT be guarded by the `_isNavigating` flag.

---

## Timing Diagram: Cloaking Race Condition

### Scenario: Scroll causes cloaking change after navigation

```
Timeline continuation from above...

T+20    T+50    T+100   T+200   T+500   T+1000  T+5000
|       |       |       |       |       |       |
+-------+-------+-------+-------+-------+-------+

=== T+50: SCROLL ANIMATION CONTINUES ===
Browser is smoothly scrolling to show post 6
|
v

+-----------------------------------------------------------------------+
| ASYNC SCROLL PROCESSING                                                |
+-----------------------------------------------------------------------+
|                                                                       |
| T+50   Scroll event fires                                             |
|        |                                                              |
|        | post-stream-viewport-tracker onScroll()                      |
|        |   |                                                          |
|        |   | discourseDebounce(this.#scrollTriggered, 10ms)           |
|        |                                                              |
+-----------------------------------------------------------------------+
        |
        v
+-----------------------------------------------------------------------+
| T+60: INTERSECTION OBSERVER FIRES                                      |
+-----------------------------------------------------------------------+
|                                                                       |
| IntersectionObserver callback (separate task)                         |
|                                                                       |
| Post 3 is now outside cloaking boundary                               |
|        |                                                              |
|        | trackCloakedPosts(entry) for post 3                          |
|        |   |                                                          |
|        |   | isIntersecting = false                                   |
|        |   |                                                          |
|        |   | this.#uncloakedPostNumbers.delete(3)                     |
|        |   |                                                          |
|        |   | this.#cloakedPostsStyle[post3.id] = { height, margin }   |
|        |   |                                                          |
|        |   | discourseDebounce(#updateCloakBoundaries, 10ms)          |
|        |                                                              |
+-----------------------------------------------------------------------+
        |
        v (after 10ms debounce)
+-----------------------------------------------------------------------+
| T+70: CLOAK BOUNDARIES UPDATE                                          |
+-----------------------------------------------------------------------+
|                                                                       |
| #updateCloakBoundaries()                                              |
|        |                                                              |
|        | Calculates min/max visible post numbers                      |
|        |                                                              |
|        | this.#setCloakingBoundaries(above, below)                    |
|        |   |                                                          |
|        |   | This is a tracked Ember property!                        |
|        |   |                                                          |
|        |   +-- Ember schedules re-render                              |
|                                                                       |
+-----------------------------------------------------------------------+
        |
        v (Ember render cycle)
+-----------------------------------------------------------------------+
| T+80: EMBER RE-RENDER DUE TO BOUNDARY CHANGE                           |
+-----------------------------------------------------------------------+
|                                                                       |
| Ember detects tracked property change                                 |
|        |                                                              |
|        | Schedules component re-render                                |
|        |                                                              |
|        | post-stream-navigation.js modify() called                    |
|        |   |                                                          |
|        |   | CHECK GUARD 1: this._isNavigating                        |
|        |   |   |                                                      |
|        |   |   | _isNavigating = false   // Was cleared at T+19!     |
|        |   |   |                                                      |
|        |   |   | Guard does NOT block                                 |
|        |   |                                                          |
|        |   | CHECK GUARD 2: activeRowId visible?                      |
|        |   |   |                                                      |
|        |   |   | this.rows = [4,5,6,7,8]  // Post 3 now cloaked!     |
|        |   |   |                                                      |
|        |   |   | findRowIndexByIdWithArray(rows, "6") = 2             |
|        |   |   |                                                      |
|        |   |   | activeRowVisible = true  // Post 6 still visible    |
|        |   |   |                                                      |
|        |   |   | Guard does NOT block                                 |
|        |   |                                                          |
|        |   | updateTabindices()                                       |
|        |   |   |                                                      |
|        |   |   | updateRovingTabindex(rows, activeRowIndex)           |
|        |   |   |   |                                                  |
|        |   |   |   | Sets tabindex="0" on post 6 (index 2 in new     |
|        |   |   |   | array)                                          |
|        |   |   |   |                                                  |
|        |   |   |   | This is CORRECT in this case                    |
|        |                                                              |
+-----------------------------------------------------------------------+
```

### When It Goes Wrong: Rapid Scrolling Scenario

```
=== RAPID SCROLL SCENARIO ===

User navigates to post 6, then immediately scrolls up manually

T+0     T+20    T+50    T+100   T+200   T+500
|       |       |       |       |       |
+-------+-------+-------+-------+-------+

T+0:   Navigation to post 6 complete
       _isNavigating = false (microtask cleared)
       activeRowId = "6"
       Focus is on post 6

T+20:  User scrolls up rapidly (manual scroll, not from navigation)
       |
       | Post 6 scrolls out of view
       |
       v

T+50:  IntersectionObserver fires for post 6
       |
       | isIntersecting = false for post 6
       |
       | trackCloakedPosts() records post 6 cloaking
       |
       | BUT: preventCloaking(6, true) was set during navigation
       |
       | getCloakingData() checks: cloakingPrevented.posts.has(6)?
       |   YES - post 6 is protected
       |
       | Post 6 remains uncloaked (correct)

T+100: User continues scrolling, post 6 now WAY out of view
       |
       | The cloaking prevention is still set
       | Post 6 DOM element still exists
       | But focus may have been lost due to layout changes
       |
       v

T+200: User presses Arrow Down
       |
       | focusNextRow() captures rows = [8,9,10,11,12]
       |   (post 6 is far out of view but NOT cloaked due to prevention)
       |
       | Wait - post 6 is NOT in the rows array!
       | Because this.rows filters: !row.closest(".post-stream--cloaked")
       |
       | But if post 6 IS uncloaked, it SHOULD be in the array
       |
       | PROBLEM: Where is post 6?
```

---

## Race Condition Windows Analysis

### Window 1: Between Navigation End and Microtask (T+17 to T+19)

```
WINDOW 1: 2-3 microseconds

T+17   focusRowWithArray() finally block queues microtask
       _isNavigating = true (still protected)

T+18   Any synchronous code still in call stack executes

T+19   Microtask runs: _isNavigating = false

RISK: Any Ember rendering that occurs synchronously during T+17-T+18
      will see _isNavigating = true and be correctly guarded.

VERDICT: This window is SAFE due to queueMicrotask() timing.
         Synchronous Ember code runs BEFORE microtask clears flag.
```

### Window 2: Between Microtask and Next User Input (T+19 to T+N)

```
WINDOW 2: Variable duration (milliseconds to seconds)

T+19     Microtask clears _isNavigating
         User might:
         - Press another arrow key (creates new navigation)
         - Scroll manually (triggers cloaking changes)
         - Do nothing (cloaking settles naturally)

T+N      Next user action

DURING THIS WINDOW:
- IntersectionObserver fires asynchronously (separate macrotask)
- Scroll events fire (debounced, 10ms intervals)
- Cloak boundary updates trigger Ember re-renders
- modify() runs WITHOUT _isNavigating protection

RISK: HIGH - This is where most bugs occur.
```

### Window 3: Scroll Animation Duration (T+15 to T+15+300ms)

```
WINDOW 3: ~300ms (smooth scroll duration)

T+15     scrollRowIntoView() calls window.scrollTo({ behavior: "smooth" })

T+15 to T+315:
         Browser animates scroll
         |
         | Multiple IntersectionObserver callbacks fire
         | Multiple scroll events fire
         | Multiple Ember re-renders possible
         |
         | ALL of these occur AFTER microtask cleared flag at T+19

T+315    Scroll animation complete

RISK: VERY HIGH - Scroll animation creates extended window where
      cloaking changes can trigger modify() with _isNavigating = false
```

---

## Guard Analysis: Why Current Guards Fail

### Guard 1: `_isNavigating` Flag

```javascript
modify(element, positional, named) {
  // GUARD 1: Skip tabindex updates during active navigation
  if (this._isNavigating) {
    console.log(`[A11Y-NAV] modify(): SKIPPED - navigation in progress`);
    return;
  }
  // ...
}
```

**Why it fails:**

```
Timeline:
T+0    Arrow key pressed
T+16   queueMicrotask(() => _isNavigating = false)
T+19   Microtask runs, flag = false
T+50   IntersectionObserver fires (async)
T+80   Ember re-render triggers modify()
       _isNavigating = false --> Guard does NOT protect
```

The flag is cleared via microtask, but IntersectionObserver callbacks and subsequent Ember renders happen **much later** in separate macrotasks.

### Guard 2: Cloaked Active Row Check

```javascript
modify(element, positional, named) {
  // ...
  // GUARD 2: Skip tabindex updates if the active row is cloaked
  const rows = this.rows;
  const activeRowVisible = this.findRowIndexByIdWithArray(rows, this.activeRowId) !== -1;

  if (!activeRowVisible && this.activeRowId !== "header" && this.initialFocusComplete) {
    console.log(`[A11Y-NAV] modify(): SKIPPED - activeRowId=${this.activeRowId} is cloaked`);
    return;
  }
  // ...
}
```

**Why it fails:**

1. **Race with `preventCloaking()`**: Navigation sets `preventCloaking(postId, true)` which prevents the post from being cloaked. So `activeRowVisible` is often `true` even when post is scrolled far out of view.

2. **Cloaking is not instant**: The post remains in DOM (uncloaked) even when outside visible area because:
   - Cloaking has a slack factor (`SLACK_FACTOR = 1`)
   - Cloaking has hysteresis thresholds
   - We explicitly prevent cloaking on focused posts

3. **Guard only protects cloaked case**: When post IS cloaked (visible=false), guard works. But if post is uncloaked but far from viewport, guard does NOT protect.

---

## Scenario: handleFocusOut Feedback Loop

This is the most dangerous race condition identified:

```
T+0    User navigates to post 6
       activeRowId = "6"
       Focus is on post 6 DOM element
       preventCloaking(6, true) set

T+100  User manually scrolls up rapidly

T+200  Post 6 is now far from viewport
       BUT not cloaked (prevention set)
       Focus is still on post 6

T+300  Something causes post 6 to re-render
       (e.g., Ember tracked state change, cloaking boundary update)

T+310  Ember removes and re-creates post 6 DOM element
       (This is how Ember updates work)

T+311  Browser detects focused element removed from DOM
       Browser moves focus to <body>
       Browser fires focusout event

T+315  handleFocusOut() executes:
       |
       | if (!event.relatedTarget || !this.element.contains(event.relatedTarget))
       |   --> TRUE (focus went to body)
       |
       | requestAnimationFrame(() => {
       |   if (this._isNavigating && ...)  // _isNavigating = false!
       |     // Recovery code does NOT run
       |   else
       |     // Passive cloaking - don't recover
       | })

T+320  Focus is now on <body>
       User has lost focus on the grid
       Pressing arrow keys does nothing (grid has no focus)

T+500  User presses Tab
       Grid gets focus again
       But focus goes to tabindex="0" element
       Which might be wrong post due to prior tabindex corruption
```

---

## The Core Timing Problem

The fundamental issue is a **synchronization mismatch**:

```
+----------------------------------+
| NAVIGATION SYSTEM                |
| (Synchronous + Microtask)        |
|                                  |
| Duration: ~20 microseconds       |
+----------------------------------+
        |
        | Sets state, focuses, scrolls
        | Clears flag via microtask
        |
        v
+----------------------------------+
| GAP: No Protection               |
| (Macrotask boundary)             |
|                                  |
| Duration: Variable (0-500ms)     |
+----------------------------------+
        |
        | IntersectionObserver fires
        | Scroll events fire
        | Ember re-renders
        |
        v
+----------------------------------+
| CLOAKING SYSTEM                  |
| (Asynchronous)                   |
|                                  |
| Duration: Ongoing                |
+----------------------------------+
```

The navigation system "finishes" (clears flag) before the cloaking system processes the scroll changes caused by navigation.

---

## Proposed Solutions

### Solution A: Extended Navigation Lock

Instead of clearing flag on microtask, use a timeout:

```javascript
focusRowWithArray(rows, index) {
  this._isNavigating = true;
  try {
    // ... navigation code
  } finally {
    // Clear after scroll animation likely complete
    setTimeout(() => {
      this._isNavigating = false;
    }, 350); // Slightly longer than smooth scroll duration
  }
}
```

**Pros:**
- Simple to implement
- Covers scroll animation window

**Cons:**
- Arbitrary timeout value
- May block legitimate modify() calls
- Doesn't handle manual user scroll during window

### Solution B: Scroll-Aware Navigation Lock

Tie the flag to scroll completion:

```javascript
focusRowWithArray(rows, index) {
  this._isNavigating = true;
  try {
    // ... navigation code
    this.scrollRowIntoView(row, () => {
      // Callback when scroll complete
      this._isNavigating = false;
    });
  } catch (e) {
    this._isNavigating = false;
    throw e;
  }
}

scrollRowIntoView(row, onComplete) {
  // Track if scroll is needed
  const rowRect = row.getBoundingClientRect();
  // ... existing scroll logic ...

  if (needsScroll) {
    // Wait for scroll to finish
    let scrollTimeout;
    const scrollHandler = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        window.removeEventListener('scroll', scrollHandler);
        onComplete?.();
      }, 100); // 100ms after last scroll event
    };
    window.addEventListener('scroll', scrollHandler);
    window.scrollTo({ top: scrollY, behavior: "smooth" });
  } else {
    onComplete?.();
  }
}
```

**Pros:**
- Accurately tracks actual scroll completion
- Works with variable scroll distances

**Cons:**
- More complex implementation
- May never clear if scroll is interrupted
- Need timeout fallback

### Solution C: Decouple Tabindex Updates from modify()

Don't update tabindices in modify() at all:

```javascript
modify(element, positional, named) {
  // Only set up listeners once
  if (this.element !== element) {
    this.cleanup();
    this.element = element;
    this.handleKeydown = this.handleKeydown.bind(this);
    // ... event listener setup

    // Initial tabindex setup only
    this.updateTabindices();
    this.setInternalTabindices();
  }

  this.options = { ...this.options, ...named };

  // NO tabindex updates on re-render
  // Tabindices only change in:
  // - focusRowWithArray() (navigation)
  // - handleFocusIn() (user click/tab)
}
```

**Pros:**
- Eliminates modify() race conditions entirely
- Simpler mental model

**Cons:**
- Tabindices may become stale if rows change
- Need to handle edge cases (new posts loaded, posts deleted)

### Solution D: State Machine Approach

Use explicit state machine to track navigation phases:

```javascript
// States
const NAV_STATE = {
  IDLE: 'idle',
  NAVIGATING: 'navigating',
  SCROLLING: 'scrolling',
  SETTLING: 'settling'
};

class PostStreamNavigationModifier extends Modifier {
  _navState = NAV_STATE.IDLE;
  _settleTimer = null;

  modify(element, positional, named) {
    // Only allow tabindex updates in IDLE state
    if (this._navState !== NAV_STATE.IDLE) {
      return;
    }
    this.updateTabindices();
  }

  focusRowWithArray(rows, index) {
    this._navState = NAV_STATE.NAVIGATING;
    try {
      // ... focus code
      this._navState = NAV_STATE.SCROLLING;
      this.scrollRowIntoView(row);
    } finally {
      // Enter settling state
      this._navState = NAV_STATE.SETTLING;
      clearTimeout(this._settleTimer);
      this._settleTimer = setTimeout(() => {
        this._navState = NAV_STATE.IDLE;
      }, 350);
    }
  }
}
```

**Pros:**
- Clear state transitions
- Easy to debug (log state changes)
- Can add more states as needed

**Cons:**
- More code complexity
- Still relies on timeout for settling phase

---

## Recommended Solution

**Combination of C and D:**

1. **Remove tabindex updates from modify()** - Only update tabindices during explicit navigation or focus events

2. **Add state machine for tracking** - But simplified:
   - `IDLE` - Accept user input, allow tabindex updates in focus handlers
   - `NAVIGATING` - Ignore external focus changes, prevent tabindex updates

3. **Use reasonable timeout** - 400ms covers most scroll animations

4. **Handle rapid keypresses** - Each keypress resets the timeout

```javascript
focusRowWithArray(rows, index) {
  // Clear any pending idle transition
  clearTimeout(this._idleTimer);

  this._navState = 'navigating';

  // ... navigation code

  // Schedule transition back to idle
  this._idleTimer = setTimeout(() => {
    this._navState = 'idle';
  }, 400);
}

modify(element, positional, named) {
  // Never update tabindices in modify()
  // This eliminates the entire class of race conditions
}

handleFocusIn(event) {
  // Only update state if IDLE (user click/tab)
  if (this._navState !== 'idle') {
    return; // Ignore focus events during navigation
  }
  // ... normal focus handling
}
```

---

## Summary Table: Race Condition Windows

| Window | Duration | Current Protection | Vulnerability | Fix Priority |
|--------|----------|-------------------|---------------|--------------|
| Sync execution | ~17us | Full (_isNavigating=true) | None | N/A |
| Microtask gap | ~2us | Full (sync code before) | None | N/A |
| After microtask | Variable | Guard 2 (cloaked check) | modify() runs | HIGH |
| Scroll animation | ~300ms | None | Full | CRITICAL |
| Settle period | ~100ms | None | Full | HIGH |
| User scroll | Indefinite | preventCloaking() | Partial | MEDIUM |

---

## Files for Reference

- `frontend/discourse/app/modifiers/post-stream-navigation.js` - Navigation modifier
- `frontend/discourse/app/modifiers/post-stream-viewport-tracker.js` - Cloaking system
- `frontend/discourse/app/lib/keyboard-navigation-utils.js` - Navigation utilities
- `docs/bugs/focus-jumping-session-2026-01-19.md` - Previous fix attempts

---

## Appendix A: JavaScript Event Loop Visualization

```
+-------------------+
| CALL STACK        |  <-- Synchronous code executes here
+-------------------+
         |
         v (when empty)
+-------------------+
| MICROTASK QUEUE   |  <-- queueMicrotask(), Promise.then()
+-------------------+
         |
         v (when empty)
+-------------------+
| MACROTASK QUEUE   |  <-- setTimeout(), events, I/O
+-------------------+

Execution order:
1. All synchronous code in current task
2. ALL microtasks (until queue empty)
3. ONE macrotask
4. Repeat from step 1

Key insight: modify() triggered by focus() is synchronous (step 1)
             modify() triggered by IntersectionObserver is macrotask (step 3)
```

---

## Appendix B: Ember Rendering Lifecycle

```
+---------------------------+
| Tracked property changes  |
+---------------------------+
         |
         v
+---------------------------+
| Schedule render           |  <-- Happens synchronously
+---------------------------+
         |
         v
+---------------------------+
| Backburner queue          |  <-- Ember's scheduling system
| "render" queue            |
+---------------------------+
         |
         v (on next tick or schedule('afterRender'))
+---------------------------+
| Execute render            |
| Call modify() on modifiers|
+---------------------------+

Key insight: When cloaking boundaries change, they update tracked
             properties, which schedule re-renders. The modify()
             call happens in the "render" queue, which may be
             synchronous or deferred depending on context.
```
