# Accessibility Implementation Documentation

This folder contains documentation for accessibility improvements to Discourse, focusing on keyboard navigation and screen reader support following WAI-ARIA patterns.

## Document Index

| File | Description |
|------|-------------|
| [00-index.md](00-index.md) | This index - overview of all accessibility documentation |
| [01-toolbar.md](01-toolbar.md) | Navigation toolbar implementation (categories, tags, nav tabs) |
| [02-topic-grid.md](02-topic-grid.md) | Topic list grid implementation with keyboard navigation |
| [03-category-grid.md](03-category-grid.md) | Category list grid implementation with keyboard navigation |
| [04-topic-thread.md](04-topic-thread.md) | Post stream grid implementation for reading topics |
| [06-empty-states.md](06-empty-states.md) | Empty state accessibility |
| [07-global-theme-accessibility.md](07-global-theme-accessibility.md) | Global theme accessibility |
| [07-latest-sidebar.md](07-latest-sidebar.md) | Latest sidebar accessibility |
| [08-per-user-theme-preferences.md](08-per-user-theme-preferences.md) | Per-user theme preferences |

## Implementation Overview

### Goals

1. **Single Tab Stop Navigation** - Complex UI regions (toolbars, grids) should be single tab stops with internal arrow key navigation
2. **Screen Reader Support** - Proper ARIA roles, labels, and announcements for assistive technology users
3. **Keyboard Parity** - All functionality accessible via keyboard matching Fluent UI patterns

### Patterns Used

- **Roving Tabindex** - One element in a group has `tabindex="0"`, others have `tabindex="-1"`
- **WAI-ARIA Toolbar Pattern** - For navigation bar (categories, tags, Latest/Hot/Categories tabs)
- **WAI-ARIA Grid Pattern** - For topic list with row/cell navigation

### Key Files Modified

#### Modifiers
- `frontend/discourse/app/modifiers/toolbar-navigation.js` - Toolbar keyboard navigation
- `frontend/discourse/app/modifiers/grid-navigation.js` - Grid keyboard navigation
- `frontend/discourse/app/modifiers/post-stream-navigation.js` - Post stream grid keyboard navigation

#### Components
- `frontend/discourse/app/components/d-navigation.gjs` - Main navigation wrapper
- `frontend/discourse/app/components/navigation-bar.gjs` - Nav tabs container
- `frontend/discourse/app/components/topic-list/list.gjs` - Topic list grid
- `frontend/discourse/app/components/topic-list/item.gjs` - Topic grid row
- `frontend/discourse/app/components/topic-list/header.gjs` - Topic grid header row
- `frontend/discourse/app/components/categories-only.gjs` - Category list grid
- `frontend/discourse/app/components/parent-category-row.gjs` - Category grid row
- `frontend/discourse/app/components/discourse-root.js` - Application root with role="application"
- `frontend/discourse/app/components/post-stream.gjs` - Post stream grid container
- `frontend/discourse/app/components/post.gjs` - Post row with gridcells
- `frontend/discourse/app/components/post/cooked-html.gjs` - Post content with dynamic document role
- `frontend/discourse/app/components/post/menu.gjs` - Post actions toolbar

#### Instance Initializers
- `frontend/discourse/app/instance-initializers/navigation-focus-restoration.js` - Focus restoration after route transitions

#### Utilities
- `frontend/discourse/app/lib/keyboard-navigation-utils.js` - Shared navigation helpers

#### Styles
- `app/assets/stylesheets/common/base/_topic-list.scss` - Focus styles for grid rows
- `app/assets/stylesheets/common/base/topic-post.scss` - Focus styles for post rows

#### i18n
- `config/locales/client.en.yml` - Screen reader strings

## Commit History

| Commit | Description |
|--------|-------------|
| `b14576b549` | A11Y: Screen readers can now navigate posts with left/right arrow keys |
| `8a05c58263` | A11Y: Fix NVDA reading post content when navigating with Arrow Right/Left |
| `a98d18dbf7` | A11Y: Enable full post content reading during keyboard navigation |
| `4560cd4486` | A11Y: Fix grid focus persistence and add poster names to row labels |
| `ed53e6cad8` | A11Y: Improve grid and toolbar keyboard navigation |
| `870a684424` | A11Y: Enhance grid navigation with Left/Right arrows and row labels |
| `1becb758ed` | A11Y: Implement WAI-ARIA grid pattern for topic list |
| `8270b7eb86` | A11Y: Add tablist pattern to navigation and restore focus after tab selection |

## References

- [WAI-ARIA Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)
- [WAI-ARIA Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
- [Fluent UI DataGrid](https://react.fluentui.dev/?path=/docs/components-datagrid--docs)
- [Roving Tabindex](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_roving_tabindex)
