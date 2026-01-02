# Empty States Accessibility

This document covers the implementation of empty state messages and end-of-list indicators that are accessible to screen reader users.

## Overview

When a list reaches its end or is empty, screen reader users navigating with arrow keys need to:
1. Know when they've reached the end of a list
2. Know when a list is completely empty
3. Understand why (category filter, no results, etc.)

## Implementation Summary

All grid-based lists now include navigable rows for empty states and end-of-list indicators:

| Location | Status |
|----------|--------|
| Topic list (with topics) | **DONE** - Footer row added |
| Topic list (empty) | **DONE** - Empty state row added |
| Category list | **DONE** - Empty state row added |
| Latest sidebar | **DONE** - Empty state row added |
| Search results | Not started |
| Notifications | Not started |
| Bookmarks | Not started |

## Implementation: Topic List

### Footer Row (End of List)

The topic list grid includes a navigable footer row that announces the end-of-list message.

**Files Modified:**
- `frontend/discourse/app/components/topic-list/list.gjs` - Added footer row support
- `frontend/discourse/app/components/discovery/topics.gjs` - Passes footerMessage to List

When all topics are loaded, the `footerMessage` is passed to the List component:

```javascript
// discovery/topics.gjs
<List
  ...
  @footerMessage={{if this.allLoaded this.footerMessage}}
/>
```

The List component renders a navigable footer row at the end of the grid:

```html
<tr
  role="row"
  tabindex="-1"
  aria-rowindex={{this.footerRowIndex}}
  aria-label={{@footerMessage}}
  class="topic-list-footer-row"
>
  <td role="gridcell" colspan={{this.columnCount}} class="topic-list-footer-cell">
    {{@footerMessage}}
  </td>
</tr>
```

### Empty State Row (No Topics)

When the topic list is empty, an empty state row is shown within the grid.

**Files Modified:**
- `frontend/discourse/app/components/topic-list/list.gjs` - Added empty state row
- `frontend/discourse/app/components/discovery/topics.gjs` - Passes emptyMessage to List
- `app/assets/stylesheets/common/base/_topic-list.scss` - Focus styles

```html
<tr
  role="row"
  tabindex="0"
  aria-rowindex="2"
  aria-label={{@emptyMessage}}
  class="topic-list-empty-row"
>
  <td role="gridcell" colspan={{this.columnCount}} class="topic-list-empty-cell">
    {{@emptyMessage}}
  </td>
</tr>
```

The `emptyMessage` getter builds context-aware messages:
- For category view: "There are no {category} topics"
- For tag view: "There are no {tag} topics"
- For general view: "There are no topics"

## Implementation: Category List

The category list grid always renders, with an empty state row when no categories exist.

**Files Modified:**
- `frontend/discourse/app/components/categories-only.gjs` - Added empty state support
- `app/assets/stylesheets/common/base/category-list.scss` - Focus styles

```html
<tr
  role="row"
  tabindex="0"
  aria-rowindex="2"
  aria-label={{this.emptyMessage}}
  class="category-list-empty-row"
>
  <td role="gridcell" colspan={{this.columnCount}} class="category-list-empty-cell">
    {{this.emptyMessage}}
  </td>
</tr>
```

Key features:
- Grid always renders (even when empty)
- Empty state row is focusable via Tab
- Announces "No categories" message

## Implementation: Latest Sidebar

The Latest sidebar grid always renders, with an empty state row when no topics exist.

**Files Modified:**
- `frontend/discourse/app/components/categories-topic-list.gjs` - Added empty state support
- `app/assets/stylesheets/desktop/latest-topic-list.scss` - Focus styles

```html
<div
  role="row"
  tabindex="0"
  aria-rowindex="1"
  aria-label={{this.emptyMessage}}
  class="latest-topic-list-empty-row"
>
  <div role="gridcell" class="latest-topic-list-empty-cell">
    {{this.emptyMessage}}
  </div>
</div>
```

Key features:
- Grid always renders (even when empty)
- Uses div elements (consistent with existing grid structure)
- Empty state row is focusable via Tab
- "More" button only shown when topics exist

## Keyboard Navigation

For all empty state implementations:

| Key | Action |
|-----|--------|
| Tab | Focus empty state row (when grid is empty) |
| Arrow Down/Up | Navigate to empty state row (when grid has items) |
| Tab | Exit grid to next region |

## Screen Reader Behavior

- Empty state row announces full message via `aria-label`
- Context-aware messages include category/tag names when applicable
- Roving tabindex ensures single tab stop for grid

## Focus Styles

All empty state rows have consistent focus styles:

```scss
&:focus {
  outline: 2px solid var(--tertiary);
  outline-offset: -2px;
}

&:focus-visible {
  outline: 2px solid var(--tertiary);
  outline-offset: -2px;
}
```

## Testing

### Manual Testing
1. Navigate to a category with no topics
2. Tab to grid - should focus empty state row
3. Screen reader should announce empty message
4. Tab should exit to next region

### Screen Reader Testing
- Empty state row should announce context-aware message
- No double announcements
- Focus should be clearly indicated

## References

- [Fluent UI Empty State Pattern](https://react.fluentui.dev/?path=/docs/components-emptycontent--docs)
- [WCAG Success Criterion 1.3.1 - Info and Relationships](https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html)
