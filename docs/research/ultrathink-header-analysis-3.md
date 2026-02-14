# ULTRATHINK: Header Row DOM Structure vs Post Rows Analysis

## Executive Summary

This analysis examines the critical DOM attribute differences between the topic header row and post rows in the post-stream-navigation system. The header row's lack of `data-post-id` and `data-post-number` attributes causes **incomplete state management** when navigating to/from the header, specifically in the cloaking prevention system. This leads to focus jumping when navigating away from the header.

**Key Finding**: When focus moves TO the header row, the previous post's cloaking prevention is NOT cleared because the header has no `data-post-id`. This "orphaned" cloaking prevention can cause unexpected behavior when focus moves away.

---

## 1. Missing Data Attributes on Header Row

### Header Row Template (header-row.gjs, lines 136-144)

```handlebars
<div
  class="post-stream__header-row topic-header-row"
  role="row"
  tabindex="-1"
  aria-rowindex="1"
  aria-label={{this.headerRowAriaLabel}}
  data-topic-id={{@topic.id}}
>
```

**Header row has:**
- `data-topic-id` - Topic ID only
- `class="topic-header-row"` - For identification

**Header row is MISSING:**
- `data-post-number` - No post number (it's not a post)
- `data-post-id` - No post ID (it's not a post)

### Post Row Template (post.gjs, lines 499-545)

```handlebars
<div
  role="row"
  tabindex="-1"
  aria-rowindex={{this.ariaRowIndex}}
  aria-label={{this.postRowAriaLabel}}
  class={{...}}
  data-post-number={{@post.post_number}}
  id={{if @cloaked @elementId}}
>
  ...
  <article
    data-post-id={{@post.id}}
    data-topic-id={{@post.topicId}}
    ...
  >
```

**Post row has:**
- `data-post-number` on outer div (line 539)
- `data-post-id` on inner article element (line 578)

---

## 2. Critical Issue: updateCloakingPrevention() Behavior

### The Function (lines 834-849)

```javascript
updateCloakingPrevention(row) {
  // Get the post ID from the row element (posts have data-post-id attribute)
  const newPostId = row.dataset?.postId;

  // Clear previous prevention if we're moving to a different post
  if (this._preventedCloakingPostId && this._preventedCloakingPostId !== newPostId) {
    preventCloaking(parseInt(this._preventedCloakingPostId, 10), false);
    this._preventedCloakingPostId = null;
  }

  // Prevent cloaking on the new post (if it's a post row, not header row)
  if (newPostId && newPostId !== this._preventedCloakingPostId) {
    preventCloaking(parseInt(newPostId, 10), true);
    this._preventedCloakingPostId = newPostId;
  }
}
```

### Analysis of Behavior When Focusing Header Row

**Scenario: User is on Post #5, then presses Arrow Up repeatedly until reaching Header**

| Step | activeRowId | newPostId | _preventedCloakingPostId | Action |
|------|-------------|-----------|--------------------------|--------|
| Start on Post 5 | "5" | "123" (postId) | "123" | Post 5 cloaking prevented |
| Arrow Up to Post 4 | "4" | "456" | "123" -> "456" | Clear 123, prevent 456 |
| Arrow Up to Post 3 | "3" | "789" | "456" -> "789" | Clear 456, prevent 789 |
| Arrow Up to Post 2 | "2" | "101" | "789" -> "101" | Clear 789, prevent 101 |
| Arrow Up to Post 1 | "1" | "202" | "101" -> "202" | Clear 101, prevent 202 |
| Arrow Up to Header | "header" | **undefined** | "202" -> **UNCHANGED** | **BUG: Post 202 STILL prevented!** |

### The Bug Explained

When `newPostId` is `undefined` (header row):

```javascript
// This condition is TRUE because:
// - this._preventedCloakingPostId = "202" (truthy)
// - newPostId = undefined
// - "202" !== undefined is TRUE
if (this._preventedCloakingPostId && this._preventedCloakingPostId !== newPostId) {
  preventCloaking(parseInt(this._preventedCloakingPostId, 10), false);  // EXECUTES
  this._preventedCloakingPostId = null;                                  // EXECUTES
}
```

**Wait - on closer inspection, this DOES clear the previous cloaking!**

Let me re-analyze:

```javascript
const newPostId = row.dataset?.postId;  // undefined for header

// First condition:
if (this._preventedCloakingPostId && this._preventedCloakingPostId !== newPostId) {
  // this._preventedCloakingPostId = "202" (truthy) ✓
  // "202" !== undefined = true ✓
  // CONDITION IS TRUE - previous cloaking IS cleared
  preventCloaking(parseInt(this._preventedCloakingPostId, 10), false);
  this._preventedCloakingPostId = null;
}

// Second condition:
if (newPostId && newPostId !== this._preventedCloakingPostId) {
  // newPostId = undefined (falsy) ✗
  // CONDITION IS FALSE - nothing set
}
```

**Correction**: The cloaking IS properly cleared when moving to header. The `_preventedCloakingPostId` becomes `null`.

---

## 3. Revised Analysis: What Actually Happens

### Scenario Analysis

| Navigation | newPostId | _preventedCloakingPostId Before | _preventedCloakingPostId After |
|------------|-----------|----------------------------------|-------------------------------|
| To Post 5 | "123" | null | "123" |
| To Header | undefined | "123" | **null** (cleared correctly) |
| Back to Post 1 | "202" | null | "202" |

**The cloaking prevention logic is actually CORRECT for the header row.**

---

## 4. Where the Real Problem Might Be: getRowId() and findRowByPostNumber()

### getRowId() (lines 207-217)

```javascript
getRowId(row) {
  if (!row) {
    return null;
  }
  if (row.classList.contains("topic-header-row")) {
    return "header";
  }
  // Post rows have data-post-number attribute
  const postNumber = row.dataset.postNumber;
  return postNumber || null;
}
```

**This correctly handles header vs post rows.**

### findRowByPostNumber() (lines 254-259)

```javascript
findRowByPostNumber(rows, postNumber) {
  if (postNumber === "header") {
    return rows.find(r => r.classList.contains('topic-header-row')) || null;
  }
  return rows.find(r => r.dataset.postNumber === postNumber) || null;
}
```

**This also correctly handles header vs post rows.**

---

## 5. The Real Issue: State Transition Edge Cases

### When Navigating FROM Header TO Post #1

```javascript
// In focusNextRow()
const currentRow = this.findRowByPostNumber(rows, this.activeRowId);
// activeRowId = "header"
// currentRow = header element (found via classList check)

if (currentRow) {
  const currentIndex = rows.indexOf(currentRow);  // 0 (header is first)
  const nextIndex = currentIndex + 1;              // 1 (first post)
  this.focusRowByElement(rows[nextIndex]);         // Focus post #1
}
```

**This looks correct too.**

### In focusRowByElement() (lines 317-331)

```javascript
focusRowByElement(row) {
  if (!row) return;

  const newRowId = this.getRowId(row);
  console.log(`[A11Y-NAV] focusRowByElement: newRowId=${newRowId}, prevActiveRowId=${this.activeRowId}`);

  this.activeRowId = newRowId;
  this.activeFocusableIndex = -1;
  this.inDocumentMode = false;
  this.updateTabindices();
  this.updateCloakingPrevention(row);

  row.focus();
  this.scrollRowIntoView(row);
}
```

**All state updates happen BEFORE focus() and scrollIntoView().**

---

## 6. Potential Timing Issue: scrollRowIntoView() and Cloaking

### scrollRowIntoView() (lines 867-886)

```javascript
scrollRowIntoView(row) {
  const rowRect = row.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const computedStyle = window.getComputedStyle(row);
  const scrollMarginTop = parseFloat(computedStyle.scrollMarginTop) || 0;

  if (rowRect.top < scrollMarginTop) {
    const scrollY = window.scrollY + rowRect.top - scrollMarginTop;
    window.scrollTo({ top: scrollY, behavior: "smooth" });  // ASYNC SCROLL!
  } else if (rowRect.bottom > viewportHeight) {
    const scrollY = window.scrollY + rowRect.bottom - viewportHeight + 20;
    window.scrollTo({ top: scrollY, behavior: "smooth" });  // ASYNC SCROLL!
  }
}
```

**CRITICAL**: `behavior: "smooth"` makes scrolling asynchronous. This can:
1. Trigger IntersectionObserver callbacks
2. Change which posts are cloaked/uncloaked
3. Run AFTER the navigation state updates

### Race Condition Scenario

1. User on header, presses Arrow Down
2. `focusRowByElement()` called for Post #1
3. `updateTabindices()` runs with `activeRowId = "1"`
4. `updateCloakingPrevention(row)` runs - prevents Post #1 from cloaking
5. `row.focus()` focuses Post #1
6. `scrollRowIntoView()` starts SMOOTH scroll animation (~300ms)
7. During scroll, IntersectionObserver fires for posts entering/leaving viewport
8. `trackCloakedPosts()` updates `#uncloakedPostNumbers` Set
9. `#updateCloakBoundaries()` is debounced (10ms interval)
10. Ember re-renders based on new cloaking boundaries
11. Re-render triggers `modify()` on navigation modifier
12. **BUT**: `modify()` no longer updates tabindices (fixed in previous commit)

**The previous fix (not updating tabindices in modify()) should prevent this race condition.**

---

## 7. The rows Getter and Cloaking Filter

### rows Getter (lines 197-201)

```javascript
get rows() {
  return Array.from(
    this.element.querySelectorAll(this.options.rowSelector)
  ).filter((row) => !row.closest(".post-stream--cloaked"));
}
```

**Important**: This FILTERS OUT cloaked posts. If the header row were somehow in a cloaked container, it would disappear from the array.

### Is Header Ever Cloaked?

Looking at `getCloakingData()` in viewport-tracker (lines 439-468):

```javascript
getCloakingData(post, { above, below }) {
  if (
    !cloakingEnabled ||
    !post ||
    cloakingPrevented.posts.has(post.id) ||
    this.#postsOnScreen[post.post_number]
  ) {
    return { active: false };
  }
  // ...
}
```

**The header row is NOT a post**, so it's never passed to `getCloakingData()`. The header row should NEVER be cloaked.

---

## 8. IDENTIFIED ISSUE: getActiveRowIndex() Fallback Logic

### When Target Row is Cloaked (lines 346-436)

When `activeRowId` is set but the row is not visible (cloaked), `getActiveRowIndex()` uses fallback logic:

```javascript
getActiveRowIndex(rows = null) {
  const rowsArray = rows || this.rows;
  const index = this.findRowIndexByIdWithArray(rowsArray, this.activeRowId);

  if (index !== -1) {
    return index;  // Found - return it
  }

  // Row not found (cloaked) - use directional fallback
  if (this.activeRowId === "header") {
    // Header should always be visible, but fallback to 0
    console.log(`[A11Y-NAV] getActiveRowIndex: header cloaked? returning 0`);
    return 0;  // ALWAYS returns 0 for header
  }

  // ... directional fallback for posts ...
}
```

**Key insight**: If `activeRowId === "header"` but the header row is somehow not in the DOM or is filtered out, the function returns `0`. This could cause unexpected behavior if the row at index 0 is not actually the header.

---

## 9. handleFocusIn() Direction Reset

### When Focus Enters via Mouse/Tab (lines 636-667)

```javascript
handleFocusIn(event) {
  const row = event.target.closest(this.options.rowSelector);

  if (row) {
    const newRowId = this.getRowId(row);
    if (newRowId && newRowId !== this.activeRowId) {
      console.log(`[A11Y-NAV] handleFocusIn: ${this.activeRowId} -> ${newRowId}, direction was ${this._lastNavigationDirection}, resetting to 0`);
      this.activeRowId = newRowId;
      // Reset navigation direction when focus comes from mouse/Tab (not arrow keys)
      this._lastNavigationDirection = 0;  // RESET TO 0
      this.updateTabindices();
      this.updateCloakingPrevention(row);
    }
    // ...
  }
}
```

**This resets `_lastNavigationDirection` to 0 when focus enters via non-keyboard means.**

---

## 10. Summary of State NOT Updated When Focusing Header

When navigating TO the header row:

| State Property | Updated? | Value After |
|----------------|----------|-------------|
| `activeRowId` | YES | "header" |
| `activeFocusableIndex` | YES | -1 |
| `inDocumentMode` | YES | false |
| `_preventedCloakingPostId` | YES | null (cleared) |
| `_lastNavigationDirection` | YES | -1 (if navigating up) |

**ALL state is properly updated when navigating to header.**

---

## 11. Actual Root Cause Hypothesis

After thorough analysis, the DOM attribute differences do NOT directly cause the focus jumping issue. The cloaking prevention and state management handle the header row correctly.

**The issue is more likely in one of these areas:**

1. **Smooth Scroll + IntersectionObserver Race**: The 300ms smooth scroll animation triggers cloaking changes that re-render the post stream while the user is trying to navigate.

2. **Re-render During Navigation**: If Ember re-renders during the time between `updateCloakingPrevention()` and `row.focus()`, the row reference could become stale.

3. **focusFirstUnreadPost Auto-Focus**: The scheduled auto-focus callback might fire after user has already navigated away from header.

### The Auto-Focus Guard (lines 141-147)

```javascript
focusFirstUnreadPost(lastReadPostNumber) {
  // GUARD: Don't auto-focus if user has already started navigating
  if (this.activeRowId !== "header") {
    console.log(`[A11Y-NAV] focusFirstUnreadPost: ABORTED - user already navigated to ${this.activeRowId}`);
    return;
  }
  // ...
}
```

**This guard exists but relies on `activeRowId`. If the user navigates TO header from a post, then this guard would ALLOW auto-focus to run (since activeRowId would be "header").**

---

## 12. Recommendations

### Immediate Fix

Verify that when navigating from Post -> Header -> Post, the auto-focus callback is not interfering:

```javascript
// In scheduleInitialFocus()
scheduleInitialFocus(lastReadPostNumber) {
  this.initialFocusComplete = true;  // Set immediately
  // ...
}
```

The `initialFocusComplete` flag should prevent this, but verify in console logs.

### Long-term Fix

Consider using `behavior: "instant"` instead of `behavior: "smooth"` for keyboard navigation scrolling to eliminate the race condition window:

```javascript
scrollRowIntoView(row) {
  // ...
  window.scrollTo({ top: scrollY, behavior: "instant" });  // or remove behavior entirely
}
```

---

## Conclusion

The header row's missing `data-post-id` and `data-post-number` attributes are handled correctly by the navigation modifier's code. The cloaking prevention is properly cleared when moving to header, and re-enabled when moving to a post.

The focus jumping issue is likely caused by:
1. Smooth scroll animation creating a race condition window
2. IntersectionObserver callbacks triggering Ember re-renders
3. Possible interference from the auto-focus initial load callback

**The DOM structure difference is a red herring - the real issue is timing/race conditions during async operations.**
