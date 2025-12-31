# Navigation Bar Toolbar Implementation

This document details the implementation of ARIA toolbar pattern for the Discourse navigation bar.

## Overview

The navigation bar contains categories dropdown, tags dropdown, and navigation links (Latest, Hot, Categories). Converting this to a proper ARIA toolbar provides:

- Single tab stop (efficient keyboard navigation)
- Arrow key navigation between items
- Proper screen reader announcements

## Current Implementation

**Files:**
- `frontend/discourse/app/components/navigation-bar.gjs` - Main container
- `frontend/discourse/app/components/navigation-item.gjs` - Individual items
- `frontend/discourse/app/components/bread-crumbs.gjs` - Category/tag dropdowns
- `frontend/discourse/select-kit/components/select-kit.js` - Dropdown internals

**Current Structure:**
```html
<ul id="navigation-bar" class="nav nav-pills">
  <li><a href="/latest">Latest</a></li>
  <li><a href="/hot">Hot</a></li>
  <li>
    <details class="select-kit">...</details>
  </li>
</ul>
```

**Issues:**
- No `role="toolbar"`
- No arrow key navigation
- Each item is a separate tab stop

## Target Implementation

### Template Changes

**navigation-bar.gjs:**

```handlebars
<ul
  id="navigation-bar"
  class="nav nav-pills"
  role="toolbar"
  aria-label={{i18n "navigation.toolbar_label"}}
  aria-orientation="horizontal"
  {{toolbarNavigation itemSelector="a, summary, button"}}
>
  {{#each @navItems as |navItem index|}}
    <NavigationItem
      @content={{navItem}}
      @filterMode={{@filterMode}}
      @category={{@category}}
      tabindex={{if (eq index this.activeItemIndex) "0" "-1"}}
    />
  {{/each}}
</ul>
```

**navigation-item.gjs:**

```handlebars
<a
  href={{this.hrefLink}}
  class={{this.activeClass}}
  aria-current={{if this.activeClass "page"}}
  tabindex={{@tabindex}}
>
  {{@content.displayName}}
</a>
```

### Keyboard Handler

**New File: `frontend/discourse/app/modifiers/toolbar-navigation.js`**

```javascript
import { registerDestructor } from "@ember/destroyable";
import Modifier from "ember-modifier";
import { bind } from "discourse/lib/decorators";

/**
 * Toolbar navigation modifier implementing WAI-ARIA toolbar pattern
 * with roving tabindex for single-tab-stop keyboard navigation.
 *
 * @component ToolbarNavigationModifier
 * @param {string} itemSelector - CSS selector for toolbar items
 * @param {boolean} horizontal - Navigation direction (default: true)
 * @param {boolean} wrap - Wrap around at ends (default: true)
 */
export default class ToolbarNavigationModifier extends Modifier {
  element = null;
  activeIndex = 0;
  options = {
    itemSelector: "a, button, summary",
    horizontal: true,
    wrap: true,
  };

  constructor(owner, args) {
    super(owner, args);
    registerDestructor(this, (instance) => instance.cleanup());
  }

  modify(element, positional, named) {
    this.element = element;
    this.options = { ...this.options, ...named };

    this.element.addEventListener("keydown", this.handleKeydown);
    this.element.addEventListener("focusin", this.handleFocusIn);

    this.updateTabindices();
  }

  get items() {
    return Array.from(
      this.element.querySelectorAll(this.options.itemSelector)
    ).filter((item) => !item.disabled && item.offsetParent !== null);
  }

  @bind
  handleKeydown(event) {
    const { key } = event;
    const isHorizontal = this.options.horizontal;

    let handled = false;

    switch (key) {
      case isHorizontal ? "ArrowRight" : "ArrowDown":
        this.focusNextItem();
        handled = true;
        break;
      case isHorizontal ? "ArrowLeft" : "ArrowUp":
        this.focusPreviousItem();
        handled = true;
        break;
      case "Home":
        this.focusFirstItem();
        handled = true;
        break;
      case "End":
        this.focusLastItem();
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

  focusNextItem() {
    const items = this.items;
    let nextIndex = this.activeIndex + 1;

    if (nextIndex >= items.length) {
      nextIndex = this.options.wrap ? 0 : items.length - 1;
    }

    this.focusItem(nextIndex);
  }

  focusPreviousItem() {
    const items = this.items;
    let prevIndex = this.activeIndex - 1;

    if (prevIndex < 0) {
      prevIndex = this.options.wrap ? items.length - 1 : 0;
    }

    this.focusItem(prevIndex);
  }

  focusFirstItem() {
    this.focusItem(0);
  }

  focusLastItem() {
    this.focusItem(this.items.length - 1);
  }

  focusItem(index) {
    const items = this.items;
    if (index >= 0 && index < items.length) {
      this.activeIndex = index;
      this.updateTabindices();
      items[index].focus();
    }
  }

  updateTabindices() {
    this.items.forEach((item, index) => {
      item.setAttribute("tabindex", index === this.activeIndex ? "0" : "-1");
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
| `<ul id="navigation-bar">` | `role` | `"toolbar"` |
| `<ul id="navigation-bar">` | `aria-label` | `"Topic navigation"` |
| `<ul id="navigation-bar">` | `aria-orientation` | `"horizontal"` |
| `<a>` (nav links) | `tabindex` | `"0"` (active) or `"-1"` |
| `<a>` (current page) | `aria-current` | `"page"` |
| Dropdown `<summary>` | `tabindex` | `"0"` (active) or `"-1"` |
| Dropdown `<summary>` | `aria-haspopup` | `"listbox"` |
| Dropdown `<summary>` | `aria-expanded` | `"true"` / `"false"` |

## Keyboard Support

| Key | Behavior |
|-----|----------|
| Tab | Moves focus into/out of toolbar |
| Arrow Right | Move to next item |
| Arrow Left | Move to previous item |
| Home | Move to first item |
| End | Move to last item |
| Enter/Space | Activate current item (navigate or open dropdown) |
| Escape | Close dropdown if open |

## Select-Kit Integration

The select-kit dropdowns have internal keyboard handling. The toolbar modifier coordinates with them:

1. **Dropdown Closed:** Arrow keys navigate between toolbar items
2. **Dropdown Open:** Arrow keys handled by select-kit (navigate options)
3. **Escape:** Closes dropdown, focus returns to dropdown header

**Key Integration Points:**

- Toolbar treats dropdown `<summary>` as the focusable item
- Enter/Space opens dropdown (existing behavior)
- When dropdown closes, focus returns to summary element
- Arrow keys within open dropdown don't propagate to toolbar

## Mobile Behavior

The toolbar keyboard navigation only applies on desktop:

```javascript
get showToolbarNavigation() {
  return !this.site.mobileView;
}
```

Mobile continues using existing touch/tap behavior with the dropdown navigation mode.

## Localization

Add to `config/locales/client.en.yml`:

```yaml
en:
  js:
    navigation:
      toolbar_label: "Topic navigation"
```

## HTML Structure After Implementation

```html
<ul id="navigation-bar"
    class="nav nav-pills"
    role="toolbar"
    aria-label="Topic navigation"
    aria-orientation="horizontal">
  <li>
    <a href="/latest"
       tabindex="0"
       aria-current="page">Latest</a>
  </li>
  <li>
    <a href="/hot"
       tabindex="-1">Hot</a>
  </li>
  <li>
    <a href="/categories"
       tabindex="-1">Categories</a>
  </li>
  <li>
    <details class="select-kit category-drop">
      <summary tabindex="-1"
               aria-haspopup="listbox"
               aria-expanded="false">all categories</summary>
      <!-- dropdown content -->
    </details>
  </li>
  <li>
    <details class="select-kit tag-drop">
      <summary tabindex="-1"
               aria-haspopup="listbox"
               aria-expanded="false">all tags</summary>
      <!-- dropdown content -->
    </details>
  </li>
</ul>
```

## Testing

See [TESTING.md](TESTING.md) for comprehensive testing strategy including:

- Unit tests for toolbar modifier
- Integration tests for navigation-bar component
- System specs for full browser testing
- Screen reader manual testing checklist
