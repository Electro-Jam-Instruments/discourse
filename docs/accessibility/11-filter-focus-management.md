# Focus Management After Filter Selection

This document describes the accessibility implementation for focus management when users select topic filters via keyboard.

## Overview

When users navigate topic lists, they often select different filters (Latest, New, Hot, etc.) to find content. This document specifies how focus should behave after filter activation to optimize the keyboard user workflow.

## Current Behavior (Before This Change)

When a user activates a filter tab via keyboard:
1. Focus remains on the selected tab
2. User must press Tab to move to the topic list
3. This was intentional from earlier work (commit `8270b7eb86`)

**Why this was done initially:**
- Preserved standard tablist behavior
- Allowed users to quickly switch between multiple filters

## New Behavior (After This Change)

When a user activates a filter tab via **keyboard only**:
1. Focus automatically moves to the **first data row** in the topic list (not the header row)
2. Screen reader announces the focused topic
3. User can immediately start navigating topics with arrow keys

When a user clicks a filter tab with **mouse**:
1. No automatic focus movement (preserves mouse user expectations)
2. User continues browsing normally

## Rationale for Change

**Why change from current behavior?**

1. **Workflow optimization** - Most users select a filter to browse topics, not to keep navigating filters
2. **Reduced keystrokes** - Current workflow requires extra Tab press after every filter change
3. **Common pattern** - Matches list/grid application patterns (Outlook, file managers, etc.)
4. **Keyboard-only change** - Mouse users keep their expected behavior

**User journey comparison:**

| Action | Before | After |
|--------|--------|-------|
| Select "New" filter | Tab → Topic List → Arrow Down | Immediately on first topic |
| Select "Hot" filter | Tab → Topic List → Arrow Down | Immediately on first topic |
| Browse 3 filters | 9 keystrokes minimum | 3 keystrokes minimum |

## Triggers

This behavior applies to:

| Trigger | Component | Selector |
|---------|-----------|----------|
| Nav tabs (Latest, New, Hot, etc.) | `NavigationBar` | `#navigation-bar a` |
| Category dropdown selection | `BreadCrumbs` | `.category-breadcrumb` |
| Tag dropdown selection | `BreadCrumbs` | `.tag-drop` |

## Empty State Handling

When the filtered list returns no topics:

1. **Focus stays on the filter tab** (so user can quickly try another filter)
2. **Live region announces** "No topics found" or similar message
3. This prevents focus from being lost or moving to nothing

### Announcement Implementation

Discourse has an existing `a11y` service with live region support:

```javascript
import { service } from "@ember/service";

// In component or modifier
@service a11y;

// Polite announcement (doesn't interrupt)
this.a11y.announce("No topics match this filter", "polite");
```

The live regions are rendered in `application.gjs` via the `A11yLiveRegions` component:
- Polite: `role="status"` + `aria-live="polite"`
- Assertive: `role="alert"` + `aria-live="assertive"`

## Implementation Details

### Files Modified

| File | Change |
|------|--------|
| `frontend/discourse/app/services/filter-focus.js` | NEW: Service to track keyboard-triggered filter activations |
| `frontend/discourse/app/components/navigation-item.gjs` | Added click handler to detect keyboard activation |
| `frontend/discourse/app/instance-initializers/navigation-focus-restoration.js` | Handle focus movement after route transition |

### Keyboard Detection

To differentiate keyboard from mouse activation:

```javascript
// Track if activation was via keyboard
handleClick(event) {
  const wasKeyboard = event.detail === 0; // Click via Enter/Space has detail=0
  // ... handle activation
}
```

Or use `keydown` handler for Enter/Space separately from `click`.

### Focus Sequence

1. User presses Enter/Space on filter tab
2. Navigation bar emits "filter-activated-via-keyboard" event
3. Route transition occurs, new topics load
4. `navigation-focus-restoration` initializer:
   - If flag is set AND topics exist: focus first data row
   - If flag is set AND no topics: announce empty state, keep focus on tab
5. Clear keyboard activation flag

### Focus Target

The focus target is the first **data row**, not the header:

```javascript
// In topic-list/list.gjs or focus restoration
const firstDataRow = document.querySelector(
  '.topic-list [role="row"]:not([role="rowheader"])'
);
if (firstDataRow) {
  firstDataRow.focus();
}
```

## Accessibility Considerations

### Screen Reader Announcements

| Scenario | Announcement |
|----------|--------------|
| Focus moves to topic | Row label announces automatically (existing behavior) |
| Empty list | "No topics match this filter" via live region |

### Focus Visibility

Focus outline is already styled in `_topic-list.scss`:
```scss
.topic-list-item:focus-visible {
  outline: 2px solid var(--tertiary);
  outline-offset: -2px;
}
```

## Testing

### Manual Testing

1. **Keyboard navigation:**
   - Tab to "New" filter, press Enter
   - Verify focus moves to first topic row
   - Screen reader should announce the topic

2. **Mouse click:**
   - Click "New" filter with mouse
   - Verify focus does NOT automatically move

3. **Empty state:**
   - Select filter with no results
   - Verify focus stays on filter
   - Verify "No topics" announcement

### Automated Testing

Add system spec:
```ruby
# spec/system/accessibility/filter_focus_spec.rb
it "moves focus to first topic after keyboard filter selection" do
  visit("/latest")
  # Tab to nav, select "New"
  # Assert focus is on first topic row
end
```

## Related Work

- [01-toolbar.md](01-toolbar.md) - Filter toolbar implementation
- [02-topic-grid.md](02-topic-grid.md) - Topic list grid navigation
- [05-accessibility-backlog.md](05-accessibility-backlog.md) - Backlog item #7: Dismiss New button focus (separate research needed)
- GitHub Issue [#4](https://github.com/Electro-Jam-Instruments/discourse/issues/4) - Dismiss New button focus research

## References

- [WAI-ARIA Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
- [Focus Management Best Practices](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#focusmanagement)
- Discourse `a11y` service: `frontend/discourse/app/services/a11y.js`
