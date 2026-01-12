# Accessibility Backlog

This document tracks pending accessibility improvements for Discourse.

---

## In Progress

### Focus History Restoration on Browser Back/Forward
**Status:** In Progress - Documented, Ready to Implement
**Priority:** High
**GitHub Issue:** [#5](https://github.com/Electro-Jam-Instruments/discourse/issues/5)
**Documentation:** [12-focus-history-restoration.md](12-focus-history-restoration.md)

**Problem:** When keyboard users navigate away from a page and return via browser back/forward (Alt+Left/Right), focus is lost. Users must tab through the entire page to find their previous position.

**Solution:**
- Track keyboard vs mouse mode globally (keydown sets keyboard mode, mousedown clears it)
- Save focused element selector before navigation
- Restore focus after back/forward navigation (only in keyboard mode)
- Use Navigation API with popstate fallback for browser compatibility

**Files to Create:**
- `frontend/discourse/app/services/focus-history.js`
- `frontend/discourse/app/instance-initializers/focus-history-tracking.js`

---

## Task List

### 1. Sidebar Navigation - Tree Pattern
**Status:** Completed (2026-01-11)
**Priority:** High
**Commit:** `694187b6fd`
**Documentation:** [09-sidebar-navigation.md](09-sidebar-navigation.md)

~~**Problem:** The sidebar menu (Topics, More, Categories section) is not structured as a proper list.~~

**Implemented:** WAI-ARIA tree pattern with single tab stop, arrow key navigation, expand/collapse support.

---

### 2. Topic Header Row for Post Grid
**Status:** Completed (2026-01-12)
**Priority:** High
**GitHub Issue:** [#6](https://github.com/Electro-Jam-Instruments/discourse/issues/6)

~~**Problem:** The topic title/metadata at the top of post threads is not part of the grid navigation. Users can't arrow up to it from the first post. This adds extra tabbing to reach the topic title and category.~~

**Implemented:**
- Added topic header as the first row in the post stream grid (aria-rowindex="1")
- Arrow Up from first post focuses the header row
- Left/Right navigation for category link and tag links
- Screen reader announces: "Topic: [title], Category: [category], [tag count] tags"

**Files Created/Modified:**
- `frontend/discourse/app/components/post-stream/header-row.gjs` (NEW)
- `frontend/discourse/app/components/post-stream.gjs` (MODIFIED - includes header row, adjusted aria-rowcount)
- `frontend/discourse/app/components/post.gjs` (MODIFIED - adjusted aria-rowindex to +1)
- `frontend/discourse/app/modifiers/post-stream-navigation.js` (MODIFIED - recognizes header row)
- `app/assets/stylesheets/common/base/topic-post.scss` (MODIFIED - focus styles)
- `config/locales/client.en.yml` (MODIFIED - i18n strings)

---

### 3. Timeline Slider Accessibility
**Status:** Pending
**Priority:** Medium
**GitHub Issue:** [#7](https://github.com/Electro-Jam-Instruments/discourse/issues/7)

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
**GitHub Issue:** [#8](https://github.com/Electro-Jam-Instruments/discourse/issues/8)

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
**GitHub Issue:** [#9](https://github.com/Electro-Jam-Instruments/discourse/issues/9)

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
**GitHub Issue:** [#10](https://github.com/Electro-Jam-Instruments/discourse/issues/10)

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

### 8. Auto-Focus Oldest Unread Post on Topic Load
**Status:** Pending
**Priority:** High
**GitHub Issue:** [#11](https://github.com/Electro-Jam-Instruments/discourse/issues/11)

**Problem:** When entering a topic, focus doesn't automatically go to the oldest unread post. Users must navigate manually to find where they left off.

**Solution:**
- On topic page load, detect the user's last read position
- Automatically focus the oldest unread post row
- If all posts are read, focus the first post
- Announce the post position (e.g., "Post 3 of 10, unread")

**UI Location:** Topic thread page, post stream

---

### 9. Post Read Status Announcement
**Status:** Pending
**Priority:** Medium
**GitHub Issue:** [#12](https://github.com/Electro-Jam-Instruments/discourse/issues/12)

**Problem:** Screen reader users can't easily tell which posts they've already read vs new/unread posts.

**Solution:**
- Add "new" or "unread" status to post row aria-label when applicable
- Example: "Post 3 by Otto_Tester, 2 hours ago, unread"
- Only announce for posts the user hasn't seen before

**UI Location:** Post rows in topic thread

---

### 10. Ctrl+Enter Content Cell Scope
**Status:** Pending
**Priority:** Low
**GitHub Issue:** [#13](https://github.com/Electro-Jam-Instruments/discourse/issues/13)

**Problem:** When pressing Ctrl+Enter to read post content, the content cell includes extra elements beyond just the post text (buttons, metadata, etc.).

**Solution:**
- Ensure Ctrl+Enter only focuses the base text content of the post
- Exclude action buttons, timestamps, and other metadata from the content cell
- Content cell should contain only the authored message text

**UI Location:** Post content cell in topic thread

---

## Recently Completed

### Topic Header Row for Post Grid
**Status:** Completed (2026-01-12)
**GitHub Issue:** [#6](https://github.com/Electro-Jam-Instruments/discourse/issues/6)

Added topic header (title, category, tags) as the first row in the post stream grid. Keyboard users can now Arrow Up from the first post to reach the topic metadata.

---

### Navigation Controls Toolbar
**Status:** Completed (2026-01-11)
**Commit:** `7b706ba416`
**Documentation:** [10-navigation-controls-toolbar.md](10-navigation-controls-toolbar.md)

Converted Dismiss/New Topic buttons area into a proper toolbar with arrow key navigation.

---

### Filter Focus Management
**Status:** Completed (2026-01-11)
**Commit:** `cc69f8d202`
**Documentation:** [11-filter-focus-management.md](11-filter-focus-management.md)

When users activate filter tabs (Latest, New, Hot) via keyboard, focus now moves to the first topic row instead of staying on the tab.

---

## Completed Tasks

- Topic Header Row for Post Grid - Arrow navigation to topic title/category/tags (2026-01-12)
- Filter Focus Management - Focus first topic after keyboard filter selection (2026-01-11)
- Navigation Controls Toolbar - Arrow key navigation for Dismiss/New Topic buttons (2026-01-11)
- Sidebar Tree Navigation - WAI-ARIA tree pattern with single tab stop (2026-01-11)
- Phase 1: 2-Cell Grid Pattern for Posts (2026-01-02)
- Phase 1.1: Fix NVDA Arrow Navigation (2026-01-04)
- Phase 1.2: Simplified Navigation - Skip Content in Arrow Flow (2026-01-04)

## References

- [WAI-ARIA Menu Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menu/)
- [WAI-ARIA Listbox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/)
- [WAI-ARIA Slider Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/)
- [WAI-ARIA Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)
