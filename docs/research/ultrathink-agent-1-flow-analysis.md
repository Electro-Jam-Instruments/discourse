# Complete End-to-End Flow Analysis: Post Stream Navigation System

## Executive Summary

This document provides a comprehensive walkthrough of the post-stream-navigation system, examining every code path, timing consideration, and race condition point. The analysis covers the complete lifecycle from user Tab entry through complex cloaking scenarios.

---

## Table of Contents

1. [System Architecture Overview](#system-architecture-overview)
2. [Component Relationships](#component-relationships)
3. [Detailed Scenario Walkthroughs](#detailed-scenario-walkthroughs)
   - [Scenario A: User Tabs Into Post Stream](#scenario-a-user-tabs-into-post-stream)
   - [Scenario B: User Arrows DOWN Through Posts 1-5](#scenario-b-user-arrows-down-through-posts-1-5)
   - [Scenario C: Posts 1-2 Get Cloaked During Scroll](#scenario-c-posts-1-2-get-cloaked-during-scroll)
   - [Scenario D: User Continues to Posts 8-10](#scenario-d-user-continues-to-posts-8-10)
   - [Scenario E: User Arrows UP Through Posts 10-7](#scenario-e-user-arrows-up-through-posts-10-7)
   - [Scenario F: User Reaches Cloaked Region](#scenario-f-user-reaches-cloaked-region)
   - [Scenario G: User Arrows UP to Header Row](#scenario-g-user-arrows-up-to-header-row)
4. [State Management Deep Dive](#state-management-deep-dive)
5. [Race Condition Analysis](#race-condition-analysis)
6. [Cloaking System Integration](#cloaking-system-integration)
7. [Guard Mechanisms](#guard-mechanisms)
8. [Recommendations](#recommendations)

---

## System Architecture Overview

### Key Files and Responsibilities

| File | Purpose |
|------|---------|
| `post-stream-navigation.js` | Ember modifier implementing WAI-ARIA grid pattern for keyboard navigation |
| `post-stream-viewport-tracker.js` | IntersectionObserver-based cloaking/virtualization system |
| `post-stream.gjs` | Parent component that hosts both systems |
| `post.gjs` | Individual post row component with `role="row"` |
| `post-stream/header-row.gjs` | Topic header row at the top of the grid |
| `keyboard-navigation-utils.js` | Pure functions for index calculations |

### DOM Structure

```
div.post-stream[role="grid"]
  |-- div.topic-header-row[role="row"][tabindex="-1"][aria-rowindex="1"]
  |-- div.topic-post[role="row"][tabindex="-1"][data-post-number="1"][aria-rowindex="2"]
  |-- div.topic-post[role="row"][tabindex="-1"][data-post-number="2"][aria-rowindex="3"]
  |-- ... more posts
  |-- div.post-stream--cloaked (placeholder for cloaked posts)
```

### State Variables in PostStreamNavigationModifier

```javascript
// Stable identifier for active row
activeRowId = "header"  // "header" or post number as string (e.g., "5")

// Position within row for Right/Left navigation
activeFocusableIndex = -1  // -1 = row itself, 0+ = internal element

// Document mode for reading post content
inDocumentMode = false

// Whether initial auto-focus has completed
initialFocusComplete = false

// Post ID with cloaking prevention active
_preventedCloakingPostId = null

// Navigation direction: -1 = up, 1 = down, 0 = no preference
_lastNavigationDirection = 0

// Flag to prevent modify() interference during navigation
_isNavigating = false
```

---

## Component Relationships

### Modifier Installation Flow

```
post-stream.gjs template:
  {{PostStreamNavigation lastReadPostNumber=@lastReadPostNumber}}
    |
    v
PostStreamNavigationModifier.modify() called
    |
    +-- If element changed:
    |     - Set up event listeners (keydown, focusin, focusout)
    |     - Initialize activeRowId = "header"
    |
    +-- If _isNavigating is true:
    |     - SKIP tabindex updates (GUARD 1)
    |     - Return early
    |
    +-- If activeRowId is cloaked AND initialFocusComplete:
    |     - SKIP tabindex updates (GUARD 2)
    |     - Return early
    |
    +-- Otherwise:
          - updateTabindices()
          - setInternalTabindices()
          - scheduleInitialFocus() if first load + keyboard mode
```

### Cloaking System Integration

```
PostStreamViewportTracker (cloaking):
    |
    +-- IntersectionObserver #cloakingObserver
    |     rootMargin: viewportHeight * SLACK_FACTOR (1x) above/below
    |     - Tracks posts entering/leaving cloaking zone
    |     - Updates #uncloakedPostNumbers Set
    |     - Debounces #updateCloakBoundaries (10ms)
    |
    +-- #updateCloakBoundaries()
    |     - Calculates min/max of uncloaked posts
    |     - Calls setCloakingBoundaries(above, below)
    |
    +-- post-stream.gjs.setCloakingBoundaries()
          - requestAnimationFrame()
          - Updates tracked properties: this.cloakAbove, this.cloakBelow
          - Triggers Ember re-render
          - Re-render triggers PostStreamNavigationModifier.modify()
```

---

## Detailed Scenario Walkthroughs

### Scenario A: User Tabs Into Post Stream

**Initial State:**
- User is on an element before the post stream
- Grid has focus nowhere inside it
- activeRowId = "header" (default)
- _isNavigating = false

**Timeline:**

```
T0: User presses Tab key
    |
T1: Browser moves focus to the element with tabindex="0" in the grid
    |
    +-- At this point, header row has tabindex="0" (from initial updateTabindices)
    |
T2: focusin event fires on the header row
    |
T3: handleFocusIn() executes:
    |   const row = event.target.closest('.topic-header-row, .topic-post')
    |   // row is the header-row element
    |
    |   const newRowId = this.getRowId(row)
    |   // Returns "header" for topic-header-row
    |
    |   if (newRowId !== this.activeRowId) {
    |     // activeRowId already is "header", so this is false
    |     // No state change
    |   }
    |
    |   if (event.target === row) {
    |     this.activeFocusableIndex = -1  // Row itself is focused
    |   }
    |
T4: Focus is now on header row
```

**State After:**
- activeRowId = "header"
- activeFocusableIndex = -1
- _lastNavigationDirection = 0
- Focus is on header row element

**Race Condition Points:** None in this scenario.

---

### Scenario B: User Arrows DOWN Through Posts 1-5

**Initial State:**
- Focus on header row
- activeRowId = "header"
- _isNavigating = false

**User presses ArrowDown once (header -> post 1):**

```
T0: keydown event fires with key="ArrowDown"
    |
T1: handleKeydown() executes:
    |   switch(key) {
    |     case "ArrowDown":
    |       this.focusNextRow()
    |       handled = true
    |   }
    |
T2: focusNextRow() executes:
    |   // CRITICAL: Capture rows array ONCE
    |   const rows = this.rows;
    |   // rows = [header-row, post-1, post-2, post-3, ...]
    |   // rows.length = 11 (header + 10 posts, for example)
    |
    |   // Set navigation direction BEFORE getting index
    |   this._lastNavigationDirection = 1;  // DOWN
    |
    |   // Check if current activeRowId is cloaked
    |   const targetIsCloaked = this.findRowIndexByIdWithArray(rows, this.activeRowId) === -1;
    |   // this.activeRowId = "header"
    |   // Header found at index 0, so targetIsCloaked = false
    |
    |   const currentIndex = this.getActiveRowIndex(rows);
    |   // Finds "header" at index 0
    |   // Returns 0
    |
    |   // Normal case: navigate from current position
    |   const newIndex = getNextIndex(rows, currentIndex, this.options.wrap);
    |   // getNextIndex([...], 0, false) = 1
    |
    |   if (newIndex !== currentIndex) {
    |     this.focusRowWithArray(rows, 1);
    |   }
    |
T3: focusRowWithArray(rows, 1) executes:
    |   // Set navigation flag
    |   this._isNavigating = true;
    |
    |   try {
    |     const row = rows[1];  // post-1 element
    |
    |     // Track by row ID (post number)
    |     const newRowId = this.getRowId(row);  // "1"
    |     this.activeRowId = "1";
    |     this.activeFocusableIndex = -1;
    |     this.inDocumentMode = false;
    |
    |     this.updateTabindices();
    |     // Sets tabindex="0" on post-1, tabindex="-1" on all others
    |
    |     this.updateCloakingPrevention(row);
    |     // Calls preventCloaking(postId, true) for post 1
    |     // Stores postId in _preventedCloakingPostId
    |
    |     row.focus();  // DOM focus moves to post-1
    |
    |     this.scrollRowIntoView(row);
    |     // Smooth scroll if needed
    |
    |   } finally {
    |     queueMicrotask(() => {
    |       this._isNavigating = false;
    |     });
    |   }
    |
T4: focusin event fires on post-1
    |
T5: handleFocusIn() executes:
    |   // newRowId = "1", this.activeRowId = "1"
    |   // They match, so no state change
    |   this.activeFocusableIndex = -1;
    |
T6: Microtask queue runs
    |   this._isNavigating = false;
    |
T7: If scrollRowIntoView triggered scroll:
    |   - IntersectionObserver may fire
    |   - Cloaking boundaries may update
    |   - Ember re-render may occur
    |   - modify() would run
    |
    |   BUT: At this point _isNavigating is false
    |   HOWEVER: activeRowId = "1" is visible, so GUARD 2 passes
    |   updateTabindices() runs with correct state
```

**State After First ArrowDown:**
- activeRowId = "1"
- activeFocusableIndex = -1
- _lastNavigationDirection = 1
- _isNavigating = false
- Focus on post 1

**Subsequent ArrowDown presses (post 1 -> 2 -> 3 -> 4 -> 5):**

Each follows the same pattern:
1. `_lastNavigationDirection = 1`
2. Find current index in rows array
3. Calculate `newIndex = currentIndex + 1`
4. Set `_isNavigating = true`
5. Update state and focus
6. `queueMicrotask` to clear `_isNavigating`

**Critical Timing Window:**

```
Between T3 (focusRowWithArray starts) and T6 (microtask clears flag):
  - _isNavigating = true
  - Any modify() call during this window will be SKIPPED (GUARD 1)
  - This protects against cloaking-triggered re-renders

After T6:
  - _isNavigating = false
  - modify() can run
  - BUT activeRowId points to visible row, so GUARD 2 passes correctly
```

---

### Scenario C: Posts 1-2 Get Cloaked During Scroll

**Context:** User has navigated to post 5, scrolling has moved posts 1-2 out of view.

**Cloaking Timeline:**

```
T0: User is on post 5, reading (1-2 second pause)
    |
T1: Viewport tracker's IntersectionObserver fires for post 1
    |   - Post 1 is no longer intersecting the cloaking zone
    |   - trackCloakedPosts() callback executes:
    |
    |     if (!isIntersecting) {
    |       this.#uncloakedPostNumbers.delete(1);
    |       this.#cloakedPostsStyle[post1.id] = {
    |         height: element.getBoundingClientRect().height,
    |         margin: getComputedStyle(element).margin
    |       };
    |     }
    |
    |     // Debounce boundary update
    |     discourseDebounce(this.#updateCloakBoundaries, 10ms);
    |
T11 (10ms later): #updateCloakBoundaries() executes
    |   const uncloakedPostNumbers = Array.from(this.#uncloakedPostNumbers);
    |   // Now excludes post 1: [2, 3, 4, 5, 6, 7, 8, 9, 10]
    |   // (but wait, post 2 is also being cloaked...)
    |
    |   // Calculate boundaries
    |   let above = 2, below = 10;  // Example
    |
    |   this.#setCloakingBoundaries(2, 10);
    |
T12: post-stream.gjs.setCloakingBoundaries() executes:
    |   requestAnimationFrame(() => {
    |     if (this.cloakAbove === 2 && this.cloakBelow === 10) {
    |       return;  // No change, skip
    |     }
    |     this.cloakAbove = 2;
    |     this.cloakBelow = 10;
    |   });
    |
T13: requestAnimationFrame callback runs
    |   this.cloakAbove = 2;  // Tracked property change
    |   this.cloakBelow = 10; // Tracked property change
    |
T14: Ember detects tracked property changes
    |   - Schedules re-render of post-stream template
    |
T15: Template re-renders
    |   - Each post calls getCloakingData(post, {above: 2, below: 10})
    |   - Post 1: post_number (1) < above (2), returns {active: true, style: ...}
    |   - Post 2-10: returns {active: false}
    |   - Post 1 gets class "post-stream--cloaked"
    |   - Post 1's DOM is replaced with placeholder
    |
T16: PostStreamNavigationModifier.modify() is called
    |   (Because the grid element's tracked dependencies changed)
    |
T17: modify() executes:
    |   // GUARD 1: Is navigation in progress?
    |   if (this._isNavigating) {
    |     console.log("SKIPPED - navigation in progress");
    |     return;  // User finished navigating, so this is false
    |   }
    |
    |   // GUARD 2: Is active row cloaked?
    |   const rows = this.rows;
    |   // rows now EXCLUDES post 1 (it has .post-stream--cloaked class)
    |   // rows = [header, post-2, post-3, post-4, post-5, ...]
    |
    |   const activeRowVisible = this.findRowIndexByIdWithArray(rows, this.activeRowId) !== -1;
    |   // this.activeRowId = "5"
    |   // Post 5 is in the rows array at some index
    |   // activeRowVisible = true
    |
    |   if (!activeRowVisible && this.activeRowId !== "header" && this.initialFocusComplete) {
    |     // This is FALSE - post 5 IS visible
    |     // Does NOT skip
    |   }
    |
    |   // Proceeds to update tabindices
    |   this.updateTabindices();
    |   // Sets tabindex="0" on post 5 (correct)
    |   this.setInternalTabindices();
```

**State After Cloaking:**
- activeRowId = "5" (unchanged, still valid)
- Focus still on post 5 (browser didn't move it)
- Posts 1-2 are now cloaked (placeholders in DOM)
- rows getter returns [header, post-3, post-4, post-5, ...]
- Tabindex="0" correctly remains on post 5

**Critical Observation:**
The cloaking of posts 1-2 DOES NOT affect navigation state because:
1. The user is on post 5 (visible)
2. activeRowId = "5" is found in the rows array
3. GUARD 2 passes, tabindices are updated correctly
4. No focus jumping occurs

---

### Scenario D: User Continues to Posts 8-10

**State:** User on post 5, posts 1-2 cloaked, posts 3-10 visible.

**User presses ArrowDown (5 -> 6):**

```
T0: keydown ArrowDown
    |
T1: focusNextRow()
    |   const rows = this.rows;
    |   // rows = [header, post-3, post-4, post-5, post-6, ..., post-10]
    |   // Note: post-1, post-2 are NOT in this array (cloaked)
    |
    |   this._lastNavigationDirection = 1;
    |
    |   const targetIsCloaked = this.findRowIndexByIdWithArray(rows, "5") === -1;
    |   // Post 5 found at index 3 (0=header, 1=post-3, 2=post-4, 3=post-5)
    |   // targetIsCloaked = false
    |
    |   const currentIndex = this.getActiveRowIndex(rows);
    |   // Returns 3
    |
    |   const newIndex = getNextIndex(rows, 3, false);
    |   // Returns 4
    |
    |   this.focusRowWithArray(rows, 4);
    |   // row = rows[4] = post-6 element
    |   // activeRowId = "6"
    |   // Focus moves to post 6
```

**Continuing to post 10:**

Each subsequent ArrowDown increments through the rows array. The navigation is stable because:
1. Posts 3-10 are all in the rows array
2. activeRowId correctly tracks by post number (not array index)
3. Array index calculation happens within single synchronous operation

**When user reaches post 10:**
- activeRowId = "10"
- _lastNavigationDirection = 1
- Focus on post 10
- Possibly posts 3-4 have also been cloaked by now (scrolled out above)

---

### Scenario E: User Arrows UP Through Posts 10-7

**State:** User on post 10, posts 1-4 cloaked, posts 5-10 visible.

**User presses ArrowUp (10 -> 9):**

```
T0: keydown ArrowUp
    |
T1: handleKeydown() calls focusPreviousRow()
    |
T2: focusPreviousRow() executes:
    |   const rows = this.rows;
    |   // rows = [header, post-5, post-6, post-7, post-8, post-9, post-10]
    |   // Length = 7
    |
    |   this._lastNavigationDirection = -1;  // UP
    |
    |   const targetIsCloaked = this.findRowIndexByIdWithArray(rows, "10") === -1;
    |   // Post 10 found at index 6
    |   // targetIsCloaked = false
    |
    |   const currentIndex = this.getActiveRowIndex(rows);
    |   // Returns 6
    |
    |   // Normal case: navigate from current position
    |   const newIndex = getPreviousIndex(rows, 6, false);
    |   // Returns 5
    |
    |   this.focusRowWithArray(rows, 5);
    |   // row = rows[5] = post-9 element
    |   // activeRowId = "9"
```

**Continuing 9 -> 8 -> 7:**

Same pattern. Navigation works correctly because all target posts are visible.

**Critical Timing Scenario - User pauses at post 7:**

```
User on post 7, waits 1.5 seconds
    |
During wait:
    - Viewport tracker observes new intersections
    - Posts 5-6 may become cloaked (scrolled out below)
    - Posts 3-4 may become uncloaked (scrolled into view above)
    |
T0: Cloaking boundary update
    |   cloakAbove = 3, cloakBelow = 10
    |
T1: Ember re-render
    |   - Posts 5-6 get cloaked (placeholder)
    |   - Posts 3-4 get uncloaked (rendered)
    |
T2: modify() is called
    |
    |   // GUARD 1: _isNavigating = false (user is idle)
    |
    |   // GUARD 2: Is activeRowId visible?
    |   const rows = this.rows;
    |   // rows = [header, post-3, post-4, post-7, post-8, post-9, post-10]
    |   // Note: posts 5-6 cloaked, posts 3-4 uncloaked
    |
    |   const activeRowVisible = this.findRowIndexByIdWithArray(rows, "7") !== -1;
    |   // Post 7 found at index 3
    |   // activeRowVisible = true
    |
    |   // GUARD 2 passes - proceed with tabindex updates
    |   this.updateTabindices();
    |   // Correctly sets tabindex="0" on post 7
```

**State after cloaking changes during idle:**
- activeRowId = "7" (still valid)
- Post 7 is visible in DOM
- Focus remains on post 7
- No focus jumping

---

### Scenario F: User Reaches Cloaked Region

**The Critical Scenario:** User on post 7, wants to navigate UP to post 6, but post 6 is now CLOAKED.

**State:**
- activeRowId = "7"
- Posts 5-6 are cloaked
- rows = [header, post-3, post-4, post-7, post-8, post-9, post-10]
- Focus on post 7

**User presses ArrowUp:**

```
T0: keydown ArrowUp
    |
T1: focusPreviousRow() executes:
    |   const rows = this.rows;
    |   // rows = [header, post-3, post-4, post-7, post-8, post-9, post-10]
    |   // Index mapping: 0=header, 1=post-3, 2=post-4, 3=post-7, ...
    |
    |   this._lastNavigationDirection = -1;  // UP
    |
    |   const targetIsCloaked = this.findRowIndexByIdWithArray(rows, "7") === -1;
    |   // Post 7 found at index 3
    |   // targetIsCloaked = false
    |
    |   const currentIndex = this.getActiveRowIndex(rows);
    |   // Returns 3
    |
    |   // Normal case: navigate from current position
    |   const newIndex = getPreviousIndex(rows, 3, false);
    |   // Returns 2 (index 2 = post-4)
    |
    |   this.focusRowWithArray(rows, 2);
    |   // row = rows[2] = post-4 element
    |   // activeRowId = "4"
    |   // Focus moves to post 4
```

**Wait - what happened to posts 5 and 6?**

The navigation SKIPPED over the cloaked posts (5, 6) and went directly from post 7 to post 4. This is the **CORRECT BEHAVIOR** because:

1. Posts 5-6 are not in the DOM (they are cloaked placeholders)
2. The `rows` getter filters out `.post-stream--cloaked` elements
3. The user cannot navigate to something that doesn't exist in the DOM
4. Post 4 is the logical "previous" post that IS in the DOM

**Alternative Scenario: activeRowId points to cloaked post**

What if the user was on post 6, THEN post 6 got cloaked, THEN user presses ArrowUp?

```
State: activeRowId = "6", but post 6 is NOW cloaked

T0: keydown ArrowUp
    |
T1: focusPreviousRow() executes:
    |   const rows = this.rows;
    |   // rows = [header, post-3, post-4, post-7, ...]
    |   // Post 6 is NOT in this array!
    |
    |   this._lastNavigationDirection = -1;  // UP
    |
    |   const targetIsCloaked = this.findRowIndexByIdWithArray(rows, "6") === -1;
    |   // Post 6 NOT found
    |   // targetIsCloaked = TRUE
    |
    |   const currentIndex = this.getActiveRowIndex(rows);
    |   // This triggers the DIRECTIONAL FALLBACK
    |
    |   // Inside getActiveRowIndex():
    |   const index = this.findRowIndexByIdWithArray(rows, "6");
    |   // Returns -1 (not found)
    |
    |   // Directional fallback for UP navigation:
    |   // Find first visible post with post_number <= 6
    |   // Candidates: post-4 (4 <= 6), post-3 (3 <= 6)
    |   // Best match: post-4 (closest to 6)
    |   // Returns index 2 (post-4)
    |
    |   currentIndex = 2;  // Post 4
    |
    |   // CRITICAL: Since targetIsCloaked is true, we DON'T call getPreviousIndex
    |   if (targetIsCloaked) {
    |     // Fallback already gave us the correct position
    |     this.focusRowWithArray(rows, currentIndex);  // Focus post 4
    |   }
    |
    |   // We focus post 4, NOT post 3
    |   // activeRowId = "4"
```

**Why this matters:** Without the `targetIsCloaked` check, the code would:
1. Get fallback index 2 (post 4)
2. Call `getPreviousIndex(rows, 2)` = 1 (post 3)
3. Focus post 3

This would be a **DOUBLE STEP** - user intended to go from 6 to 5 (or wherever), but ended up at post 3. The `targetIsCloaked` check prevents this.

---

### Scenario G: User Arrows UP to Header Row

**State:**
- activeRowId = "3"
- rows = [header, post-3, post-4, ...]
- Focus on post 3 (index 1 in rows)

**User presses ArrowUp:**

```
T0: keydown ArrowUp
    |
T1: focusPreviousRow() executes:
    |   const rows = this.rows;
    |
    |   this._lastNavigationDirection = -1;  // UP
    |
    |   const targetIsCloaked = this.findRowIndexByIdWithArray(rows, "3") === -1;
    |   // Post 3 found at index 1
    |   // targetIsCloaked = false
    |
    |   const currentIndex = this.getActiveRowIndex(rows);
    |   // Returns 1
    |
    |   const newIndex = getPreviousIndex(rows, 1, false);
    |   // wrap = false, so at boundary returns 0
    |   // Returns 0
    |
    |   this.focusRowWithArray(rows, 0);
    |   // row = rows[0] = header-row element
    |   // activeRowId = "header"
    |   // Focus moves to header row
```

**User presses ArrowUp again (at header, can't go further up):**

```
T0: keydown ArrowUp
    |
T1: focusPreviousRow() executes:
    |   const rows = this.rows;
    |
    |   this._lastNavigationDirection = -1;
    |
    |   const currentIndex = this.getActiveRowIndex(rows);
    |   // Returns 0 (header)
    |
    |   const newIndex = getPreviousIndex(rows, 0, false);
    |   // wrap = false, at index 0, returns 0
    |   // Returns 0 (no change)
    |
    |   if (newIndex !== currentIndex) {
    |     // 0 === 0, condition is false
    |     // No navigation occurs
    |   }
```

**Result:** Focus stays on header row. No action taken.

---

## State Management Deep Dive

### activeRowId vs Array Index

The system tracks position by **post number** (stable) rather than array index (volatile).

**Why this matters:**

```
Initial state:
  rows = [header, post-1, post-2, post-3, post-4, post-5]
  User on post 3 (index 3)
  activeRowId = "3"

After posts 1-2 are cloaked:
  rows = [header, post-3, post-4, post-5]
  Post 3 is now at index 1!

  If we tracked by INDEX:
    activeIndex = 3  // Now points to post-5!
    Broken!

  If we track by ID:
    activeRowId = "3"
    findRowIndexById("3") = 1  // Correctly finds post 3
    Correct!
```

### _lastNavigationDirection States

| Value | Meaning | Set When |
|-------|---------|----------|
| -1 | Navigating UP | `focusPreviousRow()`, `focusRowByOffset(-N)` |
| 1 | Navigating DOWN | `focusNextRow()`, `focusRowByOffset(+N)` |
| 0 | No preference | `handleFocusIn()` (mouse click, Tab), `focusFirstRow()`, `focusLastRow()` |

**Purpose:** Provides directional context for fallback when target row is cloaked.

### _isNavigating Flag Lifecycle

```
focusRowWithArray() start:
  _isNavigating = true
  |
  +-- updateTabindices()
  +-- updateCloakingPrevention()
  +-- row.focus()
  +-- scrollRowIntoView()
  |
  finally block:
    queueMicrotask(() => {
      _isNavigating = false
    })
```

**Why queueMicrotask?**

Microtasks run AFTER current synchronous code but BEFORE the next macrotask (including event handlers and setTimeout).

```
JavaScript execution order:
1. Synchronous code (focus, scroll)
2. Microtasks (queueMicrotask, Promise.then)
3. Rendering (browser paint)
4. Macrotasks (setTimeout, user events)

If modify() is triggered synchronously by focus/scroll:
  - It runs BEFORE the microtask clears the flag
  - _isNavigating = true, GUARD 1 protects us

If modify() is triggered asynchronously (later re-render):
  - By then _isNavigating = false
  - BUT activeRowId points to visible row, GUARD 2 protects us
```

---

## Race Condition Analysis

### Race Condition 1: Multiple this.rows Calls (FIXED)

**The Original Bug:**

```javascript
// OLD CODE (vulnerable)
focusNextRow() {
  const rows = this.rows;           // Snapshot 1: [header, 1, 2, 3, 4, 5]
  const currentIndex = this.activeRowIndex;  // Internally calls this.rows! Snapshot 2!
  // If cloaking happened between snapshots, indices mismatch
}
```

**The Fix:**

```javascript
// CURRENT CODE (safe)
focusNextRow() {
  const rows = this.rows;           // Single snapshot
  const currentIndex = this.getActiveRowIndex(rows);  // Accepts rows parameter
  // Uses same snapshot throughout
}
```

### Race Condition 2: modify() During Navigation (FIXED)

**The Original Bug:**

```javascript
// OLD CODE (vulnerable)
modify() {
  // Runs on EVERY re-render
  const focusedElement = document.activeElement;
  // If navigation just started, could read stale focus
  this.activeRowId = this.getRowId(focusedRow);  // Overwrites navigation state!
}
```

**The Fix:**

```javascript
// CURRENT CODE (safe)
modify() {
  // GUARD 1: Skip during active navigation
  if (this._isNavigating) {
    return;
  }

  // GUARD 2: Skip if active row is cloaked
  if (!activeRowVisible && this.activeRowId !== "header" && this.initialFocusComplete) {
    return;
  }

  // Safe to update tabindices
}
```

### Race Condition 3: Directional Fallback Double-Step (FIXED)

**The Original Bug:**

```javascript
// OLD CODE (vulnerable)
focusPreviousRow() {
  const currentIndex = this.activeRowIndex;  // Fallback returns index of post-4
  const newIndex = getPreviousIndex(rows, currentIndex);  // Goes to post-3!
  // Double step: intended 6->5, got 6->3
}
```

**The Fix:**

```javascript
// CURRENT CODE (safe)
focusPreviousRow() {
  const targetIsCloaked = this.findRowIndexByIdWithArray(rows, this.activeRowId) === -1;
  const currentIndex = this.getActiveRowIndex(rows);

  if (targetIsCloaked) {
    // Fallback already gave us the right position
    this.focusRowWithArray(rows, currentIndex);  // Don't apply getPreviousIndex!
  } else {
    // Normal case
    const newIndex = getPreviousIndex(rows, currentIndex);
    this.focusRowWithArray(rows, newIndex);
  }
}
```

### Race Condition 4: Focus Loss During Cloaking (FIXED)

**The Problem:**

When a focused element is removed from DOM (cloaked), browser moves focus to `<body>`.

**The Fix:**

```javascript
handleFocusOut(event) {
  if (!event.relatedTarget || !this.element.contains(event.relatedTarget)) {
    requestAnimationFrame(() => {
      // Only recover if ACTIVELY navigating (not passive scroll)
      if (this._isNavigating && document.activeElement === document.body) {
        // Recover focus
        const targetIndex = this.getActiveRowIndex(rows);
        this.focusRowWithArray(rows, targetIndex);
      } else if (document.activeElement === document.body) {
        // Passive cloaking - don't auto-recover (prevents loops)
        // User can press arrow keys to resume
      }
    });
  }
}
```

### Remaining Potential Race Conditions

**1. Rapid Keypresses**

```
T0: ArrowDown pressed
T1: focusNextRow() starts, _isNavigating = true
T2: ArrowDown pressed again (before T1 completes)
T3: focusNextRow() called again
```

**Analysis:** This is actually SAFE because:
- Each call captures a fresh `rows` snapshot
- `activeRowId` is updated synchronously within `focusRowWithArray`
- The second call reads the updated `activeRowId`
- Both calls complete without interference

**2. J/K Keyboard Shortcuts (NOT FIXED)**

Discourse's built-in J/K navigation calls `focus()` directly, bypassing our modifier.

```javascript
// In keyboard-shortcuts.js (Discourse core)
moveSelection(direction) {
  // ... finds next post element
  element.focus();  // Direct focus, no navigation state update
}
```

**Impact:** This can desync `activeRowId` from actual focus. However:
- Screen reader users use arrow keys (WAI-ARIA pattern)
- J/K is a Vim-style shortcut for sighted users
- Low priority to fix

---

## Cloaking System Integration

### preventCloaking() API

```javascript
// In post-stream-viewport-tracker.js
const cloakingPrevented = { topicId: null, posts: new Set() };

export function preventCloaking(postId, prevent = true) {
  if (prevent) {
    cloakingPrevented.posts.add(postId);
  } else {
    cloakingPrevented.posts.delete(postId);
  }
}

// In getCloakingData()
getCloakingData(post, { above, below }) {
  if (
    !cloakingEnabled ||
    !post ||
    cloakingPrevented.posts.has(post.id) ||  // Check prevention
    this.#postsOnScreen[post.post_number]
  ) {
    return { active: false };  // Don't cloak
  }
  // ... cloaking logic
}
```

### Navigation Modifier's Use of preventCloaking

```javascript
// In post-stream-navigation.js
updateCloakingPrevention(row) {
  const newPostId = row.dataset?.postId;

  // Clear previous prevention
  if (this._preventedCloakingPostId && this._preventedCloakingPostId !== newPostId) {
    preventCloaking(parseInt(this._preventedCloakingPostId, 10), false);
    this._preventedCloakingPostId = null;
  }

  // Prevent cloaking on new post
  if (newPostId && newPostId !== this._preventedCloakingPostId) {
    preventCloaking(parseInt(newPostId, 10), true);
    this._preventedCloakingPostId = newPostId;
  }
}
```

**Effect:** The currently focused post cannot be cloaked, preventing focus loss during navigation.

### Cloaking Timing Constants

```javascript
const SCROLL_BATCH_INTERVAL_MS = 10;  // Debounce for cloaking updates
const RESIZE_DEBOUNCE_MS = 100;       // Debounce for resize events
const SLACK_FACTOR = 1;               // Keep 1x viewport above/below uncloaked
const UNCLOAKING_HYSTERESIS_THRESHOLD_PX = 5;  // Minimum intersection to uncloak
const UNCLOAKING_HYSTERESIS_RATIO = 0.05;      // Minimum ratio to uncloak
```

**The 10ms Debounce:**
- Cloaking boundary updates are batched every 10ms
- This prevents rapid cloaking/uncloaking during smooth scroll
- BUT it means state changes are asynchronous

---

## Guard Mechanisms

### GUARD 1: _isNavigating Flag

**Location:** `modify()` method, line 100

```javascript
if (this._isNavigating) {
  console.log(`[A11Y-NAV] modify(): SKIPPED - navigation in progress`);
  return;
}
```

**Purpose:** Prevents `modify()` from interfering with tabindex state during active navigation.

**Timing:** Active from `focusRowWithArray()` start until microtask clears it.

### GUARD 2: Cloaked Active Row Detection

**Location:** `modify()` method, lines 111-117

```javascript
const rows = this.rows;
const activeRowVisible = this.findRowIndexByIdWithArray(rows, this.activeRowId) !== -1;

if (!activeRowVisible && this.activeRowId !== "header" && this.initialFocusComplete) {
  console.log(`[A11Y-NAV] modify(): SKIPPED - activeRowId=${this.activeRowId} is cloaked`);
  return;
}
```

**Purpose:** When the user's focused post gets cloaked (scrolled far out of view), don't update tabindices. This prevents:
1. Setting `tabindex="0"` on a fallback post
2. Browser/Ember moving focus to the new `tabindex="0"` element
3. Focus jumping to wrong location

**When it triggers:**
- User scrolls away from focused post without navigating
- Focused post gets cloaked due to IntersectionObserver
- `modify()` runs during re-render
- GUARD 2 prevents tabindex corruption

### GUARD 3: focusFirstUnreadPost Abort

**Location:** `focusFirstUnreadPost()` method, lines 157-160

```javascript
if (this.activeRowId !== "header") {
  console.log(`[A11Y-NAV] focusFirstUnreadPost: ABORTED - user already navigated`);
  return;
}
```

**Purpose:** The initial auto-focus is scheduled via `schedule("afterRender")` + `requestAnimationFrame`. If the user starts navigating before it fires, don't steal focus.

### GUARD 4: handleFocusOut Navigation Check

**Location:** `handleFocusOut()` method, lines 615-616

```javascript
if (this._isNavigating && ...) {
  // Recover focus
} else {
  // Passive cloaking - don't recover
}
```

**Purpose:** Only auto-recover focus if it was lost DURING active navigation. If focus is lost due to passive scrolling (user scrolled away), don't auto-recover (would create infinite loop).

---

## Recommendations

### Current State Assessment

The post-stream-navigation system has undergone significant hardening against race conditions. The current implementation handles:

1. **Multiple rows snapshots** - FIXED via parameter passing
2. **modify() interference** - FIXED via GUARD 1 and GUARD 2
3. **Directional fallback double-step** - FIXED via targetIsCloaked check
4. **Focus loss during cloaking** - FIXED via focusout handler with navigation check
5. **Initial focus stealing** - FIXED via GUARD 3

### Remaining Concerns

1. **J/K Shortcut Interference** - LOW PRIORITY
   - Discourse's J/K shortcuts bypass the modifier
   - Screen reader users use arrow keys per WAI-ARIA
   - Could be fixed by having shortcuts emit events we listen to

2. **Console Logging** - CLEANUP NEEDED
   - Extensive debug logging in production code
   - Should be removed or made conditional

3. **Performance** - MONITOR
   - `rows` getter queries DOM on every call
   - Could cache with invalidation, but adds complexity
   - Current performance seems acceptable

### Testing Checklist

- [ ] Tab into grid - focus on header row
- [ ] ArrowDown to navigate through all posts
- [ ] ArrowUp to navigate back
- [ ] Navigate at 100ms intervals (rapid)
- [ ] Navigate at 1500ms intervals (slow)
- [ ] Navigate past cloaking boundaries
- [ ] Navigate when current post gets cloaked
- [ ] Home/End keys
- [ ] PageUp/PageDown
- [ ] Mouse click during navigation
- [ ] Tab out and back in
- [ ] Screen reader testing (NVDA, JAWS)

---

## Appendix: Key Code Locations

| Function | File | Line |
|----------|------|------|
| `modify()` | post-stream-navigation.js | 70-128 |
| `focusNextRow()` | post-stream-navigation.js | 639-671 |
| `focusPreviousRow()` | post-stream-navigation.js | 674-706 |
| `focusRowWithArray()` | post-stream-navigation.js | 752-788 |
| `getActiveRowIndex()` | post-stream-navigation.js | 272-361 |
| `handleFocusIn()` | post-stream-navigation.js | 562-593 |
| `handleFocusOut()` | post-stream-navigation.js | 607-636 |
| `updateCloakingPrevention()` | post-stream-navigation.js | 804-819 |
| `getCloakingData()` | post-stream-viewport-tracker.js | 439-468 |
| `trackCloakedPosts()` | post-stream-viewport-tracker.js | 478-527 |
| `#updateCloakBoundaries()` | post-stream-viewport-tracker.js | 918-931 |
| `setCloakingBoundaries()` | post-stream.gjs | 222-234 |

---

*Document generated: 2026-01-22*
*Analysis by: Claude Opus 4.5 (ULTRATHINK Agent 1)*
