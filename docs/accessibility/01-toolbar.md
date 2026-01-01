# Navigation Toolbar Accessibility

This document covers the implementation of keyboard navigation for the Discourse navigation toolbar, which includes category/tag dropdowns and navigation tabs (Latest, Hot, Categories, etc.).

## Overview

The navigation toolbar uses the **WAI-ARIA Toolbar Pattern** to provide:
- Single tab stop for the entire toolbar region
- Arrow key navigation between toolbar items
- Roving tabindex for focus management

## Component Structure

```
topic-filter-toolbar (role="toolbar")
├── BreadCrumbs (.category-breadcrumb)
│   ├── CategoryDrop (summary element)
│   └── TagDrop (summary element)
└── NavigationBar (#navigation-bar)
    └── NavigationItem (a elements with role="tab")
```

## Files

### Primary Implementation
- **`frontend/discourse/app/modifiers/toolbar-navigation.js`** - The modifier that handles keyboard navigation

### Components Using Toolbar
- **`frontend/discourse/app/components/d-navigation.gjs`** - Applies the modifier to the toolbar wrapper

## Keyboard Behavior

| Key | Action |
|-----|--------|
| Tab | Enter/exit toolbar (single tab stop) |
| Arrow Right | Move to next toolbar item |
| Arrow Left | Move to previous toolbar item |
| Home | Move to first toolbar item |
| End | Move to last toolbar item |
| Enter/Space | Activate current item (handled by item itself) |

## Implementation Details

### Modifier Configuration

The toolbar modifier is applied in `d-navigation.gjs`:

```javascript
{{toolbarNavigation
  itemSelector=".category-breadcrumb summary, .category-breadcrumb button, #navigation-bar a"
}}
```

This selector includes:
1. Category/tag dropdown triggers (`summary` elements)
2. Any buttons in breadcrumbs
3. Navigation tab links

### Roving Tabindex Pattern

The modifier maintains focus state using roving tabindex:

```javascript
updateTabindices() {
  const items = this.items;
  if (items.length === 0) return;

  // Ensure activeIndex is valid
  if (this.activeIndex < 0 || this.activeIndex >= items.length) {
    this.activeIndex = 0;
  }

  items.forEach((item, index) => {
    item.setAttribute("tabindex", index === this.activeIndex ? "0" : "-1");
  });
}
```

- Active item: `tabindex="0"` (receives focus on Tab)
- Other items: `tabindex="-1"` (focusable via `.focus()` but not Tab)

### Focus Preservation

When the component re-renders, the modifier preserves focus on the correct item:

```javascript
modify(element, positional, named) {
  // Only set up listeners once
  if (this.element !== element) {
    this.cleanup();
    this.element = element;
    this.element.addEventListener("keydown", this.handleKeydown);
    this.element.addEventListener("focusin", this.handleFocusIn);
  }

  // Preserve focus on currently focused item
  const focusedElement = document.activeElement;
  const items = this.items;
  const focusedIndex = items.indexOf(focusedElement);
  if (focusedIndex !== -1) {
    this.activeIndex = focusedIndex;
  }

  this.updateTabindices();
}
```

### Focus Tracking

The `handleFocusIn` event updates `activeIndex` when focus enters any toolbar item:

```javascript
handleFocusIn(event) {
  const index = this.items.indexOf(event.target);
  if (index !== -1) {
    this.activeIndex = index;
    this.updateTabindices();
  }
}
```

## ARIA Attributes

The toolbar wrapper has:
- `role="toolbar"` - Identifies the toolbar pattern
- `aria-label` - Descriptive label for screen readers
- `aria-orientation="horizontal"` - Indicates navigation direction

## Issues Fixed

### Duplicate Event Listeners
**Problem:** `modify()` was adding event listeners on every call, causing duplicate handlers.

**Solution:** Check if element changed before adding listeners:
```javascript
if (this.element !== element) {
  this.cleanup();
  this.element = element;
  // Add listeners
}
```

### Focus Reset on Re-render
**Problem:** When tabbing back to toolbar after navigating away, focus would go to wrong item.

**Solution:** Preserve focus by checking `document.activeElement` and updating `activeIndex` accordingly.

### Invalid activeIndex
**Problem:** If items change (e.g., category dropdown shows/hides), `activeIndex` could be out of bounds.

**Solution:** Validate bounds in `updateTabindices()`:
```javascript
if (this.activeIndex < 0 || this.activeIndex >= items.length) {
  this.activeIndex = 0;
}
```

## Testing

### Manual Testing
1. Tab to toolbar - should focus first item (or last focused item)
2. Arrow Right/Left - should move between items
3. Home/End - should jump to first/last item
4. Tab away and Shift+Tab back - should return to same item
5. Category dropdown interaction should not break toolbar navigation

### Screen Reader Testing
- Toolbar should be announced as "toolbar"
- Current item should be announced when focused
- Navigation tabs should announce as tabs with selected state

## Related Documentation

- [WAI-ARIA Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)
- [docs/grid/NAVIGATION-TOOLBAR.md](../grid/NAVIGATION-TOOLBAR.md) - Original planning document
