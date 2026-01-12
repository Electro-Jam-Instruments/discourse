# Accessibility Backlog

This document tracks pending accessibility improvements for Discourse.

## Task List

### 1. Sidebar Navigation - List Pattern
**Status:** Pending
**Priority:** High

**Problem:** The sidebar menu (Topics, More, Categories section) is not structured as a proper list.

**Solution:**
- Add `role="list"` to the container
- Add `role="listitem"` to each menu item
- If items can be "selected", add `aria-selected="true"` to the current selection
- Consider if `role="menu"` with `role="menuitem"` is more appropriate (discuss)

**UI Location:** Left sidebar with Topics, More, Categories (General, Site Feedback, All categories)

---

### 2. Topic Header Row for Post Grid
**Status:** Pending
**Priority:** High

**Problem:** The topic title/metadata at the top of post threads is not part of the grid navigation. Users can't arrow up to it from the first post.

**Solution:**
- Add topic header as the first row in the post stream grid
- Arrow Up from first post should focus the header row
- Left/Right navigation for interactive elements in header (category link, tags, etc.)
- Should follow same pattern as post rows

**UI Location:** Topic title area showing "Phase 6 Test After Fix - 17:21:28" with category/tags below

---

### 3. Timeline Slider Accessibility
**Status:** Pending
**Priority:** Medium

**Problem:** The timeline slider on the right side of topics has odd tab order and may not work well with keyboard/screen readers.

**Solution:**
- Implement as `role="slider"` with proper ARIA attributes
- `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext`
- Keyboard support: Arrow Up/Down to move through posts
- Ensure it's after the post grid in tab order
- Screen reader should announce position (e.g., "Post 1 of 3, December 2025")

**UI Location:** Right side vertical timeline showing dates and post position (1/3)

---

### 4. Signup Prompt Card Pattern
**Status:** Pending
**Priority:** Medium

**Problem:** The "Hello! Looks like you're enjoying the discussion" signup prompt doesn't announce all content when tabbed to.

**Solution:**
- Implement as a card/region that takes focus as a unit
- Add `role="region"` or `role="dialog"` with `aria-label`
- When focused, screen reader should announce the full message
- Left/Right or Tab to navigate to Sign Up, Maybe later, no thanks buttons
- Consider `aria-describedby` pointing to the message content

**UI Location:** Blue card appearing at bottom of topic for non-logged-in users

---

### 5. Header Toolbar - Single Tab Stop
**Status:** Pending
**Priority:** High

**Problem:** The main header (logo, Sign Up, Log In, Search) has multiple tab stops instead of being a single toolbar.

**Solution:**
- Wrap in `role="toolbar"` with `aria-label="Site navigation"`
- Single tab stop with Left/Right arrow navigation
- Include: Logo (home link), Sign Up, Log In, Search button
- Roving tabindex pattern

**UI Location:** Top header bar with Discourse logo on left, Sign Up/Log In/Search on right

---

### 6. Default Focus on Page Load
**Status:** Pending
**Priority:** High

**Problem:** When loading topic list or post stream pages, focus doesn't automatically move to the main content area. Screen reader users have to tab through header/sidebar to reach the list.

**Solution:**
- On page load, automatically focus the first row of the topic list grid
- On topic page load, focus the first post row in the post stream
- Ensure focus is visible (focus outline shows)
- Announce the focused element to screen readers
- Consider skip link as alternative/complement

**UI Location:** Topic list pages and topic thread pages

---

### 7. Dismiss New Button Focus Management
**Status:** Needs Research
**Priority:** Medium
**GitHub Issue:** [#4](https://github.com/Electro-Jam-Instruments/discourse/issues/4)

**Problem:** When a user activates the "Dismiss New" button to dismiss new topics, it's unclear where focus should move after the operation completes.

**Questions to Research:**
1. After dismissing topics, should focus move to:
   - The first remaining topic in the list?
   - An empty state message (if no topics remain)?
   - Stay on the Dismiss button (if it remains visible)?
   - Move to another element?

2. What happens to the Dismiss button itself after activation?
   - Does it disappear?
   - Does it become disabled?
   - Does it remain active?

3. What is the expected user workflow after dismissing topics?

**Context:** This is part of ongoing accessibility work to improve keyboard navigation and screen reader support. Related to focus management improvements for topic filter selection.

**Acceptance Criteria:**
- [ ] Document current behavior of Dismiss New button
- [ ] Research WAI-ARIA best practices for this pattern
- [ ] Propose focus management strategy
- [ ] Implement the chosen approach

**UI Location:** Topic actions toolbar when viewing New filter with new topics

---

## Completed Tasks

- Phase 1: 2-Cell Grid Pattern for Posts (2026-01-02)
- Phase 1.1: Fix NVDA Arrow Navigation (2026-01-04)
- Phase 1.2: Simplified Navigation - Skip Content in Arrow Flow (2026-01-04)

## References

- [WAI-ARIA Menu Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menu/)
- [WAI-ARIA Listbox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/)
- [WAI-ARIA Slider Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/)
- [WAI-ARIA Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)
