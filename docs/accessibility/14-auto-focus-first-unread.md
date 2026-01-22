# Auto-Focus First Unread Post on Topic Entry

This document describes the accessibility implementation for automatically focusing the first unread post when keyboard users enter a topic.

## Overview

When keyboard users navigate to a topic page, focus should automatically move to the first unread post rather than requiring manual navigation through the post stream. This optimizes the keyboard workflow and matches expected behavior.

## Problem Statement

### Current Behavior
When a user:
1. Is in the topic list
2. Presses Enter on a topic to open it
3. Topic page loads

**Result**: Focus goes to an undefined location, user must manually navigate to find unread content.

### Desired Behavior
1. If the user has read some posts: Focus the first unread post (lastReadPostNumber + 1)
2. If the user has read all posts: Focus the first content post (post 1, skipping header row)
3. If mouse navigation: Do not auto-focus (preserve existing behavior)

## Design Decisions

### 1. Keyboard Mode Detection

**Approach**: Use existing `focus-history` service's `keyboardMode` property.

- Service already tracks last input type globally
- Any `keydown` sets keyboard mode = true
- Any `mousedown` sets keyboard mode = false

### 2. Timing Strategy

**Approach**: `schedule("afterRender")` + `requestAnimationFrame`

```javascript
schedule("afterRender", () => {
  requestAnimationFrame(() => {
    this.focusFirstUnreadPost(lastReadPostNumber);
  });
});
```

**Why this combination**:
- `schedule("afterRender")` ensures Ember has completed DOM updates
- `requestAnimationFrame` ensures the browser has painted
- No arbitrary timers (user requirement)

### 3. Target Post Identification

**Approach**: Use `data-post-number` attribute on row elements.

```javascript
const targetPostNumber = (lastReadPostNumber || 0) + 1;

for (let i = 0; i < rows.length; i++) {
  const postNumber = parseInt(rows[i].dataset.postNumber, 10);
  if (postNumber === targetPostNumber) {
    targetIndex = i;
    break;
  }
}
```

**Fallback behavior**:
- If target post not loaded (virtualized): Focus first content row (index 1)
- If no posts: Do nothing

### 4. Skip Header Row

**Approach**: Always skip index 0 when falling back.

The topic header row is always at index 0 in the grid. When the target unread post isn't found, we focus index 1 (first content post) rather than index 0.

## Implementation Details

### Modified Files

| File | Change |
|------|--------|
| `frontend/discourse/app/modifiers/post-stream-navigation.js` | Add auto-focus logic |
| `frontend/discourse/app/components/post-stream.gjs` | Pass `lastReadPostNumber` to modifier |

### Code Changes

#### post-stream-navigation.js

```javascript
// New imports
import { schedule } from "@ember/runloop";
import { service } from "@ember/service";

export default class PostStreamNavigationModifier extends Modifier {
  @service focusHistory;

  // New property to track if initial focus done
  initialFocusComplete = false;

  modify(element, positional, named) {
    // ... existing code ...

    // Auto-focus first unread post on initial load if user navigated via keyboard
    if (!this.initialFocusComplete && this.focusHistory.keyboardMode) {
      this.scheduleInitialFocus(named.lastReadPostNumber);
    }
  }

  /**
   * Schedule auto-focus on first unread post after rendering completes.
   */
  scheduleInitialFocus(lastReadPostNumber) {
    this.initialFocusComplete = true;

    schedule("afterRender", () => {
      requestAnimationFrame(() => {
        this.focusFirstUnreadPost(lastReadPostNumber);
      });
    });
  }

  /**
   * Focus the first unread post in the stream.
   * If all posts are read, focus the first content post (skipping header row).
   */
  focusFirstUnreadPost(lastReadPostNumber) {
    const rows = this.rows;
    if (rows.length === 0) {
      return;
    }

    const targetPostNumber = (lastReadPostNumber || 0) + 1;

    // Find row with matching post number
    let targetIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      const postNumber = parseInt(rows[i].dataset.postNumber, 10);
      if (postNumber === targetPostNumber) {
        targetIndex = i;
        break;
      }
    }

    // Fallback: focus first content row (skip header at index 0)
    if (targetIndex === -1) {
      targetIndex = rows.length > 1 ? 1 : 0;
    }

    this.focusRow(targetIndex);
  }
}
```

#### post-stream.gjs

```gbs
{{PostStreamNavigation lastReadPostNumber=@lastReadPostNumber}}
```

## Testing

### Manual Testing

1. **First unread post**:
   - Open a topic you've partially read
   - Using keyboard navigation (Tab, Enter)
   - Verify focus goes to first unread post

2. **All posts read**:
   - Open a topic you've fully read
   - Using keyboard navigation
   - Verify focus goes to post 1 (not header row)

3. **New topic (never read)**:
   - Open a topic you've never read
   - Using keyboard navigation
   - Verify focus goes to post 1

4. **Mouse navigation**:
   - Click on a topic with mouse
   - Verify focus does NOT auto-move
   - Verify page scrolls to expected position (existing behavior)

5. **Direct URL entry**:
   - Type/paste a topic URL directly
   - Press Enter (keyboard)
   - Verify focus goes to first unread post

### Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Empty topic | No focus change |
| Single post | Focus that post |
| Unread post not loaded (virtualized) | Focus first loaded post |
| Header row only | Focus header row (graceful fallback) |

## Accessibility Benefits

1. **Reduced navigation** - Users land directly on unread content
2. **Consistent workflow** - Matches expected behavior of reading apps
3. **Screen reader friendly** - Post content immediately announced
4. **Keyboard parity** - Same efficiency as mouse users who get visual scroll position

## Future Enhancements

1. **Mouse mode auto-scroll** - Scroll to first unread even for mouse users (filed as GitHub issue)
2. **Announce unread count** - Use live region to announce "3 unread posts" on entry
3. **Configurable behavior** - User preference to enable/disable auto-focus

## Related Work

- [12-focus-history-restoration.md](12-focus-history-restoration.md) - Browser back/forward focus restoration
- [04-topic-thread.md](04-topic-thread.md) - Post stream grid navigation
- [11-filter-focus-management.md](11-filter-focus-management.md) - Focus after filter selection

## References

- [Ember runloop schedule](https://api.emberjs.com/ember/release/classes/@ember%2Frunloop/methods/schedule?anchor=schedule)
- [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame)
