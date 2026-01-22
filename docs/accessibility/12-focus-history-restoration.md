# Focus History Restoration on Browser Navigation

This document describes the accessibility implementation for restoring focus when users navigate with browser back/forward (Alt+Left/Right arrows or browser buttons).

## Overview

When keyboard users navigate away from a page and return via browser back/forward, focus should return to where they were. This prevents users from losing their place and having to tab through the entire page to find their position again.

## Problem Statement

### Current Behavior
When a user:
1. Is focused on row 5 in the topic list
2. Presses Enter to open a topic
3. Reads the topic
4. Presses Alt+Left to go back

**Result**: Focus goes to an undefined location (body or first focusable), not row 5.

### Desired Behavior
Focus should return to row 5 in the topic list, exactly where the user was.

## Design Decisions

### 1. Keyboard Mode Detection

**Approach**: Track last input type globally.

- Any `keydown` event sets keyboard mode = true
- Any `mousedown` event sets keyboard mode = false
- Focus restoration only happens when keyboard mode is active

**Rationale**:
- Alt+Back navigation triggers `keydown` for the Alt key before the navigation occurs
- Mouse clicks on browser back button trigger `mousedown` first
- This naturally distinguishes keyboard vs mouse navigation

### 2. Element Identification

**Approach**: Prioritized fallback chain to find the same element after page load.

| Priority | Method | Example | Use Case |
|----------|--------|---------|----------|
| 1 | `id` attribute | `#create-topic` | Buttons, specific elements |
| 2 | `data-*` attributes | `[data-topic-id="123"]` | Topic rows, post rows |
| 3 | Role + aria-rowindex | `[role="row"][aria-rowindex="5"]` | Grid rows without data IDs |
| 4 | Unique selector path | `.topic-list tbody tr:nth-child(5)` | Last resort |

**Storage Format**:
```javascript
{
  url: "/latest",
  selector: '[data-topic-id="123"]',  // Primary selector
  fallbackSelector: '[role="row"][aria-rowindex="5"]',  // Backup
  keyboardMode: true,
  timestamp: 1704567890123
}
```

### 3. Fallback Behavior

**Approach**: Do nothing if element not found.

If the exact element no longer exists (topic deleted, post removed):
- Let browser default behavior happen
- Don't attempt to focus "nearby" elements (could be confusing)
- Future enhancement: Add smarter fallbacks based on real-world issues

### 4. Navigation API with Fallback

**Approach**: Use Navigation API where available, `popstate` elsewhere.

```javascript
if ('navigation' in window) {
  // Modern browsers (Chrome 102+, Edge 102+)
  navigation.addEventListener('navigate', handleNavigation);
} else {
  // Firefox, Safari, older browsers
  window.addEventListener('popstate', handlePopstate);
}
```

**Benefits**:
- Navigation API provides cleaner, more reliable detection
- `popstate` ensures Firefox/Safari users aren't broken
- Progressive enhancement - best experience where possible

## Implementation Details

### New Service: `focus-history`

```javascript
// frontend/discourse/app/services/focus-history.js

/**
 * Service to track and restore focus across browser navigation.
 *
 * Responsibilities:
 * - Track keyboard vs mouse input mode
 * - Save focused element info before navigation
 * - Restore focus after back/forward navigation
 */
export default class FocusHistoryService extends Service {
  @tracked keyboardMode = false;

  // Map of URL -> focus info
  focusStack = new Map();

  /**
   * Build a selector that can find this element after page reload.
   * Tries multiple strategies in priority order.
   */
  buildElementSelector(element) {
    // 1. ID
    if (element.id) {
      return `#${element.id}`;
    }

    // 2. Data attributes (topic-id, post-id, etc.)
    if (element.dataset.topicId) {
      return `[data-topic-id="${element.dataset.topicId}"]`;
    }
    if (element.dataset.postId) {
      return `[data-post-id="${element.dataset.postId}"]`;
    }

    // 3. Role + aria-rowindex for grid rows
    const role = element.getAttribute('role');
    const rowIndex = element.getAttribute('aria-rowindex');
    if (role === 'row' && rowIndex) {
      return `[role="row"][aria-rowindex="${rowIndex}"]`;
    }

    // 4. Role + aria-selected for tabs
    if (role === 'tab' && element.getAttribute('aria-selected') === 'true') {
      const tablist = element.closest('[role="tablist"]');
      if (tablist?.id) {
        return `#${tablist.id} [role="tab"][aria-selected="true"]`;
      }
    }

    // 5. Fallback: try to build unique path
    return this.buildSelectorPath(element);
  }

  /**
   * Save current focus state for this URL.
   */
  saveFocusState(url) {
    const activeElement = document.activeElement;
    if (!activeElement || activeElement === document.body) {
      return;
    }

    this.focusStack.set(url, {
      selector: this.buildElementSelector(activeElement),
      keyboardMode: this.keyboardMode,
      timestamp: Date.now()
    });
  }

  /**
   * Restore focus for this URL if we have saved state.
   */
  restoreFocusState(url) {
    const state = this.focusStack.get(url);
    if (!state || !state.keyboardMode) {
      return false;
    }

    const element = document.querySelector(state.selector);
    if (element) {
      element.focus();
      return true;
    }

    return false;
  }
}
```

### Instance Initializer Updates

```javascript
// frontend/discourse/app/instance-initializers/focus-history-tracking.js

export default {
  initialize(owner) {
    const focusHistory = owner.lookup('service:focus-history');

    // Track input mode globally
    document.addEventListener('keydown', () => {
      focusHistory.keyboardMode = true;
    }, { capture: true });

    document.addEventListener('mousedown', () => {
      focusHistory.keyboardMode = false;
    }, { capture: true });

    // Navigation API (modern browsers)
    if ('navigation' in window) {
      navigation.addEventListener('navigate', (event) => {
        // Save focus before navigating away
        focusHistory.saveFocusState(location.href);
      });

      navigation.addEventListener('navigatesuccess', () => {
        // Restore focus after navigation completes
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          focusHistory.restoreFocusState(location.href);
        });
      });
    } else {
      // Popstate fallback (Firefox, Safari)
      window.addEventListener('beforeunload', () => {
        focusHistory.saveFocusState(location.href);
      });

      window.addEventListener('popstate', () => {
        requestAnimationFrame(() => {
          focusHistory.restoreFocusState(location.href);
        });
      });
    }
  }
};
```

### Integration with Existing Focus Restoration

The new focus history system should integrate with, not replace, existing focus restoration:

1. **Filter selection** (`navigation-focus-restoration.js`) - Handles focus after selecting Latest/New/Hot tabs
2. **Focus history** (new) - Handles focus after browser back/forward

**Priority order on navigation**:
1. If browser back/forward AND keyboard mode → restore from focus history
2. If filter tab activated via keyboard → focus first topic row
3. Otherwise → focus active tab (existing behavior)

## Files to Create/Modify

| File | Change |
|------|--------|
| `frontend/discourse/app/services/focus-history.js` | NEW: Service to track and restore focus |
| `frontend/discourse/app/instance-initializers/focus-history-tracking.js` | NEW: Set up global event listeners |
| `frontend/discourse/app/instance-initializers/navigation-focus-restoration.js` | Integrate with focus history |

## Testing

### Manual Testing

1. **Basic back/forward**:
   - Focus row 5 in topic list
   - Press Enter to open topic
   - Press Alt+Left to go back
   - Verify focus is on row 5

2. **Keyboard mode detection**:
   - Click (mouse) on row 5
   - Click to open topic
   - Press Alt+Left to go back
   - Verify focus is NOT restored (mouse mode was active)

3. **Element no longer exists**:
   - Focus a topic row
   - Navigate away
   - Delete that topic (in another tab)
   - Navigate back
   - Verify no errors, focus goes to default location

4. **Different element types**:
   - Test with grid rows
   - Test with nav tabs
   - Test with sidebar items
   - Test with buttons

### Browser Compatibility

| Browser | API Used | Expected Behavior |
|---------|----------|-------------------|
| Chrome 102+ | Navigation API | Full support |
| Edge 102+ | Navigation API | Full support |
| Firefox | popstate | Full support |
| Safari | popstate | Full support |

## Accessibility Benefits

1. **Reduced cognitive load** - Users don't lose their place
2. **Fewer keystrokes** - No need to tab back to previous position
3. **Consistent experience** - Works like native desktop applications
4. **Screen reader friendly** - Focus position is announced on restoration

## Limitations

1. **Session-only** - Focus history not persisted across page refreshes
2. **Single tab** - Doesn't sync across browser tabs
3. **Dynamic content** - May fail if page content changes significantly between visits

## Related Work

- [11-filter-focus-management.md](11-filter-focus-management.md) - Focus after filter selection
- [02-topic-grid.md](02-topic-grid.md) - Topic list grid navigation

## References

- [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API)
- [popstate event](https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event)
- [Focus Management Best Practices](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#focusmanagement)
