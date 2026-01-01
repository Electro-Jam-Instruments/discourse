# Topic List Grid Accessibility

This document covers the implementation of keyboard navigation for the Discourse topic list, using the WAI-ARIA Grid pattern.

## Overview

The topic list uses the **WAI-ARIA Grid Pattern** to provide:
- Single tab stop for the entire grid
- Up/Down arrow navigation between rows (including header)
- Left/Right arrow navigation between focusable elements within rows
- Row-level focus with full rectangle highlight
- Composite accessible names for screen reader announcements

## Component Structure

```
table.topic-list (role="grid")
├── thead.topic-list-header (role="rowgroup")
│   └── tr (role="row", aria-rowindex="1")
│       └── th (role="columnheader") - sortable columns
└── tbody.topic-list-body (role="rowgroup")
    └── tr.topic-list-item (role="row", aria-rowindex="2+", aria-label="...")
        └── td (role="gridcell") - topic data cells
```

## Files

### Primary Implementation
- **`frontend/discourse/app/modifiers/grid-navigation.js`** - Grid keyboard navigation modifier

### Components
- **`frontend/discourse/app/components/topic-list/list.gjs`** - Grid container
- **`frontend/discourse/app/components/topic-list/item.gjs`** - Grid data rows
- **`frontend/discourse/app/components/topic-list/header.gjs`** - Grid header row
- **`frontend/discourse/app/components/topic-list/item/topic-cell.gjs`** - Topic cell

### Utilities
- **`frontend/discourse/app/lib/keyboard-navigation-utils.js`** - Shared helpers

### Styles
- **`app/assets/stylesheets/common/base/_topic-list.scss`** - Focus outline styles

## Keyboard Behavior

| Key | Action |
|-----|--------|
| Tab | Enter grid at first data row / Exit grid |
| Arrow Down | Move to next row |
| Arrow Up | Move to previous row (including header) |
| Arrow Right | Move to next focusable element in row (from row focus) |
| Arrow Left | Move to previous focusable element / Return to row focus |
| Home | First row |
| End | Last row |
| Ctrl+Home | Focus entire current row (row focus) |
| Ctrl+End | Last focusable element in current row |
| Page Down | Jump down 10 rows |
| Page Up | Jump up 10 rows |
| Enter | Activate current element / Navigate to topic |

## Implementation Details

### Row Focus State

The grid supports two focus states per row:
1. **Row Focus** (`activeFocusableIndex = -1`) - Entire row is focused, shows full rectangle highlight
2. **Element Focus** (`activeFocusableIndex >= 0`) - Specific element within row is focused

```javascript
// Row itself is focused (full highlight)
activeFocusableIndex = -1;

// Focus the row element
rows[index].focus();
```

### Navigation Flow

```
Row Focus (-1)  --Right-->  First Element (0)  --Right-->  Next Element (1)  ...
     ^                            |
     |                            |
     +--------Left (at 0)---------+
```

When pressing Left at the first element, focus returns to row focus state.

### Header Row Navigation

Header row is index 0 in the rows array. Users can arrow up from the first data row to reach the header:

```javascript
get rows() {
  const headerRow = this.element.querySelector(this.options.headerRowSelector);
  const dataRows = Array.from(this.element.querySelectorAll(this.options.dataRowSelector));
  return headerRow ? [headerRow, ...dataRows] : dataRows;
}
```

### Single Tab Stop

All internal focusable elements have `tabindex="-1"`:

```javascript
setInternalTabindices() {
  const allFocusables = this.element.querySelectorAll(this.options.focusableSelector);
  allFocusables.forEach((el) => {
    el.setAttribute("tabindex", "-1");
  });
}
```

Only the active row has `tabindex="0"`.

### Composite Accessible Names

Each data row has an `aria-label` built from topic data:

```javascript
get accessibleName() {
  const topic = this.args.topic;
  const parts = [];

  parts.push(topic.title);

  if (topic.pinned) parts.push(i18n("topic_statuses.pinned.title"));
  if (topic.closed) parts.push(i18n("topic_statuses.closed.title"));
  if (topic.archived) parts.push(i18n("topic_statuses.archived.title"));
  if (topic.unseen) parts.push(i18n("filters.new.lower_title"));

  if (topic.category?.name) {
    parts.push(i18n("sr_category", { categoryName: topic.category.name }));
  }

  if (topic.tags?.length > 0) {
    parts.push(i18n("sr_tags", { tags: topic.tags.join(", ") }));
  }

  parts.push(i18n("sr_replies", { count: replyCount }));
  parts.push(i18n("sr_views", { count: views }));

  if (topic.bumpedAt) {
    parts.push(i18n("sr_activity", { time: topic.bumpedAtTitle }));
  }

  return parts.join(", ");
}
```

Example announcement: "Welcome to ElectroJam Community, in General, tags: announcements, 5 replies, 120 views, last activity 2 hours ago"

### Load More Integration

When navigating near the bottom of the list, the grid triggers load-more:

```javascript
focusNextRow() {
  const rows = this.rows;
  const newIndex = getNextIndex(rows.length, this.activeRowIndex, this.options.wrap);

  // Trigger load-more when approaching end
  const threshold = this.options.loadMoreThreshold;
  if (this.options.onLoadMore && rows.length - newIndex <= threshold) {
    this.options.onLoadMore();
  }

  if (newIndex !== this.activeRowIndex) {
    this.focusRow(newIndex);
  }
}
```

## ARIA Attributes

### Grid (table)
- `role="grid"`
- `aria-labelledby` - References heading element
- `aria-rowcount` - Total rows including those not yet loaded

### Header Row
- `role="row"`
- `tabindex="-1"` (or "0" when active)
- `aria-rowindex="1"`
- `aria-label` - "Column headers, use left and right arrows to navigate, Enter to sort"

### Data Rows
- `role="row"`
- `tabindex` - "0" for active row, "-1" for others
- `aria-rowindex` - 2-based (1 is header)
- `aria-label` - Composite accessible name

### Cells
- `role="gridcell"` for data cells
- `role="columnheader"` for header cells

## Focus Styles

CSS for full rectangle highlight on rows:

```scss
.topic-list-item {
  &:focus {
    outline: 2px solid var(--tertiary);
    outline-offset: -2px;
  }

  &:focus-visible {
    outline: 2px solid var(--tertiary);
    outline-offset: -2px;
  }
}

.topic-list-header tr[role="row"] {
  &:focus,
  &:focus-visible {
    outline: 2px solid var(--tertiary);
    outline-offset: -2px;
  }
}
```

## Issues Fixed

### Duplicate Title Announcements
**Problem:** Screen reader was announcing topic title multiple times.

**Cause:** Topic cell had `role="heading"` on the title span, causing double announcement.

**Solution:** Removed heading role from `topic-cell.gjs`:
```diff
- <span class="link-top-line" role="heading" aria-level="2">
+ <span class="link-top-line">
```

### Focus Goes to Internal Element Instead of Row
**Problem:** Up/Down arrow was focusing the first link instead of the row itself.

**Solution:** Changed `focusRow()` to focus the row element and set `activeFocusableIndex = -1`:
```javascript
focusRow(index) {
  const rows = this.rows;
  if (index >= 0 && index < rows.length) {
    this.activeRowIndex = index;
    this.activeFocusableIndex = -1; // Row itself is focused
    this.updateTabindices();
    rows[index].focus(); // Focus row, not internal element
  }
}
```

### Tab Traverses Internal Elements
**Problem:** Tab key was moving through all links/buttons within the grid.

**Solution:** Set `tabindex="-1"` on all internal focusable elements:
```javascript
setInternalTabindices() {
  const allFocusables = this.element.querySelectorAll(this.options.focusableSelector);
  allFocusables.forEach((el) => {
    el.setAttribute("tabindex", "-1");
  });
}
```

### No Full Rectangle Highlight
**Problem:** Focus indicator was only showing on left edge, not full row rectangle.

**Solution:** Added CSS focus styles with `outline` instead of relying on default browser focus.

## Testing

### Manual Testing
1. Tab to grid - should focus first data row with full rectangle
2. Arrow Down/Up - should move between rows (including header)
3. Arrow Right from row - should move to first element in row
4. Arrow Left from first element - should return to row focus
5. Enter on row - should navigate to topic
6. Enter on element - should activate that element
7. Navigate to bottom - should trigger load-more

### Screen Reader Testing
- Grid should announce "grid" with caption
- Row focus should announce full `aria-label`
- Individual elements should announce their own labels
- Header row should indicate sortable columns

## i18n Strings

Added to `config/locales/client.en.yml`:

```yaml
sr_topic_list_caption: Topic list, column headers with buttons are sortable.
sr_topic_list_header: "Column headers, use left and right arrows to navigate, Enter to sort"
sr_category: "in %{categoryName}"
sr_tags: "tags: %{tags}"
sr_replies:
  one: "%{count} reply"
  other: "%{count} replies"
sr_views:
  one: "%{count} view"
  other: "%{count} views"
sr_activity: "last activity %{time}"
```

## Related Documentation

- [WAI-ARIA Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
- [Fluent UI DataGrid](https://react.fluentui.dev/?path=/docs/components-datagrid--docs)
- [docs/grid/TOPIC-LIST-GRID.md](../grid/TOPIC-LIST-GRID.md) - Original planning document
- [docs/grid/ORCHESTRATION.md](../grid/ORCHESTRATION.md) - Task orchestration plan
