# 3-Cell Post Structure Implementation Plan

## Executive Summary

This document details the implementation plan for restructuring the post component from a 2-cell to a 3-cell grid structure to fix NVDA screen reader compatibility issues. The key insight is that NVDA in application mode does not announce `aria-label` on gridcells containing interactive elements (buttons, links in toolbar).

**Goal:** Separate content from toolbar so NVDA can read the content cell's aria-label.

---

## 1. Current DOM Structure Analysis

### Current 2-Cell Structure (post.gjs lines 624-803)

```
<div role="row" class="topic-post">                    <!-- Row -->
  <PostAvatar role="gridcell">...</PostAvatar>         <!-- Cell 0: Avatar -->
  <div class="post__body topic-body" role="gridcell">  <!-- Cell 1: Body + Toolbar -->
    <PostMetaData>...</PostMetaData>
    <div class="post__regular post__contents">
      <PostCookedHtml>...</PostCookedHtml>             <!-- Content here -->
      <section class="post__menu-area">
        <PostMenu>                                     <!-- Toolbar INSIDE gridcell -->
          <nav class="post-controls">
            <div class="actions" role="toolbar">      <!-- Buttons here -->
            </div>
          </nav>
        </PostMenu>
      </section>
      <section class="post__embedded-posts">...</section>
    </div>
    <section class="post-actions">...</section>
    <PostLinks>...</PostLinks>
  </div>
</div>
```

### Problem

NVDA in application mode ignores `aria-label` on Cell 1 because it contains interactive elements (toolbar buttons). The screen reader enters the container looking for focusable items but never announces the cell label.

---

## 2. Proposed 3-Cell Structure

```
<div role="row" class="topic-post">                    <!-- Row -->
  <PostAvatar role="gridcell">...</PostAvatar>         <!-- Cell 0: Avatar -->
  <div class="post__body topic-body" role="gridcell">  <!-- Cell 1: Content ONLY -->
    <PostMetaData>...</PostMetaData>
    <div class="post__regular post__contents">
      <PostCookedHtml>...</PostCookedHtml>
      <!-- NO toolbar here - moved to Cell 2 -->
      <section class="post__embedded-posts">...</section>
    </div>
    <section class="post-actions">...</section>
    <PostLinks>...</PostLinks>
  </div>
  <div class="post__actions-cell" role="gridcell">     <!-- Cell 2: Actions (NEW) -->
    <section class="post__menu-area post-menu-area clearfix">
      <PostMenu>
        <nav class="post-controls">
          <div class="actions" role="toolbar">
          </div>
        </nav>
      </PostMenu>
    </section>
  </div>
</div>
```

---

## 3. Template Changes (post.gjs)

### Location: Lines 624-803 in post.gjs

**Before (current structure):**
```gjs
<div class="post__row row">
  <PostAvatar
    role="gridcell"
    tabindex="-1"
    aria-label={{i18n "post.sr_avatar_cell" username=@post.username}}
    @post={{@post}}
    @decoratorState={{this.decoratorState}}
    @keyboardSelected={{@keyboardSelected}}
  />
  <div
    class="post__body topic-body clearfix"
    role="gridcell"
    tabindex="-1"
    aria-label={{this.postContentLabel}}
  >
    <!-- ... metadata, content, TOOLBAR, embedded posts, actions, links ... -->
  </div>
</div>
```

**After (3-cell structure):**
```gjs
<div class="post__row row">
  <PostAvatar
    role="gridcell"
    tabindex="-1"
    aria-label={{i18n "post.sr_avatar_cell" username=@post.username}}
    @post={{@post}}
    @decoratorState={{this.decoratorState}}
    @keyboardSelected={{@keyboardSelected}}
  />
  <div
    class="post__body topic-body clearfix"
    role="gridcell"
    tabindex="-1"
    aria-label={{this.postContentLabel}}
  >
    <PluginOutlet @name="post-metadata" @outletArgs={{postOutletArgs}}>
      <PostMetaData ... />
    </PluginOutlet>
    <div class={{concatClass "post__regular regular" "post__contents contents" ...}}>
      <PluginOutlet @name="post-content-cooked-html" @outletArgs={{postOutletArgs}}>
        <PostCookedHtml ... />
      </PluginOutlet>

      {{#if @post.requestedGroupName}}
        <div class="post__group-request group-request">...</div>
      {{/if}}

      {{#if (and @post.cooked_hidden @post.can_see_hidden_post)}}
        <a class="post__expand-hidden expand-hidden" {{on "click" @expandHidden}}>...</a>
      {{/if}}

      {{#if (and (not this.expandedFirstPost.isResolved) @post.expandablePost)}}
        <DButton class="post__expand-button expand-post" ... />
      {{/if}}

      {{! MOVE TOOLBAR TO CELL 2 - Remove from here }}

      {{#if this.repliesBelow}}
        <section class="post__embedded-posts post__embedded-posts--bottom embedded-posts bottom">
          ...
        </section>
      {{/if}}
    </div>

    <section class="post__actions post-actions">
      <PostActionsSummary @post={{@post}} />
    </section>
    <PluginOutlet @name="post-links" @outletArgs={{postOutletArgs}}>
      <PostLinks @post={{@post}} />
    </PluginOutlet>
  </div>
  {{! NEW CELL 2: Actions Toolbar }}
  <div
    class="post__actions-cell"
    role="gridcell"
    tabindex="-1"
    aria-label={{i18n "post.sr_actions_cell"}}
  >
    <section class="post__menu-area post-menu-area clearfix">
      <PostMenu
        @post={{@post}}
        @prevPost={{@prevPost}}
        @nextPost={{@nextPost}}
        @canCreatePost={{@canCreatePost}}
        @changeNotice={{@changeNotice}}
        @changePostOwner={{@changePostOwner}}
        @copyLink={{this.copyLink}}
        @deletePost={{@deletePost}}
        @editPost={{@editPost}}
        @filteredRepliesView={{this.filteredRepliesView}}
        @grantBadge={{@grantBadge}}
        @lockPost={{@lockPost}}
        @permanentlyDeletePost={{@permanentlyDeletePost}}
        @rebakePost={{@rebakePost}}
        @recoverPost={{@recoverPost}}
        @repliesShown={{this.repliesShown}}
        @repliesButtonDisabled={{this.isTogglingReplies}}
        @replyToPost={{@replyToPost}}
        @share={{this.share}}
        @showFlags={{@showFlags}}
        @showLogin={{@showLogin}}
        @showPagePublish={{@showPagePublish}}
        @showReadIndicator={{@showReadIndicator}}
        @toggleLike={{this.toggleLike}}
        @togglePostType={{@togglePostType}}
        @toggleReplies={{this.toggleReplies}}
        @toggleWiki={{@toggleWiki}}
        @unhidePost={{@unhidePost}}
        @unlockPost={{@unlockPost}}
      />
    </section>
  </div>
</div>
```

### New i18n Key Required

Add to `config/locales/client.en.yml`:
```yaml
post:
  sr_actions_cell: "Post actions"
```

---

## 4. CSS Changes Required

### File: `app/assets/stylesheets/common/base/topic-post.scss`

Add focus styles for the new cell:

```scss
// Focus styles for actions gridcell (new 3rd cell)
.post__actions-cell[role="gridcell"] {
  &:focus {
    outline: var(--d-grid-focus-outline-width) solid
      var(--d-grid-focus-outline-color);
    outline-offset: var(--d-grid-focus-outline-offset);
  }

  &:focus-visible {
    outline: var(--d-grid-focus-outline-width) solid
      var(--d-grid-focus-outline-color);
    outline-offset: var(--d-grid-focus-outline-offset);
  }
}
```

### File: `app/assets/stylesheets/desktop/topic-post.scss`

Adjust the row layout for 3 cells:

```scss
.onscreen-post .row {
  display: flex;
  // Existing flex display handles this

  .post__actions-cell {
    // Position the actions cell
    // This cell should collapse to content width
    flex: 0 0 auto;
    align-self: flex-end; // Align to bottom of row
    padding-bottom: var(--space-3);
  }
}

// Remove padding-left from post-menu-area since it's no longer nested
section.post-menu-area {
  position: relative;
  // Remove: padding-left: var(--topic-body-width-padding);
  // The new cell will handle positioning
}
```

### Alternative CSS Approach (Preserve Visual Layout)

To maintain the current visual appearance where the toolbar appears at the bottom of the content area, we may need CSS Grid or absolute positioning:

```scss
.onscreen-post .row {
  display: grid;
  grid-template-columns: var(--topic-avatar-width) 1fr auto;
  grid-template-rows: auto;
}

.topic-avatar[role="gridcell"] {
  grid-column: 1;
  grid-row: 1;
}

.post__body[role="gridcell"] {
  grid-column: 2;
  grid-row: 1;
}

.post__actions-cell[role="gridcell"] {
  grid-column: 2; // Same column as body
  grid-row: 1;
  align-self: end; // At bottom
  justify-self: start; // Left aligned
  z-index: 1; // Above body content
  // Or use absolute positioning within body
}
```

**Visual Layout Consideration:**
The current visual design has the toolbar at the bottom of the post body. With 3 cells, we need to either:
1. Accept a layout change (toolbar in its own column to the right)
2. Use CSS to overlay Cell 2 over the bottom of Cell 1
3. Use absolute positioning within the row

**Recommendation:** Option 2 or 3 to preserve visual layout while fixing accessibility.

---

## 5. Navigation Modifier Changes

### File: `frontend/discourse/app/modifiers/post-stream-navigation.js`

Update `getFocusablesInRow()` to handle 3 cells:

**Current (lines 141-188):**
```javascript
getFocusablesInRow(row) {
  if (!row) {
    return [];
  }

  const focusables = [];

  // Avatar cell
  const avatarCell = row.querySelector(
    '.topic-avatar[role="gridcell"], .topic-avatar [role="gridcell"]'
  );
  if (avatarCell) {
    focusables.push(avatarCell);
  }

  // Post body gridcell
  const postBodyCell = row.querySelector(
    '.post__body[role="gridcell"], .topic-body[role="gridcell"]'
  );
  if (postBodyCell) {
    focusables.push(postBodyCell);
  } else {
    // For small actions...
  }

  // Toolbar buttons (inside body cell currently)
  const toolbar = row.querySelector(this.options.toolbarSelector);
  const toolbarButtons = toolbar
    ? Array.from(toolbar.querySelectorAll("button:not([disabled]), a[href]"))
    : [];

  return [...focusables, ...toolbarButtons, ...Array.from(smallActionButtons)];
}
```

**Updated for 3 cells:**
```javascript
getFocusablesInRow(row) {
  if (!row) {
    return [];
  }

  const focusables = [];

  // Cell 0: Avatar cell
  const avatarCell = row.querySelector(
    '.topic-avatar[role="gridcell"], .topic-avatar [role="gridcell"]'
  );
  if (avatarCell) {
    focusables.push(avatarCell);
  }

  // Cell 1: Post body gridcell (content only, no toolbar)
  const postBodyCell = row.querySelector(
    '.post__body[role="gridcell"], .topic-body[role="gridcell"]'
  );
  if (postBodyCell) {
    focusables.push(postBodyCell);
  } else {
    // For small actions: the description cell
    const smallActionDesc = row.querySelector(
      '.small-action-desc[role="gridcell"]'
    );
    if (smallActionDesc) {
      focusables.push(smallActionDesc);
    }
  }

  // Cell 2: Actions cell (new)
  const actionsCell = row.querySelector('.post__actions-cell[role="gridcell"]');
  if (actionsCell) {
    focusables.push(actionsCell);
  }

  // Toolbar buttons within actions cell
  const toolbar = row.querySelector(this.options.toolbarSelector);
  const toolbarButtons = toolbar
    ? Array.from(toolbar.querySelectorAll("button:not([disabled]), a[href]"))
    : [];

  // Small action buttons (for small-action posts)
  const smallActionButtons = row.querySelectorAll(
    ".small-action-buttons button:not([disabled])"
  );

  return [...focusables, ...toolbarButtons, ...Array.from(smallActionButtons)];
}
```

### Navigation Flow Changes

With 3 cells, Arrow Right navigation becomes:

```
Row Focus -> Cell 0 (Avatar) -> Cell 1 (Content) -> Cell 2 (Actions) -> Button 1 -> Button 2 -> ...
```

The actions cell acts as a natural intermediate step before diving into individual toolbar buttons.

---

## 6. Risk Assessment

### High Risk

1. **Visual Layout Breakage**
   - Current CSS heavily relies on `.topic-body` containing the toolbar
   - Moving toolbar to sibling cell may break positioning
   - **Mitigation:** Use CSS Grid or absolute positioning to preserve visual layout

2. **Plugin Compatibility**
   - Multiple plugins use `post-menu-buttons` transformer
   - Plugins expect toolbar inside `.topic-body`
   - **Mitigation:** Keep `.post-menu-area` class structure intact within new cell

### Medium Risk

3. **Test Failures**
   - Tests reference `.post-menu-area` selectors
   - Tests may assume specific DOM nesting
   - **Mitigation:** Update test selectors if needed

4. **Embedded Posts**
   - Reply expansions (`.embedded-posts`) have different layout
   - May need separate handling
   - **Mitigation:** Test with reply expansions visible

### Low Risk

5. **Mobile Layout**
   - Mobile already has different layout
   - Should adapt with proper CSS
   - **Mitigation:** Test on mobile viewport

---

## 7. Implementation Order

### Phase 1: Template Restructuring
1. Add new i18n key `post.sr_actions_cell`
2. Move PostMenu to new Cell 2 in post.gjs template
3. Update PostAvatar and topic-body gridcell attributes as needed

### Phase 2: CSS Adjustments
4. Add focus styles for `.post__actions-cell`
5. Update row layout CSS (flex or grid)
6. Adjust `.post-menu-area` positioning
7. Test on desktop and mobile viewports

### Phase 3: Navigation Modifier
8. Update `getFocusablesInRow()` to include Cell 2
9. Test Arrow Right/Left navigation flow
10. Verify NVDA reads Cell 1 aria-label correctly

### Phase 4: Testing & Validation
11. Run existing QUnit tests
12. Manual NVDA testing for each cell
13. Test with plugins (reactions, AI, etc.)
14. Test embedded posts (replies below/above)

---

## 8. Exact Code Changes

### File 1: `frontend/discourse/app/components/post.gjs`

**Remove from line ~718-750 (inside post__contents):**
```gjs
// DELETE THIS SECTION - move to new cell
<section class="post__menu-area post-menu-area clearfix">
  <PostMenu
    @post={{@post}}
    ... all props ...
  />
</section>
```

**Add after closing `</div>` of post__body (around line 803), before the row closing:**
```gjs
{{! Cell 2: Actions Toolbar }}
<div
  class="post__actions-cell"
  role="gridcell"
  tabindex="-1"
  aria-label={{i18n "post.sr_actions_cell"}}
>
  <section class="post__menu-area post-menu-area clearfix">
    <PostMenu
      @post={{@post}}
      @prevPost={{@prevPost}}
      @nextPost={{@nextPost}}
      @canCreatePost={{@canCreatePost}}
      @changeNotice={{@changeNotice}}
      @changePostOwner={{@changePostOwner}}
      @copyLink={{this.copyLink}}
      @deletePost={{@deletePost}}
      @editPost={{@editPost}}
      @filteredRepliesView={{this.filteredRepliesView}}
      @grantBadge={{@grantBadge}}
      @lockPost={{@lockPost}}
      @permanentlyDeletePost={{@permanentlyDeletePost}}
      @rebakePost={{@rebakePost}}
      @recoverPost={{@recoverPost}}
      @repliesShown={{this.repliesShown}}
      @repliesButtonDisabled={{this.isTogglingReplies}}
      @replyToPost={{@replyToPost}}
      @share={{this.share}}
      @showFlags={{@showFlags}}
      @showLogin={{@showLogin}}
      @showPagePublish={{@showPagePublish}}
      @showReadIndicator={{@showReadIndicator}}
      @toggleLike={{this.toggleLike}}
      @togglePostType={{@togglePostType}}
      @toggleReplies={{this.toggleReplies}}
      @toggleWiki={{@toggleWiki}}
      @unhidePost={{@unhidePost}}
      @unlockPost={{@unlockPost}}
    />
  </section>
</div>
```

### File 2: `config/locales/client.en.yml`

Add under `post:` section:
```yaml
sr_actions_cell: "Post actions"
```

### File 3: `app/assets/stylesheets/common/base/topic-post.scss`

Add after existing gridcell focus styles (around line 33):
```scss
// Focus styles for actions gridcell (3rd cell in post row)
.post__actions-cell[role="gridcell"] {
  &:focus {
    outline: var(--d-grid-focus-outline-width) solid
      var(--d-grid-focus-outline-color);
    outline-offset: var(--d-grid-focus-outline-offset);
  }

  &:focus-visible {
    outline: var(--d-grid-focus-outline-width) solid
      var(--d-grid-focus-outline-color);
    outline-offset: var(--d-grid-focus-outline-offset);
  }
}
```

### File 4: `app/assets/stylesheets/desktop/topic-post.scss`

Add new cell positioning (add after `.topic-body` styles around line 69):
```scss
// New actions cell positioning for 3-cell grid structure
.post__actions-cell {
  // Position overlapping with body cell to preserve visual layout
  position: absolute;
  left: var(--topic-avatar-width);
  bottom: 0;
  width: calc(var(--topic-body-width) + (var(--topic-body-width-padding) * 2));

  // Reset section padding since parent handles it
  section.post-menu-area {
    padding-left: var(--topic-body-width-padding);
  }
}

// Ensure row has position context for absolute child
.onscreen-post .row {
  position: relative;
}
```

### File 5: `frontend/discourse/app/modifiers/post-stream-navigation.js`

Update `getFocusablesInRow` method (lines 141-188):
```javascript
getFocusablesInRow(row) {
  if (!row) {
    return [];
  }

  const focusables = [];

  // Cell 0: Avatar cell (simple gridcell - NVDA reads this fine)
  const avatarCell = row.querySelector(
    '.topic-avatar[role="gridcell"], .topic-avatar [role="gridcell"]'
  );
  if (avatarCell) {
    focusables.push(avatarCell);
  }

  // Cell 1: Post body gridcell (content only - NO toolbar)
  // The gridcell has aria-label with post content for NVDA to read
  const postBodyCell = row.querySelector(
    '.post__body[role="gridcell"], .topic-body[role="gridcell"]'
  );
  if (postBodyCell) {
    focusables.push(postBodyCell);
  } else {
    // For small actions: the description cell (simple text content)
    const smallActionDesc = row.querySelector(
      '.small-action-desc[role="gridcell"]'
    );
    if (smallActionDesc) {
      focusables.push(smallActionDesc);
    }
  }

  // Cell 2: Actions cell (contains toolbar)
  const actionsCell = row.querySelector('.post__actions-cell[role="gridcell"]');
  if (actionsCell) {
    focusables.push(actionsCell);
  }

  // Toolbar buttons (now in Cell 2 for regular posts)
  const toolbar = row.querySelector(this.options.toolbarSelector);
  const toolbarButtons = toolbar
    ? Array.from(
        toolbar.querySelectorAll("button:not([disabled]), a[href]")
      )
    : [];

  // Small action buttons (edit, delete, recover)
  const smallActionButtons = row.querySelectorAll(
    ".small-action-buttons button:not([disabled])"
  );

  return [...focusables, ...toolbarButtons, ...Array.from(smallActionButtons)];
}
```

---

## 9. Alternative Approach: CSS-Only Solution

If structural changes prove too risky, consider a CSS-only approach:

**Concept:** Use `aria-hidden="true"` on the toolbar wrapper and rely on `aria-describedby` for content.

```gjs
<div
  class="post__body topic-body clearfix"
  role="gridcell"
  tabindex="-1"
  aria-label={{this.postContentLabel}}
  aria-describedby={{this.postContentId}}
>
  ...
  <section class="post__menu-area post-menu-area clearfix" aria-hidden="true">
    <PostMenu ... />
  </section>
</div>
```

**Problem:** This hides the toolbar from screen readers entirely, making buttons inaccessible. Not recommended.

---

## 10. Testing Checklist

### NVDA Testing
- [ ] Arrow Down/Up moves between posts
- [ ] Arrow Right from row announces "Avatar" (Cell 0)
- [ ] Arrow Right from Cell 0 announces post content (Cell 1 aria-label)
- [ ] Arrow Right from Cell 1 announces "Post actions" (Cell 2)
- [ ] Arrow Right from Cell 2 focuses first toolbar button
- [ ] Arrow Left reverses navigation
- [ ] Ctrl+Enter from Cell 1 enters document mode

### Functional Testing
- [ ] Like button works
- [ ] Reply button works
- [ ] Bookmark button works
- [ ] Admin menu opens
- [ ] Reply expansion appears correctly
- [ ] Embedded replies visible and navigable

### Visual Testing
- [ ] Desktop layout unchanged
- [ ] Mobile layout unchanged
- [ ] Focus rings visible on all cells
- [ ] Toolbar positioned at bottom of post

---

## 11. References

- WAI-ARIA Grid Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/grid/
- NVDA Application Mode: https://www.nvda.io/
- Current accessibility docs: `docs/accessibility/04-topic-thread.md`
