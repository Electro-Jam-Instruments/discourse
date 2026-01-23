# Timeline Slider Accessibility

**Status:** Planning
**GitHub Issue:** [#7](https://github.com/Electro-Jam-Instruments/discourse/issues/7)

## Problem

The timeline slider on the right side of topics (showing "N of M" posts) is not keyboard accessible and doesn't work well with screen readers. Currently it only supports mouse/touch drag interactions.

## Solution

Convert the timeline scroller to a proper WAI-ARIA slider with full keyboard support and screen reader announcements.

## Design

### ARIA Attributes

The slider element will have:

| Attribute | Value | Description |
|-----------|-------|-------------|
| `role` | `"slider"` | Identifies as a slider control |
| `aria-valuemin` | `1` | First post |
| `aria-valuemax` | `[total posts]` | Last post (dynamic) |
| `aria-valuenow` | `[current post]` | Currently selected post (dynamic) |
| `aria-valuetext` | `"Post 3 of 15, December 2025"` | Human-readable value (dynamic) |
| `aria-orientation` | `"vertical"` | Timeline is vertical |
| `aria-label` | `"Topic timeline"` | Accessible name |
| `aria-describedby` | `[post-row-id]` | Points to current post row for full content |
| `tabindex` | `"0"` | Focusable via Tab |

### Keyboard Navigation

| Key | Action |
|-----|--------|
| Arrow Up | Previous post (toward post 1) |
| Arrow Down | Next post (toward post N) |
| Arrow Left | Previous post (RTL: next post) |
| Arrow Right | Next post (RTL: previous post) |
| Page Up | Scroll up one viewport, select post now at bottom |
| Page Down | Scroll down one viewport, select post now at top |
| Home | First post |
| End | Last post |
| Enter | Move focus to selected post row in the grid |

### RTL Language Support

For right-to-left languages:
- Arrow Left = Next post (older)
- Arrow Right = Previous post (newer)
- Up/Down remain unchanged

Detection via `document.documentElement.dir === "rtl"` or Discourse's locale service.

### Screen Reader Announcements

When slider receives focus or value changes:
- Announces: "Post 3 of 15, December 2025"
- The `aria-describedby` reference allows users to read the full post content

### Bidirectional Sync

1. **Slider → Grid:** When user navigates the slider, the page scrolls to show that post
2. **Grid → Slider:** When user navigates the post grid, the slider value updates

### Immediate Scroll Behavior

Each arrow key press immediately scrolls the page to the selected post. This ensures:
- The post is visible on screen
- The post row element exists in DOM (not cloaked)
- `aria-describedby` can reference the actual post row

## Implementation Plan

### Phase 1: Add Slider Role and ARIA Attributes

**File:** `frontend/discourse/app/components/topic-timeline/scroller.gjs`

1. Add `role="slider"` to the scroller element
2. Add `aria-valuemin="1"`
3. Add `aria-valuemax` bound to total posts
4. Add `aria-valuenow` bound to current post
5. Add `aria-valuetext` with formatted string "Post N of M, [date]"
6. Add `aria-orientation="vertical"`
7. Add `aria-label` for accessible name
8. Add `tabindex="0"` to make focusable

### Phase 2: Keyboard Navigation

**File:** `frontend/discourse/app/components/topic-timeline/container.gjs`

1. Add keydown event handler to scroller
2. Implement Arrow Up/Down for single post navigation
3. Implement Arrow Left/Right with RTL detection
4. Implement Home/End for first/last post
5. Implement Page Up/Down for viewport-based navigation
6. Implement Enter to jump focus to post grid
7. Call existing `jumpToIndex` action for scrolling

### Phase 3: aria-describedby Integration

**Files:**
- `frontend/discourse/app/components/topic-timeline/container.gjs`
- `frontend/discourse/app/components/post.gjs`

1. Ensure post rows have unique IDs (e.g., `post-row-{post_number}`)
2. Add `aria-describedby` to slider pointing to current post row ID
3. Update `aria-describedby` when slider value changes

### Phase 4: Bidirectional Sync

**Files:**
- `frontend/discourse/app/components/topic-timeline/container.gjs`
- `frontend/discourse/app/modifiers/post-stream-navigation.js`

1. Slider already updates from grid navigation via `topic:current-post-scrolled` event
2. Add event emission from slider when keyboard navigation occurs
3. Ensure grid's active row updates when slider navigates

### Phase 5: i18n Strings

**File:** `config/locales/client.en.yml`

Add strings:
```yaml
topic:
  timeline:
    slider_label: "Topic timeline"
    post_position: "Post %{current} of %{total}"
    post_position_with_date: "Post %{current} of %{total}, %{date}"
```

## Files to Modify

| File | Changes |
|------|---------|
| `frontend/discourse/app/components/topic-timeline/scroller.gjs` | Add ARIA attributes, tabindex |
| `frontend/discourse/app/components/topic-timeline/container.gjs` | Add keyboard handler, aria-describedby logic |
| `frontend/discourse/app/components/post.gjs` | Ensure unique ID on post rows |
| `frontend/discourse/app/modifiers/post-stream-navigation.js` | Sync with slider navigation |
| `config/locales/client.en.yml` | Add i18n strings |

## Testing

### Keyboard Testing

1. Tab to the timeline slider
2. Verify focus indicator is visible
3. Press Arrow Down - should move to next post, page scrolls
4. Press Arrow Up - should move to previous post
5. Press Home - should go to first post
6. Press End - should go to last post
7. Press Page Down - should scroll one viewport
8. Press Page Up - should scroll one viewport back
9. Press Enter - focus should move to post row in grid

### Screen Reader Testing

1. Focus the slider with NVDA/JAWS
2. Verify it announces "Topic timeline, slider, Post 1 of 15, December 2025"
3. Press Arrow Down
4. Verify it announces new position "Post 2 of 15, December 2025"
5. Verify full post content is readable via describedby

### RTL Testing

1. Switch to an RTL language (Arabic, Hebrew)
2. Verify Arrow Left moves to next (older) post
3. Verify Arrow Right moves to previous (newer) post

## Related

- [04-topic-thread.md](04-topic-thread.md) - Post stream grid documentation
- [WAI-ARIA Slider Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/)
- GitHub issue [#7](https://github.com/Electro-Jam-Instruments/discourse/issues/7)
