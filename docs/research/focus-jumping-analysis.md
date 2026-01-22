# Focus Jumping Issue Analysis - Post Stream Navigation

## Executive Summary

The post-stream-navigation.js modifier exhibits unpredictable focus jumping behavior when users navigate posts using arrow keys with 1-2 second delays between keypresses. This document provides a comprehensive three-pass analysis identifying root causes and presenting three distinct solution options.

**Root Cause Summary**: The focus jumping is caused by a race condition between the Ember modifier's `modify()` lifecycle being triggered by re-renders (from cloaking/uncloaking, posts loading, etc.) while navigation is in progress. The `modify()` method attempts to "preserve focus" by updating `activeRowId` based on current DOM state, but this happens asynchronously relative to the user's navigation intent.

## Critical Timing Analysis

### Why 1-2 Second Delays Cause Issues

The viewport tracker (`post-stream-viewport-tracker.js`) uses multiple debounced operations:

```javascript
const SCROLL_BATCH_INTERVAL_MS = 10;
const RESIZE_DEBOUNCE_MS = 100;

// Debounced operations that can trigger re-renders:
- discourseDebounce(this.#scrollTriggered, 10ms)
- discourseDebounce(this.#updateCloakBoundaries, 10ms)
- discourseDebounce(this.#updateScreenTracking, 10ms)
- discourseDebounce(this.#findPostMatchingEyeline, 10ms)
```

The 1-2 second timing window is significant because:
1. **< 100ms delays**: Navigation completes before any cloaking can occur
2. **1-2 second delays**: Enough time for smooth scroll, intersection observers, and cloaking to complete
3. **> 3 second delays**: State has fully stabilized

### Comparison with grid-navigation.js

| Aspect | grid-navigation.js | post-stream-navigation.js |
|--------|-------------------|---------------------------|
| Row tracking | Uses array index | Uses stable ID (`activeRowId`) |
| Row stability | Static DOM | Rows cloaked/uncloaked dynamically |
| Focus preservation | Simple index validation | Multiple fallback strategies |
| Cloaking | None | Complex cloaking system |

Grid navigation works reliably because the DOM structure is stable - rows are never virtualized.

---

## First Analysis Pass: DOM Structure and Focus Management

### Row Identification Architecture

The navigation system identifies rows in two ways:

1. **`activeRowId`** (line 41): A stable identifier using post numbers or "header"
   - For topic header row: `"header"`
   - For post rows: the `data-post-number` attribute value as a string

2. **`rows` getter** (lines 195-199): Live DOM query that filters out cloaked posts
   ```javascript
   get rows() {
     return Array.from(
       this.element.querySelectorAll(this.options.rowSelector)
     ).filter((row) => !row.closest(".post-stream--cloaked"));
   }
   ```

### Critical Issue #1: Dynamic Row Set

The `rows` getter returns a **live snapshot** that can change between calls:
- Posts get cloaked/uncloaked as user scrolls
- Posts are dynamically loaded (above/below)
- Re-renders can add/remove DOM elements

When a user presses Arrow Down, the flow is:
1. `focusNextRow()` gets `rows` array (call #1)
2. `getNextIndex()` calculates new index
3. `focusRow(newIndex)` called
4. Inside `focusRow()`, `rows` is accessed again (call #2)
5. **If the rows array changed between calls, the wrong row gets focused**

### Critical Issue #2: `modify()` Focus Preservation Logic

Lines 82-112 in `modify()` attempt to preserve focus:

```javascript
if (focusedElement && this.element.contains(focusedElement)) {
  const cloakedContainer = focusedElement.closest(".post-stream--cloaked");
  if (cloakedContainer) {
    focusInCloakedPost = true;
  } else {
    const rows = this.rows;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i] === focusedElement || rows[i].contains(focusedElement)) {
        this.activeRowId = this.getRowId(rows[i]);
        // ...
      }
    }
  }
}
```

**Problem**: When `modify()` runs during a navigation operation (between keydown and focus completion), it can overwrite `activeRowId` with a stale value, causing the next navigation to jump to an unexpected location.

### Focus Ring vs Actual Focus

The code calls `row.focus()` directly (line 557), which should move actual DOM focus. However:
- The `updateTabindices()` call happens **before** `focus()` (line 550)
- If a re-render triggers during this gap, tabindex values may get reset
- The row that receives `tabindex="0"` may differ from the row that gets `focus()`

---

## Second Analysis Pass: Navigation Flow

### `handleArrowNavigation` Flow (focusNextRow/focusPreviousRow)

```
User presses ArrowDown
    |
    v
handleKeydown() [line 361]
    |
    v
focusNextRow() [line 493]
    |-- Get rows = this.rows (snapshot #1)
    |-- Get currentIndex = this.activeRowIndex (uses activeRowId)
    |-- Calculate newIndex via getNextIndex()
    |
    v
focusRow(newIndex) [line 542]
    |-- Get rows = this.rows (snapshot #2) <-- POTENTIAL MISMATCH
    |-- Set this.activeRowId from row at index
    |-- Set this.activeFocusableIndex = -1
    |-- this.inDocumentMode = false
    |-- updateTabindices() <-- UPDATES tabindex attributes
    |-- updateCloakingPrevention(row)
    |-- row.focus() <-- ACTUAL FOCUS
    |-- scrollRowIntoView(row)
```

### Critical Issue #3: Multiple `this.rows` Calls

Between `focusNextRow()` and `focusRow()`, the code accesses `this.rows` twice. If a cloaking/uncloaking operation happens between these calls (which can happen on every scroll), the indices become misaligned.

Example scenario:
1. User is at post #3, there are 10 visible posts (indices 0-9)
2. Post #3 is at index 3 in rows array
3. User presses Down, `getNextIndex()` returns 4
4. Before `focusRow(4)` executes, the viewport tracker uncloaks post #1 above
5. Now post #3 is at index 4, and index 4 points to post #4
6. But `focusRow(4)` is called, which focuses post #4 instead of post #4

Wait - that seems correct. Let me trace a different scenario:

**Actual problematic scenario**:
1. User is at post #5 (index 5 of 10 posts, indices 0-9)
2. User presses Down, `focusNextRow()` calculates newIndex = 6
3. Scroll triggers cloaking of posts #1 and #2 (they go off-screen)
4. Now only 8 posts visible, post #5 is at new index 3
5. `focusRow(6)` is called with the OLD index 6
6. Index 6 now points to post #8, not post #6
7. **Focus jumps from post #5 to post #8 instead of post #6**

### Smooth Scrolling and Timing

The `scrollRowIntoView()` method uses `behavior: "smooth"` (line 616), which is asynchronous. This creates a window where:
1. Focus is set on a row
2. Smooth scroll begins
3. Scroll triggers viewport changes
4. Viewport tracker uncloaks/cloaks posts
5. `modify()` is called due to re-render
6. `activeRowId` potentially gets overwritten

### updateCloakingPrevention Interaction

The `updateCloakingPrevention()` method (lines 571-586) uses `preventCloaking()` from the viewport tracker to prevent the focused post from being cloaked. However:
- It only protects the **newly focused** post
- The **previously focused** post becomes cloak-eligible
- If the user navigates quickly, the cloaking prevention may not propagate fast enough

---

## Third Analysis Pass: Lifecycle Issues

### Ember Modifier Lifecycle

The `PostStreamNavigationModifier` extends `Modifier` which has these lifecycle hooks:
- `modify()` - Called on install AND every time tracked dependencies change
- Destructor via `registerDestructor()` - Called on teardown

**Key insight**: `modify()` is called on EVERY re-render of the post-stream component, not just installation. This happens when:
1. `cloakAbove` or `cloakBelow` changes (lines 38-39 in post-stream.gjs are tracked)
2. Posts are added/removed from the stream
3. Any tracked property in the component changes

### Critical Issue #4: `modify()` Runs During Navigation

The timeline of events:
```
T=0ms:    User presses ArrowDown
T=1ms:    handleKeydown fires
T=2ms:    focusNextRow calculates new index
T=3ms:    focusRow begins execution
T=4ms:    updateTabindices called
T=5ms:    row.focus() called
T=6ms:    scrollRowIntoView starts smooth scroll
T=50ms:   Scroll triggers viewport observer
T=60ms:   Cloaking boundaries updated (setCloakingBoundaries called)
T=70ms:   Ember re-renders due to tracked property change
T=80ms:   modify() is called
T=81ms:   modify() checks document.activeElement
T=82ms:   modify() potentially overwrites activeRowId
T=1500ms: User presses ArrowDown again
T=1501ms: Navigation uses potentially corrupted activeRowId
```

### Critical Issue #5: No Navigation Lock

There's no mechanism to indicate "navigation in progress" to prevent `modify()` from interfering. The code at lines 82-112 tries to preserve focus but doesn't know if it's interrupting an ongoing navigation operation.

### Re-render Triggers in post-stream.gjs

Looking at line 279 in post-stream.gjs:
```handlebars
{{PostStreamNavigation lastReadPostNumber=@lastReadPostNumber}}
```

The `lastReadPostNumber` is passed as a named argument. If this value changes (which it does as the user reads posts), it triggers `modify()` to run again.

Additionally, the viewport tracker's `setCloakingBoundaries` (lines 222-234) updates tracked properties:
```javascript
@action
setCloakingBoundaries(above, below) {
  requestAnimationFrame(() => {
    this.cloakAbove = above;
    this.cloakBelow = below;
  });
}
```

These tracked property updates cause Ember to re-render the template, which can trigger `modify()`.

### The 1-2 Second Delay Pattern

Why does the bug manifest with 1-2 second delays?

1. **Immediate keypresses** (< 100ms): The navigation completes before any cloaking/uncloaking can occur
2. **1-2 second delays**: Enough time for:
   - Smooth scroll to complete
   - Intersection observers to fire
   - Cloaking boundaries to update
   - Ember to re-render
   - `modify()` to potentially corrupt state
3. **Longer delays** (> 3 seconds): State has fully stabilized, so next navigation works correctly

---

## Solution Options

### Option 1: Navigation Lock with Debounced State Sync

**Concept**: Add a navigation lock flag that prevents `modify()` from overwriting state during active navigation, with a debounced callback to sync state after navigation completes.

**Implementation**:
```javascript
// Add to class properties
_navigationInProgress = false;
_navigationDebounceTimer = null;

// Modify focusRow to set the lock
focusRow(index) {
  this._navigationInProgress = true;
  clearTimeout(this._navigationDebounceTimer);

  // ... existing focus logic ...

  // Clear lock after navigation settles (after smooth scroll completes)
  this._navigationDebounceTimer = setTimeout(() => {
    this._navigationInProgress = false;
  }, 300); // Match smooth scroll duration
}

// Modify modify() to respect the lock
modify(element, positional, named) {
  // ... element setup ...

  // Skip focus preservation during active navigation
  if (!this._navigationInProgress) {
    // ... existing focus preservation logic ...
  }

  // ... rest of modify ...
}
```

**Pros**:
- Minimal code changes
- Directly addresses the race condition
- Doesn't change the fundamental architecture

**Cons**:
- Adds timing-dependent logic (300ms magic number)
- Could miss edge cases where navigation takes longer
- Doesn't address the root cause of multiple `this.rows` calls

**Risk Level**: Medium

---

### Option 2: Single Rows Snapshot Per Navigation

**Concept**: Capture the rows array once at the start of each navigation operation and use that same reference throughout. This eliminates the index mismatch caused by multiple `this.rows` calls.

**Implementation**:
```javascript
focusNextRow() {
  const rows = this.rows; // Capture once
  if (rows.length === 0) {
    return;
  }

  // Find current index in THIS snapshot
  const currentIndex = this.findRowIndexByIdInRows(rows, this.activeRowId);
  const newIndex = getNextIndex(rows, currentIndex, this.options.wrap);

  if (newIndex !== currentIndex && newIndex >= 0) {
    this.focusRowFromSnapshot(rows, newIndex);
  }
}

focusRowFromSnapshot(rows, index) {
  if (index >= 0 && index < rows.length) {
    const row = rows[index];
    this.activeRowId = this.getRowId(row);
    this.activeFocusableIndex = -1;
    this.inDocumentMode = false;

    // Update tabindices using the SAME rows snapshot
    updateRovingTabindex(rows, index);

    this.updateCloakingPrevention(row);
    row.focus();
    this.scrollRowIntoView(row);
  }
}

// New helper method
findRowIndexByIdInRows(rows, rowId) {
  if (!rowId) return 0;
  for (let i = 0; i < rows.length; i++) {
    if (this.getRowId(rows[i]) === rowId) {
      return i;
    }
  }
  return 0; // Fallback to first row
}
```

**Pros**:
- Eliminates the fundamental source of index mismatch
- More predictable behavior
- No timing dependencies

**Cons**:
- Requires refactoring multiple navigation methods
- Still doesn't prevent `modify()` from corrupting state
- The rows snapshot could become stale if navigation is slow

**Risk Level**: Low-Medium

---

### Option 3: Post-ID Based Navigation (Recommended)

**Concept**: Navigate entirely by post ID/number rather than array index. Instead of calculating "go to index 4", calculate "go to the post after post #5". This approach is immune to cloaking/uncloaking changing array indices.

**Implementation**:
```javascript
focusNextRow() {
  const currentRowId = this.activeRowId;
  const rows = this.rows;
  if (rows.length === 0) return;

  // Find the row with ID greater than current
  const sortedRows = this.getSortedRowsByPostNumber(rows);
  let nextRow = null;

  if (currentRowId === "header") {
    // After header, go to first post
    nextRow = sortedRows.find(r => this.getRowId(r) !== "header");
  } else {
    const currentPostNumber = parseInt(currentRowId, 10);
    // Find smallest post number greater than current
    for (const row of sortedRows) {
      const rowId = this.getRowId(row);
      if (rowId !== "header") {
        const postNumber = parseInt(rowId, 10);
        if (postNumber > currentPostNumber) {
          nextRow = row;
          break;
        }
      }
    }
  }

  if (nextRow) {
    this.focusRowByElement(nextRow);
  } else if (!this.options.wrap) {
    // Stay at current or go to last
    const lastRow = sortedRows[sortedRows.length - 1];
    if (lastRow) this.focusRowByElement(lastRow);
  }
}

focusRowByElement(row) {
  this.activeRowId = this.getRowId(row);
  this.activeFocusableIndex = -1;
  this.inDocumentMode = false;
  this.updateTabindices();
  this.updateCloakingPrevention(row);
  row.focus();
  this.scrollRowIntoView(row);
}

getSortedRowsByPostNumber(rows) {
  return [...rows].sort((a, b) => {
    const aId = this.getRowId(a);
    const bId = this.getRowId(b);
    if (aId === "header") return -1;
    if (bId === "header") return 1;
    return parseInt(aId, 10) - parseInt(bId, 10);
  });
}
```

**Combined with Option 1's navigation lock for `modify()`**:
```javascript
modify(element, positional, named) {
  // ... setup code ...

  // Only preserve focus if NOT navigating and focus is actually in grid
  if (!this._navigationInProgress) {
    const focusedElement = document.activeElement;
    if (focusedElement && this.element.contains(focusedElement)) {
      // ... existing preservation logic ...
    }
  }

  // ... rest of modify ...
}
```

**Pros**:
- Fundamentally immune to index-based race conditions
- Post numbers are stable identifiers that don't change with cloaking
- Works correctly even if rows appear/disappear
- Aligns with the existing `activeRowId` concept (post numbers as strings)
- Combined with navigation lock, addresses both root causes

**Cons**:
- More significant refactor
- Sorting has O(n log n) cost (but n is typically small - visible posts)
- Need to handle edge cases (gaps in post numbers, deleted posts)

**Risk Level**: Medium (but highest reward)

---

## Recommendation

**I recommend Option 3 (Post-ID Based Navigation) combined with the navigation lock from Option 1.**

### Justification

1. **Addresses Root Cause**: The fundamental issue is that array indices are unstable. Post numbers are stable identifiers that don't change when posts are cloaked/uncloaked.

2. **Aligns with Existing Architecture**: The code already tracks `activeRowId` as a post number string. This approach fully embraces that pattern.

3. **Defensive Programming**: The navigation lock provides defense-in-depth against `modify()` interference, which is valuable regardless of the navigation approach.

4. **Future-Proof**: As Discourse adds more dynamic loading features, post-ID based navigation will remain stable.

5. **Minimal User-Visible Risk**: Navigation will feel the same to users but be more reliable.

### Implementation Priority

1. First: Add navigation lock to `modify()` (quick fix, immediate relief)
2. Second: Refactor navigation methods to use post-ID based navigation
3. Third: Add comprehensive tests for navigation with simulated cloaking

---

## Appendix: Code References

### Key Files
- `frontend/discourse/app/modifiers/post-stream-navigation.js` - Main navigation modifier
- `frontend/discourse/app/modifiers/post-stream-viewport-tracker.js` - Cloaking logic
- `frontend/discourse/app/components/post-stream.gjs` - Post stream component
- `frontend/discourse/app/components/post.gjs` - Individual post component
- `frontend/discourse/app/lib/keyboard-navigation-utils.js` - Navigation helpers

### Critical Code Sections
- Lines 64-124: `modify()` method with focus preservation
- Lines 195-199: `rows` getter (live DOM query)
- Lines 493-519: `focusNextRow()`/`focusPreviousRow()`
- Lines 542-563: `focusRow()`
- Lines 571-586: `updateCloakingPrevention()`

### Related Cloaking Code
- `post-stream-viewport-tracker.js` lines 87-93: `preventCloaking()` function
- `post-stream.gjs` lines 222-234: `setCloakingBoundaries()` action

---

## Deep Dive: Uncloaking Mechanism

### How Cloaking Works

From `post-stream-viewport-tracker.js`:

```javascript
// Posts outside this margin are cloaked
#cloakOffset = Math.ceil(viewportHeight * SLACK_FACTOR)  // SLACK_FACTOR = 1

// Cloaking observer with hysteresis thresholds
const UNCLOAKING_HYSTERESIS_THRESHOLD_PX = 5;
const UNCLOAKING_HYSTERESIS_RATIO = 0.05;

#cloakingObserver = IntersectionObserver({
  rootMargin: `${cloakOffset}px 0px`,  // ~viewport height above/below
  threshold: [0, 0.05, 1]  // Includes UNCLOAKING_HYSTERESIS_RATIO
})
```

### The Uncloaking Sequence

1. `trackCloakedPosts()` callback fires when post enters/exits cloaking zone
2. Updates `#uncloakedPostNumbers` Set
3. **Debounces** `#updateCloakBoundaries` at 10ms
4. Boundaries update triggers Ember re-render via tracked properties
5. Cloaked posts become real DOM, visible posts outside boundaries become placeholders

### Focus Restoration and preventCloaking

The `preventCloaking()` function (lines 87-93) is used by navigation:

```javascript
// From post-stream-navigation.js lines 571-586
updateCloakingPrevention(row) {
  const newPostId = row.dataset?.postId;

  // Clear previous prevention
  if (this._preventedCloakingPostId && this._preventedCloakingPostId !== newPostId) {
    preventCloaking(parseInt(this._preventedCloakingPostId, 10), false);
  }

  // Prevent cloaking on new post
  if (newPostId) {
    preventCloaking(parseInt(newPostId, 10), true);
  }
}
```

### The Bug Pattern in Detail

1. User on Post 5, presses ArrowDown
2. Navigation focuses Post 6, calls `preventCloaking(6, true)` and `preventCloaking(5, false)`
3. **1-2 seconds pass** - user is reading
4. During this time, viewport tracker may have:
   - Cloaked Posts 3-4 (scrolled out of viewport)
   - Uncloaked Posts 8-9 (scrolled into viewport)
   - Updated cloaking boundaries via `#updateCloakBoundaries`
   - Triggered Ember re-render via tracked `cloakAbove`/`cloakBelow`
5. `modify()` runs during re-render, re-queries `this.rows`
6. `activeRowIndex` getter (lines 238-272) attempts to find Post 6 in new rows array
7. If timing is unfortunate, index misalignment occurs
8. User presses ArrowDown again - navigation uses corrupted state

### The activeRowIndex Getter Issue

```javascript
// Lines 238-272
get activeRowIndex() {
  const index = this.findRowIndexById(this.activeRowId);
  if (index !== -1) {
    return index;  // Normal case - post found
  }

  // Row not found (cloaked) - find closest visible row
  // THIS is where focus can "jump" to unexpected post
  const targetPostNumber = parseInt(this.activeRowId, 10);
  // ... finds closest by post number
}
```

If `activeRowId` references a post that was briefly cloaked during the timing window, the fallback kicks in and may select a different row.

---

## Testing Strategy

For any solution, verify these scenarios:

| Test Case | Expected Behavior |
|-----------|-------------------|
| Navigate at 100ms intervals (rapid) | Focus moves sequentially |
| Navigate at 500ms intervals (normal) | Focus moves sequentially |
| Navigate at 1500ms intervals (slow) | Focus moves sequentially |
| Navigate at 3000ms intervals (deliberate) | Focus moves sequentially |
| Navigate past cloaking boundary | Focus moves to correct post |
| Navigate while new posts loading | Focus maintains position |
| Navigate immediately after page load | Focus on first unread |
| Navigate with screen reader active | Announcements match focused post |

---

## Summary of Root Causes

1. **Multiple `this.rows` calls**: Different snapshots between calculation and focus
2. **`modify()` interference**: Focus preservation logic overwrites navigation state
3. **Async cloaking updates**: 10ms debounced boundaries cause DOM changes
4. **Smooth scroll timing**: Creates window for state corruption
5. **No navigation lock**: No mechanism to protect navigation state from `modify()`

---

## SOLUTION IMPLEMENTED (2026-01-19)

### What Was Done

The fix implemented a **directional fallback** approach combined with **skip-double-navigation** logic. This addresses the issue where pressing Arrow Up/Down with 1-2 second delays caused focus to jump in the wrong direction.

### Root Cause Identified

The actual bug was more subtle than the original analysis suggested. The issue was:

1. User navigates to post 5
2. User waits 1-2 seconds (post 5 gets cloaked)
3. User presses Arrow Up
4. `activeRowIndex` getter can't find post 5 (cloaked)
5. **Original fallback** used "closest distance" which might find post 7 (closer than post 3)
6. `focusPreviousRow()` then navigates UP from post 7 to post 6
7. **Result**: User pressed UP but focus jumped from 5 → 6 (DOWN!)

Additionally, there was a **one-off error**: when the directional fallback found the correct "proxy" position, `getPreviousIndex()`/`getNextIndex()` was STILL applied, causing a double navigation step.

### Implementation

#### 1. Direction Tracking

```javascript
// Track navigation direction: -1 = up, 1 = down, 0 = no preference
_lastNavigationDirection = 0;
```

#### 2. Directional Fallback in activeRowIndex Getter

When target post is cloaked, find the appropriate visible post based on navigation direction:

- **Navigating UP (-1)**: Find first visible post with post number ≤ target
- **Navigating DOWN (+1)**: Find first visible post with post number ≥ target
- **No direction (0)**: Use closest (for mouse clicks, Tab focus, etc.)

#### 3. Skip Double Navigation

The critical fix - when fallback was used, don't apply additional navigation:

```javascript
focusPreviousRow() {
  this._lastNavigationDirection = -1; // Set direction BEFORE getting index

  // Check if target is cloaked BEFORE calling activeRowIndex
  const targetIsCloaked = this.findRowIndexById(this.activeRowId) === -1;
  const currentIndex = this.activeRowIndex;

  if (targetIsCloaked) {
    // Fallback already gave us the correct position
    // Focus it directly WITHOUT getPreviousIndex()
    this.focusRow(currentIndex);
  } else {
    // Normal case: navigate from current position
    const newIndex = getPreviousIndex(rows, currentIndex, this.options.wrap);
    this.focusRow(newIndex);
  }
}
```

#### 4. Direction Resets

Reset direction to 0 to prevent stale direction affecting non-arrow-key interactions:

- In `handleFocusIn()` - mouse clicks, Tab key
- In `focusFirstRow()` - Home key
- In `focusLastRow()` - End key

### Why This Works

| Scenario | Before Fix | After Fix |
|----------|-----------|-----------|
| At post 5 (cloaked), press Up | Closest finds post 7, then moves to 6 → **jumped DOWN** | Direction finds post ≤5 (post 4), focuses directly → **correct** |
| At post 5 (cloaked), press Down | Closest finds post 3, then moves to 4 → **jumped UP** | Direction finds post ≥5 (post 6), focuses directly → **correct** |
| At post 5 (visible), press Up | Normal navigation to 4 | Normal navigation to 4 |
| Mouse click on post 7 | Direction 0, uses closest | Direction 0, uses closest |

### Commit

`489b991b23` - A11Y: Fix focus jumping with directional cloaking fallback

### Validation

- Used 3 ULTRATHINK sub-agents to analyze the fix
- All identified the one-off error (double navigation)
- Tested with 1-1.5 second delays between arrow presses
- Navigation works correctly in both directions

### Files Modified

- `frontend/discourse/app/modifiers/post-stream-navigation.js`

### Key Insight

The original analysis recommended Option 3 (Post-ID Based Navigation), but the actual fix was simpler: keep the existing architecture but add **direction-aware fallback** that respects user intent when the target post is cloaked, AND skip the double navigation that was causing the one-off error.
