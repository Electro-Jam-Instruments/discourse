# Topic Header Row for Post Stream Grid

**Status:** Updated (2026-01-23)
**GitHub Issue:** [#25](https://github.com/Electro-Jam-Instruments/discourse/issues/25)

## Problem

When viewing a topic, there were two topic headers:
1. A static header at the top of the page (in `topic.gjs`)
2. A header row in the post stream grid (in `header-row.gjs`)

This caused screen readers to announce the topic title twice, creating redundant and confusing navigation. Additionally, the grid header row was missing functionality that the static header had (status icons, edit button, PM glyph).

## Solution

Unified the topic header by:
1. Enhancing the grid header row with all features from the static header
2. Removing the static header from `topic.gjs`
3. Passing the necessary actions (`editFirstPost`, `onTitleClick`) through the component chain

Now there is one topic header that serves both visual and accessibility needs.

### Header Row Features

The unified header row includes:
- **Topic status icons** (pinned, closed, archived, etc.) via `TopicStatus` component
- **PM glyph** for private messages (with link to inbox if user can send PMs)
- **Clickable title** that triggers edit mode
- **Edit button** (pencil icon) when user has permission to edit
- **Category** with link
- **Tags** (when tagging is enabled)
- **Plugin outlets** for extensibility (`topic-title-suffix`, `topic-category-wrapper`)

### Keyboard Navigation

| Key | Action |
|-----|--------|
| Arrow Up | From first post, focuses topic header row |
| Arrow Down | From header row, focuses first post |
| Arrow Left/Right | Navigate between focusable elements (see order below) |
| Enter | On row: triggers edit if user can edit, otherwise follows title link |
| Enter | On edit button: opens topic title editor |

**Focusable elements in header row (in order):**
1. PM link (if private message and user can send PMs)
2. Title link
3. Edit button (if user can edit)
4. Category link
5. Tag links (one per tag)

### Screen Reader Announcement

When the header row receives focus, screen readers announce:
- "Topic: [title], [status], Category: [category], [X] tags, press Enter to edit"

Example: "Topic: Welcome to Discourse, Pinned, Category: Site Feedback, 3 tags, press Enter to edit"

## Implementation

### Modified Files

| File | Changes |
|------|---------|
| `frontend/discourse/app/components/post-stream/header-row.gjs` | Enhanced with full static header functionality (TopicStatus, PM glyph, edit button, plugin outlets) |
| `frontend/discourse/app/components/post-stream.gjs` | Pass `editFirstPost` and `onTitleClick` actions to header row |
| `frontend/discourse/app/templates/topic.gjs` | Removed static header (h1 with title, status icons, category), pass actions to PostStream |
| `config/locales/client.en.yml` | Added `can_edit` i18n string |

### Removed from topic.gjs

The following static header code was removed:
- `<h1>` element with topic title
- `TopicStatus` component call
- `PrivateMessageGlyph` component call
- Category/tags display
- Edit pencil icon inline with title
- `booleanString` helper import (no longer needed)
- `TopicStatus` import (no longer needed)
- `TopicCategory` import (no longer needed)

### Preserved in topic.gjs

The edit mode UI (`@controller.editingTopic` condition) was preserved - this is the form that appears when actively editing the topic title, category, and tags.

### Actions Flow

```
topic.gjs
  └── @editFirstPost={{@controller.editFirstPost}}
  └── @onTitleClick={{@controller.handleTitleClick}}
      ↓
post-stream.gjs
  └── @editFirstPost={{@editFirstPost}}
  └── @onTitleClick={{@onTitleClick}}
      ↓
header-row.gjs
  └── Edit button calls @editFirstPost
  └── Title link click calls @onTitleClick
```

### i18n Strings

```yaml
post_stream:
  header_row:
    title: "Topic: %{title}"
    category: "Category: %{category}"
    tags:
      one: "%{count} tag"
      other: "%{count} tags"
    can_edit: "press Enter to edit"
```

## Why This Change

1. **Reduced redundancy** - Screen reader users no longer hear the topic title twice
2. **Cleaner UI** - Single source of truth for topic header
3. **Better keyboard navigation** - All topic metadata is navigable via grid pattern
4. **Consistent behavior** - Edit functionality works the same way regardless of how user accesses it

## Testing

To verify this implementation:

1. Navigate to any topic thread
2. Verify there is only ONE topic header visible (the one in the post stream)
3. Tab to the post stream grid
4. Arrow Up from first post to reach header row
5. Verify screen reader announces title, status, category, tags
6. If you can edit, verify "press Enter to edit" is announced
7. Press Enter on header row - should open edit mode
8. Arrow Right to navigate to edit button, press Enter - should open edit mode
9. Check private messages - PM glyph should appear and be navigable

## Related

- [04-topic-thread.md](04-topic-thread.md) - Full post stream grid documentation
- [#25](https://github.com/Electro-Jam-Instruments/discourse/issues/25) - GitHub issue for redundant headers
