# Focus Jumping Issue Analysis: Post Stream Navigation

## Executive Summary

This document provides a comprehensive analysis of the focus jumping bug that occurs when using arrow keys to navigate posts in a Discourse forum post stream with 1-2 second delays between keypresses. The analysis is conducted from three distinct angles: timing/async issues, state management, and edge cases. Three detailed solutions are provided with complete pros/cons analysis.

**Root Cause Summary**: The focus jumping is caused by a race condition where the IntersectionObserver-based cloaking system asynchronously modifies which posts are visible in the DOM, while the navigation modifier's state tracking (`activeRowId`, `_preventedCloakingPostId`) becomes inconsistent with the actual DOM state during the delay between keypresses.

---

## First Analysis Pass: Timing and Async Issues

### 1.1 The IntersectionObserver Timing Problem

The `post-stream-viewport-tracker.js` uses two IntersectionObservers:

```javascript
// Cloaking observer - determines which posts get hidden
this.#cloakingObserver = this.#initializeObserver(this.trackCloakedPosts, {
  rootMargin: `${this.#cloakOffset}px 0px`,
  threshold: Array.from(new Set([0, UNCLOAKING_HYSTERESIS_RATIO, 1])),
});

// Viewport observer - tracks which posts are on screen
this.#viewportObserver = this.#initializeObserver(this.trackVisiblePosts, {
  rootMargin: `${headerMargin}px 0px 0px 0px`,
  threshold: [0, 1],
});
```

**Critical Issue**: IntersectionObserver callbacks are **asynchronous** and fire at the browser's convenience, typically during idle time or the next frame. They are also **debounced** by the system:

```javascript
// In trackCloakedPosts and trackVisiblePosts
this.#scheduledTimers.set(
  this.#updateCloakBoundaries,
  discourseDebounce(this, this.#updateCloakBoundaries, SCROLL_BATCH_INTERVAL_MS) // 10ms
);
```

### 1.2 The Cloaking Timing Sequence

When a user presses Arrow Down to navigate:

```
T+0ms:   User presses Arrow Down
T+0ms:   focusNextRow() is called
T+0ms:   getNextIndex() calculates new index from current rows
T+0ms:   focusRow(newIndex) is called
T+0ms:   updateCloakingPrevention(row) is called
T+0ms:   preventCloaking(newPostId, true) marks new post as protected
T+0ms:   preventCloaking(oldPostId, false) removes protection from old post
T+0ms:   row.focus() is called
T+0ms:   scrollRowIntoView(row) triggers smooth scroll
T+10-50ms: IntersectionObserver fires for scroll position change
T+10-50ms: trackCloakedPosts() updates #uncloakedPostNumbers
T+20-60ms: discourseDebounce fires #updateCloakBoundaries
T+20-60ms: #setCloakingBoundaries(above, below) called
T+20-60ms: Component re-renders with new cloaking boundaries
T+30-80ms: DOM updates - some posts get class="post-stream--cloaked"
```

### 1.3 The 1-2 Second Delay Problem

When there is a 1-2 second delay between keypresses:

```
T+0ms:      User presses Arrow Down, focuses Post 5
T+0ms:      preventCloaking(post5Id, true)
T+50ms:     IntersectionObserver fires, cloaking boundaries update
T+100ms:    DOM stabilizes, Post 5 is focused and protected
T+1000ms:   User's smooth scroll animation completes
T+1000ms:   Another IntersectionObserver callback fires
T+1010ms:   Cloaking boundaries might shift based on viewport
T+1500ms:   User presses Arrow Down again

PROBLEM: Between T+100ms and T+1500ms:
- The viewport may have shifted due to scroll settling
- IntersectionObserver may have fired additional callbacks
- Cloaking boundaries may have changed
- The `rows` getter now returns a DIFFERENT set of posts
- The current activeRowIndex calculation finds the wrong row
```

### 1.4 The `rows` Getter Instability

The core problem is in how `rows` is calculated:

```javascript
get rows() {
  return Array.from(
    this.element.querySelectorAll(this.options.rowSelector)
  ).filter((row) => !row.closest(".post-stream--cloaked"));
}
```

This is called **every time** navigation happens. Between keypresses:
1. Posts may be cloaked/uncloaked based on viewport position
2. The array length and indices change
3. The `activeRowIndex` getter tries to compensate but may find the wrong post

### 1.5 The `activeRowIndex` Getter Race

```javascript
get activeRowIndex() {
  const index = this.findRowIndexById(this.activeRowId);
  if (index !== -1) {
    return index;
  }
  // Row not found (cloaked) - find closest visible row
  // ... fallback logic ...
}
```

The fallback logic can select a **different** post than intended when the tracked post becomes cloaked between keypresses.

---

## Second Analysis Pass: State Management Issues

### 2.1 State Variables at Play

The navigation modifier maintains several pieces of state:

| Variable | Purpose | Update Timing |
|----------|---------|---------------|
| `activeRowId` | Post number of focused row | On focusRow(), handleFocusIn() |
| `_preventedCloakingPostId` | Post ID protected from cloaking | On updateCloakingPrevention() |
| `activeFocusableIndex` | Index within row (-1 = row itself) | On focusRow(), handleFocusIn() |
| `inDocumentMode` | Whether user is in document reading mode | On enterDocumentMode(), exitDocumentMode() |

### 2.2 The State Synchronization Problem

**Problem 1: `activeRowId` vs Actual DOM Focus**

```javascript
focusRow(index) {
  const rows = this.rows;
  if (index >= 0 && index < rows.length) {
    const row = rows[index];
    this.activeRowId = this.getRowId(row);  // State updated
    // ...
    row.focus();  // DOM focus set
  }
}
```

Between calls, if `document.activeElement` changes (e.g., user clicks elsewhere), `activeRowId` may not match actual focus.

**Problem 2: `_preventedCloakingPostId` Lifecycle**

```javascript
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

**Critical Issue**: The `preventCloaking` function adds/removes from a global Set:

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
```

However, the cloaking check in `getCloakingData` happens asynchronously:

```javascript
getCloakingData(post, { above, below }) {
  if (!cloakingEnabled || !post || cloakingPrevented.posts.has(post.id) || this.#postsOnScreen[post.post_number]) {
    return { active: false };  // Won't cloak
  }
  // ... cloaking logic
}
```

**The Race**: If `getCloakingData` is called BEFORE `updateCloakingPrevention` runs (due to async timing), the post may be cloaked even though it should be protected.

### 2.3 The `focusNextRow()` / `focusPreviousRow()` Problem

```javascript
focusNextRow() {
  const rows = this.rows;  // Snapshot at this moment
  if (rows.length === 0) {
    return;
  }
  const currentIndex = this.activeRowIndex;  // Calculated from activeRowId
  const newIndex = getNextIndex(rows, currentIndex, this.options.wrap);

  if (newIndex !== currentIndex) {
    this.focusRow(newIndex);  // Uses the same rows snapshot
  }
}
```

**Issue**: The `currentIndex` is derived from `activeRowId` via `activeRowIndex`, which searches the current `rows`. If the previously focused post is now cloaked, `activeRowIndex` falls back to finding "closest" post, which may not be the expected navigation starting point.

### 2.4 The `handleFocusIn` Event Race

```javascript
handleFocusIn(event) {
  const row = event.target.closest(this.options.rowSelector);

  if (row) {
    const newRowId = this.getRowId(row);
    if (newRowId && newRowId !== this.activeRowId) {
      this.activeRowId = newRowId;
      this.updateTabindices();
      this.updateCloakingPrevention(row);  // Async effects start here
    }
    // ...
  }
}
```

This updates state when focus changes, but the cloaking prevention happens AFTER state is updated. There's a window where state says "focus is on post X" but post X is still cloakable.

---

## Third Analysis Pass: Edge Cases and DOM Mutation Issues

### 3.1 The Scroll-Triggered Cloaking Edge Case

When `scrollRowIntoView(row)` is called:

```javascript
scrollRowIntoView(row) {
  // ... calculations ...
  if (rowRect.top < scrollMarginTop) {
    window.scrollTo({ top: scrollY, behavior: "smooth" });
  } else if (rowRect.bottom > viewportHeight) {
    window.scrollTo({ top: scrollY, behavior: "smooth" });
  }
}
```

The `behavior: "smooth"` causes an animated scroll over ~500ms. During this animation:
1. IntersectionObserver fires multiple times
2. Each fire triggers `trackCloakedPosts()` and `trackVisiblePosts()`
3. Cloaking boundaries shift continuously
4. Posts around the focused post may cloak/uncloak

If the user presses another arrow key during this animation, the DOM state is unstable.

### 3.2 The Post Stream Re-render Edge Case

The `post-stream.gjs` component re-renders when cloaking boundaries change:

```javascript
// From viewport tracker
this.#setCloakingBoundaries(above, below);
```

This triggers Ember's tracked property system, which may:
1. Re-render the post list
2. Call the navigation modifier's `modify()` method
3. Potentially reset or update state

In `modify()`:

```javascript
modify(element, positional, named) {
  if (this.element !== element) {
    this.cleanup();
    this.element = element;
    // ... re-setup ...
  }

  // Preserve focus if currently focused element is in the grid
  const focusedElement = document.activeElement;
  if (focusedElement && this.element.contains(focusedElement)) {
    const cloakedContainer = focusedElement.closest(".post-stream--cloaked");
    if (cloakedContainer) {
      focusInCloakedPost = true;  // Don't update activeRowId
    } else {
      // Update activeRowId from current focus
    }
  }
}
```

**Edge Case**: If `modify()` runs while the focused element is in the process of being cloaked (the DOM is being mutated), the focus detection may fail or produce incorrect results.

### 3.3 The "Closest Post" Fallback Edge Case

When the tracked post is cloaked, `activeRowIndex` falls back:

```javascript
get activeRowIndex() {
  const index = this.findRowIndexById(this.activeRowId);
  if (index !== -1) {
    return index;
  }
  // Row not found (cloaked) - find closest visible row
  const targetPostNumber = parseInt(this.activeRowId, 10);
  // ... find closest by post number ...
}
```

**Edge Case**: In a long topic with many cloaked posts, the "closest" post might be several posts away from the intended navigation point, causing a "jump" when the user presses arrow.

### 3.4 The Header Row Edge Case

The navigation includes a topic header row:

```javascript
rowSelector: '.topic-header-row[role="row"], .topic-post[role="row"]',
```

When navigating from the header row to the first post, if the first post is cloaked due to viewport position, the user may jump to a later post unexpectedly.

### 3.5 MutationObserver Absence

The code does NOT use a MutationObserver to track DOM changes. This means:
1. If posts are added/removed asynchronously, state may become stale
2. If cloaking happens during navigation, there's no notification
3. The modifier relies entirely on the Ember re-render cycle

---

## Solution Options

### Option 1: Navigation Lock with Timeout

**Approach**: Implement a "navigation lock" that prevents cloaking state changes from affecting navigation for a short period after each keypress.

**Implementation**:

```javascript
// In post-stream-navigation.js

// Add new state
_navigationLockUntil = 0;
_lastFocusedRowSnapshot = null;

focusNextRow() {
  const rows = this.rows;
  if (rows.length === 0) {
    return;
  }

  // Use locked position if within lock window
  let currentIndex;
  if (Date.now() < this._navigationLockUntil && this._lastFocusedRowSnapshot) {
    // Find the snapshotted row in current rows
    currentIndex = rows.indexOf(this._lastFocusedRowSnapshot.element);
    if (currentIndex === -1) {
      // Row was cloaked, find by post number
      currentIndex = this.findRowIndexById(this._lastFocusedRowSnapshot.rowId);
    }
  }

  if (currentIndex === undefined || currentIndex === -1) {
    currentIndex = this.activeRowIndex;
  }

  const newIndex = getNextIndex(rows, currentIndex, this.options.wrap);

  if (newIndex !== currentIndex || newIndex !== this.activeRowIndex) {
    this.focusRowWithLock(newIndex);
  }
}

focusRowWithLock(index) {
  const rows = this.rows;
  if (index >= 0 && index < rows.length) {
    const row = rows[index];
    const rowId = this.getRowId(row);

    // Set navigation lock for 2 seconds
    this._navigationLockUntil = Date.now() + 2000;
    this._lastFocusedRowSnapshot = {
      element: row,
      rowId: rowId,
      postId: row.dataset?.postId
    };

    this.activeRowId = rowId;
    this.activeFocusableIndex = -1;
    this.inDocumentMode = false;
    this.updateTabindices();
    this.updateCloakingPrevention(row);

    row.focus();
    this.scrollRowIntoView(row);
  }
}

// Clear lock on cleanup
cleanup() {
  this._navigationLockUntil = 0;
  this._lastFocusedRowSnapshot = null;
  // ... existing cleanup
}
```

**Pros**:
- Simple implementation with minimal code changes
- Directly addresses the timing issue
- Maintains element reference for stability
- No external dependencies

**Cons**:
- Arbitrary timeout value (2 seconds) may not fit all cases
- If post is actually cloaked, the snapshot element reference becomes invalid
- Doesn't prevent cloaking, just remembers position
- May feel unresponsive if user navigates quickly after lock expires

**Risk Assessment**: Low-Medium risk. The lock provides stability but may create edge cases around the timeout boundary.

---

### Option 2: Extended Cloaking Prevention with Neighbors

**Approach**: Prevent cloaking on the focused post AND its immediate neighbors (prev/next). This creates a "navigation buffer zone" that ensures there's always a valid navigation target.

**Implementation**:

```javascript
// In post-stream-navigation.js

// Change from single ID to array
_preventedCloakingPostIds = [];

updateCloakingPrevention(row) {
  const rows = this.rows;
  const currentIndex = rows.indexOf(row);

  // Clear all previous preventions
  this._preventedCloakingPostIds.forEach(postId => {
    preventCloaking(parseInt(postId, 10), false);
  });
  this._preventedCloakingPostIds = [];

  // Collect post IDs for current row and neighbors
  const indicesToProtect = [
    currentIndex - 2,  // Two before
    currentIndex - 1,  // One before
    currentIndex,      // Current
    currentIndex + 1,  // One after
    currentIndex + 2   // Two after
  ].filter(i => i >= 0 && i < rows.length);

  indicesToProtect.forEach(i => {
    const postId = rows[i].dataset?.postId;
    if (postId) {
      preventCloaking(parseInt(postId, 10), true);
      this._preventedCloakingPostIds.push(postId);
    }
  });
}

clearCloakingPrevention() {
  this._preventedCloakingPostIds.forEach(postId => {
    preventCloaking(parseInt(postId, 10), false);
  });
  this._preventedCloakingPostIds = [];
}
```

**Additionally**, modify the rows getter to prioritize protected posts:

```javascript
get rows() {
  const allRows = Array.from(
    this.element.querySelectorAll(this.options.rowSelector)
  );

  return allRows.filter(row => {
    // Never filter out protected posts
    const postId = row.dataset?.postId;
    if (postId && this._preventedCloakingPostIds.includes(postId)) {
      return true;
    }
    // Filter out cloaked posts
    return !row.closest(".post-stream--cloaked");
  });
}
```

**Pros**:
- Guarantees navigation targets exist in DOM
- Uses existing `preventCloaking` API
- Gracefully handles rapid navigation
- Works regardless of scroll animation timing

**Cons**:
- Keeps more posts uncloaked (minor performance impact)
- More complex state management (array vs single value)
- May create visual discontinuity if protected posts are far from viewport
- Requires coordination between navigation and viewport tracker

**Risk Assessment**: Medium risk. The buffer zone approach is robust but adds complexity and may have performance implications in very long topics.

---

### Option 3: Synchronous Cloaking Check Before Navigation

**Approach**: Before navigating, synchronously check and update cloaking state to ensure consistency. This involves making the navigation "authoritative" over cloaking.

**Implementation**:

```javascript
// In post-stream-navigation.js

// Add service injection for viewport tracker reference
@service postStreamViewportTracker; // Would need to be made a service

focusNextRow() {
  // Force synchronous cloaking update before navigation
  this.ensureCloakingConsistency();

  const rows = this.rows;
  if (rows.length === 0) {
    return;
  }

  const currentIndex = this.activeRowIndex;
  const newIndex = getNextIndex(rows, currentIndex, this.options.wrap);

  if (newIndex !== currentIndex) {
    this.focusRow(newIndex);
  }
}

ensureCloakingConsistency() {
  // Cancel any pending cloaking debounce timers
  // This would require exposing internals from viewport tracker

  // Force immediate recalculation of which posts should be cloaked
  // based on current viewport position

  // The key insight: when user is actively navigating,
  // don't allow async cloaking updates
}

// Alternative: Simpler approach without service
focusRow(index) {
  const rows = this.rows;
  if (index >= 0 && index < rows.length) {
    const row = rows[index];

    // CRITICAL: Prevent cloaking BEFORE any other operations
    const postId = row.dataset?.postId;
    if (postId) {
      preventCloaking(parseInt(postId, 10), true);
    }

    // Clear previous prevention AFTER new one is set
    if (this._preventedCloakingPostId && this._preventedCloakingPostId !== postId) {
      // Use setTimeout to delay clearing - this ensures the new protection
      // is in place before the old one is removed
      const oldPostId = this._preventedCloakingPostId;
      setTimeout(() => {
        preventCloaking(parseInt(oldPostId, 10), false);
      }, 100);
    }

    this._preventedCloakingPostId = postId;
    this.activeRowId = this.getRowId(row);
    // ... rest of focusRow
  }
}
```

**Alternative Implementation with MutationObserver**:

```javascript
// In post-stream-navigation.js

modify(element, positional, named) {
  if (this.element !== element) {
    this.cleanup();
    this.element = element;

    // Set up MutationObserver to track cloaking changes
    this._cloakingObserver = new MutationObserver((mutations) => {
      this.handleCloakingMutation(mutations);
    });

    this._cloakingObserver.observe(element, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });

    // ... rest of setup
  }
}

handleCloakingMutation(mutations) {
  // Check if focused post was just cloaked
  const activeRow = this.rows[this.activeRowIndex];
  if (!activeRow) {
    // Active row was cloaked - restore focus to nearest uncloaked
    this.restoreFocusAfterCloaking();
  }
}

restoreFocusAfterCloaking() {
  const rows = this.rows;
  if (rows.length === 0) return;

  // Find closest post to the one that was just cloaked
  const targetPostNumber = parseInt(this.activeRowId, 10);
  let closestIndex = 0;
  let closestDistance = Infinity;

  rows.forEach((row, index) => {
    const rowId = this.getRowId(row);
    if (rowId !== "header") {
      const postNumber = parseInt(rowId, 10);
      const distance = Math.abs(postNumber - targetPostNumber);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    }
  });

  // Re-focus on closest post
  this.focusRow(closestIndex);
}

cleanup() {
  this._cloakingObserver?.disconnect();
  this._cloakingObserver = null;
  // ... rest of cleanup
}
```

**Pros**:
- Reacts to actual DOM changes rather than guessing timing
- Maintains focus even when unexpected cloaking occurs
- No arbitrary timeouts
- Works with any future changes to cloaking logic

**Cons**:
- MutationObserver has performance overhead
- May cause focus to jump visibly as it "catches up"
- More complex implementation
- Potential for infinite loops if not careful (focus causes scroll, scroll causes cloak, cloak causes refocus)

**Risk Assessment**: Medium-High risk. The reactive approach is more robust but introduces complexity and potential for feedback loops.

---

## Comparison Matrix

| Factor | Option 1: Nav Lock | Option 2: Neighbor Prevention | Option 3: Sync Check/MutationObserver |
|--------|-------------------|------------------------------|---------------------------------------|
| Implementation Complexity | Low | Medium | High |
| Code Changes Required | ~30 lines | ~50 lines | ~80 lines |
| Performance Impact | None | Minor (more uncloaked posts) | Medium (MutationObserver) |
| Reliability | Good for most cases | Excellent | Excellent |
| Edge Case Handling | Fair | Good | Excellent |
| Maintenance Burden | Low | Medium | High |
| Risk of Regressions | Low | Medium | Medium-High |
| Works with Fast Navigation | Yes | Yes | Yes |
| Works with Slow Navigation | Sometimes (timeout) | Yes | Yes |
| Preserves Scroll Position | Yes | Yes | Mostly |

---

## Recommendation

### Primary Recommendation: Option 2 (Extended Cloaking Prevention with Neighbors)

**Justification**:

1. **Root Cause Alignment**: The issue is fundamentally about posts being cloaked when they shouldn't be during navigation. Option 2 directly prevents this by protecting a buffer zone.

2. **Uses Existing Infrastructure**: The `preventCloaking` API exists specifically for this purpose. Extending its use is a natural evolution.

3. **Predictable Behavior**: Users will always have valid navigation targets. No surprises from timeout expiration or async race conditions.

4. **Minimal Performance Impact**: Keeping 5 posts uncloaked instead of 1 is negligible in terms of DOM complexity.

5. **Clear Mental Model**: "The focused post and its neighbors are always available" is easy to understand and debug.

### Secondary Recommendation: Combine with Option 1 (Navigation Lock)

For maximum robustness, combine Option 2 with a simplified version of Option 1:

```javascript
// Track the last known good position
_lastNavigationTime = 0;
_lastNavigatedRowId = null;

focusRow(index) {
  // ... Option 2's neighbor prevention logic ...

  this._lastNavigationTime = Date.now();
  this._lastNavigatedRowId = this.getRowId(rows[index]);
}

get activeRowIndex() {
  // If we navigated recently, trust that position
  if (Date.now() - this._lastNavigationTime < 500 && this._lastNavigatedRowId) {
    const index = this.findRowIndexById(this._lastNavigatedRowId);
    if (index !== -1) {
      return index;
    }
  }
  // Fall back to normal calculation
  // ... existing logic ...
}
```

This combination provides:
- **Option 2's protection**: Ensures posts are available
- **Option 1's stability**: Uses cached position during active navigation
- **Graceful degradation**: Falls back to existing behavior if both fail

---

## Implementation Considerations

### Testing Strategy

1. **Unit Tests**:
   - Test `_preventedCloakingPostIds` array management
   - Test neighbor index calculation edge cases (first post, last post)
   - Test lock timeout behavior

2. **Integration Tests**:
   - Navigate through posts with various delays (100ms, 500ms, 1s, 2s)
   - Navigate during scroll animation
   - Navigate when posts are actively being cloaked

3. **System Tests**:
   - Full keyboard navigation in long topic (100+ posts)
   - Navigation after using browser back/forward
   - Navigation after page resize

### Rollback Plan

If the fix causes issues:
1. Revert to single `_preventedCloakingPostId`
2. Remove neighbor protection
3. Issue will recur but won't be worse than before

### Monitoring

After deployment, monitor:
- Focus-related error events
- User reports of focus jumping
- Performance metrics on long topic pages

---

## Appendix: Key Code Locations

| File | Key Lines | Purpose |
|------|-----------|---------|
| `post-stream-navigation.js:46` | `_preventedCloakingPostId` | Current protection tracking |
| `post-stream-navigation.js:195-199` | `get rows()` | Row collection with cloaking filter |
| `post-stream-navigation.js:238-272` | `get activeRowIndex` | Index calculation with fallback |
| `post-stream-navigation.js:542-563` | `focusRow()` | Focus and protection update |
| `post-stream-navigation.js:571-586` | `updateCloakingPrevention()` | Protection management |
| `post-stream-viewport-tracker.js:73` | `cloakingPrevented` | Global protection Set |
| `post-stream-viewport-tracker.js:87-93` | `preventCloaking()` | Protection API |
| `post-stream-viewport-tracker.js:439-468` | `getCloakingData()` | Cloaking decision logic |

---

## Conclusion

The focus jumping issue in post stream navigation is caused by a timing mismatch between the asynchronous IntersectionObserver-based cloaking system and the synchronous keyboard navigation. The recommended fix (Option 2 with elements of Option 1) provides robust protection by:

1. Preventing cloaking on the focused post and its neighbors
2. Maintaining a short-term cache of navigation position
3. Using existing APIs to minimize risk

This approach balances reliability, maintainability, and performance while directly addressing the root cause of the issue.
