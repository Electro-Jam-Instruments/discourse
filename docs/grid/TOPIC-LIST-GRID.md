# Topic List Grid Implementation

This document details the implementation of ARIA grid pattern for the Discourse topic list.

## Overview

The topic list displays topics in a tabular format with columns for Topic, Replies, Views, and Activity. Converting this to a proper ARIA grid provides:

- Keyboard row navigation (Up/Down arrows)
- Optional cell navigation (Left/Right arrows)
- Proper screen reader announcements for grid context

## Architecture Decision

**Recommendation: ARIA Grid Role (Flat List)**

Following [Fluent UI DataGrid](https://react.fluentui.dev/?path=/docs/components-datagrid--docs) patterns:

- Use `role="grid"` for flat tabular data (current topic list)
- Use `role="treegrid"` ONLY when hierarchical data with expand/collapse is present
- Fluent UI uses `useArrowNavigationGroup({ axis: 'grid' })` for keyboard navigation

**Reference Implementations:**
- [Fluent UI DataGrid](https://react.fluentui.dev/?path=/docs/components-datagrid--docs) - Uses `role="grid"` with Table primitives
- [Fluent UI virtualized DataGrid](https://github.com/microsoft/fluentui-contrib/blob/main/packages/react-data-grid-react-window/stories/DataGrid/VirtualizedDataGrid.stories.tsx) - Virtualization patterns
- [AG Grid](https://www.ag-grid.com/react-data-grid/accessibility/) - Confirms: "role='treegrid' when using Tree Data or Row Grouping, otherwise role='grid'"

**Current Implementation: `role="grid"`**
- Topic list is flat data without hierarchy
- Grid provides keyboard navigation (arrow keys, Enter to activate)
- Single tab stop via roving tabindex
- Supports virtualization via `aria-rowcount` / `aria-rowindex`

**Future Upgrade Path: `role="treegrid"`**
- When Discourse adds hierarchical topics (threaded replies in list view)
- Add `aria-expanded` on parent rows
- Add `aria-level` to indicate nesting depth
- Arrow Left/Right for expand/collapse

## Current Implementation

**Files:**
- `frontend/discourse/app/components/topic-list/list.gjs` - Main container
- `frontend/discourse/app/components/topic-list/item.gjs` - Row component
- `frontend/discourse/app/components/topic-list/header.gjs` - Header row

**Current Structure:**
```html
<table class="topic-list" aria-labelledby="...">
  <caption class="sr-only">Topics in...</caption>
  <thead>
    <tr>
      <th scope="col" aria-sort="descending">Topic</th>
      <th scope="col">Replies</th>
      <th scope="col">Views</th>
      <th scope="col">Activity</th>
    </tr>
  </thead>
  <tbody>
    <tr class="topic-list-item" role="..." aria-level="...">
      <td>...</td>
      <td>...</td>
      <td>...</td>
      <td>...</td>
    </tr>
  </tbody>
</table>
```

**Issues:**
- No keyboard navigation within table
- `role` and `aria-level` on rows but undefined
- Must tab to each individual link

## Target Implementation

### Template Changes

**list.gjs:**

```handlebars
<table
  class={{concatClass "topic-list" ...}}
  aria-labelledby={{@ariaLabelledby}}
  role="grid"
  aria-rowcount={{this.totalTopicCount}}
  {{gridNavigation
    onRowActivate=this.handleRowActivate
    onLoadMore=this.loadMoreTopics
  }}
>
  <caption class="sr-only">{{i18n "sr_topic_list_caption"}}</caption>
  <thead class="topic-list-header" role="rowgroup">
    <Header
      @columns={{this.columns}}
      role="row"
      aria-rowindex="1"
    />
  </thead>
  <tbody class="topic-list-body" role="rowgroup">
    {{#each @topics as |topic index|}}
      <Item
        @columns={{this.columns}}
        @topic={{topic}}
        @logicalIndex={{topic.logicalIndex}}
        role="row"
        aria-rowindex={{add topic.logicalIndex 2}}
        tabindex={{if (eq index this.activeRowIndex) "0" "-1"}}
      />
    {{/each}}
  </tbody>
</table>
```

**item.gjs:**

```handlebars
<tr
  {{this.highlightIfNeeded}}
  {{on "keydown" this.handleGridKeydown}}
  {{on "click" this.click}}
  data-topic-id={{@topic.id}}
  role="row"
  aria-rowindex={{@ariaRowIndex}}
  tabindex={{@tabindex}}
  class={{concatClass "topic-list-item" ...}}
>
  {{#each @columns as |entry|}}
    <entry.value.item
      @topic={{@topic}}
      role="gridcell"
    />
  {{/each}}
</tr>
```

### Keyboard Handler

**New File: `frontend/discourse/app/modifiers/grid-navigation.js`**

```javascript
import { registerDestructor } from "@ember/destroyable";
import Modifier from "ember-modifier";
import { bind } from "discourse/lib/decorators";

/**
 * Grid navigation modifier implementing WAI-ARIA grid pattern
 * for keyboard navigation within topic lists.
 *
 * @component GridNavigationModifier
 *
 * Keyboard Support:
 * - Arrow Up/Down: Move between rows
 * - Arrow Left/Right: Move between cells (optional)
 * - Enter: Activate current row (navigate to topic)
 * - Home: First row
 * - End: Last row
 * - Page Up/Down: Jump multiple rows
 * - Ctrl+Home: First cell of first row
 * - Ctrl+End: Last cell of last row
 */
export default class GridNavigationModifier extends Modifier {
  element = null;
  activeRowIndex = 0;
  activeCellIndex = 0;
  options = {};

  constructor(owner, args) {
    super(owner, args);
    registerDestructor(this, (instance) => instance.cleanup());
  }

  modify(element, positional, named) {
    this.element = element;
    this.options = named;

    this.element.addEventListener("keydown", this.handleKeydown);
    this.element.addEventListener("focusin", this.handleFocusIn);

    this.updateTabindices();
  }

  get rows() {
    return Array.from(
      this.element.querySelectorAll('tbody tr[role="row"]')
    );
  }

  get headerRow() {
    return this.element.querySelector('thead tr[role="row"]');
  }

  getCells(row) {
    return Array.from(
      row.querySelectorAll('[role="gridcell"], [role="rowheader"]')
    );
  }

  @bind
  handleKeydown(event) {
    const { key, ctrlKey, metaKey } = event;
    const modifier = ctrlKey || metaKey;

    let handled = false;

    switch (key) {
      case "ArrowDown":
        if (modifier) {
          this.focusLastRow();
        } else {
          this.focusNextRow();
        }
        handled = true;
        break;

      case "ArrowUp":
        if (modifier) {
          this.focusFirstRow();
        } else {
          this.focusPreviousRow();
        }
        handled = true;
        break;

      case "ArrowRight":
        this.focusNextCell();
        handled = true;
        break;

      case "ArrowLeft":
        this.focusPreviousCell();
        handled = true;
        break;

      case "Home":
        if (modifier) {
          this.focusFirstRow();
          this.focusFirstCell();
        } else {
          this.focusFirstCell();
        }
        handled = true;
        break;

      case "End":
        if (modifier) {
          this.focusLastRow();
          this.focusLastCell();
        } else {
          this.focusLastCell();
        }
        handled = true;
        break;

      case "PageDown":
        this.focusRowByOffset(10);
        handled = true;
        break;

      case "PageUp":
        this.focusRowByOffset(-10);
        handled = true;
        break;

      case "Enter":
        this.activateCurrentRow();
        handled = true;
        break;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  @bind
  handleFocusIn(event) {
    const row = event.target.closest('tr[role="row"]');
    if (row && row.closest("tbody")) {
      const index = this.rows.indexOf(row);
      if (index !== -1) {
        this.activeRowIndex = index;
        this.updateTabindices();
      }
    }
  }

  focusNextRow() {
    const rows = this.rows;
    if (this.activeRowIndex < rows.length - 1) {
      this.focusRow(this.activeRowIndex + 1);
    }
  }

  focusPreviousRow() {
    if (this.activeRowIndex > 0) {
      this.focusRow(this.activeRowIndex - 1);
    }
  }

  focusFirstRow() {
    this.focusRow(0);
  }

  focusLastRow() {
    this.focusRow(this.rows.length - 1);
  }

  focusRowByOffset(offset) {
    const newIndex = Math.max(
      0,
      Math.min(this.rows.length - 1, this.activeRowIndex + offset)
    );
    this.focusRow(newIndex);
  }

  focusRow(index) {
    const rows = this.rows;
    if (index >= 0 && index < rows.length) {
      this.activeRowIndex = index;
      this.updateTabindices();
      rows[index].focus();
    }
  }

  focusNextCell() {
    const row = this.rows[this.activeRowIndex];
    const cells = this.getCells(row);
    if (this.activeCellIndex < cells.length - 1) {
      this.activeCellIndex++;
      cells[this.activeCellIndex].focus();
    }
  }

  focusPreviousCell() {
    const row = this.rows[this.activeRowIndex];
    const cells = this.getCells(row);
    if (this.activeCellIndex > 0) {
      this.activeCellIndex--;
      cells[this.activeCellIndex].focus();
    }
  }

  focusFirstCell() {
    this.activeCellIndex = 0;
    const row = this.rows[this.activeRowIndex];
    const cells = this.getCells(row);
    if (cells.length) {
      cells[0].focus();
    }
  }

  focusLastCell() {
    const row = this.rows[this.activeRowIndex];
    const cells = this.getCells(row);
    this.activeCellIndex = cells.length - 1;
    if (cells.length) {
      cells[this.activeCellIndex].focus();
    }
  }

  activateCurrentRow() {
    const row = this.rows[this.activeRowIndex];
    if (row && this.options.onRowActivate) {
      const topicId = row.dataset.topicId;
      this.options.onRowActivate(topicId);
    }
  }

  updateTabindices() {
    this.rows.forEach((row, index) => {
      row.setAttribute(
        "tabindex",
        index === this.activeRowIndex ? "0" : "-1"
      );
    });
  }

  cleanup() {
    this.element?.removeEventListener("keydown", this.handleKeydown);
    this.element?.removeEventListener("focusin", this.handleFocusIn);
  }
}
```

## ARIA Attributes

| Element | Attribute | Value |
|---------|-----------|-------|
| `<table>` | `role` | `"grid"` |
| `<table>` | `aria-rowcount` | **Total logical rows** (for virtualization) |
| `<thead>` | `role` | `"rowgroup"` |
| `<tbody>` | `role` | `"rowgroup"` |
| Header `<tr>` | `role` | `"row"` |
| Header `<tr>` | `aria-rowindex` | `"1"` |
| Data `<tr>` | `role` | `"row"` |
| Data `<tr>` | `aria-rowindex` | Logical position (2, 3, 4...) |
| Data `<tr>` | `tabindex` | `"0"` (active) or `"-1"` |
| `<th>` | `role` | `"columnheader"` |
| `<td>` | `role` | `"gridcell"` |

**Note:** `aria-level` is NOT used for flat grids. Only add when upgrading to treegrid for hierarchical data.

### Virtualization Support

For infinite scroll / lazy loading, the key insight is:

- `aria-rowcount` = **total logical rows** (e.g., 500 topics total)
- `aria-rowindex` = **logical position** (not DOM position)
- Only a subset of rows exist in DOM at any time
- Screen reader announces "Row 15 of 500" even if row 15 is first visible

```html
<!-- 500 total topics, but only rows 10-25 in DOM -->
<table role="grid" aria-rowcount="500">
  <tbody>
    <!-- First visible row, but logically row 10 -->
    <tr role="row" aria-rowindex="10">...</tr>
    <tr role="row" aria-rowindex="11">...</tr>
    <!-- ... -->
    <tr role="row" aria-rowindex="25">...</tr>
  </tbody>
</table>
```

## Keyboard Support

| Key | Behavior |
|-----|----------|
| Tab | Move focus into/out of grid |
| Arrow Down | Move to next row (**load more if at boundary**) |
| Arrow Up | Move to previous row |
| Arrow Right | Move to next cell (optional, Phase 2) |
| Arrow Left | Move to previous cell (optional, Phase 2) |
| Enter | **Navigate directly to topic** (matches click behavior) |
| Home | First row |
| End | Last row |
| Ctrl+Home | First row |
| Ctrl+End | Last row |
| Page Down | Jump down 10 rows (**load more if needed**) |
| Page Up | Jump up 10 rows |

### Infinite Scroll on Keyboard Navigation

When user presses Arrow Down at the last loaded topic:

```javascript
focusLogicalNext() {
  const nextIndex = this.activeLogicalIndex + 1;

  // At boundary of loaded data?
  if (nextIndex >= this.loadedTopics.length) {
    // Load more topics, then focus
    this.loadMoreTopics().then(() => {
      this.focusLogicalIndex(nextIndex);
    });
  } else {
    this.focusLogicalIndex(nextIndex);
  }
}
```

The user should never hit a "dead end" - arrow keys keep loading content.

## Focus Strategy Options

| Strategy | Description | Phase |
|----------|-------------|-------|
| **Row Focus Only** | Arrows move between rows, Enter activates | PHASE 1 (recommended) |
| **Row + Cell Focus** | Full grid navigation with cell focus | PHASE 2 |
| **Active Descendants** | `aria-activedescendant` pattern | Consider later |

**Recommendation:** Start with row-only focus for Phase 1. Cell navigation can be added in Phase 2 if user feedback indicates need.

## Cell Focus (Phase 2)

For cell-level navigation, cells need to be focusable:

```handlebars
<td
  role="gridcell"
  tabindex="-1"
  class="topic-list-data main-link"
>
  <TopicLink @topic={{@topic}} />
</td>
```

## Screen Reader Announcements

Add live region for row navigation feedback:

```handlebars
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  class="sr-only"
>
  {{this.currentRowAnnouncement}}
</div>
```

**Announcement Format:**
"Topic: [title], [replies] replies, [views] views, last activity [time]"

## Future TreeGrid Support

When hierarchical topics are implemented (threaded replies), the grid upgrades to treegrid:

```html
<table role="treegrid">
  <tr role="row"
      aria-level="1"
      aria-expanded="true"
      aria-setsize="5"
      aria-posinset="1">
    <!-- Parent topic -->
  </tr>
  <tr role="row"
      aria-level="2"
      aria-setsize="3"
      aria-posinset="1">
    <!-- Child topic (reply) -->
  </tr>
</table>
```

**TreeGrid Keyboard Additions:**
- Arrow Right on collapsed row: Expand
- Arrow Left on expanded row: Collapse
- Arrow Left on collapsed row: Move to parent

## HTML Structure After Implementation

```html
<table role="grid"
       class="topic-list"
       aria-labelledby="topic-list-heading"
       aria-rowcount="51">
  <caption class="sr-only">Topics in category...</caption>
  <thead role="rowgroup">
    <tr role="row" aria-rowindex="1">
      <th role="columnheader" scope="col" aria-sort="descending">Topic</th>
      <th role="columnheader" scope="col">Replies</th>
      <th role="columnheader" scope="col">Views</th>
      <th role="columnheader" scope="col">Activity</th>
    </tr>
  </thead>
  <tbody role="rowgroup">
    <tr role="row"
        aria-rowindex="2"
        tabindex="0"
        data-topic-id="123"
        class="topic-list-item">
      <td role="gridcell">Welcome to Discourse</td>
      <td role="gridcell">42</td>
      <td role="gridcell">1.2k</td>
      <td role="gridcell">2h</td>
    </tr>
    <tr role="row"
        aria-rowindex="3"
        tabindex="-1"
        data-topic-id="124"
        class="topic-list-item">
      <td role="gridcell">Getting Started Guide</td>
      <td role="gridcell">15</td>
      <td role="gridcell">890</td>
      <td role="gridcell">1d</td>
    </tr>
  </tbody>
</table>
```

## Future Enhancements

### FUTURE TODO: Article Document Role

When a topic is opened from the grid, consider enhancing the reading experience:

1. **Add `role="document"` to article content** - Helps screen readers switch to document reading mode
2. **ESC key navigation** - Allow user to press ESC to exit the article and return focus to the topic list
3. **Quick navigation back to grid** - User can then arrow up/down through topic rows without re-reading the full article

**Implementation sketch:**
```html
<article role="document" aria-label="Topic: {{topic.title}}">
  <!-- Topic content -->
</article>
```

**Keyboard behavior:**
- ESC from article → Focus returns to the topic row that was activated
- User can then Arrow Up/Down to navigate other topics

This creates a seamless flow: Grid → Enter → Read Article → ESC → Back to Grid

### Upgrade to TreeGrid (When Hierarchical Topics Added)

When Discourse adds hierarchical topic display (threaded replies in list view):

- Change `role="grid"` to `role="treegrid"`
- Add `aria-expanded` on parent rows
- Add `aria-level` to indicate nesting depth
- Arrow Left/Right for expand/collapse

## Research Notes

### Fluent UI DataGrid Implementation

Per [Fluent UI DataGrid](https://react.fluentui.dev/?path=/docs/components-datagrid--docs):

- Uses `role="grid"` with Table primitives
- Keyboard navigation via `useArrowNavigationGroup({ axis: 'grid' })`
- `focusMode` property controls cell focus behavior (`"cell"` or `"group"`)
- Virtualization supported via [@fluentui-contrib/react-data-grid-react-window](https://github.com/microsoft/fluentui-contrib/blob/main/packages/react-data-grid-react-window/stories/DataGrid/VirtualizedDataGrid.stories.tsx)

**Fluent UI keyboard navigation pattern:**
```javascript
import { useArrowNavigationGroup } from '@fluentui/react-components';
const gridNavigationProps = useArrowNavigationGroup({ axis: 'grid' });
<DataGrid {...gridNavigationProps}>
```

### AG Grid Implementation

Per [AG Grid](https://www.ag-grid.com/react-data-grid/accessibility/):

- Uses `role="grid"` for flat tabular data
- Uses `role="treegrid"` ONLY for hierarchical data with expand/collapse
- "role='treegrid' when using Tree Data or Row Grouping, otherwise role='grid'"

## Testing

See [TESTING.md](TESTING.md) for comprehensive testing strategy including:

- Unit tests for grid modifier
- Integration tests for topic-list component
- System specs for full browser testing
- Screen reader manual testing checklist
