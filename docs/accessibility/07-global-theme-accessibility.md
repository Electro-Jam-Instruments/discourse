# Global Theme Accessibility Options

**Status:** ACTIVE - Contains CSS variable customizations for site-wide accessibility

This document tracks accessibility-related CSS customizations that apply site-wide through Discourse's theming system. These are implemented as CSS Custom Properties that themes can override.

## How Discourse Global Theming Works

Discourse uses CSS Custom Properties (CSS variables) for all theming:

1. **Core variables** defined in `app/assets/stylesheets/color_definitions.scss`
2. **Variables use `:root`** selector for global scope
3. **Themes override** variables in their SCSS files
4. **Naming convention:** `--d-*` prefix for Discourse design tokens

Example override in a theme:
```scss
:root {
  --d-nav-color--active: #0066cc;
}
```

---

## Implemented Options

### 1. Focus Indicator CSS Variables

**Status:** IMPLEMENTED

**Goal:** Allow themes to configure focus indicator appearance for grid navigation.

**CSS Variables (defined in `color_definitions.scss`):**
```scss
:root {
  // Rectangle outline settings (row-level focus)
  --d-grid-focus-outline-width: 2px;
  --d-grid-focus-outline-color: var(--tertiary);
  --d-grid-focus-outline-offset: -2px;

  // Left bar settings (element-level focus within row)
  // Set to 0 by default - change to 3px to enable left bar highlight
  --d-grid-focus-bar-width: 0;
  --d-grid-focus-bar-color: var(--d-nav-color--active);
}
```

**Current Behavior (Release Default):**
- All focus states use rectangle outline only
- Left-bar highlight is disabled by default (width set to 0)
- Themes can enable left-bar by setting `--d-grid-focus-bar-width: 3px`

**Files Updated:**
- `app/assets/stylesheets/color_definitions.scss` - Variable definitions
- `app/assets/stylesheets/common/base/_topic-list.scss` - Topic list focus styles
- `app/assets/stylesheets/common/base/category-list.scss` - Category list focus styles
- `app/assets/stylesheets/desktop/latest-topic-list.scss` - Latest sidebar focus styles
- `app/assets/stylesheets/common/components/keyboard_shortcuts.scss` - Left-bar highlight

**Theme Customization Example:**
```scss
// Make focus indicators more prominent
:root {
  --d-grid-focus-outline-width: 3px;
  --d-grid-focus-outline-color: #ff6600;
  --d-grid-focus-bar-width: 5px;
  --d-grid-focus-bar-color: #ff6600;
}
```

**Related per-user setting:** See `08-per-user-theme-preferences.md` for future per-user override.

---

## Planned Options

### 2. Focus Indicator Style Toggle

**Status:** FUTURE WORK

**Goal:** Allow themes to control which focus indicator styles are shown (rectangle, left-bar, or both).

**Proposed approach:** CSS class on body element controlled by theme setting, with CSS rules that show/hide each indicator type based on the class.

**Note:** This requires additional work beyond CSS variables alone.

---

## Adding New Global Options

When adding a new global accessibility option:

1. **Define CSS variable** with `--d-` prefix
2. **Set sensible default** that works for most users
3. **Update relevant SCSS files** to use the variable
4. **Document here** with:
   - Status (implemented/planned)
   - Variable names and allowed values
   - Files affected
   - Related per-user setting (if applicable)
5. **Test** with multiple themes to ensure it works

## References

- `app/assets/stylesheets/color_definitions.scss` - CSS variable definitions
- `app/assets/stylesheets/common/foundation/variables.scss` - SCSS foundation variables
- [Discourse Theme Developer Guide](https://meta.discourse.org/t/developer-s-guide-to-discourse-themes/93648)
