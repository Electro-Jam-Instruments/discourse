# Empty States Accessibility

This document covers the implementation of empty state messages and end-of-list indicators that are accessible to screen reader users.

## Overview

When a list reaches its end or is empty, screen reader users navigating with arrow keys need to:
1. Know when they've reached the end of a list
2. Know when a list is completely empty
3. Understand why (category filter, no results, etc.)

## Implementation: Topic List Footer Row

The topic list grid now includes a navigable footer row that announces the end-of-list message.

### Files Modified

- **`frontend/discourse/app/components/topic-list/list.gjs`** - Added footer row support
- **`frontend/discourse/app/components/discovery/topics.gjs`** - Passes footerMessage to List

### How It Works

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

### Footer Message Computation

The `footerMessage` getter in `discovery/topics.gjs` builds the message based on context:

- For category view: "There are no more X topics"
- For tag view: "There are no more X topics"
- For general view: "There are no more topics"

The message is only shown when `allLoaded` is true (no more topics to load).

### Keyboard Navigation

Users can Arrow Down past the last topic to reach the footer row, which announces:
> "There are no more NVDA PPT Dev topics"

This provides a clear end-of-list indicator for screen reader users.

## Known Limitations

### Completely Empty Lists

When there are zero topics, the grid is not rendered at all. The empty state education component (`EmptyTopicFilter`) is shown instead. This is not yet navigable as a grid row.

**TODO:** Consider adding grid rendering even when empty, with the empty state as the only row.

### Category Grid

The category grid does not yet have empty state handling. Most category lists always have content.

### Latest Sidebar

The latest sidebar grid does not have empty state handling - the "no topics" message is shown outside the grid.

## Other Empty States to Address

| Location | Status |
|----------|--------|
| Topic list (with topics) | **DONE** - Footer row added |
| Topic list (empty) | Not started - uses EmptyTopicFilter |
| Category list | Not started |
| Latest sidebar | Not started |
| Search results | Not started |
| Notifications | Not started |
| Bookmarks | Not started |

## References

- [Fluent UI Empty State Pattern](https://react.fluentui.dev/?path=/docs/components-emptycontent--docs)
- [WCAG Success Criterion 1.3.1 - Info and Relationships](https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html)
