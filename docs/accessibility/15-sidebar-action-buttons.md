# Sidebar Tree Item Action Buttons Accessibility

This document provides a detailed development design for enabling keyboard access to action buttons within sidebar tree items (GitHub Issue #39).

## Executive Summary

The sidebar uses the WAI-ARIA tree pattern with roving tabindex for keyboard navigation. Currently, action buttons (edit pencil, overflow menu "...") within tree items cannot be reached via arrow keys. This design proposes extending the keyboard navigation to allow Left/Right arrow keys to move focus between tree items and their embedded action controls.

**Recommendation:** Implement a horizontal navigation model within tree items, where Arrow Right moves focus from the treeitem to its action buttons, and Arrow Left returns focus. This aligns with the established pattern in section headers while avoiding the complexity of the nested toolbar approach.

**Success Probability: 75%** (see Risk Assessment section)

## Current Behavior Analysis

### Architecture Overview

The sidebar tree navigation is implemented across these components:

| Component | Purpose |
|-----------|---------|
| `sidebar/user/sections.gjs` | Tree container with `role="tree"` and `sidebarTreeNavigation` modifier |
| `sidebar/section.gjs` | Section wrapper with collapsible header and content group |
| `sidebar/section-header.gjs` | Section header button with `role="treeitem"` |
| `sidebar/section-link.gjs` | Navigation links with `role="treeitem"` |
| `sidebar/more-section-trigger.gjs` | "More" popup button with `role="treeitem"` |
| `sidebar-tree-navigation.js` | Modifier implementing tree keyboard navigation |
| `toolbar-navigation.js` | Modifier for horizontal toolbar navigation |

### Current Keyboard Support

```
Arrow Down/Up     - Move between visible tree items (working)
Arrow Right       - Expand collapsed section header (working)
Arrow Left        - Collapse section header OR move to parent (working)
Home/End          - First/last visible item (working)
Enter/Space       - Activate item (working)
Tab               - Enter/exit tree (working)
```

### Where Action Buttons Exist

1. **Section Headers** - Have a toolbar with collapse button + optional edit button
   - Template: `sidebar/section.gjs` lines 177-240
   - Uses `role="toolbar"` with `toolbarNavigation` modifier
   - **Already works** for keyboard navigation between buttons in header toolbar

2. **Section Links** - Can have hover action buttons (e.g., edit pencil)
   - Template: `sidebar/section-link.gjs` lines 294-306
   - Button is inside `LinkTo` component (nested inside treeitem)
   - **Does NOT work** - no keyboard navigation to these buttons

3. **More Section Trigger** - A button that opens a popup menu
   - Template: `sidebar/more-section-trigger.gjs`
   - Is itself a `role="treeitem"` with `aria-haspopup="menu"`
   - **Works** via Enter/Space to open popup

### Current Problem: Nested Interactive Elements

The section-link component has this structure:

```html
<li class="sidebar-section-link-wrapper">
  <a role="treeitem" tabindex="-1" href="/c/general/1">  <!-- or LinkTo -->
    <span class="sidebar-section-link-prefix">...</span>
    <span class="sidebar-section-link-content-text">General</span>

    <!-- PROBLEM: Button is INSIDE the treeitem link -->
    <span class="sidebar-section-link-hover">
      <button class="sidebar-section-hover-button">
        <svg>pencil icon</svg>
      </button>
    </span>
  </a>
</li>
```

This is the **nested interactive elements anti-pattern** that the W3C ARIA spec explicitly warns against:
- The button is a child of the link (`<a>`)
- Clicking the button also triggers the link
- The button is not reachable via keyboard
- Screen readers may not announce the button correctly due to `children: presentational`

## WAI-ARIA Tree Pattern Requirements

### Standard Tree Keyboard Navigation

Per [WAI-ARIA APG Tree Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/):

| Key | Action |
|-----|--------|
| Arrow Down | Next visible treeitem |
| Arrow Up | Previous visible treeitem |
| Arrow Right | Expand collapsed node OR move to first child |
| Arrow Left | Collapse expanded node OR move to parent |
| Enter/Space | Activate (navigate, toggle, etc.) |
| Home/End | First/last visible treeitem |

### Action Buttons in Tree Items: The Unsolved Problem

The W3C ARIA Working Group has an [open issue (#1440)](https://github.com/w3c/aria/issues/1440) titled "Secondary actions on items in composite widget roles" that directly addresses this pattern. Key findings:

1. **Nested buttons violate spec** - Child elements of `treeitem` are presentational
2. **Sibling buttons are ambiguous** - May violate "Required Owned Elements"
3. **No official pattern exists** - This is a known gap in WAI-ARIA

### Practical Approaches in the Wild

| Approach | Used By | Pros | Cons |
|----------|---------|------|------|
| **Show on hover/focus only** | VS Code, many file explorers | Clean UI | Can't navigate to buttons via keyboard |
| **Arrow Right to buttons** | Fluent UI Tree, Spectrum | Intuitive | Non-standard, needs documentation |
| **Separate actions column** | Data grids | Clear separation | Doesn't fit tree mental model |
| **Context menu only** | macOS Finder | Standard pattern | Requires Shift+F10 or right-click |

## Proposed Design

### Option 1: Extended Tree Item Navigation (RECOMMENDED)

**Concept:** When focus is on a tree item that has action buttons, Arrow Right moves focus horizontally to the first action button. Subsequent Arrow Right moves to next button. Arrow Left returns to the tree item.

**Keyboard Behavior:**

```
Focus on "General" treeitem:
  Arrow Right  -> Focus moves to edit button (if exists)
  Arrow Down   -> Focus moves to next treeitem (normal tree nav)

Focus on edit button:
  Arrow Right  -> Focus moves to next button (if any), else no-op
  Arrow Left   -> Focus returns to parent treeitem
  Arrow Down   -> Focus moves to next treeitem
  Arrow Up     -> Focus moves to previous treeitem
  Enter/Space  -> Activate button
```

**Implementation:**

1. Move action buttons OUTSIDE the link (sibling structure)
2. Modify `sidebar-tree-navigation.js` to track "current row focus position"
3. Arrow Right/Left navigate within a row's focusable elements
4. Arrow Up/Down always navigate between rows

**New HTML Structure:**

```html
<li class="sidebar-section-link-wrapper" role="none">
  <div class="sidebar-section-link-row" role="presentation">
    <a role="treeitem"
       tabindex="-1"
       href="/c/general/1"
       class="sidebar-section-link">
      <span class="sidebar-section-link-prefix">...</span>
      <span class="sidebar-section-link-content-text">General</span>
    </a>

    <!-- BUTTONS NOW SIBLINGS, NOT CHILDREN -->
    <div class="sidebar-section-link-actions" role="presentation">
      <button
        class="sidebar-section-action-button"
        tabindex="-1"
        aria-label="Edit General"
        title="Edit">
        <svg>pencil icon</svg>
      </button>
    </div>
  </div>
</li>
```

**Pros:**
- Fixes the nested interactive element violation
- Consistent with section header toolbar behavior
- Buttons become properly keyboard accessible
- Screen readers can announce buttons correctly

**Cons:**
- Requires HTML restructure (breaking change for plugins using this API)
- Click handling needs adjustment (clicking row background)
- CSS updates needed for visual alignment

### Option 2: Nested Toolbar Within Tree Items

**Concept:** Each tree item with actions becomes a micro-toolbar. The entire row has `role="toolbar"` inside the treeitem wrapper.

**Implementation:**

```html
<li class="sidebar-section-link-wrapper">
  <div role="toolbar"
       aria-label="General category actions"
       class="sidebar-section-link-toolbar">
    <a role="link"
       tabindex="-1"
       href="/c/general/1"
       class="sidebar-section-link">
      General
    </a>
    <button tabindex="-1" aria-label="Edit">Edit</button>
  </div>
</li>
```

**Pros:**
- Uses established toolbar pattern
- Clear semantic meaning
- Works with existing `toolbar-navigation.js`

**Cons:**
- Tree item now contains a toolbar (unusual nesting)
- Need to remove `role="treeitem"` from link (changes tree structure)
- May confuse screen readers ("toolbar inside tree")
- Complex focus management between tree and toolbar contexts

### Option 3: Context Menu via Keyboard Shortcut

**Concept:** Keep current structure, add keyboard shortcut (e.g., Shift+F10 or dedicated key) to open actions menu for focused tree item.

**Implementation:**
- Add keydown handler for Shift+F10 on tree items
- Open a dropdown/popover with available actions
- Actions rendered in accessible menu

**Pros:**
- No HTML restructure needed
- Familiar pattern (Windows/macOS context menu)
- Works with nested button issue (doesn't need to fix it)

**Cons:**
- Requires users to know the shortcut exists
- Extra step to reach common actions
- Doesn't address the fundamental nested button problem
- Hover-only buttons still inaccessible to screen readers

## Recommendation: Option 1

**Justification:**

1. **Addresses root cause** - Fixes the nested interactive element problem that violates ARIA spec
2. **Consistent with existing patterns** - Section headers already use toolbar with Arrow Left/Right navigation; this extends the pattern
3. **Best screen reader experience** - Buttons become proper siblings, can be announced correctly
4. **Future-proof** - Aligns with likely direction of W3C ARIA working group recommendations
5. **Intuitive** - Right arrow to "drill into" more options, Left to "go back" matches tree mental model

## Files to Modify

### Core Changes

| File | Changes |
|------|---------|
| `frontend/discourse/app/components/sidebar/section-link.gjs` | Restructure template to move button outside link; add row wrapper |
| `frontend/discourse/app/modifiers/sidebar-tree-navigation.js` | Add horizontal navigation within rows; track column position |
| `app/assets/stylesheets/common/base/sidebar-section-link.scss` | Update styles for new structure; handle focus states |
| `config/locales/client.en.yml` | Add aria-label strings for action buttons |

### Supporting Changes

| File | Changes |
|------|---------|
| `frontend/discourse/app/components/sidebar/section.gjs` | Potentially unify header and link action patterns |
| `frontend/discourse/app/lib/keyboard-navigation-utils.js` | Add helper for horizontal within vertical navigation |

### Test Updates

| File | Changes |
|------|---------|
| `frontend/discourse/tests/acceptance/sidebar-plugin-api-test.gjs` | Update selectors for new structure |
| `frontend/discourse/tests/integration/components/sidebar/section-link-test.gjs` | Add keyboard navigation tests |

## Implementation Approach

### Phase 1: HTML Restructure (section-link.gjs)

```javascript
// Before: Button inside link
<LinkTo ...>
  <span class="sidebar-section-link-hover">
    <button>...</button>
  </span>
</LinkTo>

// After: Button as sibling
<div class="sidebar-section-link-row">
  <LinkTo class="sidebar-section-link" role="treeitem" tabindex="-1">
    ...link content...
  </LinkTo>
  {{#if @hoverValue}}
    <button
      class="sidebar-section-action-button"
      tabindex="-1"
      aria-label={{concat "Edit " @content}}
      {{on "click" this.runHoverAction}}>
      {{icon @hoverValue}}
    </button>
  {{/if}}
</div>
```

### Phase 2: Modifier Updates (sidebar-tree-navigation.js)

```javascript
// Track both row position and column position within row
this.activeRowIndex = 0;
this.activeColumnIndex = 0; // 0 = link, 1+ = action buttons

// Get all focusable elements in current row
get currentRowFocusables() {
  const rows = this.visibleRows;
  const currentRow = rows[this.activeRowIndex];
  if (!currentRow) return [];

  return Array.from(
    currentRow.querySelectorAll('[role="treeitem"], .sidebar-section-action-button')
  ).filter(el => !el.disabled && el.offsetParent !== null);
}

// Arrow Right handler
handleArrowRight() {
  const focusables = this.currentRowFocusables;
  if (this.activeColumnIndex < focusables.length - 1) {
    // Move to next element in row (action button)
    this.activeColumnIndex++;
    this.focusCurrentElement();
  } else if (/* current item is collapsed section header */) {
    // Expand section (existing behavior)
    this.expandSection();
  }
}

// Arrow Left handler
handleArrowLeft() {
  if (this.activeColumnIndex > 0) {
    // Move back to treeitem
    this.activeColumnIndex = 0;
    this.focusCurrentElement();
  } else if (/* current item is expanded section header */) {
    // Collapse section (existing behavior)
    this.collapseSection();
  } else {
    // Move to parent (existing behavior)
    this.moveToParent();
  }
}
```

### Phase 3: Focus Management

- Ensure action buttons have `tabindex="-1"` initially
- Update tabindex when navigating to button
- Reset column index to 0 when changing rows
- Handle case where row has no action buttons

### Phase 4: Screen Reader Announcements

- Add descriptive `aria-label` to action buttons: "Edit General category"
- Consider `aria-describedby` to associate button with row label
- Announce available actions when focusing tree item (optional)

## Risk Assessment

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Plugin API breakage | High | Medium | Document migration path; deprecation warnings |
| CSS regressions | Medium | Medium | Visual regression testing; screenshot comparisons |
| Focus management edge cases | Medium | High | Comprehensive keyboard navigation tests |
| Screen reader compatibility | Medium | High | Test with NVDA, JAWS, VoiceOver |

### Non-Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| User confusion (new pattern) | Low | Low | Pattern matches section headers; intuitive |
| Performance (more DOM elements) | Low | Low | Minimal additional elements |

### Success Probability: 75%

**Positive factors:**
- Clear technical path forward
- Similar pattern already works in section headers
- Well-understood focus management patterns

**Risk factors:**
- Plugin API changes may reveal unexpected usage patterns
- Screen reader testing may reveal unforeseen issues
- No official WAI-ARIA pattern to reference

## Edge Cases

### 1. Items Without Action Buttons

When a tree item has no action buttons, Arrow Right should:
- On collapsed section header: expand the section (existing behavior)
- On regular link: do nothing (no buttons to navigate to)

### 2. Multiple Action Buttons

If a future item has 2+ buttons:
- Arrow Right cycles through buttons left-to-right
- Arrow Left returns to the treeitem from first button
- Consider wrapping (Right from last button -> first button) vs no-wrap

### 3. Hover-Only Buttons Becoming Always-Visible

Currently buttons show on hover. Options:
- Keep hover-only visual, but focusable via keyboard
- Show focused buttons even without hover
- **Recommend:** Focused button should be visible (CSS `:focus-within`)

### 4. Mobile/Touch

Touch users don't have arrow keys. Current behavior:
- Tap link -> navigate
- Tap button -> action

New structure should preserve this (buttons as siblings still clickable).

### 5. Section Header Actions

Section headers already have a toolbar with actions. Should unify:
- Header toolbar: collapse button + edit button (if admin)
- Link actions: edit button

Both should use same keyboard pattern for consistency.

## Testing Strategy

### Unit Tests

- `sidebar-tree-navigation.js` modifier methods
- Column index management
- Focus element calculation

### Integration Tests

- Tab into sidebar, navigate with arrows
- Arrow Right to action button, activate with Enter
- Arrow Left back to link
- Verify tabindex updates

### Accessibility Tests

- NVDA: Navigate tree, reach buttons, hear announcements
- JAWS: Same as NVDA
- VoiceOver: Same as above

### Visual Regression Tests

- Sidebar with focused link
- Sidebar with focused action button
- Hover state vs focus state

## References

- [WAI-ARIA Tree View Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/)
- [WAI-ARIA Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)
- [W3C ARIA Issue #1440: Secondary actions on composite widgets](https://github.com/w3c/aria/issues/1440)
- [Keyboard Interface Best Practices](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
- [Navigation Treeview Example](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/examples/treeview-navigation/)
- Internal: `docs/accessibility/09-sidebar-navigation.md`

## Appendix: Existing Section Header Toolbar

For reference, section headers already implement a working toolbar pattern:

```html
<!-- From sidebar/section.gjs lines 177-240 -->
<div
  class="sidebar-section-header-wrapper sidebar-row"
  role="toolbar"
  aria-label="Categories"
  {{toolbarNavigation itemSelector="button"}}
>
  <SectionHeader>
    <!-- Collapse button (role="treeitem" on DButton) -->
  </SectionHeader>

  <!-- Edit button (if single action) -->
  <button class="sidebar-section-header-button">
    <svg>pencil</svg>
  </button>
</div>
```

This pattern works: Arrow Right/Left navigate between collapse and edit buttons. The proposed solution extends this to regular tree items.
