# Topic Header Row for Post Stream Grid

**Status:** Completed (2026-01-12)
**GitHub Issue:** [#6](https://github.com/Electro-Jam-Instruments/discourse/issues/6)
**Awaiting:** Deployment verification

## Problem

When keyboard users navigate a topic thread using the post stream grid, they could not easily access the topic title, category, and tags. The grid started at the first post, requiring extra tabbing to reach the topic metadata at the top of the page.

## Solution

Added the topic header (title, category, tags) as the first row in the post stream grid with `aria-rowindex="1"`. All post rows now have their `aria-rowindex` offset by +1.

### Implementation

#### New Component: `post-stream/header-row.gjs`

```javascript
// Renders topic title, category, and tags as the first grid row
// - role="row" with aria-rowindex="1"
// - aria-label announces: "Topic: [title], Category: [category], [tag count] tags"
// - Left/Right navigation for category link and tag links
```

#### Modified Files

| File | Changes |
|------|---------|
| `frontend/discourse/app/components/post-stream/header-row.gjs` | **NEW** - Topic header row component |
| `frontend/discourse/app/components/post-stream.gjs` | Import header row, add `totalRowCount` getter, render header row |
| `frontend/discourse/app/components/post.gjs` | Add `ariaRowIndex` getter that returns `post_number + 1` |
| `frontend/discourse/app/modifiers/post-stream-navigation.js` | Updated `rowSelector` to include `.topic-header-row`, added header row handling in `getFocusablesInRow()` |
| `config/locales/client.en.yml` | Added i18n strings for header row aria-label |
| `app/assets/stylesheets/common/base/topic-post.scss` | Added focus styles for `.topic-header-row` |

### Keyboard Navigation

| Key | Action |
|-----|--------|
| Arrow Up | From first post, focuses topic header row |
| Arrow Down | From header row, focuses first post |
| Arrow Left/Right | Navigate between category link and tag links in header |

### Screen Reader Announcement

When the header row receives focus, screen readers announce:
- "Topic: [title], Category: [category], [X] tags"

Example: "Topic: Welcome to Discourse, Category: Site Feedback, 3 tags"

### aria-rowindex Adjustment

The header row uses `aria-rowindex="1"`. All post rows now use `post.post_number + 1` for their `aria-rowindex`:

| Row | aria-rowindex |
|-----|---------------|
| Topic header | 1 |
| Post 1 | 2 |
| Post 2 | 3 |
| Post N | N + 1 |

### i18n Strings

```yaml
post_stream:
  header_row:
    title: "Topic: %{title}"
    category: "Category: %{category}"
    tags:
      one: "%{count} tag"
      other: "%{count} tags"
```

## Testing

To verify this implementation:

1. Navigate to any topic thread
2. Tab to the post stream grid
3. Use Arrow Up from the first post - should focus the topic header row
4. Verify screen reader announces topic title, category, and tag count
5. Use Arrow Left/Right to navigate between category link and tags
6. Use Arrow Down to return to first post

## Related

- [04-topic-thread.md](04-topic-thread.md) - Full post stream grid documentation
- [05-accessibility-backlog.md](05-accessibility-backlog.md) - Backlog tracking
