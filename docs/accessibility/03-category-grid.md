# Category List Grid Accessibility

This document covers the implementation of keyboard navigation for the Discourse category list, using the WAI-ARIA Grid pattern.

## Overview

The category list uses the **WAI-ARIA Grid Pattern** to provide:
- Single tab stop for the entire grid
- Up/Down arrow navigation between rows (including header)
- Left/Right arrow navigation between focusable elements within rows
- Row-level focus with full rectangle highlight
- Composite accessible names for screen reader announcements

## Component Structure

```
table.category-list (role="grid")
├── thead (role="rowgroup")
│   └── tr (role="row", tabindex="-1")
│       └── th (role="columnheader") - Category, Topics, Latest
└── tbody (role="rowgroup")
    └── tr (role="row", tabindex, aria-label)
        └── td (role="gridcell") - category data cells
```

## Files

### Primary Implementation
- **`frontend/discourse/app/modifiers/grid-navigation.js`** - Grid keyboard navigation modifier (shared with topic list)

### Components
- **`frontend/discourse/app/components/categories-only.gjs`** - Grid container for categories
- **`frontend/discourse/app/components/parent-category-row.gjs`** - Grid data rows

### i18n
- **`config/locales/client.en.yml`** - Screen reader strings

## Keyboard Behavior

| Key | Action |
|-----|--------|
| Tab | Enter grid at first data row / Exit grid |
| Arrow Down | Move to next row |
| Arrow Up | Move to previous row (including header) |
| Arrow Right | Move to next focusable element in row |
| Arrow Left | Move to previous focusable element / Return to row focus |
| Home | First row |
| End | Last row |
| Ctrl+Home | Focus entire current row |
| Ctrl+End | Last focusable element in current row |
| Page Down | Jump down 10 rows |
| Page Up | Jump up 10 rows |
| Enter | Activate current element / Navigate to category |

## Implementation Details

### Grid Modifier Configuration

The grid modifier is applied in `categories-only.gjs`:

```javascript
{{gridNavigation
  headerRowSelector="thead tr"
  dataRowSelector="tbody tr[role='row']"
}}
```

### Composite Accessible Names

Each data row has an `aria-label` built from category data:

```javascript
get accessibleName() {
  const category = this.category;
  const parts = [];

  // Category name
  parts.push(category.name);

  // Topic count
  if (category.topic_count !== undefined) {
    parts.push(i18n("sr_category_topics", { count: category.topic_count }));
  }

  // Subcategory count
  if (category.subcategories?.length > 0) {
    parts.push(i18n("sr_subcategories", { count: category.subcategories.length }));
  }

  // Muted status
  if (this.isMuted) {
    parts.push(i18n("sr_muted"));
  }

  return parts.join(", ");
}
```

Example announcement: "General, 150 topics, 3 subcategories"

### Muted Categories

The muted categories section also uses the grid pattern with its own table and modifier instance:

```html
<table role="grid" {{gridNavigation ...}}>
  <caption class="sr-only">{{i18n "sr_muted_category_list_caption"}}</caption>
  ...
</table>
```

## ARIA Attributes

### Grid (table)
- `role="grid"`
- `aria-labelledby` - References heading element

### Header Row
- `role="row"`
- `tabindex="-1"`
- `aria-label` - "Column headers, use arrow keys to navigate"

### Data Rows
- `role="row"`
- `tabindex` - "0" for active row, "-1" for others
- `aria-rowindex` - 2-based (1 is header)
- `aria-label` - Composite accessible name

### Cells
- `role="gridcell"` for data cells
- `role="columnheader"` for header cells

## i18n Strings

Added to `config/locales/client.en.yml`:

```yaml
sr_category_list_caption: "Category list with keyboard navigation"
sr_category_list_header: "Column headers, use arrow keys to navigate"
sr_muted_category_list_caption: "Muted categories list"
sr_category_topics:
  one: "%{count} topic"
  other: "%{count} topics"
sr_subcategories:
  one: "%{count} subcategory"
  other: "%{count} subcategories"
sr_muted: "muted"
```

## Testing

### Manual Testing
1. Tab to grid - should focus first data row with full rectangle
2. Arrow Down/Up - should move between rows (including header)
3. Arrow Right from row - should move to first element in row
4. Arrow Left from first element - should return to row focus
5. Enter on row - should navigate to category
6. Enter on element - should activate that element

### Screen Reader Testing
- Grid should announce "grid" with caption
- Row focus should announce full `aria-label`
- Individual elements should announce their own labels
- Header row should indicate column headers

## Related Documentation

- [WAI-ARIA Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
- [02-topic-grid.md](02-topic-grid.md) - Topic list grid (similar implementation)
