# Latest Sidebar List Accessibility

This document covers the implementation of keyboard navigation for the "Latest" sidebar widget that appears on category pages.

## Overview

The Latest sidebar uses the **WAI-ARIA Grid Pattern** (shared with topic and category lists) to provide:
- Single tab stop for the list
- Up/Down arrow navigation between topics
- Composite accessible names for screen reader announcements

## Component Structure

```
div.latest-topic-list-container (role="grid")
└── div.latest-topic-list-body (role="rowgroup")
    └── div.latest-topic-list-item (role="row", tabindex, aria-label)
        ├── div.topic-poster (role="gridcell") - Avatar
        ├── div.main-link (role="gridcell") - Topic title, category badge, tags
        └── div.topic-stats (role="gridcell") - Reply count, age
```

The structure now includes:
- `role="rowgroup"` wrapper for WAI-ARIA compliance
- `role="gridcell"` on content containers for proper cell semantics

## Files

### Components
- **`frontend/discourse/app/components/categories-topic-list.gjs`** - Grid container with gridNavigation modifier
- **`frontend/discourse/app/components/topic-list/latest-topic-list-item.gjs`** - Grid data rows with ARIA attributes

### Shared
- **`frontend/discourse/app/modifiers/grid-navigation.js`** - Grid keyboard navigation (shared)

### Styles
- **`app/assets/stylesheets/desktop/latest-topic-list.scss`** - Focus outline styles

## Keyboard Behavior

| Key | Action |
|-----|--------|
| Tab | Enter list at first topic |
| Arrow Down | Move to next topic |
| Arrow Up | Move to previous topic |
| Arrow Right | Move to focusable elements in row |
| Arrow Left | Return to row focus |
| Enter | Navigate to topic |
| Tab (from last) | Exit to next region |

## Implementation Details

### Grid Container (`categories-topic-list.gjs`)

```javascript
<div
  role="grid"
  aria-labelledby="latest-topics-heading"
  aria-rowcount={{this.topicRowCount}}
  class="latest-topic-list-container"
  {{gridNavigation
    headerRowSelector=null
    dataRowSelector="[role='row']"
  }}
>
```

Note: `headerRowSelector=null` because this list has no header row.

### Composite Accessible Names (`latest-topic-list-item.gjs`)

```javascript
get accessibleName() {
  const topic = this.args.topic;
  const parts = [];

  // Topic title
  parts.push(topic.title);

  // Pinned status
  if (topic.pinned) {
    parts.push(i18n("topic_statuses.pinned.title"));
  }

  // Category
  if (topic.category?.name) {
    parts.push(i18n("sr_category", { categoryName: topic.category.name }));
  }

  // Reply count
  const replyCount = topic.replyCount ?? topic.reply_count ?? 0;
  parts.push(i18n("sr_replies", { count: replyCount }));

  // Age
  if (topic.bumpedAt) {
    const age = relativeAge(new Date(topic.bumpedAt), {
      format: "medium-with-ago",
      wrapInSpan: false,
    });
    parts.push(age);
  }

  return parts.join(", ");
}
```

Example: "Welcome to ElectroJam, pinned, in General, 0 replies, 8 days ago"

### Row ARIA Attributes

```html
<div
  role="row"
  tabindex={{this.tabindex}}
  aria-rowindex={{this.ariaRowIndex}}
  aria-label={{this.accessibleName}}
  data-topic-id={{@topic.id}}
  class="latest-topic-list-item ..."
>
```

## "More" Button

The "More" button is outside the grid and remains a separate tab stop. This is intentional:
- The grid contains topic rows only
- "More" is a navigation action, not a topic
- Users Tab out of grid to reach "More"

## Testing

### Manual Testing
1. Tab to grid - should focus first topic
2. Arrow Down/Up - should move between topics
3. Arrow Right - should enter row and move to links
4. Arrow Left from first element - return to row focus
5. Enter on row - should navigate to topic
6. Tab from last row - should exit grid

### Screen Reader Testing
- Grid should announce caption/label
- Row focus should announce full accessible name
- Pinned topics should include "pinned" status

## Related Documentation

- [02-topic-grid.md](02-topic-grid.md) - Topic list grid (similar implementation)
- [03-category-grid.md](03-category-grid.md) - Category list grid
