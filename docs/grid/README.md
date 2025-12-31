# Grid and Toolbar Accessibility Documentation

This directory contains documentation for implementing ARIA grid and toolbar patterns in Discourse for improved keyboard and screen reader accessibility.

## Overview

Two major accessibility improvements are documented here:

1. **Navigation Bar Toolbar** - Converting the navigation bar (categories dropdown, tags dropdown, Latest/Hot/Categories links) into an ARIA toolbar with single tab stop and arrow key navigation
2. **Topic List Grid** - Enhancing the topic list table with ARIA grid role for keyboard row/cell navigation

Both implementations follow [Fluent UI DataGrid](https://react.fluentui.dev/?path=/docs/components-datagrid--docs) patterns and W3C WAI-ARIA Authoring Practices Guide (APG).

## Documentation Files

| File | Description |
|------|-------------|
| [NAVIGATION-TOOLBAR.md](NAVIGATION-TOOLBAR.md) | Navigation bar toolbar implementation details |
| [TOPIC-LIST-GRID.md](TOPIC-LIST-GRID.md) | Topic list grid/treegrid implementation details |
| [KEYBOARD-NAVIGATION.md](KEYBOARD-NAVIGATION.md) | Shared keyboard navigation utilities |
| [TESTING.md](TESTING.md) | Testing strategy for grid/toolbar patterns |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Branch deployment and server configuration |
| [ORCHESTRATION.md](ORCHESTRATION.md) | Task breakdown and agent handoff workflow |

## Architecture Overview

```
User presses Tab
    ↓
Focus enters toolbar (single tab stop)
    ↓
Arrow keys navigate between toolbar items
    ↓
User presses Tab again
    ↓
Focus enters topic list grid (single tab stop)
    ↓
Arrow Up/Down navigate between rows
Arrow Left/Right navigate between cells (optional)
Enter activates current row
```

## Key Patterns Used

### Roving Tabindex

Only the active item has `tabindex="0"`, all others have `tabindex="-1"`. This creates a single tab stop while allowing arrow key navigation within the widget.

```html
<!-- Only "Latest" is focusable via Tab -->
<a href="/latest" tabindex="0">Latest</a>
<a href="/hot" tabindex="-1">Hot</a>
<a href="/categories" tabindex="-1">Categories</a>
```

### ARIA Roles

| Pattern | Container Role | Item Role |
|---------|----------------|-----------|
| Toolbar | `role="toolbar"` | Links/buttons with `tabindex` |
| Grid | `role="grid"` | `role="row"`, `role="gridcell"` |
| Treegrid | `role="treegrid"` | `role="row"` with `aria-level`, `aria-expanded` |

## Files to Modify

### Navigation Bar (Phase 1)

| File | Location |
|------|----------|
| `navigation-bar.gjs` | `frontend/discourse/app/components/` |
| `navigation-item.gjs` | `frontend/discourse/app/components/` |
| `bread-crumbs.gjs` | `frontend/discourse/app/components/` |

### Topic List (Phase 2)

| File | Location |
|------|----------|
| `list.gjs` | `frontend/discourse/app/components/topic-list/` |
| `item.gjs` | `frontend/discourse/app/components/topic-list/` |
| `header.gjs` | `frontend/discourse/app/components/topic-list/` |

### New Files

| File | Purpose |
|------|---------|
| `toolbar-navigation.js` | Toolbar keyboard navigation modifier |
| `grid-navigation.js` | Grid keyboard navigation modifier |
| `keyboard-navigation-utils.js` | Shared utility functions |

## Current State Analysis

### Navigation Bar

**Current Issues:**
- No `role="toolbar"` attribute
- No arrow key navigation between items
- Multiple tab stops required to traverse navigation
- Each item is a separate tab stop

**Goal:**
- Single tab stop for entire navigation bar
- Left/Right arrow keys move between items
- Home/End jump to first/last item
- Escape closes any open dropdown

### Topic List

**Current Issues:**
- No keyboard navigation within the table
- Must tab to each individual link
- No grid role for proper screen reader navigation
- `role` and `aria-level` attributes on rows but undefined

**Goal:**
- Single tab stop for topic list
- Up/Down arrow keys move between rows
- Enter activates (navigates to) current row
- Screen reader announces row position and column data

## References

### Fluent UI (Primary Reference)
- [Fluent UI DataGrid](https://react.fluentui.dev/?path=/docs/components-datagrid--docs) - Uses `role="grid"` with Table primitives
- [Fluent UI virtualized DataGrid](https://github.com/microsoft/fluentui-contrib/blob/main/packages/react-data-grid-react-window/stories/DataGrid/VirtualizedDataGrid.stories.tsx) - Virtualization patterns
- [useArrowNavigationGroup](https://github.com/microsoft/fluentui/discussions/33883) - Keyboard navigation hook

### W3C WAI-ARIA APG
- [WAI-ARIA Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)
- [WAI-ARIA Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
- [WAI-ARIA Treegrid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/)
- [Roving Tabindex Guide](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_roving_tabindex)

### Other Implementations
- [AG Grid Accessibility](https://www.ag-grid.com/react-data-grid/accessibility/) - Industry standard grid accessibility

## Related Documentation

- [Editor Accessibility](../editor/ACCESSIBILITY.md) - Live region announcements for editor
- [Discourse Accessibility](https://meta.discourse.org/c/accessibility)
