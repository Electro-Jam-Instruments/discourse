# Issue #16: Admin Sidebar - Tree Pattern

**GitHub:** https://github.com/Electro-Jam-Instruments/discourse/issues/16
**Status:** Ready to implement

## Problem

Admin sidebar renders via `ApiPanels` which lacks tree navigation. Main sidebar uses `Sections` which has it.

## Root Cause

`frontend/discourse/app/components/sidebar.gjs` (line 81-92):
```javascript
{{#if this.sidebarState.showMainPanel}}
  <Sections ... />  // Has tree navigation
{{else}}
  <ApiPanels ... />  // Missing tree navigation
{{/if}}
```

## Component to Modify

### `frontend/discourse/app/components/sidebar/api-panels.gjs`

**Current (line 12-20):**
```html
<div class="sidebar-sections {{this.panelCssClass}}">
  <ApiSections
    @collapsable={{@collapsableSections}}
    @expandActiveSection={{this.sidebarState.currentPanel.expandActiveSection}}
    @scrollActiveLinkIntoView={{this.sidebarState.currentPanel.scrollActiveLinkIntoView}}
  />
</div>
```

**Fix:**
```html
<nav
  role="tree"
  aria-label={{i18n "sidebar.aria_label"}}
  class="sidebar-sections {{this.panelCssClass}}"
  {{sidebarTreeNavigation}}
>
  <ApiSections
    @collapsable={{@collapsableSections}}
    @expandActiveSection={{this.sidebarState.currentPanel.expandActiveSection}}
    @scrollActiveLinkIntoView={{this.sidebarState.currentPanel.scrollActiveLinkIntoView}}
  />
</nav>
```

**Imports to add:**
```javascript
import sidebarTreeNavigation from "discourse/modifiers/sidebar-tree-navigation";
import { i18n } from "discourse-i18n";
```

## Reference

- Main sidebar: `frontend/discourse/app/components/sidebar/user/sections.gjs`
- Modifier: `frontend/discourse/app/modifiers/sidebar-tree-navigation.js`
- Docs: `docs/accessibility/09-sidebar-navigation.md`

## Keyboard Support

- Arrow Up/Down - Navigate between visible items
- Arrow Right - Expand collapsed section
- Arrow Left - Collapse section or move to parent
- Enter/Space - Activate item or toggle section
- Home/End - First/last item
- Single tab stop (roving tabindex)
