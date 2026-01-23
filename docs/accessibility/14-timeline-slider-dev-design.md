# Timeline Slider Accessibility - Developer Design Document

**Status:** Design Complete
**End-User Design:** [14-timeline-slider.md](14-timeline-slider.md)
**GitHub Issue:** [#7](https://github.com/Electro-Jam-Instruments/discourse/issues/7)

## Executive Summary

This document provides the technical implementation details for converting the topic timeline slider (showing "N of M" posts) into a WAI-ARIA accessible slider with full keyboard support. The implementation must coordinate with the existing post-stream grid navigation system, handle Discourse's cloaking (virtualization) system, and avoid timing-based anti-patterns learned from the focus-jumping bug fix history.

---

## 1. Technical Overview

### 1.1 Current Architecture

The timeline consists of two main components:

| Component | File | Responsibility |
|-----------|------|----------------|
| `TopicTimelineScrollArea` (container) | `components/topic-timeline/container.gjs` | State management, scroll calculations, drag handling, appEvents coordination |
| `TopicTimelineScroller` (scroller) | `components/topic-timeline/scroller.gjs` | Visual display, draggable modifier attachment |

**Current Data Flow:**
```
User scrolls page
    |
    v
topic.js controller detects scroll
    |
    v
appEvents.trigger("topic:current-post-scrolled", {postIndex, percent})
    |
    v
container.postScrolled() updates state
    |
    v
container.calculatePosition() recomputes UI
```

**Existing Jump Mechanism:**
```
User drags scroller OR clicks padding
    |
    v
container.updatePercentage() computes new percentage
    |
    v
container.commit() determines target
    |
    v
@args.jumpToIndex(this.current) called
    |
    v
topic-navigation.jumpToIndex() scrolls page
```

### 1.2 Integration Points

The slider accessibility implementation integrates at these points:

1. **Scroller Component** - Add ARIA attributes and tabindex
2. **Container Component** - Add keyboard handler, manage aria-describedby
3. **Post Stream Navigation** - Coordinate slider navigation with grid focus
4. **Post Component** - Ensure post rows have stable IDs for aria-describedby
5. **appEvents** - Use existing event system for bidirectional sync

### 1.3 State Synchronization Model

```
                    +-----------------+
                    |   User Input    |
                    +--------+--------+
                             |
              +--------------+--------------+
              |                             |
    +---------v---------+         +---------v---------+
    |   Grid Arrow Keys |         |  Slider Arrow Keys|
    +--------+----------+         +----------+--------+
             |                               |
             |                               v
             |                    +----------+----------+
             |                    | jumpToIndex(postNum)|
             |                    +----------+----------+
             |                               |
             v                               v
    +--------+--------+           +----------+----------+
    | Focus post row  |           | Page scrolls to post|
    +--------+--------+           +----------+----------+
             |                               |
             v                               v
    +--------+--------+           +----------+----------+
    |  Post in view   |<--------->| topic:current-post- |
    |                 |           | scrolled event      |
    +--------+--------+           +----------+----------+
             |                               |
             +--------------+----------------+
                            |
                            v
                  +---------+---------+
                  | container.postScrolled|
                  | updates slider UI     |
                  +-----------------------+
```

---

## 2. Component Architecture

### 2.1 Files to Modify

| File | Changes Required |
|------|------------------|
| `components/topic-timeline/scroller.gjs` | Add ARIA attributes, tabindex, `...attributes` spread |
| `components/topic-timeline/container.gjs` | Add keydown handler, RTL detection, aria-describedby logic, emit events for grid sync |
| `components/post.gjs` | Add stable `id` attribute on row div for aria-describedby reference |
| `config/locales/client.en.yml` | Add i18n strings for slider |

### 2.2 Scroller Component Changes

**Current scroller element (line 27-36 of scroller.gjs):**
```handlebars
<div
  {{draggable
    didStartDrag=@didStartDrag
    didEndDrag=@didEndDrag
    dragMove=@dragMove
  }}
  style={{this.style}}
  class="timeline-scroller"
  ...attributes
>
```

**Required additions (passed from container):**
```handlebars
<div
  {{draggable ...}}
  style={{this.style}}
  class="timeline-scroller"
  role="slider"
  aria-orientation="vertical"
  aria-valuemin="1"
  aria-valuemax={{@total}}
  aria-valuenow={{@current}}
  aria-valuetext={{@valueText}}
  aria-label={{i18n "topic.timeline.slider_label"}}
  aria-describedby={{@describedById}}
  tabindex="0"
  {{on "keydown" @onKeydown}}
  ...attributes
>
```

### 2.3 Container Component Changes

**New properties needed:**

```javascript
// Tracked properties
@tracked sliderDescribedById = null;  // ID of current post row for aria-describedby

// Computed properties
get ariaValueText() {
  // Format: "Post 3 of 15, December 2025"
  const dateText = this.date ? timelineDate(this.date) : '';
  return i18n('topic.timeline.post_position_with_date', {
    current: this.current,
    total: this.total,
    date: dateText
  });
}

get isRTL() {
  return document.documentElement.dir === 'rtl';
}
```

**New methods needed:**

```javascript
@action
handleSliderKeydown(event) {
  // Implementation detailed in Section 3
}

@action
updateDescribedById() {
  // Implementation detailed in Section 6
}
```

### 2.4 Post Component ID Convention

**Add stable ID to post row (post.gjs line 500):**

```handlebars
<div
  ...attributes
  role="row"
  tabindex="-1"
  aria-rowindex={{this.ariaRowIndex}}
  aria-label={{this.postRowAriaLabel}}
  id={{concat "post-row-" @post.post_number}}  {{! NEW: stable ID for aria-describedby }}
  data-post-number={{@post.post_number}}
  ...
>
```

**ID Naming Convention:**
- Pattern: `post-row-{post_number}`
- Examples: `post-row-1`, `post-row-15`, `post-row-100`
- Post number is stable across cloaking (unlike post ID)

---

## 3. Keyboard Handler Implementation

### 3.1 Core Handler Pseudocode

```javascript
@action
handleSliderKeydown(event) {
  const { key, ctrlKey, metaKey, altKey } = event;

  // Allow Alt+Arrow for browser navigation
  if (altKey) {
    return;
  }

  let handled = false;
  let newPostNumber = this.current;
  const total = this.total;

  switch (key) {
    case 'ArrowUp':
      // Previous post (toward post 1)
      newPostNumber = Math.max(1, this.current - 1);
      handled = true;
      break;

    case 'ArrowDown':
      // Next post (toward post N)
      newPostNumber = Math.min(total, this.current + 1);
      handled = true;
      break;

    case 'ArrowLeft':
      // RTL-aware: In LTR, same as Up. In RTL, same as Down.
      if (this.isRTL) {
        newPostNumber = Math.min(total, this.current + 1);
      } else {
        newPostNumber = Math.max(1, this.current - 1);
      }
      handled = true;
      break;

    case 'ArrowRight':
      // RTL-aware: In LTR, same as Down. In RTL, same as Up.
      if (this.isRTL) {
        newPostNumber = Math.max(1, this.current - 1);
      } else {
        newPostNumber = Math.min(total, this.current + 1);
      }
      handled = true;
      break;

    case 'PageUp':
      // Scroll up one viewport, select post now at bottom
      newPostNumber = this.calculateViewportJump(-1);
      handled = true;
      break;

    case 'PageDown':
      // Scroll down one viewport, select post now at top
      newPostNumber = this.calculateViewportJump(1);
      handled = true;
      break;

    case 'Home':
      // First post
      newPostNumber = 1;
      handled = true;
      break;

    case 'End':
      // Last post
      newPostNumber = total;
      handled = true;
      break;

    case 'Enter':
      // Move focus to the post grid
      this.focusPostInGrid();
      handled = true;
      break;
  }

  if (handled) {
    event.preventDefault();
    event.stopPropagation();

    if (newPostNumber !== this.current && key !== 'Enter') {
      this.navigateToPost(newPostNumber);
    }
  }
}
```

### 3.2 RTL Detection

**Preferred approach using document dir attribute:**
```javascript
get isRTL() {
  return document.documentElement.dir === 'rtl';
}
```

**Alternative using locale service (if available):**
```javascript
@service siteSettings;

get isRTL() {
  // Check if current locale is RTL
  // Discourse stores locale direction in site settings or I18n
  const rtlLocales = ['ar', 'he', 'fa', 'ur'];
  const currentLocale = this.siteSettings.default_locale || 'en';
  return rtlLocales.some(rtl => currentLocale.startsWith(rtl));
}
```

**Recommendation:** Use the document.dir approach as it's the most reliable - Discourse sets this attribute based on the active locale.

### 3.3 Page Up/Down Viewport Calculation

```javascript
/**
 * Calculate the target post number after a viewport jump.
 *
 * @param {number} direction - 1 for down, -1 for up
 * @returns {number} Target post number
 */
calculateViewportJump(direction) {
  const viewportHeight = window.innerHeight;
  const headerHeight = document.querySelector('.d-header')?.offsetHeight || 0;
  const effectiveViewport = viewportHeight - headerHeight;

  // Estimate posts per viewport based on average post height
  // This is an approximation - actual post heights vary
  const averagePostHeight = 150; // pixels, reasonable default
  const postsPerViewport = Math.floor(effectiveViewport / averagePostHeight);

  // Jump by estimated posts per viewport, clamped to valid range
  const jumpAmount = Math.max(5, postsPerViewport); // Minimum 5 posts
  const newPostNumber = this.current + (direction * jumpAmount);

  return Math.max(1, Math.min(this.total, newPostNumber));
}
```

**Alternative approach - use visible posts count:**
```javascript
calculateViewportJump(direction) {
  // Count currently visible posts in the viewport
  const visiblePosts = document.querySelectorAll(
    '.topic-post[role="row"]:not(.post-stream--cloaked)'
  );

  let visibleCount = 0;
  const viewportTop = window.scrollY;
  const viewportBottom = viewportTop + window.innerHeight;

  visiblePosts.forEach(post => {
    const rect = post.getBoundingClientRect();
    const postTop = rect.top + window.scrollY;
    const postBottom = postTop + rect.height;

    // Post is at least partially visible
    if (postBottom > viewportTop && postTop < viewportBottom) {
      visibleCount++;
    }
  });

  const jumpAmount = Math.max(5, visibleCount - 1); // -1 to keep context
  const newPostNumber = this.current + (direction * jumpAmount);

  return Math.max(1, Math.min(this.total, newPostNumber));
}
```

---

## 4. Scroll and Cloaking Considerations

### 4.1 Critical Lesson: State Flags, Not Timing

From `focus-jumping-fix-history.md`, the key lesson is:

**NEVER use setTimeout or timing delays to "fix" race conditions.**

The focus-jumping bug required 11 fix attempts before being resolved. The failed approaches included:
- Timing guards with `NAVIGATION_GUARD_MS = 150`
- `performance.now()` comparisons
- Smooth scroll with 300ms animation windows

**What worked:**
- State flags (`_isNavigating`, `_userHasInteractedWithStream`)
- Boolean guards checked synchronously
- Instant scroll (`behavior: "instant"`)
- Checking actual conditions, not time elapsed

### 4.2 Ensuring Target Post is Loaded

**Problem:** When navigating to a post via the slider, the post may be cloaked (virtualized). We need to ensure the post is loaded and in the DOM before updating `aria-describedby`.

**Solution approach using existing jumpToIndex:**

```javascript
/**
 * Navigate the slider to a specific post.
 * Uses existing jumpToIndex which handles uncloaking.
 *
 * @param {number} postNumber - Target post number
 */
navigateToPost(postNumber) {
  // Set navigation flag BEFORE any action
  this._isSliderNavigating = true;

  // Update internal state
  this.current = postNumber;
  this.percentage = (postNumber - 1) / (this.total - 1);
  this.calculatePosition();

  // Use existing jump mechanism - this triggers scroll and uncloaking
  this.args.jumpToIndex(postNumber);

  // aria-describedby will be updated in postScrolled callback
  // when the post is confirmed visible

  // Clear flag via microtask (same pattern as post-stream-navigation.js)
  queueMicrotask(() => {
    this._isSliderNavigating = false;
  });
}
```

### 4.3 aria-describedby Update Strategy

**DO NOT try to update aria-describedby immediately.** The target post may not be in the DOM yet.

**Instead, update in the postScrolled callback:**

```javascript
@bind
postScrolled(e) {
  // Existing logic
  this.current = e.postIndex;
  this.percentage = e.percent;
  this.calculatePosition();
  this.dockCheck();

  // NEW: Update aria-describedby now that post is confirmed visible
  this.updateDescribedById();
}

updateDescribedById() {
  const postRowId = `post-row-${this.current}`;
  const postRow = document.getElementById(postRowId);

  if (postRow) {
    this.sliderDescribedById = postRowId;
  } else {
    // Post not in DOM (still cloaked) - clear describedby
    // Screen reader will read aria-valuetext instead
    this.sliderDescribedById = null;
  }
}
```

### 4.4 Coordination with Post Stream Cloaking Prevention

The `post-stream-navigation.js` modifier uses `preventCloaking()` to keep focused posts in the DOM. When the slider navigates, we should leverage the same mechanism:

```javascript
import { preventCloaking } from "discourse/modifiers/post-stream-viewport-tracker";

navigateToPost(postNumber) {
  // Get post ID for cloaking prevention
  const postStream = this.args.model.postStream;
  const postIndex = postNumber - 1; // 0-indexed
  const postId = postStream.stream[postIndex];

  if (postId) {
    // Prevent cloaking on target post while we navigate to it
    this._preventedCloakingPostId = postId;
    preventCloaking(postId, true);
  }

  // ... perform navigation ...

  // Clear prevention after navigation completes (via postScrolled)
}
```

**However,** this may be unnecessary since `jumpToIndex` already ensures the post is loaded. Test first without explicit cloaking prevention - only add if needed.

---

## 5. Bidirectional Sync

### 5.1 Slider to Grid Sync

When the slider navigates (via keyboard), the grid's active row should update:

**Option A: Emit appEvent for grid to consume**

```javascript
// In container.gjs
navigateToPost(postNumber) {
  // ... navigation logic ...

  // Emit event for post-stream-navigation to update active row
  this.appEvents.trigger("timeline:navigated-to-post", {
    postNumber: postNumber
  });
}
```

```javascript
// In post-stream-navigation.js constructor
this.appEvents.on("timeline:navigated-to-post", this.onTimelineNavigated);

onTimelineNavigated({ postNumber }) {
  // Only update if not currently navigating via grid
  if (!this._isNavigating) {
    this.activeRowId = String(postNumber);
    this._lastNavigationDirection = 0; // Reset direction
    this.updateTabindices();
  }
}
```

**Option B: Let the scroll event handle it naturally**

The existing flow is:
1. Slider calls `jumpToIndex(postNumber)`
2. Page scrolls to that post
3. `topic:current-post-scrolled` fires
4. Post becomes visible/focused

For the grid, the row would naturally be in view, but its `activeRowId` wouldn't update. Users would need to Tab to re-enter the grid at the new position.

**Recommendation:** Use Option A for tight coordination. The grid should update its internal `activeRowId` when the slider navigates, so that subsequent grid navigation starts from the correct position.

### 5.2 Grid to Slider Sync (Already Exists)

The existing `topic:current-post-scrolled` event already handles this:

```javascript
// In container.gjs
@bind
postScrolled(e) {
  this.current = e.postIndex;  // Updates slider position
  this.percentage = e.percent;
  this.calculatePosition();    // Recalculates UI
}
```

When the user navigates the grid with arrow keys:
1. `post-stream-navigation.js` focuses a new row
2. `scrollRowIntoView(row)` scrolls the page
3. `topic.js` controller detects scroll position change
4. `topic:current-post-scrolled` fires with new postIndex
5. Container updates slider position

**No additional work needed for Grid -> Slider sync.**

### 5.3 Preventing Infinite Loops

**Risk:** Slider navigates -> triggers scroll -> triggers `postScrolled` -> triggers another navigation

**Prevention via state flag:**

```javascript
// In container.gjs
@tracked _isSliderNavigating = false;

@bind
postScrolled(e) {
  // Always update UI state
  this.current = e.postIndex;
  this.percentage = e.percent;
  this.calculatePosition();
  this.dockCheck();
  this.updateDescribedById();

  // If slider initiated the navigation, don't emit grid sync event
  // (the slider already knows where it is)
  // The grid will receive the event from jumpToIndex
}

navigateToPost(postNumber) {
  this._isSliderNavigating = true;
  // ... navigation ...
  queueMicrotask(() => {
    this._isSliderNavigating = false;
  });
}
```

---

## 6. ARIA Implementation Details

### 6.1 Computing aria-valuetext

```javascript
get ariaValueText() {
  const parts = [];

  // Post position
  parts.push(i18n('topic.timeline.post_position', {
    current: this.current,
    total: this.total
  }));

  // Date (if available)
  if (this.date) {
    parts.push(timelineDate(this.date));
  }

  return parts.join(', ');
}
```

**Example output:** "Post 3 of 15, December 2025"

### 6.2 aria-describedby Reference

```javascript
get sliderDescribedById() {
  // Returns ID of current post row, or null if post is cloaked
  const postRowId = `post-row-${this.current}`;
  const postRow = document.getElementById(postRowId);
  return postRow ? postRowId : null;
}
```

**In template:**
```handlebars
<Scroller
  ...
  @describedById={{this.sliderDescribedById}}
/>
```

**In scroller:**
```handlebars
aria-describedby={{if @describedById @describedById}}
```

**Behavior when post is cloaked:**
- `aria-describedby` is not set (attribute omitted)
- Screen reader reads `aria-valuetext` instead
- When post loads (after scroll), `aria-describedby` is set

### 6.3 Post Row ID Naming Convention

| Element | ID Format | Example |
|---------|-----------|---------|
| Post row | `post-row-{post_number}` | `post-row-1`, `post-row-42` |
| Header row | `topic-header-row` | `topic-header-row` |

**Why post_number, not post_id?**
- `post_number` is sequential and stable within a topic
- `post_id` is a database ID that users never see
- Slider uses `current` which maps to post_number
- Easier debugging ("post-row-5" is clearly post 5)

---

## 7. Event Coordination

### 7.1 Existing appEvents Used

| Event | Emitter | Consumer | Purpose |
|-------|---------|----------|---------|
| `topic:current-post-scrolled` | topic.js controller | container.gjs | Update slider when page scrolls |
| `composer:opened/resized/closed` | composer | container.gjs | Recalculate scroll area height |

### 7.2 New Event: `timeline:navigated-to-post`

**Emitter:** `container.gjs` (when slider keyboard navigation occurs)

**Consumers:**
- `post-stream-navigation.js` - Update grid's activeRowId

**Payload:**
```javascript
{
  postNumber: number,  // Target post number
  source: 'slider'     // Origin of navigation (for debugging)
}
```

**Emission:**
```javascript
// In container.gjs navigateToPost()
this.appEvents.trigger("timeline:navigated-to-post", {
  postNumber: postNumber,
  source: 'slider'
});
```

**Consumption:**
```javascript
// In post-stream-navigation.js
this.appEvents.on("timeline:navigated-to-post", this.onTimelineNavigated);

@bind
onTimelineNavigated({ postNumber }) {
  if (!this._isNavigating) {
    this.activeRowId = String(postNumber);
    this._lastNavigationDirection = 0;
    // Don't update tabindices - we're not focusing the grid
    // Just updating internal state for when user Tabs back in
  }
}
```

### 7.3 Sequence Diagram: Slider Arrow Down

```
User presses Arrow Down on slider
         |
         v
handleSliderKeydown(event)
         |
         v
navigateToPost(currentPost + 1)
    |    |    |
    |    |    +-> this._isSliderNavigating = true
    |    |
    |    +-> this.args.jumpToIndex(newPostNumber)
    |              |
    |              v
    |         topic-navigation.jumpToIndex()
    |              |
    |              v
    |         Page scrolls to post
    |              |
    |              v
    |         topic.js currentPostScrolled()
    |              |
    |              v
    |         appEvents.trigger("topic:current-post-scrolled")
    |              |
    |              v
    |         container.postScrolled(e)
    |              |
    |              +-> this.current = e.postIndex
    |              +-> this.calculatePosition()
    |              +-> this.updateDescribedById()
    |
    +-> appEvents.trigger("timeline:navigated-to-post")
              |
              v
         post-stream-navigation.onTimelineNavigated()
              |
              v
         this.activeRowId = postNumber (no focus change)
```

---

## 8. Edge Cases

### 8.1 First/Last Post Boundaries

**At first post (post 1):**
- Arrow Up: No-op (already at minimum)
- Home: No-op (already at first)
- PageUp: No-op (already at first)

**At last post:**
- Arrow Down: No-op (already at maximum)
- End: No-op (already at last)
- PageDown: No-op (already at last)

**Implementation:**
```javascript
case 'ArrowUp':
  newPostNumber = Math.max(1, this.current - 1);
  // If already at 1, newPostNumber === this.current, no navigation occurs
  break;
```

### 8.2 During Post Loading

**Scenario:** User navigates to a post that is not yet loaded (far from current viewport).

**Behavior:**
1. `jumpToIndex` triggers post stream to load that post
2. Page scrolls (possibly with loading indicator)
3. Once post is loaded and in DOM, `postScrolled` fires
4. `updateDescribedById()` finds the post row
5. `aria-describedby` is set

**Edge case:** Very slow loading

- While loading, `aria-describedby` remains null
- Screen reader reads `aria-valuetext` only
- User can continue navigating (each key press updates target)
- Eventually, correct post loads and aria-describedby updates

### 8.3 Cloaked Posts

**When target post is cloaked:**
1. `jumpToIndex` triggers uncloaking
2. Post loads into DOM
3. `aria-describedby` updates

**While waiting for uncloaking:**
- Don't set `aria-describedby` to a non-existent ID
- Leave it null so screen reader uses `aria-valuetext`

```javascript
updateDescribedById() {
  const postRowId = `post-row-${this.current}`;
  const postRow = document.getElementById(postRowId);

  // Only set if element actually exists in DOM
  this.sliderDescribedById = postRow ? postRowId : null;
}
```

### 8.4 Rapid Key Presses

**Scenario:** User holds down Arrow Down

**Handling:**
- Each keydown triggers navigation
- `jumpToIndex` may be called rapidly
- Discourse's scroll handling is debounced (50ms in `updateScrollPosition`)
- Final position will be correct
- Intermediate posts may be skipped visually (OK for this use case)

**No special handling needed** - existing debouncing handles this.

### 8.5 Slider Hidden (Mobile/Small Viewport)

The timeline slider is not displayed on mobile views (`this.site.mobileView`). On mobile, users use the simpler `topic-progress` component instead.

**Check in container.gjs:**
```javascript
get displayTimeLineScrollArea() {
  if (this.site.mobileView) {
    return true; // Shows simplified version
  }
  // ... rest of logic
}
```

**Keyboard navigation should still work** when the slider is visible, regardless of viewport size.

---

## 9. Testing Strategy

### 9.1 Unit Test Considerations

**Keyboard handler tests (`container-test.js`):**

```javascript
module("Unit | Component | topic-timeline/container", function(hooks) {

  test("Arrow Down increases post number", async function(assert) {
    // Setup component with current=5, total=20
    // Trigger keydown ArrowDown
    // Assert current === 6
  });

  test("Arrow Up at first post stays at 1", async function(assert) {
    // Setup component with current=1, total=20
    // Trigger keydown ArrowUp
    // Assert current === 1 (no change)
  });

  test("RTL: Arrow Left moves to next post", async function(assert) {
    // Set document.documentElement.dir = 'rtl'
    // Setup component with current=5
    // Trigger keydown ArrowLeft
    // Assert current === 6 (next, not previous)
  });

  test("Home navigates to first post", async function(assert) {
    // Setup with current=10
    // Trigger keydown Home
    // Assert current === 1
  });

  test("Page Down jumps by viewport estimate", async function(assert) {
    // Setup with current=5, total=100
    // Mock window.innerHeight for consistent calculation
    // Trigger keydown PageDown
    // Assert current > 5 and current <= 100
  });

});
```

### 9.2 Integration Test Scenarios

**Test file:** `spec/system/accessibility/timeline_slider_spec.rb`

```ruby
describe "Timeline slider accessibility", type: :system do
  fab!(:topic) { Fabricate(:topic) }
  fab!(:posts) { Fabricate.times(20, :post, topic: topic) }

  it "can be focused with Tab key" do
    visit("/t/#{topic.slug}/#{topic.id}")

    # Tab through page elements until slider is focused
    find('.timeline-scroller').send_keys(:tab)
    expect(page).to have_css('.timeline-scroller:focus')
  end

  it "navigates with arrow keys" do
    visit("/t/#{topic.slug}/#{topic.id}")

    find('.timeline-scroller').send_keys(:tab)
    expect(find('.timeline-scroller')['aria-valuenow']).to eq('1')

    find('.timeline-scroller').send_keys(:arrow_down)
    expect(find('.timeline-scroller')['aria-valuenow']).to eq('2')
  end

  it "Enter moves focus to post grid" do
    visit("/t/#{topic.slug}/#{topic.id}")

    find('.timeline-scroller').send_keys(:tab)
    find('.timeline-scroller').send_keys(:arrow_down, :arrow_down)
    find('.timeline-scroller').send_keys(:enter)

    # Focus should now be on post row 3
    expect(page).to have_css('#post-row-3:focus')
  end

end
```

### 9.3 Manual Testing Checklist

**Keyboard Navigation:**
- [ ] Tab to slider - focus indicator visible
- [ ] Arrow Down - moves to next post, page scrolls
- [ ] Arrow Up - moves to previous post
- [ ] Arrow Down at last post - no change (boundary)
- [ ] Arrow Up at first post - no change (boundary)
- [ ] Home - jumps to first post
- [ ] End - jumps to last post
- [ ] Page Down - jumps approximately one viewport
- [ ] Page Up - jumps back one viewport
- [ ] Enter - focus moves to post row in grid

**RTL Testing:**
- [ ] Switch to Arabic/Hebrew locale
- [ ] Arrow Left = next post (not previous)
- [ ] Arrow Right = previous post (not next)
- [ ] Up/Down unchanged

**Screen Reader Testing (NVDA):**
- [ ] Focus slider - announces "Topic timeline, slider, Post 1 of 15, December 2025"
- [ ] Arrow Down - announces "Post 2 of 15, December 2025"
- [ ] Post content readable via aria-describedby (if post in DOM)
- [ ] When post cloaked - reads aria-valuetext only, no error

**Grid Sync Testing:**
- [ ] Navigate slider to post 5
- [ ] Press Enter to focus grid
- [ ] Arrow Down in grid - moves to post 6 (not post 2)
- [ ] Navigate grid to post 10
- [ ] Slider shows "Post 10 of N"

---

## 10. Implementation Phases

### Phase 1: Basic ARIA Attributes (Low Risk)

1. Add `role="slider"` and static ARIA attributes to scroller
2. Add `tabindex="0"` for focusability
3. Add `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
4. Add `aria-orientation="vertical"`
5. Add `aria-label` with i18n string
6. Add basic CSS focus styles

**Files:** `scroller.gjs`, `container.gjs`, `client.en.yml`

**Testing:** Tab to slider, verify ARIA attributes in DevTools

### Phase 2: Keyboard Navigation (Medium Risk)

1. Add `handleSliderKeydown` to container
2. Wire up to scroller via `@onKeydown`
3. Implement Arrow Up/Down
4. Implement Home/End
5. Implement Page Up/Down with viewport calculation

**Files:** `container.gjs`, `scroller.gjs`

**Testing:** Full keyboard navigation works

### Phase 3: RTL Support (Low Risk)

1. Add `isRTL` getter
2. Modify Arrow Left/Right handling

**Files:** `container.gjs`

**Testing:** Test with Arabic locale

### Phase 4: aria-valuetext and aria-describedby (Medium Risk)

1. Add `ariaValueText` computed property
2. Add post row IDs to `post.gjs`
3. Add `updateDescribedById` method
4. Update in `postScrolled` callback

**Files:** `container.gjs`, `scroller.gjs`, `post.gjs`

**Testing:** Screen reader announces proper text

### Phase 5: Bidirectional Sync (Higher Risk)

1. Add `timeline:navigated-to-post` event
2. Add listener in `post-stream-navigation.js`
3. Implement Enter key to focus post grid
4. Test for infinite loops

**Files:** `container.gjs`, `post-stream-navigation.js`

**Testing:** Full integration test suite

### Phase 6: Polish and Edge Cases

1. Handle loading states
2. Handle cloaked post edge cases
3. Final screen reader testing
4. Performance profiling

---

## 11. References

### Project Documentation
- [End-User Design: 14-timeline-slider.md](14-timeline-slider.md)
- [Post Stream Grid: 04-topic-thread.md](04-topic-thread.md)
- [Focus Jumping Fix History: ../bugs/focus-jumping-fix-history.md](../bugs/focus-jumping-fix-history.md)
- [CLAUDE.md Anti-Patterns Section](../../CLAUDE.md)

### Source Files
- `frontend/discourse/app/components/topic-timeline/container.gjs` (lines 1-689)
- `frontend/discourse/app/components/topic-timeline/scroller.gjs` (lines 1-71)
- `frontend/discourse/app/components/post.gjs` (lines 1-816)
- `frontend/discourse/app/modifiers/post-stream-navigation.js` (lines 1-1359)
- `frontend/discourse/app/modifiers/draggable.js` (lines 1-92)
- `frontend/discourse/app/lib/keyboard-navigation-utils.js` (lines 1-143)

### WAI-ARIA Specifications
- [WAI-ARIA Slider Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/)
- [WAI-ARIA Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)

### Key Lessons from Focus-Jumping Bug

1. **NEVER use timing delays** to fix race conditions
2. Use **state flags** (`_isNavigating`) cleared via `queueMicrotask()`
3. Use **instant scroll** (`behavior: "instant"`) to avoid animation race conditions
4. **Check actual conditions** (post in DOM?), not time elapsed
5. Multiple navigation regions must **coordinate** to avoid stealing focus
6. **Call stacks** (`new Error().stack`) are invaluable for debugging focus issues

---

## Appendix A: i18n Strings

Add to `config/locales/client.en.yml`:

```yaml
en:
  js:
    topic:
      timeline:
        slider_label: "Topic timeline"
        post_position: "Post %{current} of %{total}"
        post_position_with_date: "Post %{current} of %{total}, %{date}"
```

---

## Appendix B: CSS Focus Styles

Add to relevant stylesheet:

```scss
.timeline-scroller {
  // Existing styles...

  &:focus {
    outline: 2px solid var(--tertiary);
    outline-offset: 2px;
  }

  &:focus:not(:focus-visible) {
    outline: none; // Hide for mouse users
  }

  &:focus-visible {
    outline: 2px solid var(--tertiary);
    outline-offset: 2px;
  }
}
```
