# Accessibility Implementation Documentation

This folder contains documentation for accessibility improvements to Discourse, focusing on keyboard navigation and screen reader support following WAI-ARIA patterns.

## Document Index

| File | Description |
|------|-------------|
| [00-index.md](00-index.md) | This index - overview of all accessibility documentation |
| [01-toolbar.md](01-toolbar.md) | Navigation toolbar implementation (categories, tags, nav tabs) |
| [02-topic-grid.md](02-topic-grid.md) | Topic list grid implementation with keyboard navigation |

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

#### Components
- `frontend/discourse/app/components/d-navigation.gjs` - Main navigation wrapper
- `frontend/discourse/app/components/navigation-bar.gjs` - Nav tabs container
- `frontend/discourse/app/components/topic-list/list.gjs` - Topic list grid
- `frontend/discourse/app/components/topic-list/item.gjs` - Grid row
- `frontend/discourse/app/components/topic-list/header.gjs` - Grid header row

#### Utilities
- `frontend/discourse/app/lib/keyboard-navigation-utils.js` - Shared navigation helpers

#### Styles
- `app/assets/stylesheets/common/base/_topic-list.scss` - Focus styles for grid rows

#### i18n
- `config/locales/client.en.yml` - Screen reader strings

## Commit History

| Commit | Description |
|--------|-------------|
| `ed53e6cad8` | A11Y: Improve grid and toolbar keyboard navigation |
| `870a684424` | A11Y: Enhance grid navigation with Left/Right arrows and row labels |
| `1becb758ed` | A11Y: Implement WAI-ARIA grid pattern for topic list |
| `8270b7eb86` | A11Y: Add tablist pattern to navigation and restore focus after tab selection |

## References

- [WAI-ARIA Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)
- [WAI-ARIA Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
- [Fluent UI DataGrid](https://react.fluentui.dev/?path=/docs/components-datagrid--docs)
- [Roving Tabindex](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_roving_tabindex)
