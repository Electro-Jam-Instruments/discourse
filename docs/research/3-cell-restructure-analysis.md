# 3-Cell Grid Restructure Analysis

## Executive Summary

**Overall Success Probability: 45-55%**

The 3-cell restructure plan has significant merit in addressing the NVDA gridcell aria-label issue, but contains critical gaps that threaten its viability. The fundamental premise is correct (separating interactive elements from content), but **the proposed solution does not fully achieve this goal** because Cell 1 would still contain interactive elements after the restructure.

---

## Question 1: Will This Actually Fix the NVDA Issue?

### Answer: **Partially - Critical Issue Identified**

The plan correctly identifies that NVDA ignores `aria-label` on gridcells containing interactive elements. However, **moving PostMenu to Cell 2 does NOT remove all interactive elements from Cell 1**.

#### Interactive Elements Remaining in Cell 1 After Restructure

Examining `post.gjs` lines 624-803 reveals these interactive elements would remain in the "content-only" Cell 1:

| Element | Location | Purpose |
|---------|----------|---------|
| `<a class="post__expand-hidden">` | Line 693-698 | Show hidden post content |
| `<DButton class="post__expand-button expand-post">` | Line 707-715 | Expand truncated first post |
| `<DButton class="post__collapse-button-up">` | Line 774-780 | Collapse reply expansion |
| `<DButton class="post__load-more load-more-replies">` | Line 783-788 | Load more embedded replies |
| `<UserLink>` | In PostMetaData | Link to user profile (in poster-name.gjs) |
| `<GroupLink>` | In PostMetaData | Link to group (in poster-name.gjs) |
| `<DButton>` | In edits-indicator.gjs | Show post history |
| `<DButton>` | In select-post.gjs | Multi-select post buttons |
| Links in `.cooked` | User-generated content | Any link in post body |

**Impact:** Even with toolbar moved to Cell 2, NVDA may still refuse to read Cell 1's `aria-label` due to these remaining interactive elements.

#### What Would Actually Fix the Issue

To fully solve the NVDA issue, one of these approaches is needed:

1. **Move ALL interactive elements to Cell 2** - Not practical; would break UX for embedded replies and content links
2. **Use NVDA workaround** - Focus the gridcell and rely on aria-labelledby/describedby (current approach attempts this)
3. **Abandon gridcell approach for content** - Use document role for content cell, but this breaks grid semantics
4. **Accept partial fix** - The 3-cell structure is still an improvement, just not a complete solution

---

## Question 2: CSS Risk Assessment

### Answer: **High Risk - 65% chance of visual breakage**

The plan proposes absolute positioning to preserve visual layout. This is the **riskiest approach** for several reasons:

#### Current Layout Analysis

```scss
// Desktop: .topic-body is floated and has fixed width calculation
.topic-body {
  width: calc(var(--topic-body-width) + (var(--topic-body-width-padding) * 2));
  float: left;
  position: relative;
}

// Post menu has left padding to align with content
section.post-menu-area {
  position: relative;
  padding-left: var(--topic-body-width-padding);
}
```

The current layout uses:
- `float: left` for avatar and body columns
- Fixed width calculations based on CSS variables
- Relative positioning with padding for alignment

#### Problems with Proposed CSS

```scss
.post__actions-cell {
  position: absolute;
  left: var(--topic-avatar-width);
  bottom: 0;
  width: calc(var(--topic-body-width) + (var(--topic-body-width-padding) * 2));
}
```

**Issues:**

1. **Absolute positioning removes from flow** - Row height won't account for actions cell
2. **Width calculation assumes fixed layout** - Breaks on tablet/mobile responsive widths
3. **Bottom positioning is fragile** - Breaks when:
   - Post has embedded replies expanded
   - Post has PostLinks section visible
   - Post has PostActionsSummary visible
4. **Z-index conflicts** - Absolute cell may overlap other content
5. **Responsive breakpoints** - Width changes at 790px and 767px not accounted for

#### Alternative CSS Approach (Lower Risk)

CSS Grid would be safer:

```scss
.onscreen-post .row {
  display: grid;
  grid-template-columns: var(--topic-avatar-width) 1fr;
  grid-template-rows: auto;
}

// Actions cell spans same column as body but aligns to end
.post__actions-cell {
  grid-column: 2;
  grid-row: 1;
  align-self: end;
  justify-self: start;
  margin-top: auto; // Push to bottom of cell
}
```

But this still has issues:
- Breaking change to float-based layout
- Plugin CSS selectors may assume float layout
- Need thorough responsive testing

---

## Question 3: Ember Component Architecture Concerns

### Answer: **Medium Risk - 50% chance of service/context issues**

#### Current PostMenu Dependencies

From `post/menu.gjs`, PostMenu uses these services:
- `@service capabilities`
- `@service currentUser`
- `@service keyValueStore`
- `@service modal`
- `@service menu`
- `@service siteSettings`
- `@service store`

And receives these args passed from Post component:
- 20+ action callbacks (deletePost, editPost, toggleLike, etc.)
- Post and surrounding post references (@post, @prevPost, @nextPost)
- State flags (@repliesShown, @showReadIndicator, etc.)

#### Moving PostMenu to Sibling Position

**No Impact on:**
- Service injection (Ember DI works regardless of DOM position)
- Component instantiation (still same parent component)
- Args passing (template syntax unchanged)

**Potential Issues:**
- **Event bubbling** - Actions that currently bubble up through `.topic-body` may be affected
- **CSS selector specificity** - Styles using `.topic-body .post-menu-area` will break
- **Plugin selectors** - Plugins targeting `.topic-body > .post-menu-area` will break

**Mitigation:**
- Keep `.post-menu-area` class on the section wrapper inside Cell 2
- Update any internal CSS selectors
- Document breaking change for plugins

---

## Question 4: Plugin Compatibility

### Answer: **High Risk - 70% chance of breaking plugins**

#### Plugin Outlets Affected

From `post/menu.gjs`:
```javascript
<PluginOutlet @name="post-menu" @outletArgs={{lazyHash post=@post state=this.state}}>
```

And in post.gjs, multiple outlets surround the PostMenu area:
- `@name="post-content-cooked-html"` - before menu
- `@name="post-links"` - after menu in current structure

#### Known Plugin Integration Points

1. **post-menu-buttons transformer** - Used by plugins to add/modify toolbar buttons
2. **CSS selectors** - Plugins often use:
   - `.topic-body .post-controls`
   - `.topic-post article .actions`
   - `.post-menu-area button`

3. **DOM queries** - Plugins may use JavaScript to:
   - `row.querySelector('.topic-body .post-controls')`
   - `element.closest('.topic-body')`

#### Affected Plugins (Likely)

Based on common Discourse plugin patterns:
- **discourse-reactions** - Adds reactions to toolbar
- **discourse-ai** - Adds AI summary/actions
- **discourse-post-voting** - Custom vote buttons
- **discourse-calendar** - Event integration buttons

#### Mitigation Strategy

1. Keep all existing class names on elements
2. Add new `.post__actions-cell` class, don't remove `.post-menu-area`
3. Document DOM change in release notes
4. Consider deprecation period with both structures

---

## Question 5: Focus Management

### Answer: **Medium Risk - Navigation will feel awkward**

#### Current Navigation Flow

```
Row -> Cell 0 (Avatar) -> Cell 1 (Body) -> [Like] -> [Share] -> [Bookmark] -> [Reply]
```

Arrow Right flows naturally from content to actions.

#### Proposed 3-Cell Navigation Flow

```
Row -> Cell 0 (Avatar) -> Cell 1 (Content) -> Cell 2 (Actions) -> [Like] -> [Share] -> ...
```

#### User Experience Impact

1. **Extra keystroke** - Users must Arrow Right through Cell 2 before reaching buttons
2. **Confusing semantics** - Cell 2's `aria-label="Post actions"` is redundant with toolbar's label
3. **What gets announced?** - Cell 2 is essentially a wrapper with no meaningful content to announce

#### Better Approach

Skip Cell 2 in navigation entirely:
```javascript
getFocusablesInRow(row) {
  // Cell 0: Avatar
  focusables.push(avatarCell);

  // Cell 1: Content (for reading)
  focusables.push(postBodyCell);

  // Skip Cell 2 wrapper, go directly to buttons
  const toolbarButtons = toolbar.querySelectorAll("button:not([disabled])");
  focusables.push(...toolbarButtons);
}
```

This maintains the navigation feel while achieving DOM restructure for CSS purposes.

---

## Question 6: Mobile Considerations

### Answer: **Medium Risk - Requires separate implementation**

#### Mobile Layout Differences

Mobile layout (from viewport checks in CSS):
- Avatar width changes to 45px at 790px breakpoint
- `.topic-body` becomes `calc(100% - 47px)`
- Different flex/float behaviors

#### Impact of 3-Cell on Mobile

1. **Absolute positioning won't work** - Different widths break the calculation
2. **Need separate mobile CSS** - Or use CSS Grid that adapts
3. **Touch targets** - Actions cell needs proper spacing

#### Mobile-Specific Concerns

- Mobile may not need 3-cell (users typically scroll, not keyboard navigate)
- Could conditionally apply 3-cell only on desktop
- But that adds complexity and potential inconsistency

---

## Key Risks Ranked by Severity

### Critical (Would Block Release)

1. **Interactive elements remaining in Cell 1** (Severity: 9/10)
   - The fix doesn't fully solve the NVDA issue
   - Links in post content, expand buttons, metadata links all remain

2. **Plugin breakage** (Severity: 8/10)
   - DOM restructure affects plugin selectors
   - No deprecation path proposed

### High (Would Require Significant Rework)

3. **CSS absolute positioning fragility** (Severity: 7/10)
   - Breaks with embedded replies
   - Breaks on responsive widths

4. **Visual layout breakage** (Severity: 6/10)
   - Multiple edge cases not handled
   - Tablet/mobile responsive issues

### Medium (Manageable with Care)

5. **Extra navigation step** (Severity: 5/10)
   - Cell 2 adds unnecessary keystroke
   - Can be mitigated by skipping in focus flow

6. **Test updates needed** (Severity: 4/10)
   - Selector updates in QUnit tests
   - System spec page object updates

---

## Recommendations

### Recommendation 1: Do NOT Proceed with Current Plan

The 3-cell restructure as documented will not fully fix the NVDA issue because interactive elements remain in Cell 1. The high risk and partial benefit do not justify the implementation effort.

### Recommendation 2: Alternative Approach - Computed aria-label

Instead of restructuring DOM, improve the current `postContentLabel` computation:

```javascript
get postContentLabel() {
  const parts = [];
  parts.push(this.args.post.username);
  // ... existing label computation
  parts.push(this.extractPlainTextContent());
  return parts.join(", ");
}
```

This is already implemented and working. The issue is NVDA behavior, not the implementation.

### Recommendation 3: If Restructure Needed, Use CSS Grid Not Absolute Positioning

```scss
.onscreen-post .row {
  display: grid;
  grid-template-columns: var(--topic-avatar-width) 1fr;
  // Actions cell floats at bottom of content column via grid-row-end
}
```

### Recommendation 4: Skip Cell 2 in Focus Flow

Even with 3-cell DOM, keep navigation as:
```
Avatar -> Body -> Button1 -> Button2 -> ...
```

Cell 2 exists for CSS purposes only, not keyboard navigation.

### Recommendation 5: Consider Alternative NVDA Solutions

1. **Test with NVDA 2025 builds** - NVDA may have fixed this behavior
2. **Use aria-describedby** - For supplementary content announcement
3. **Progressive enhancement** - Accept that grid navigation is "good enough" for now

---

## Go/No-Go Recommendation

### **NO-GO** for current plan

**Rationale:**
1. Does not fully solve the stated problem (interactive elements remain in Cell 1)
2. High plugin breakage risk with no mitigation plan
3. CSS approach is fragile and will cause visual regressions
4. Effort-to-benefit ratio unfavorable

### Alternative: **GO** for Incremental Improvements

Instead of 3-cell restructure, pursue:
1. Improve `postContentLabel` to be more informative
2. Test NVDA latest versions for improved aria-label support
3. Document the NVDA limitation for users
4. Consider restructure only if plugins are updated first

---

## References

- [WAI-ARIA Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
- [NVDA Browse Mode Documentation](https://www.nvaccess.org/files/nvda/documentation/userGuide.html)
- Current implementation: `docs/accessibility/04-topic-thread.md`
- Original plan: `docs/research/3-cell-post-structure-implementation.md`

---

## Appendix: Files Reviewed

| File | Purpose |
|------|---------|
| `post.gjs` (826 lines) | Main post component, current 2-cell structure |
| `post-stream-navigation.js` (555 lines) | Keyboard navigation modifier |
| `post/menu.gjs` (692 lines) | Post actions toolbar component |
| `desktop/topic-post.scss` (697 lines) | Desktop post styles |
| `common/base/topic-post.scss` (1844 lines) | Common post styles |
| `post/meta-data.gjs` | Metadata component with interactive elements |
| `post/meta-data/poster-name.gjs` | Contains UserLink, GroupLink |
| `04-topic-thread.md` | Accessibility planning documentation |
| `3-cell-post-structure-implementation.md` | Original implementation plan |
