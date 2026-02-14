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
| [05-accessibility-backlog.md](05-accessibility-backlog.md) | **Backlog** - Pending accessibility tasks |
| [06-empty-states.md](06-empty-states.md) | Empty state accessibility |
| [07-global-theme-accessibility.md](07-global-theme-accessibility.md) | Global theme accessibility |
| [07-latest-sidebar.md](07-latest-sidebar.md) | Latest sidebar accessibility |
| [08-per-user-theme-preferences.md](08-per-user-theme-preferences.md) | Per-user theme preferences |
| [09-sidebar-navigation.md](09-sidebar-navigation.md) | Sidebar tree navigation with single tab stop |
| [10-navigation-controls-toolbar.md](10-navigation-controls-toolbar.md) | Topic actions toolbar (Dismiss, New Topic, etc.) |
| [11-filter-focus-management.md](11-filter-focus-management.md) | Focus management after filter selection |
| [12-focus-history-restoration.md](12-focus-history-restoration.md) | Focus restoration on browser back/forward |
| [13-topic-header-row.md](13-topic-header-row.md) | Topic header row for post stream grid |
| [14-timeline-slider.md](14-timeline-slider.md) | Timeline slider accessibility (N of M indicator) |
| [14-timeline-slider-dev-design.md](14-timeline-slider-dev-design.md) | Timeline slider developer design |
| [14-timeline-slider-risk-assessment.md](14-timeline-slider-risk-assessment.md) | Timeline slider risk assessment (Decision: Remove from keyboard nav) |
| [15-sidebar-action-buttons.md](15-sidebar-action-buttons.md) | **PLANNING** - Sidebar action button arrow key navigation |
| [16-post-content-link-navigation.md](16-post-content-link-navigation.md) | **PLANNING** - Arrow key navigation between links within post content |

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
- `frontend/discourse/app/components/post-stream/header-row.gjs` - Topic header row for post grid
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
| `c37d121b4d` | A11Y: Use aria-label with computed text for post content gridcell |
| `9271a80579` | A11Y: Use aria-labelledby instead of aria-describedby for post content |
| `08e5225d51` | A11Y: Fix NVDA char-by-char navigation when focusing post content |
| `b14576b549` | A11Y: Screen readers can now navigate posts with left/right arrow keys |
| `8a05c58263` | A11Y: Fix NVDA reading post content when navigating with Arrow Right/Left |
| `a98d18dbf7` | A11Y: Enable full post content reading during keyboard navigation |
| `4560cd4486` | A11Y: Fix grid focus persistence and add poster names to row labels |
| `ed53e6cad8` | A11Y: Improve grid and toolbar keyboard navigation |
| `870a684424` | A11Y: Enhance grid navigation with Left/Right arrows and row labels |
| `1becb758ed` | A11Y: Implement WAI-ARIA grid pattern for topic list |
| `8270b7eb86` | A11Y: Add tablist pattern to navigation and restore focus after tab selection |
| `694187b6fd` | A11Y: Implement sidebar tree navigation with single tab stop |
| `7b706ba416` | A11Y: Convert navigation controls to toolbar with arrow key navigation |
| `cc69f8d202` | A11Y: Move focus to first topic row after keyboard filter selection |
| `0302079f35` | A11Y: Auto-focus first topic row on page load for keyboard users |
| `1e7b72bddf` | A11Y: Add toolbar pattern to header auth buttons |
| `90492821bd` | A11Y: Fix topic header row scroll under sticky header |
| `8e952a95c8` | A11Y: Prevent cloaking on focused post during keyboard navigation |
| `489b991b23` | A11Y: Fix focus jumping with directional cloaking fallback |
| `d035eb86f1` | A11Y: Remove timeline slider from keyboard navigation |
| `4959214207` | A11Y: Fix header row Enter key and category link navigation |
| `67621ca2aa` | A11Y: Focus first category row after keyboard tab selection (#35) |
| `fe6fdc9900` | A11Y: Ensure focus outline visible after browser back navigation (#36) |
| `fe6fdc9900` | A11Y: Fix focus indicator on danger dropdown items (#37) |
| `46d38f52c8` | A11Y: Fix sidebar tree nav catching toolbar and header elements (#40) |
| `c5b580eb7d` | A11Y: Let post-stream handle focus when navigating to topic via keyboard (#41) |
| `d24bc172f2` | A11Y: Fix header edit scroll under sticky nav (#43) |

## References

- [WAI-ARIA Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)
- [WAI-ARIA Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
- [WAI-ARIA Tree Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/)
- [WAI-ARIA Slider Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/)
- [Fluent UI DataGrid](https://react.fluentui.dev/?path=/docs/components-datagrid--docs)
- [Roving Tabindex](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_roving_tabindex)
