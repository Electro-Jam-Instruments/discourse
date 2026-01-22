# Topic View Accessibility TODO

**Created:** 2026-01-17
**Status:** Planning

---

## Issues to Address

### 1. Redundant Topic Headers - Consolidate Edit Button
**Priority:** High
**Location:** Post stream topic header

**Problem:** Two nearly identical headers appear at the top of topic view:
- First header: Title + category/tags (no edit button)
- Second header (in grid): Title + category/tags + edit button + date

**Goal:** Fold the edit button into the first header row to eliminate redundancy.

**Investigation needed:**
- [ ] Check what other actions can appear in the header row (besides edit button)
- [ ] Identify all possible header actions so they can all be consolidated
- [ ] Determine if this is the topic-header-row component or a separate element

---

### 2. Alt+Back Arrow Not Working in Post Grid
**Priority:** High
**Location:** Post stream grid navigation

**Problem:** When focus is on a post row in the grid, Alt+Back Arrow (browser back) does not work. User cannot navigate back to topic list.

**Investigation needed:**
- [ ] Check if grid-navigation.js or post-stream-navigation.js is capturing Alt key
- [ ] Verify if keydown handler is preventing default on Alt+Arrow combinations
- [ ] Test if this affects other browser shortcuts

---

### 3. Topic Footer Buttons Need Toolbar
**Priority:** Medium
**Location:** Bottom of topic view (Share, Bookmark, Flag, Reply buttons)

**Problem:** The buttons (wrench, Share, Bookmark, Flag, Reply) are not in a toolbar pattern. They should be a single tab stop with arrow key navigation.

**Goal:** Wrap these buttons in `role="toolbar"` with proper label like "Topic actions".

**Buttons to include:**
- Wrench icon (admin/mod tools)
- Share
- Bookmark
- Flag
- Reply

---

### 4. Wrench Icon Has No Accessible Name
**Priority:** High
**Location:** Topic footer, also appears in topic header row

**Problem:** The wrench icon button has no accessible name. Screen readers announce nothing useful.

**Fix needed:**
- [ ] Add `aria-label="Topic admin actions"` or similar
- [ ] Ensure icon has proper title/alt text

---

### 5. Popup Menus Are All Tab Stops
**Priority:** Medium
**Location:** All popup menus (wrench menu, etc.)

**Problem:** Popup menu items are individual tab stops instead of a single menu with arrow key navigation.

**Goal:** Implement WAI-ARIA menu pattern:
- Menu container with `role="menu"`
- Menu items with `role="menuitem"`
- Single tab stop with arrow key navigation
- Escape to close

**Investigation needed:**
- [ ] Find where popup menus are created (FloatKit? DMenu?)
- [ ] Determine if there's a central component to fix all menus at once

---

### 6. Post Row Actions Need Toolbar
**Priority:** Medium
**Location:** Reply/notification buttons at bottom-right of each post row

**Problem:** The reply and notification bell buttons are separate tab stops.

**Goal:** Wrap in `role="toolbar"` with label like "Post actions".

---

### 7. Sidebar Footer Buttons
**Priority:** Low
**Location:** Bottom of admin/chat sidebar

**Problem:** Two buttons at sidebar bottom:
- Add new section (+)
- Keyboard shortcuts

**Investigation needed:**
- [ ] Check if these have accessible names
- [ ] Determine if they should be in a toolbar
- [ ] Verify keyboard access

---

## Files to Investigate

- `frontend/discourse/app/components/topic-footer-buttons.gjs` - Footer buttons
- `frontend/discourse/app/components/post-stream/header-row.gjs` - Topic header in grid
- `frontend/discourse/app/components/d-menu.gjs` - Popup menus
- `frontend/discourse/app/modifiers/post-stream-navigation.js` - Grid keyboard handling
- `frontend/discourse/app/components/sidebar-footer.gjs` - Sidebar buttons

---

## Related Issues

- Issue #11 - Auto-focus first unread post (PARTIAL)
- Issue #21 - Login error re-announcement (FAIL)
