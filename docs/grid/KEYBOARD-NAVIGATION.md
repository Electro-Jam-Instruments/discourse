# Keyboard Navigation Utilities

This document covers shared keyboard navigation utilities and base classes used by both toolbar and grid patterns.

## Overview

Both the navigation bar toolbar and topic list grid share common keyboard navigation patterns:

- Roving tabindex management
- Arrow key handling
- Focus tracking
- Event cleanup

These shared utilities reduce code duplication and ensure consistent behavior.

## Shared Utility Functions

**File: `frontend/discourse/app/lib/keyboard-navigation-utils.js`**

```javascript
/**
 * Shared utilities for keyboard navigation patterns
 */

/**
 * Get next index in a collection with optional wrapping
 *
 * @param {Element[]} elements - Collection of elements
 * @param {number} currentIndex - Current focused index
 * @param {boolean} wrap - Whether to wrap around
 * @returns {number} Next valid index
 */
export function getNextIndex(elements, currentIndex, wrap = true) {
  const nextIndex = currentIndex + 1;
  if (nextIndex >= elements.length) {
    return wrap ? 0 : elements.length - 1;
  }
  return nextIndex;
}

/**
 * Get previous index in a collection with optional wrapping
 *
 * @param {Element[]} elements - Collection of elements
 * @param {number} currentIndex - Current focused index
 * @param {boolean} wrap - Whether to wrap around
 * @returns {number} Previous valid index
 */
export function getPreviousIndex(elements, currentIndex, wrap = true) {
  const prevIndex = currentIndex - 1;
  if (prevIndex < 0) {
    return wrap ? elements.length - 1 : 0;
  }
  return prevIndex;
}

/**
 * Check if element should be included in navigation
 *
 * @param {Element} element - Element to check
 * @returns {boolean} True if element is navigable
 */
export function isNavigable(element) {
  return (
    element &&
    !element.disabled &&
    element.offsetParent !== null &&
    !element.classList.contains("hidden") &&
    !element.hasAttribute("aria-hidden")
  );
}

/**
 * Update tabindex values for roving tabindex pattern
 *
 * @param {Element[]} elements - Collection of focusable elements
 * @param {number} activeIndex - Index of currently active element
 */
export function updateRovingTabindex(elements, activeIndex) {
  elements.forEach((el, index) => {
    el.setAttribute("tabindex", index === activeIndex ? "0" : "-1");
  });
}

/**
 * Find index of currently focused element in collection
 *
 * @param {Element[]} elements - Collection to search
 * @returns {number} Index of focused element, or -1 if not found
 */
export function getFocusedIndex(elements) {
  const focused = document.activeElement;
  return elements.indexOf(focused);
}

/**
 * Calculate new index after jumping by offset (for PageUp/PageDown)
 *
 * @param {number} currentIndex - Current index
 * @param {number} offset - Amount to jump (positive or negative)
 * @param {number} maxIndex - Maximum valid index
 * @returns {number} New index clamped to valid range
 */
export function getOffsetIndex(currentIndex, offset, maxIndex) {
  return Math.max(0, Math.min(maxIndex, currentIndex + offset));
}
```

## Base Modifier Class

**File: `frontend/discourse/app/modifiers/keyboard-navigation-base.js`**

```javascript
import { registerDestructor } from "@ember/destroyable";
import Modifier from "ember-modifier";
import { bind } from "discourse/lib/decorators";
import { updateRovingTabindex } from "discourse/lib/keyboard-navigation-utils";

/**
 * Base class for keyboard navigation modifiers.
 * Provides common setup, cleanup, and event handling patterns.
 *
 * Subclasses should override:
 * - get items() - Return array of navigable elements
 * - handleKeydown(event) - Handle keyboard events
 * - handleFocusIn(event) - Handle focus changes
 * - initialize() - Additional setup after modify()
 *
 * @class KeyboardNavigationBaseModifier
 */
export default class KeyboardNavigationBaseModifier extends Modifier {
  /**
   * The root element the modifier is attached to
   * @type {HTMLElement|null}
   */
  element = null;

  /**
   * Index of currently active/focused item
   * @type {number}
   */
  activeIndex = 0;

  /**
   * Configuration options passed to modifier
   * @type {Object}
   */
  options = {};

  constructor(owner, args) {
    super(owner, args);
    registerDestructor(this, (instance) => instance.cleanup());
  }

  modify(element, positional, named) {
    this.element = element;
    this.options = named;
    this.setupEventListeners();
    this.initialize();
  }

  /**
   * Set up event listeners on the element
   */
  setupEventListeners() {
    this.element.addEventListener("keydown", this.handleKeydown);
    this.element.addEventListener("focusin", this.handleFocusIn);
  }

  /**
   * Override in subclasses for additional initialization
   */
  initialize() {
    this.updateTabindices();
  }

  /**
   * Get array of navigable items - override in subclasses
   * @returns {Element[]}
   */
  get items() {
    return [];
  }

  /**
   * Handle keyboard events - override in subclasses
   * @param {KeyboardEvent} event
   */
  @bind
  handleKeydown(event) {}

  /**
   * Handle focus entering an item - override in subclasses
   * @param {FocusEvent} event
   */
  @bind
  handleFocusIn(event) {}

  /**
   * Focus item at given index
   * @param {number} index
   */
  focusItem(index) {
    const items = this.items;
    if (index >= 0 && index < items.length) {
      this.activeIndex = index;
      this.updateTabindices();
      items[index].focus();
    }
  }

  /**
   * Update tabindex attributes for roving tabindex pattern
   */
  updateTabindices() {
    updateRovingTabindex(this.items, this.activeIndex);
  }

  /**
   * Clean up event listeners
   */
  cleanup() {
    this.element?.removeEventListener("keydown", this.handleKeydown);
    this.element?.removeEventListener("focusin", this.handleFocusIn);
  }
}
```

## Using the Base Class

### Toolbar Navigation Example

```javascript
import KeyboardNavigationBaseModifier from "discourse/modifiers/keyboard-navigation-base";
import { bind } from "discourse/lib/decorators";
import { getNextIndex, getPreviousIndex } from "discourse/lib/keyboard-navigation-utils";

export default class ToolbarNavigationModifier extends KeyboardNavigationBaseModifier {
  get items() {
    return Array.from(
      this.element.querySelectorAll(this.options.itemSelector || "a, button")
    ).filter((item) => !item.disabled && item.offsetParent !== null);
  }

  @bind
  handleKeydown(event) {
    const { key } = event;
    let handled = false;

    switch (key) {
      case "ArrowRight":
        this.focusItem(getNextIndex(this.items, this.activeIndex, true));
        handled = true;
        break;
      case "ArrowLeft":
        this.focusItem(getPreviousIndex(this.items, this.activeIndex, true));
        handled = true;
        break;
      case "Home":
        this.focusItem(0);
        handled = true;
        break;
      case "End":
        this.focusItem(this.items.length - 1);
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
    const index = this.items.indexOf(event.target);
    if (index !== -1) {
      this.activeIndex = index;
      this.updateTabindices();
    }
  }
}
```

### Grid Navigation Example

```javascript
import KeyboardNavigationBaseModifier from "discourse/modifiers/keyboard-navigation-base";
import { bind } from "discourse/lib/decorators";
import { getOffsetIndex } from "discourse/lib/keyboard-navigation-utils";

export default class GridNavigationModifier extends KeyboardNavigationBaseModifier {
  get items() {
    return Array.from(this.element.querySelectorAll('tbody tr[role="row"]'));
  }

  @bind
  handleKeydown(event) {
    const { key, ctrlKey, metaKey } = event;
    let handled = false;

    switch (key) {
      case "ArrowDown":
        this.focusItem(Math.min(this.activeIndex + 1, this.items.length - 1));
        handled = true;
        break;
      case "ArrowUp":
        this.focusItem(Math.max(this.activeIndex - 1, 0));
        handled = true;
        break;
      case "PageDown":
        this.focusItem(getOffsetIndex(this.activeIndex, 10, this.items.length - 1));
        handled = true;
        break;
      case "PageUp":
        this.focusItem(getOffsetIndex(this.activeIndex, -10, this.items.length - 1));
        handled = true;
        break;
      case "Enter":
        this.activateRow();
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
    if (row) {
      const index = this.items.indexOf(row);
      if (index !== -1) {
        this.activeIndex = index;
        this.updateTabindices();
      }
    }
  }

  activateRow() {
    const row = this.items[this.activeIndex];
    if (row && this.options.onRowActivate) {
      this.options.onRowActivate(row.dataset.topicId);
    }
  }
}
```

## Existing Discourse Patterns

Discourse already has some keyboard navigation utilities that can be leveraged:

### roving-button-bar.js

Located at `frontend/discourse/app/lib/roving-button-bar.js`, this provides arrow key navigation between button siblings.

### tab-to-sibling.js

A modifier that redirects tab navigation to sibling elements.

### d-editor.gjs Toolbar

The editor has an existing toolbar with `role="toolbar"` that can be referenced as a pattern.

### select-kit.js

Dropdown keyboard handling with `highlightNext()` and `highlightPrevious()` methods.

## Integration Considerations

### Event Propagation

When handling keyboard events in nested structures (e.g., toolbar containing dropdowns), carefully manage event propagation:

```javascript
@bind
handleKeydown(event) {
  // Only handle if we're the target container
  if (event.target.closest(".select-kit.is-expanded")) {
    // Let dropdown handle its own keys
    return;
  }

  // Handle toolbar navigation
  // ...

  if (handled) {
    event.preventDefault();
    event.stopPropagation();
  }
}
```

### Focus Management

When items are dynamically added/removed:

```javascript
// After items change, ensure tabindex is valid
@action
onItemsChanged() {
  const items = this.items;
  if (this.activeIndex >= items.length) {
    this.activeIndex = Math.max(0, items.length - 1);
  }
  this.updateTabindices();
}
```

### RTL Support

For right-to-left languages, swap arrow key directions:

```javascript
get isRTL() {
  return document.documentElement.dir === "rtl";
}

@bind
handleKeydown(event) {
  const { key } = event;
  const isRTL = this.isRTL;

  switch (key) {
    case "ArrowRight":
      isRTL ? this.focusPrevious() : this.focusNext();
      break;
    case "ArrowLeft":
      isRTL ? this.focusNext() : this.focusPrevious();
      break;
  }
}
```

## API Reference

### Functions

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `getNextIndex` | `elements, currentIndex, wrap` | `number` | Next index with optional wrapping |
| `getPreviousIndex` | `elements, currentIndex, wrap` | `number` | Previous index with optional wrapping |
| `isNavigable` | `element` | `boolean` | Check if element is focusable |
| `updateRovingTabindex` | `elements, activeIndex` | `void` | Set tabindex values |
| `getFocusedIndex` | `elements` | `number` | Index of focused element |
| `getOffsetIndex` | `currentIndex, offset, maxIndex` | `number` | Clamped offset index |

### Base Modifier Properties

| Property | Type | Description |
|----------|------|-------------|
| `element` | `HTMLElement` | Root element modifier is attached to |
| `activeIndex` | `number` | Currently active item index |
| `options` | `Object` | Configuration passed to modifier |

### Base Modifier Methods

| Method | Description |
|--------|-------------|
| `get items()` | Override to return navigable elements |
| `handleKeydown(event)` | Override to handle keyboard events |
| `handleFocusIn(event)` | Override to handle focus changes |
| `initialize()` | Override for additional setup |
| `focusItem(index)` | Focus element at index |
| `updateTabindices()` | Update roving tabindex |
| `cleanup()` | Remove event listeners |
