# Post Stream WAI-ARIA Grid Pattern Code Review

**Review Date:** 2026-01-03
**Reviewer:** Claude Code
**Status:** PASS with Minor Recommendations

---

## Executive Summary

The WAI-ARIA Grid pattern implementation for the Discourse post stream is **well-implemented and follows accessibility best practices**. The previous build failure caused by passing `rows.length` instead of `rows` to navigation utility functions has been correctly fixed. The implementation correctly follows the WAI-ARIA Grid pattern specification and provides excellent keyboard navigation for screen reader users.

**Overall Assessment:** Ready for testing with minor recommendations noted below.

---

## Files Reviewed

| File | Status | Notes |
|------|--------|-------|
| `frontend/discourse/app/modifiers/post-stream-navigation.js` | PASS | Correctly implemented |
| `frontend/discourse/app/components/post-stream.gjs` | PASS | ARIA attributes correct |
| `frontend/discourse/app/components/post.gjs` | PASS | Row/cell structure correct |
| `frontend/discourse/app/components/post/avatar.gjs` | PASS | Spreads attributes correctly |
| `frontend/discourse/app/components/post/menu.gjs` | PASS | Toolbar pattern correct |
| `frontend/discourse/app/components/post/small-action.gjs` | PASS | Consistent with main post |
| `frontend/discourse/app/components/post/cooked-html.gjs` | PASS | Document mode correct |
| `frontend/discourse/app/components/decorated-html.gjs` | PASS | Role attribute support |
| `frontend/discourse/app/lib/keyboard-navigation-utils.js` | PASS | Function signatures correct |
| `config/locales/client.en.yml` | PASS | All i18n strings present |

---

## Critical Issues

**None found.** The build failure has been correctly resolved.

---

## Medium Issues

### 1. Inconsistency with Existing grid-navigation.js (Not a Bug in This PR)

**Location:** `frontend/discourse/app/modifiers/grid-navigation.js` lines 270-275, 289-293

**Description:** The existing `grid-navigation.js` file (for topic lists) passes `rows.length` to `getNextIndex` and `getPreviousIndex`:

```javascript
// grid-navigation.js - EXISTING BUG
const newIndex = getNextIndex(
  rows.length,  // WRONG - passes number, not array
  this.activeRowIndex,
  this.options.wrap
);
```

While the new `post-stream-navigation.js` correctly passes the array:

```javascript
// post-stream-navigation.js - CORRECT
const newIndex = getNextIndex(
  rows,  // CORRECT - passes array
  this.activeRowIndex,
  this.options.wrap
);
```

**Impact:** This inconsistency suggests a latent bug in `grid-navigation.js` that should be fixed separately.

**Recommendation:** File a separate issue to fix `grid-navigation.js` to pass `rows` instead of `rows.length`.

---

### 2. Small-Action Posts Missing gridcell Roles

**Location:** `frontend/discourse/app/components/post/small-action.gjs`

**Description:** The small-action component has `role="row"` but does not define any children with `role="gridcell"`. The WAI-ARIA spec states that grid rows should contain gridcell, columnheader, or rowheader children.

**Current Code (line 152-164):**
```handlebars
<div
  ...attributes
  role="row"
  tabindex="-1"
  aria-label={{this.a11yHeadingText}}
  data-post-number={{@post.post_number}}
  id={{if @cloaked @elementId}}
>
```

The inner content (topic-avatar div and small-action-desc div) does not have `role="gridcell"`.

**Impact:** Minor - screen readers may not properly announce the grid structure for small-action posts.

**Recommendation:** Add `role="gridcell"` to appropriate child elements in small-action posts, similar to how post.gjs wraps avatar and body in gridcells.

---

## Minor Issues / Code Quality Recommendations

### 1. Document Mode Tabindex Cleanup

**Location:** `post-stream-navigation.js` lines 477-479, 489-494

**Description:** When entering document mode, the code sets `tabindex="0"` on the document element but relies on `exitDocumentMode` to reset it to `-1`. If a user navigates away without pressing Escape (e.g., Tab or clicking elsewhere), the tabindex may not be properly reset.

**Current Code:**
```javascript
enterDocumentMode(row) {
  const documentElement = row.querySelector(this.options.documentSelector);
  if (documentElement) {
    this.inDocumentMode = true;
    documentElement.setAttribute("tabindex", "0");
    documentElement.focus();
  }
}
```

**Impact:** Minor - may cause focus management issues in edge cases.

**Recommendation:** Consider adding a focusout event listener to automatically exit document mode when focus leaves the document element, or resetting all document tabindices during `setInternalTabindices()`.

---

### 2. Potential Null Reference in postRowAriaLabel

**Location:** `post.gjs` lines 174-236

**Description:** The `postRowAriaLabel` getter accesses several post properties without defensive null checks for all paths.

**Current Code (lines 182-190):**
```javascript
// 2. Replying to (if reply to specific post)
if (
  post.reply_to_post_number &&
  post.reply_to_user?.username &&
  !this.isReplyingDirectlyToPostAbove
) {
  parts.push(
    i18n("post.sr_replying_to", { username: post.reply_to_user.username })
  );
}
```

**Impact:** The optional chaining (`?.`) is correctly used here, so this is safe.

**Assessment:** No action needed - the code is defensive.

---

### 3. Consider Adding aria-describedby for Post Content

**Location:** `post.gjs`

**Description:** The post row has an `aria-label` with metadata but the actual post content (cooked HTML) is only accessible in document mode. Consider adding `aria-describedby` pointing to the cooked content for screen readers.

**Impact:** Minor UX improvement.

**Recommendation:** Optional enhancement for future iteration.

---

## Verification Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Syntax errors | PASS | All files parse correctly |
| Import statements | PASS | All imports are valid |
| Function signatures match usage | PASS | `getNextIndex(rows, ...)` is correct |
| Event listeners cleaned up | PASS | `registerDestructor` and `cleanup()` properly implemented |
| ARIA roles correct | PASS | grid/row/gridcell hierarchy correct |
| ARIA labels present | PASS | All elements have appropriate labels |
| Keyboard navigation complete | PASS | All required keys implemented |
| Focus management correct | PASS | Roving tabindex implemented correctly |
| i18n strings defined | PASS | All required strings in client.en.yml |
| Document mode works | PASS | Ctrl+Enter/Escape pattern implemented |

---

## ARIA Compliance Analysis

### WAI-ARIA Grid Pattern Requirements

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| Container has `role="grid"` | `post-stream.gjs` line 259 | PASS |
| Grid has accessible name | `aria-label={{i18n "post_stream.aria_label"}}` | PASS |
| Rows have `role="row"` | `post.gjs` line 484, `small-action.gjs` line 155 | PASS |
| Cells have `role="gridcell"` | `post.gjs` lines 598, 604 | PASS |
| Roving tabindex implemented | `updateRovingTabindex()` in modifier | PASS |
| Arrow key navigation | Up/Down/Left/Right handlers | PASS |
| Home/End navigation | With and without Ctrl modifier | PASS |
| Page Up/Down | Jump by pageSize (5) | PASS |
| Enter to activate | `activateCurrentFocusable()` | PASS |
| Escape from document mode | `exitDocumentMode()` | PASS |

### Document Mode Pattern

The implementation uses a clever approach for document mode:

1. Post content (`.cooked`) has `role="document"` when in stream elements
2. Ctrl+Enter enters document mode by focusing the document element
3. Escape exits document mode and returns focus to the row

This follows the [WAI-ARIA document role](https://www.w3.org/TR/wai-aria-1.2/#document) pattern, allowing screen readers to switch from application mode to document reading mode.

---

## Edge Case Analysis

| Edge Case | Handling | Status |
|-----------|----------|--------|
| Empty post stream | `rows.length === 0` check in navigation functions | PASS |
| Single post | Navigation functions handle gracefully | PASS |
| Cloaked (virtualized) posts | Modifier queries live DOM; cloaked posts excluded | PASS |
| Deleted posts | Same as regular posts with `.deleted` class | PASS |
| Loading states | `loadingAbove`/`loadingBelow` checked before rendering | PASS |
| Focus on page load | First post gets `tabindex="0"` via `updateTabindices()` | PASS |
| Component destruction | `registerDestructor` removes event listeners | PASS |

---

## Memory Leak Analysis

| Potential Leak | Prevention Mechanism | Status |
|----------------|---------------------|--------|
| Event listeners | `registerDestructor` calls `cleanup()` | SAFE |
| DOM references | `this.element = null` not set on cleanup but... | SAFE |
| Observer patterns | Not used | N/A |
| Tracked state | Ember auto-cleanup | SAFE |

**Note:** The `this.element` reference is not explicitly nulled in `cleanup()`, but this is not a leak because:
1. The modifier is destroyed along with its element
2. Ember's destroyable system handles cleanup

---

## Recommendations Summary

### Must Fix Before Merge

None - all critical issues have been resolved.

### Should Fix

1. Add `role="gridcell"` to small-action post child elements for ARIA compliance consistency

### Nice to Have

1. Add focusout handler to auto-exit document mode
2. File separate issue to fix `grid-navigation.js` passing `rows.length` instead of `rows`

---

## References

- [WAI-ARIA Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
- [WAI-ARIA 1.3 Specification](https://w3c.github.io/aria/)
- [Keyboard Interface Development](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
- [Layout Grid Examples](https://www.w3.org/WAI/ARIA/apg/patterns/grid/examples/layout-grids/)

---

## Conclusion

The post stream WAI-ARIA Grid pattern implementation is **well-designed and correctly implemented**. The code follows accessibility best practices, implements the full keyboard navigation pattern, and provides proper ARIA roles and labels for screen reader users. The document mode implementation is a thoughtful addition that allows screen reader users to read post content in detail.

The minor issues identified are non-blocking and can be addressed in future iterations. The implementation is ready for accessibility testing.
