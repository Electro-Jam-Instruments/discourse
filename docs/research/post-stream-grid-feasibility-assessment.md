# Post Stream Grid Pattern - Feasibility Assessment

**Date:** 2026-01-02
**Analyst:** Strategic Planning Agent
**Subject:** WAI-ARIA Grid Pattern Implementation for Discourse Post Stream
**Related Doc:** `docs/accessibility/04-topic-thread.md`

---

## Executive Summary

The proposed 3-cell grid pattern for the post stream is **feasible but requires significant DOM restructuring**. The current implementation has PostMenu deeply nested inside `.topic-body`, which conflicts with the plan to have actions as a separate grid cell.

**Overall Confidence:** 65%

**Recommendation:** Proceed with a **modified 2-phase approach** - first implement a 2-cell grid (Avatar + Body), then evaluate whether 3-cell separation provides meaningful accessibility benefits.

---

## 1. Current DOM Structure Analysis

### 1.1 Regular Post Structure

```html
<div class="topic-post clearfix post--sticky-avatar sticky-avatar">
  <article class="boxed onscreen-post" aria-labelledby="post-heading-N">

    <!-- Replies above section (conditional) -->
    <div class="post__row row">
      <section class="post__embedded-posts post__embedded-posts--top ...">
        ...embedded posts...
      </section>
    </div>

    <!-- Post notice row (conditional) -->
    <div class="post__row row">
      <PostNotice/>
    </div>

    <!-- Main post row -->
    <div class="post__row row">
      <!-- CELL 1: Avatar (float: left) -->
      <div class="topic-avatar">
        <div class="post-avatar">
          <UserAvatar/>
          <UserAvatarFlair/>
        </div>
      </div>

      <!-- CELL 2: Body (float: left, contains EVERYTHING else) -->
      <div class="post__body topic-body clearfix">
        <PostMetaData/> <!-- author, timestamp, badges -->

        <div class="post__regular post__contents">
          <PostCookedHtml/> <!-- actual post content -->

          <!-- ACTIONS ARE INSIDE CONTENTS! -->
          <section class="post__menu-area post-menu-area clearfix">
            <nav class="post-controls">
              <div class="actions">
                <!-- Like, Share, Bookmark, Reply buttons -->
              </div>
            </nav>
          </section>

          <!-- Embedded replies below (conditional) -->
          <section class="post__embedded-posts bottom">
            ...
          </section>
        </div>

        <section class="post__actions post-actions">
          <PostActionsSummary/>
        </section>
        <PostLinks/>
      </div>
    </div>

    <!-- Topic map (first post only) -->
    <div class="post__topic-map topic-map --op">
      <TopicMap/>
    </div>

  </article>
</div>
```

### 1.2 Small Action Post Structure

```html
<div class="topic-post" data-post-number="N">
  <article class="small-action onscreen-post">
    <div class="topic-avatar">
      <!-- Icon instead of user avatar -->
      <svg class="d-icon">...</svg>
    </div>
    <div class="small-action-desc">
      <div class="small-action-contents">
        <UserAvatar/> <!-- small avatar -->
        <p>{{description}}</p>
      </div>
      <div class="small-action-buttons">
        <!-- Edit/Delete buttons -->
      </div>
      <div class="small-action-custom-message">
        <PostCookedHtml/>
      </div>
    </div>
  </article>
</div>
```

### 1.3 Key CSS Layout Characteristics

| Element | CSS Property | Value | Notes |
|---------|--------------|-------|-------|
| `.topic-avatar` | `float` | `left` | Fixed width ~45-60px |
| `.topic-avatar` | `width` | `var(--topic-avatar-width)` | Desktop: ~60px, Mobile: ~45px |
| `.topic-body` | `float` | `left` | Fills remaining width |
| `.topic-body` | `width` | `calc(var(--topic-body-width) + padding*2)` | Complex calculation |
| `.topic-body` | `border-top` | `1px solid` | Visual separator |
| `.post-controls` | `display` | `flex` | Horizontal button layout |
| `.actions` | `margin-left` | `auto` | Right-aligns buttons |

---

## 2. Critical Issues Identified

### 2.1 Issue #1: PostMenu Location (MAJOR)

**Problem:** PostMenu (`nav.post-controls`) is nested 4 levels deep inside `.topic-body`:
```
.topic-body
  > .post__regular.post__contents
    > .post__menu-area.post-menu-area
      > nav.post-controls
        > .actions
```

**Impact on Plan:** The proposed 3-cell structure requires `.post-controls` to be a sibling of `.topic-body`, not a child.

**Required Changes:**
1. Move `<PostMenu>` component out of `.post__contents` div
2. Create new wrapper for body content (excluding actions)
3. Restructure template hierarchy in `post.gjs`

**Risk Level:** HIGH - Template restructuring could break:
- Plugin outlets that target specific positions
- CSS selectors that depend on nesting
- Existing decorators that traverse the DOM

### 2.2 Issue #2: Embedded Posts Inside Content Area

**Problem:** Embedded replies (both above and below) are rendered inside the main post structure:
- `post__embedded-posts--top`: Above the main row
- `post__embedded-posts.bottom`: Inside `.post__contents`

**Impact on Plan:** These embedded posts would need special handling:
- Should they be separate grid rows?
- How do they fit into the 3-cell model?

**Risk Level:** MEDIUM - Edge case but important for threading

### 2.3 Issue #3: Float-Based Layout vs CSS Grid

**Problem:** Current layout uses `float: left` for both avatar and body. The plan adds semantic grid roles but retains visual layout.

**Considerations:**
- Adding `role="gridcell"` to floated elements is valid
- But float layout doesn't naturally support 3-column structure
- Moving actions to Cell 3 requires either:
  - CSS Grid/Flexbox restructuring (visual change)
  - Absolute positioning (hacky)
  - Keeping visual position but changing semantic position (confusing)

**Risk Level:** MEDIUM - CSS work required

### 2.4 Issue #4: Small Action Posts Have Different Structure

**Problem:** Small action posts (system messages) have no `.post-controls` and different layout.

**Impact on Plan:** Grid navigation modifier must handle:
- Posts with 3 cells (regular posts)
- Posts with 2 cells (small action posts)
- Conditional cell presence

**Risk Level:** LOW - Manageable with conditional logic

### 2.5 Issue #5: Cloaking Behavior

**Problem:** Posts can be "cloaked" (DOM replaced with placeholder) for performance.

**Impact on Plan:** Grid semantics must:
- Work with cloaked placeholders
- Preserve aria-rowindex across cloaking
- Handle dynamic insertion/removal

**Risk Level:** LOW - Existing topic list handles this

---

## 3. Option Analysis

### Option A: Full 3-Cell Restructuring (Original Plan)

**Description:** Implement the plan as documented - move PostMenu out of topic-body to create true 3-cell structure.

**Implementation:**
1. Restructure `post.gjs` template:
   ```html
   <div role="row" class="topic-post">
     <div role="gridcell" class="topic-avatar">...</div>
     <div role="gridcell" class="topic-body-content">
       <PostMetaData/>
       <div class="cooked" role="document">...</div>
     </div>
     <nav role="gridcell" class="post-controls">
       <div role="toolbar" class="actions">...</div>
     </nav>
   </div>
   ```

2. Update CSS to maintain visual layout with 3 siblings

3. Create new `post-stream-navigation.js` modifier

**Pros:**
- Clean semantic structure
- Matches documented plan
- True column navigation

**Cons:**
- Significant template restructuring
- High CSS complexity to maintain visual layout
- Plugin outlet positions change
- Risk of visual regressions

**Effort:** 3-4 days
**Risk:** HIGH
**Confidence:** 50%

---

### Option B: Semantic 3-Cell with Visual 2-Column (Hybrid)

**Description:** Add grid semantics without moving DOM elements. PostMenu stays inside topic-body visually but is semantically labeled as a separate cell.

**Implementation:**
1. Add `role="gridcell"` to logical sections:
   ```html
   <div role="row" class="topic-post">
     <div role="gridcell" class="topic-avatar">...</div>
     <div class="topic-body">
       <div role="gridcell" class="topic-body-content">
         <PostMetaData/>
         <div class="cooked" role="document">...</div>
       </div>
       <nav role="gridcell" class="post-controls">...</nav>
     </div>
   </div>
   ```

2. Navigation modifier treats nested gridcells as separate columns

**Pros:**
- Minimal DOM changes
- Visual layout preserved
- Lower risk

**Cons:**
- Gridcells nested inside non-gridcell container (`.topic-body`)
- Violates strict WAI-ARIA grid spec (gridcells should be direct children of row)
- Screen reader column navigation may not work correctly

**Effort:** 1-2 days
**Risk:** MEDIUM (accessibility compliance concern)
**Confidence:** 40% (due to spec violation)

---

### Option C: Simplified 2-Cell Approach (RECOMMENDED)

**Description:** Use 2 cells - Avatar and Body (including actions). Toolbar navigation is integrated into Cell 2.

**Implementation:**
1. Add grid roles to existing structure:
   ```html
   <div class="post-stream" role="grid" aria-label="Posts">
     <div role="row" tabindex="0" aria-rowindex="1" aria-label="..."
          class="topic-post">
       <div role="gridcell" class="topic-avatar">...</div>
       <div role="gridcell" class="topic-body">
         ...existing structure unchanged...
         <nav class="post-controls">
           <div role="toolbar" class="actions">...</div>
         </nav>
       </div>
     </div>
   </div>
   ```

2. Keyboard navigation:
   - Up/Down: Move between posts
   - Right from row: Focus avatar cell
   - Right again: Focus body cell
   - Right again: Focus first toolbar button (Like)
   - Continue Right: Navigate toolbar buttons
   - Left: Reverse navigation
   - Enter on body cell: Enter document mode

**Pros:**
- Matches current DOM structure exactly
- No CSS changes required
- No plugin outlet disruption
- Toolbar still directly accessible via arrow keys
- Low risk of visual regression

**Cons:**
- No separate "actions" column for column navigation
- Users must arrow through body to reach actions
- Doesn't match original 3-cell plan

**Effort:** 1-2 days
**Risk:** LOW
**Confidence:** 85%

---

### Option D: Deferred Actions Cell (Phased Approach)

**Description:** Implement Option C now, then iterate to Option A in a future phase after validating the approach.

**Phase 1 (Now):**
- 2-cell grid (Avatar + Body)
- Toolbar integrated in body cell
- Document mode for content reading

**Phase 2 (Future):**
- Evaluate user feedback on Phase 1
- If separate actions column is requested:
  - Restructure template
  - Move PostMenu
  - Add Cell 3

**Pros:**
- Delivers value immediately
- Validates approach before major restructuring
- Reduces risk

**Cons:**
- May require future refactoring
- Users accustomed to 2-cell may resist change

**Effort:** Phase 1: 1-2 days, Phase 2: 2-3 days
**Risk:** LOW initially
**Confidence:** 90%

---

## 4. Implementation Phase Feasibility

### Phase 1: Basic Grid Structure

| Task | Feasibility | Notes |
|------|-------------|-------|
| Add `role="grid"` to `.post-stream` | HIGH | Simple attribute addition |
| Add `role="row"` to `.topic-post` | HIGH | Simple attribute addition |
| Add `role="gridcell"` to avatar | HIGH | Simple attribute addition |
| Add `role="gridcell"` to body | HIGH | Simple attribute addition |
| Create composite `aria-label` | HIGH | Existing pattern from topic list |
| Create navigation modifier | MEDIUM | Adapt `grid-navigation.js` |
| Handle small action posts | MEDIUM | Conditional cell structure |

**Phase 1 Confidence:** 85%

### Phase 2: Actions Toolbar Integration

| Task | Feasibility | Notes |
|------|-------------|-------|
| Add `role="toolbar"` to `.actions` | HIGH | Simple attribute addition |
| Arrow Right to focus toolbar | HIGH | Straightforward implementation |
| Toolbar roving tabindex | MEDIUM | Existing pattern available |
| Arrow Left from first button | MEDIUM | Return to body cell |

**Phase 2 Confidence:** 80%

### Phase 3: Document Mode for Reading

| Task | Feasibility | Notes |
|------|-------------|-------|
| Add `role="document"` to `.cooked` | HIGH | Simple attribute addition |
| Enter on body to focus content | MEDIUM | Requires focus management |
| Escape to return to row | MEDIUM | Event handler needed |
| Virtual cursor activation | VARIABLE | Depends on screen reader |

**Phase 3 Confidence:** 75%

### Phase 4: Polish and Edge Cases

| Task | Feasibility | Notes |
|------|-------------|-------|
| Focus styles | HIGH | CSS variables exist |
| Empty state | HIGH | Follow topic list pattern |
| New post announcements | MEDIUM | Live region implementation |
| Infinite scroll handling | MEDIUM | Existing viewport tracker |
| Small action posts | MEDIUM | Different structure |
| Cloaked posts | HIGH | Existing pattern |

**Phase 4 Confidence:** 70%

---

## 5. Confidence Assessment

### Overall Confidence: 65%

**Factors Reducing Confidence:**

1. **DOM Restructuring Risk (-15%)**: Moving PostMenu requires template and CSS changes that could break existing functionality

2. **Float Layout Complexity (-10%)**: Converting semantic structure while maintaining float-based visual layout is tricky

3. **Plugin Outlet Stability (-5%)**: Template changes may affect plugin injection points

4. **Screen Reader Document Mode Variability (-5%)**: Different screen readers handle `role="document"` differently

### Factors Increasing Confidence:

1. **Existing Grid Pattern (+15%)**: Topic list and category list implementations provide proven patterns

2. **Modular Approach (+10%)**: Option C/D allows incremental delivery with low risk

3. **Clear Specifications (+5%)**: WAI-ARIA Grid pattern is well-documented

---

## 6. Recommendations

### Primary Recommendation: Option D (Deferred Actions Cell)

Implement a 2-cell grid now, defer 3-cell restructuring.

**Rationale:**
1. Delivers accessibility improvements quickly
2. Validates approach with real users before major changes
3. Reduces risk of breaking existing functionality
4. Aligns with existing DOM structure

### Modifications to Increase Confidence to 90%+

1. **Drop 3-cell requirement for initial implementation**
   - Use 2-cell (Avatar + Body) structure
   - Actions accessible via continued arrow-right navigation
   - Confidence boost: +15%

2. **Reuse existing grid-navigation.js modifier**
   - Customize for post-specific behavior
   - Confidence boost: +5%

3. **Add comprehensive integration tests**
   - Test with NVDA, JAWS, VoiceOver
   - Confidence boost: +5%

4. **Create rollback plan**
   - Feature flag for grid behavior
   - Confidence boost: +5%

### Files to Modify

**Phase 1:**
- `frontend/discourse/app/components/post-stream.gjs` - Add grid role, aria-label
- `frontend/discourse/app/components/post.gjs` - Add row role, gridcell roles, aria-label
- `frontend/discourse/app/components/post/small-action.gjs` - Add row/gridcell roles
- `frontend/discourse/app/modifiers/post-stream-navigation.js` (NEW) - Keyboard navigation

**Phase 2:**
- `frontend/discourse/app/components/post/menu.gjs` - Add toolbar role
- `frontend/discourse/app/modifiers/post-stream-navigation.js` - Toolbar integration

**Phase 3:**
- `frontend/discourse/app/components/post/cooked-html.gjs` - Add document role
- Document mode focus management

**Phase 4:**
- Various edge case handling
- CSS focus styles

---

## 7. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Visual regression | Feature flag, visual regression tests |
| Plugin breakage | Test with common plugins before release |
| Screen reader compatibility | Test matrix with NVDA, JAWS, VoiceOver |
| Performance impact | Profile with large threads (1000+ posts) |
| User confusion | Clear documentation, gradual rollout |

---

## 8. Conclusion

The 3-cell grid pattern is conceptually sound but **premature given current DOM structure**. A 2-cell approach (Option C/D) delivers 80% of the accessibility benefit with 20% of the risk.

**Next Steps:**
1. Implement 2-cell grid with toolbar integration
2. Gather user feedback
3. Re-evaluate 3-cell restructuring based on feedback
4. If needed, plan DOM restructuring as separate project

---

## References

- [WAI-ARIA Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
- [Discourse Topic List Grid Implementation](frontend/discourse/app/components/topic-list/list.gjs)
- [Existing Grid Navigation Modifier](frontend/discourse/app/modifiers/grid-navigation.js)
- [Original Plan Document](docs/accessibility/04-topic-thread.md)
