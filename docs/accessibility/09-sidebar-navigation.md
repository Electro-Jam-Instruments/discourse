# Sidebar Navigation Accessibility Specification

This document defines the accessibility implementation for the Discourse sidebar navigation, following the WAI-ARIA Tree pattern.

## Design Intent

The sidebar should function as a single tab stop with internal arrow key navigation, allowing efficient keyboard navigation for screen reader users. The pattern enables users to quickly move through navigation items without excessive tabbing.

## ARIA Structure

### Tree Container
```html
<nav role="tree" aria-label="Sidebar navigation">
```

### Section Headers (Collapsible)
```html
<div role="treeitem"
     aria-expanded="true|false"
     aria-selected="false"
     tabindex="-1">
  Topics
</div>
```

### Navigation Items
```html
<a role="treeitem"
   aria-selected="true|false"
   tabindex="0|-1"
   href="/latest">
  Latest
</a>
```

### Section Groups (Children Container)
```html
<div role="group">
  <!-- Child treeitems go here -->
</div>
```

### "More" Popup Trigger
```html
<button role="treeitem"
        aria-haspopup="menu"
        aria-expanded="false"
        tabindex="-1">
  More
</button>
```

## Keyboard Behavior

| Key | Action |
|-----|--------|
| **Tab** | Enter tree; focus selected item (aria-selected="true") or first visible item |
| **Shift+Tab** | Exit tree to previous focusable element |
| **Arrow Down** | Move to next visible treeitem; wrap to first item at end |
| **Arrow Up** | Move to previous visible treeitem; wrap to last item at beginning |
| **Arrow Right** | If on collapsed section header: expand section |
| **Arrow Left** | If on expanded section header: collapse section. If on child item: move focus to parent section header |
| **Enter / Space** | Activate link (navigate) OR toggle expand/collapse on section headers OR open popup for "More" |
| **Home** | Move focus to first visible treeitem |
| **End** | Move focus to last visible treeitem |
| **Escape** | Close popup menu (when open) |

## Visual Sections

The sidebar contains these sections:

1. **Topics Section**
   - Section header: "Topics" (collapsible)
   - Items: Latest, Hot, My Posts, etc.
   - "More" button: Opens popup with additional links

2. **Categories Section**
   - Section header: "Categories" (collapsible)
   - Items: General, Site Feedback, etc.
   - "All categories" link

3. **Tags Section** (if enabled)
   - Section header: "Tags" (collapsible)
   - Tag items

## Focus Management

### Roving Tabindex
- One item has `tabindex="0"` (currently focused/last focused)
- All other items have `tabindex="-1"`
- Focus memory persists across page navigations

### Selection State
- `aria-selected="true"` on the item matching current page
- Visual styling indicates selected state
- Focus can differ from selection (user can arrow around without changing selection)

### Focus Persistence
- When navigating to a new page via sidebar, focus returns to the activated item
- On page load, the item matching current URL gets `aria-selected="true"` and `tabindex="0"`

## "More" Popup Behavior

The "More" button opens a popup menu containing additional navigation links.

### Opening
- **Enter** or **Space** on "More" button opens popup
- Focus moves to first item in popup

### Inside Popup
- **Arrow Up/Down** navigate popup items
- **Enter/Space** activate item
- **Escape** closes popup, returns focus to "More" button

### Modal Behavior
- Popup traps focus until closed
- Clicking outside closes popup
- On mobile: renders as modal dialog

## Screen Reader Announcements

When focused, screen readers should announce:
- Item name/label
- Role ("tree item" or similar)
- Selection state ("selected" when aria-selected="true")
- Expansion state for collapsible headers ("expanded"/"collapsed")
- Position in set (optional: "3 of 7")

## Future Consideration: Inline Collapsible "More"

GitHub Issue #3 tracks converting the "More" popup to an inline collapsible section:
- Would become a treeitem with `aria-expanded`
- Arrow Right/Left would expand/collapse
- Children would appear inline in the tree
- Would follow same patterns as Topics/Categories sections

## Files to Modify

### Components
- `frontend/discourse/app/components/sidebar/section.gjs` - Section container
- `frontend/discourse/app/components/sidebar/section-link.gjs` - Navigation links
- `frontend/discourse/app/components/sidebar/more-section-links.gjs` - More popup
- `frontend/discourse/app/components/sidebar/more-section-trigger.gjs` - More button

### New Modifier
- `frontend/discourse/app/modifiers/sidebar-tree-navigation.js` - Keyboard navigation

### Styles
- Focus ring styles for sidebar items
- Selected state visual indicator

## References

- [WAI-ARIA Tree Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/)
- [WAI-ARIA Tree Example](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/examples/treeview-navigation/)
- [Roving Tabindex](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_roving_tabindex)
