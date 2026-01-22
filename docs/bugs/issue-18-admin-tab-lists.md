# Issue #18: Admin Tab Lists - Tablist Pattern

**GitHub:** https://github.com/Electro-Jam-Instruments/discourse/issues/18
**Status:** Ready to implement

## Problem

Admin pages use tab-style navigation without WAI-ARIA tablist pattern. Each tab is a separate tab stop and arrow keys don't work.

## Components to Modify

### 1. AdminNav (`frontend/discourse/admin/components/admin-nav.gjs`)

**Current:**
```html
<div class="admin-controls">
  <nav>
    <ul class="nav nav-pills">
      {{yield}}
    </ul>
  </nav>
</div>
```

**Fix:**
```html
<div class="admin-controls">
  <nav>
    <ul class="nav nav-pills" role="tablist" {{tablist-navigation}}>
      {{yield}}
    </ul>
  </nav>
</div>
```

### 2. HorizontalOverflowNav (`frontend/discourse/app/components/horizontal-overflow-nav.gjs`)

**Current (line 160-169):**
```html
<ul
  {{onResize this.onResize}}
  {{on "scroll" this.onScroll}}
  ...
  class="nav-pills action-list {{@className}}"
>
```

**Fix:**
```html
<ul
  {{onResize this.onResize}}
  {{on "scroll" this.onScroll}}
  {{tablist-navigation}}
  role="tablist"
  class="nav-pills action-list {{@className}}"
>
```

## Files Using These Components

- `admin/templates/admin-plugins.gjs` - HorizontalOverflowNav
- `admin/templates/admin-site-settings.gjs` - admin-nav class
- `admin/templates/admin-watched-words.gjs` - admin-nav class

## Nav Item Requirements

Items yielded into these components need:
- `role="tab"`
- `aria-selected="true/false"`
- `tabindex="0"` (active) / `tabindex="-1"` (inactive)

## Keyboard Support

- Arrow Left/Right - Navigate between tabs
- Home/End - First/last tab
- Enter/Space - Activate tab
- Single tab stop (roving tabindex)

## Reference

- Main navigation tabs: commit `8270b7eb86`
- Existing modifier: `frontend/discourse/app/modifiers/tablist-navigation.js`
