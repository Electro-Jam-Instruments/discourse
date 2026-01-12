# Navigation Controls Toolbar Accessibility

This document describes the accessibility implementation for the topic actions toolbar in the navigation area.

## Overview

The navigation controls area contains action buttons that appear based on context:
- Dismiss buttons (Dismiss, Dismiss New)
- Create Topic button
- Category/Tag management buttons
- Notification dropdowns

Previously, each button was a separate tab stop, requiring many key presses to navigate. Now, the entire area is a single toolbar with arrow key navigation.

## Implementation

### ARIA Structure

```html
<div class="navigation-controls"
     role="toolbar"
     aria-label="Topic actions"
     aria-orientation="horizontal">
  <!-- Buttons and dropdowns -->
</div>
```

### Keyboard Behavior

| Key | Action |
|-----|--------|
| **Tab** | Enter toolbar, focus first/last focused item |
| **Shift+Tab** | Exit toolbar to previous element |
| **Arrow Right** | Move to next button/control |
| **Arrow Left** | Move to previous button/control |
| **Home** | Move to first button |
| **End** | Move to last button |
| **Enter/Space** | Activate focused button |

### Components That May Appear

| Component | When Shown | Selector |
|-----------|------------|----------|
| Bulk Select Toggle | Mobile or enabled via transformer | `button` |
| Dismiss Button | Unread filter with unread topics | `.dismiss-read` button |
| Dismiss New Button | New filter with new topics | `.dismiss-read` button |
| Categories Admin Dropdown | Admin on categories view | `.select-kit-header` |
| Create Category Button | Admin on categories view | `#create-category` |
| Edit Category Button | Viewing editable category | `.edit-category` |
| Tag Info/Edit Button | Viewing a tag | `#show-tag-info` |
| Create Topic Button | Can create topics | `#create-topic` |
| Topic Drafts Dropdown | Has drafts | `.select-kit-header` |
| Category Notifications | Viewing a category (logged in) | `.select-kit-header` |
| Tag Notifications | Viewing a tag (logged in) | `.select-kit-header` |

## Item Selector

The toolbar navigation modifier uses this selector to find navigable items:

```javascript
itemSelector="button, .btn, a.btn, .select-kit-header"
```

This captures:
- All button elements
- Elements with `.btn` class
- Anchor elements styled as buttons
- Select-kit dropdown headers

## Files Modified

### Components
- `frontend/discourse/app/components/d-navigation.gjs` - Added toolbar role and modifier

### i18n
- `config/locales/client.en.yml` - Added `navigation.actions_toolbar_label`

## Relationship to Filter Toolbar

The page now has two toolbars in the navigation area:

1. **Topic Filters Toolbar** (`.topic-filter-toolbar`)
   - Contains: Breadcrumbs, Category dropdown, Tags dropdown, Nav tabs (Latest, New, Hot, etc.)
   - Label: "Topic filters"

2. **Topic Actions Toolbar** (`.navigation-controls`)
   - Contains: Dismiss buttons, Create Topic, Notifications
   - Label: "Topic actions"

Both use the same `toolbarNavigation` modifier for consistent keyboard behavior.

## Screen Reader Experience

When a screen reader user tabs into the navigation area:

1. First Tab: Enters "Topic filters" toolbar
   - Arrow keys navigate between categories, tags, and filter tabs
2. Second Tab: Enters "Topic actions" toolbar
   - Arrow keys navigate between Dismiss, New Topic, and notification controls
3. Third Tab: Moves to main content (topic list grid)

## References

- [WAI-ARIA Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)
- [01-toolbar.md](01-toolbar.md) - Filter toolbar implementation details
