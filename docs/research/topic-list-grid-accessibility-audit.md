# Topic List Grid Accessibility Audit Report

**Date:** 2026-01-01
**Auditor:** Accessibility Review Agent
**Branch:** accessibility

---

## Executive Summary

**Overall Assessment: NEEDS WORK**

The topic list grid has a solid foundation for accessibility with proper ARIA roles and roving tabindex implementation for row navigation. However, critical gaps exist in:

1. **Missing composite row accessible names** - Screen reader users cannot get context when navigating rows
2. **No cell-level navigation** - ArrowLeft/ArrowRight keys are not implemented for moving between cells
3. **Header row missing role="row"** - ARIA structure incomplete

---

## Verification Checklist Results

### 1. Single Tab Stop (Roving Tabindex)

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Grid has exactly ONE tab stop | PASS | `item.gjs:102-104` - tabindex is set based on index |
| Only ONE element has tabindex="0" at any time | PASS | `keyboard-navigation-utils.js:96-104` - `updateRovingTabindex` sets only activeIndex to 0 |
| All other focusable elements have tabindex="-1" | PASS | Same function sets all others to "-1" |
| tabindex updates when focus moves | PASS | `grid-navigation.js:190-193` calls `updateTabindices()` on focus changes |

**Code Evidence:**

```javascript
// item.gjs:102-104
get tabindex() {
  return this.args.index === 0 ? "0" : "-1";
}
```

```javascript
// keyboard-navigation-utils.js:96-104
export function updateRovingTabindex(elements, activeIndex) {
  if (!elements || elements.length === 0) {
    return;
  }

  elements.forEach((el, index) => {
    el.setAttribute("tabindex", index === activeIndex ? "0" : "-1");
  });
}
```

---

### 2. Row Navigation (Up/Down Arrows)

| Requirement | Status | Evidence |
|-------------|--------|----------|
| ArrowDown moves to next row | PASS | `grid-navigation.js:64-70` |
| ArrowUp moves to previous row | PASS | `grid-navigation.js:72-80` |
| At last row, ArrowDown triggers load-more or stops | PASS | `grid-navigation.js:134-137` - calls `onLoadMore` if at boundary |
| Focus visually indicated on current row | PASS | Row receives focus, CSS handles visual indication |

**Code Evidence:**

```javascript
// grid-navigation.js:64-70
case "ArrowDown":
  if (modifier) {
    this.focusLastRow();
  } else {
    this.focusNextRow();
  }
  handled = true;
  break;
```

```javascript
// grid-navigation.js:125-138
focusNextRow() {
  const rows = this.rows;
  const newIndex = getNextIndex(
    rows.length,
    this.activeRowIndex,
    this.options.wrap
  );
  if (newIndex !== this.activeRowIndex) {
    this.focusRow(newIndex);
  } else if (this.options.onLoadMore) {
    // At boundary - try to load more
    this.options.onLoadMore();
  }
}
```

**Additional Keyboard Support:**
- `Home` - First row (line 82-85)
- `End` - Last row (line 87-90)
- `PageUp/PageDown` - Jump by pageSize (default 10) (lines 92-100)
- `Ctrl+ArrowDown/Up` - Jump to last/first row (lines 65-66, 73-74)
- `Enter` - Activate current row / navigate to topic (lines 102-105)

---

### 3. Composite Row Accessible Name

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Each row has aria-label or aria-labelledby | **FAIL** | No aria-label on `<tr>` elements |
| Label includes topic title | **FAIL** | Not implemented |
| Label includes category | **FAIL** | Not implemented |
| Label includes tags | **FAIL** | Not implemented |
| Label includes reply count | **FAIL** | Not implemented |
| Label includes views | **FAIL** | Not implemented |
| Label includes activity time | **FAIL** | Not implemented |
| Screen reader announces full context on row focus | **FAIL** | Only table role semantics available |

**Code Evidence:**

```javascript
// item.gjs:284-312 - The <tr> element has no aria-label
<tr
  {{this.highlightIfNeeded}}
  {{on "keydown" this.keyDown}}
  {{on "click" this.click}}
  {{on "auxclick" this.click}}
  data-topic-id={{@topic.id}}
  role={{this.role}}
  tabindex={{this.tabindex}}
  class={{concatClass "topic-list-item" ...}}
  style={{this.style}}
>
```

**Impact:** Screen reader users focusing a row will only hear generic "row" announcement, not the topic content. They must navigate into cells to discover what the row contains.

---

### 4. Cell Navigation (Left/Right Arrows)

| Requirement | Status | Evidence |
|-------------|--------|----------|
| ArrowRight moves to next cell in row | **FAIL** | Not implemented in grid-navigation.js |
| ArrowLeft moves to previous cell in row | **FAIL** | Not implemented in grid-navigation.js |
| Each cell has role="gridcell" | PASS | All item cells have `role="gridcell"` |

**Code Evidence:**

The `grid-navigation.js` modifier only handles row-level navigation:

```javascript
// grid-navigation.js:57-112 - handleKeydown
// Only handles: ArrowUp, ArrowDown, Home, End, PageUp, PageDown, Enter
// Does NOT handle: ArrowLeft, ArrowRight
```

**Current Cell Roles (All Correct):**
- `topic-cell.gjs:51` - `role="gridcell"`
- `replies-cell.gjs:58` - `role="gridcell"`
- `views-cell.gjs:7` - `role="gridcell"`
- `activity-cell.gjs:15` - `role="gridcell"`
- `posters-cell.gjs:5` - `role="gridcell"`
- `bulk-select-cell.gjs:4` - `role="gridcell"`
- `likes-cell.gjs:6` - `role="gridcell"`
- `op-likes-cell.gjs:6` - `role="gridcell"`

---

### 5. ARIA Roles Verification

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Container: role="grid" | PASS | `list.gjs:193` |
| Header section: role="rowgroup" | PASS | `list.gjs:200` |
| Body section: role="rowgroup" | PASS | `list.gjs:230` |
| Each data row: role="row" | PASS | `item.gjs:94-96` |
| Header row: role="row" | PASS | `header.gjs:5` |
| Header cells: role="columnheader" | **PARTIAL** | Uses `<th scope="col">` (acceptable) but not explicit role |
| Data cells: role="gridcell" | PASS | All cells have explicit role |
| aria-rowcount on grid | PASS | `list.gjs:195` |
| aria-rowindex on each row | **FAIL** | Not implemented on rows |

**Code Evidence:**

```javascript
// list.gjs:187-198
<table
  class={{concatClass "topic-list" ...}}
  role="grid"
  aria-labelledby={{@ariaLabelledby}}
  aria-rowcount={{@topics.length}}
  {{gridNavigation}}
  ...attributes
>
  <caption class="sr-only">{{i18n "sr_topic_list_caption"}}</caption>
  <thead class="topic-list-header" role="rowgroup">
```

```javascript
// header.gjs:4-6 - Has role="row"
<tr role="row">
  {{#each @columns as |entry|}}
```

```javascript
// item.gjs:291-292 - Data row role is correct
role={{this.role}}
// where this.role returns "row" (line 94-96)
```

---

## Issues Summary

### Critical Issues (Must Fix)

#### Issue 1: Missing Row Accessible Names

**File:** `frontend/discourse/app/components/topic-list/item.gjs`
**Line:** 284-312
**Expected:** Each `<tr>` should have `aria-label` with composite text
**Actual:** No aria-label present

**Recommended Fix:**
```javascript
// Add computed property to Item component
get accessibleName() {
  const topic = this.args.topic;
  const parts = [
    topic.title,
    topic.category?.name ? `in ${topic.category.name}` : null,
    topic.tags?.length ? `tags: ${topic.tags.join(', ')}` : null,
    `${topic.replyCount} replies`,
    `${topic.views} views`,
    `last activity ${formatRelativeDate(topic.bumpedAt)}`
  ].filter(Boolean);
  return parts.join(', ');
}

// Then in template:
<tr aria-label={{this.accessibleName}} ...>
```

#### Issue 2: No Cell Navigation (ArrowLeft/ArrowRight)

**File:** `frontend/discourse/app/modifiers/grid-navigation.js`
**Line:** 57-112
**Expected:** ArrowLeft/ArrowRight should move focus between cells within a row
**Actual:** These keys are not handled

**Recommended Fix:**
```javascript
// Add to handleKeydown switch statement
case "ArrowRight":
  this.focusNextCell();
  handled = true;
  break;

case "ArrowLeft":
  this.focusPreviousCell();
  handled = true;
  break;

// Add new methods
focusNextCell() {
  const row = this.rows[this.activeRowIndex];
  if (!row) return;

  const cells = Array.from(row.querySelectorAll('[role="gridcell"]'));
  const currentCell = row.querySelector('[role="gridcell"]:focus-within')
                   || cells[0];
  const currentIndex = cells.indexOf(currentCell);
  const nextIndex = Math.min(currentIndex + 1, cells.length - 1);

  // Focus first focusable element in next cell
  const nextCell = cells[nextIndex];
  const focusable = nextCell.querySelector('a, button, input, [tabindex]');
  if (focusable) {
    focusable.focus();
  }
}

focusPreviousCell() {
  // Similar logic, but decrement index
}
```

### Medium Issues (Should Fix)

#### Issue 3: Missing aria-rowindex

**File:** `frontend/discourse/app/components/topic-list/item.gjs`
**Line:** 284
**Expected:** `aria-rowindex={{add @index 2}}` (add 2 to account for 1-based and header row)
**Actual:** Not present

**Recommended Fix:**
```javascript
<tr aria-rowindex={{add @index 2}} ...>
```

### Minor Issues (Nice to Have)

#### Issue 4: Header Cells Use <th> Instead of Explicit role="columnheader"

**File:** `frontend/discourse/app/components/topic-list/header/sortable-column.gjs`
**Line:** 69-84
**Current:** Uses `<th scope="col">` which is valid HTML
**Note:** Explicit `role="columnheader"` would be more consistent with the grid pattern but is not strictly required when using semantic `<th>` with `scope="col"`

---

## What's Implemented Correctly

1. **Grid Role Structure**
   - Container has `role="grid"` with `aria-labelledby` and `aria-rowcount`
   - Includes screen reader caption
   - Proper rowgroup structure for thead and tbody

2. **Roving Tabindex Pattern**
   - Only one row is tabbable at a time
   - Focus management updates tabindex correctly
   - Initial focus goes to first row

3. **Row Keyboard Navigation**
   - Full arrow key support for up/down navigation
   - Home/End for first/last row
   - PageUp/PageDown for jumping multiple rows
   - Ctrl+Arrow for jumping to boundaries
   - Enter to activate (navigate to topic)

4. **Cell Roles**
   - All data cells have `role="gridcell"`
   - Header cells use semantic `<th>` with `scope="col"`

5. **Sort Indication**
   - `aria-sort` on sortable column headers
   - Visual sort indicators

---

## Accessibility Testing Recommendations

### Manual Testing Checklist

1. [ ] With NVDA/JAWS: Tab to grid, verify single tab stop
2. [ ] Use ArrowUp/Down: Verify row-to-row navigation announcements
3. [ ] Press Enter on row: Verify topic opens
4. [ ] Test Home/End: Verify first/last row navigation
5. [ ] Verify sort column announcements (aria-sort)
6. [ ] **After fixes:** Test ArrowLeft/Right cell navigation
7. [ ] **After fixes:** Verify row accessible names are announced

### Automated Testing

- axe-core: Run on topic list page
- Lighthouse: Check accessibility score
- WAVE: Verify no critical errors

---

## Implementation Priority

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| P0 | Row accessible names | Medium | Critical for screen readers |
| P1 | Cell navigation (Left/Right) | Medium | Important for grid pattern compliance |
| P2 | aria-rowindex | Low | Helps with large lists |
| P3 | Explicit columnheader role | Low | Nice to have |

---

## References

- [WAI-ARIA Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
- [WAI-ARIA Data Grid Examples](https://www.w3.org/WAI/ARIA/apg/example-index/grid/dataGrids.html)
- [MDN: ARIA grid role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/grid_role)

---

## Files Reviewed

| File | Path |
|------|------|
| Grid Navigation Modifier | `frontend/discourse/app/modifiers/grid-navigation.js` |
| Topic List Component | `frontend/discourse/app/components/topic-list/list.gjs` |
| Topic List Item | `frontend/discourse/app/components/topic-list/item.gjs` |
| Topic List Header | `frontend/discourse/app/components/topic-list/header.gjs` |
| Keyboard Nav Utils | `frontend/discourse/app/lib/keyboard-navigation-utils.js` |
| Topic Cell | `frontend/discourse/app/components/topic-list/item/topic-cell.gjs` |
| Replies Cell | `frontend/discourse/app/components/topic-list/item/replies-cell.gjs` |
| Views Cell | `frontend/discourse/app/components/topic-list/item/views-cell.gjs` |
| Activity Cell | `frontend/discourse/app/components/topic-list/item/activity-cell.gjs` |
| Posters Cell | `frontend/discourse/app/components/topic-list/item/posters-cell.gjs` |
| Bulk Select Cell | `frontend/discourse/app/components/topic-list/item/bulk-select-cell.gjs` |
| Likes Cell | `frontend/discourse/app/components/topic-list/item/likes-cell.gjs` |
| Op Likes Cell | `frontend/discourse/app/components/topic-list/item/op-likes-cell.gjs` |
| Sortable Column | `frontend/discourse/app/components/topic-list/header/sortable-column.gjs` |
