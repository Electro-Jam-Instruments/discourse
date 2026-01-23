# Timeline Slider Accessibility - Risk Assessment

**Status:** Decision Made - Remove from Keyboard Navigation
**Assessed:** 2026-01-23
**Decision Date:** 2026-01-23
**Related:** [14-timeline-slider.md](14-timeline-slider.md), [14-timeline-slider-dev-design.md](14-timeline-slider-dev-design.md)

## Chance of Success: 75%

### Justification

The plan is well-structured and correctly applies lessons from the focus-jumping bug (state flags vs timing hacks). However, several concerns could cause implementation friction or regressions.

**Strengths:**
- Correctly identifies state flag patterns over timing-based solutions
- Uses `queueMicrotask()` for flag clearing, matching existing patterns
- Leverages existing `jumpToIndex` mechanism
- Properly plans to update `aria-describedby` in `postScrolled` callback
- Includes phased implementation with clear risk assessments
- Comprehensive testing strategy including RTL and screen reader testing

**Weaknesses:**
- aria-describedby implementation has race condition risk
- Bidirectional sync (Phase 5) adds complexity with potential infinite loops
- Page Up/Down viewport calculation uses DOM queries that could be stale
- Focus region coordination is incomplete

---

## Open Concerns

### High Priority

1. **Focus Region Coordination Missing**
   - Slider is a THIRD navigation region (alongside grid-navigation and post-stream-navigation)
   - When Enter moves focus to grid, what prevents focus-history service or suggested topics grid from stealing focus?
   - This was the exact root cause of the 11-attempt focus-jumping bug
   - *Location: Section 5 (Bidirectional Sync)*

2. **aria-describedby Race Condition**
   - DOM check happens in `postScrolled`, but post may still be rendering
   - Cloaking uncloaking is asynchronous - DOM may not reflect final state
   - *Location: Section 4.3, Section 6.2*

3. **Event Loop Order Assumption**
   - Plan uses `queueMicrotask()` to clear `_isSliderNavigating`
   - But `postScrolled` is triggered by appEvent which may have different scheduling
   - *Location: Section 5.3*

4. **Timing Anti-Pattern in Referenced Code**
   - Design shows awareness but doesn't provide concrete alternative for macrotask timing gaps
   - *Location: Section 4.1*

### Medium Priority

1. **Scroller Component Prop Bloat** - 7+ new props tightly couple accessibility state
2. **Post Row ID Gaps** - Deleted posts create numbering gaps
3. **RTL Locale List** - Hardcoded array will become stale
4. **Page Up/Down Expensive** - DOM queries during rapid keypresses
5. **Missing Debounce** - No rate limiting on `jumpToIndex` calls

### Low Priority

1. No error boundary for aria-describedby failures
2. Focus style CSS may need vendor prefixes
3. i18n string namespace consistency
4. Tablet/responsive breakpoint handling

---

## Recommendations

### Must Address Before Implementation

1. **Resolve Timing Anti-Pattern** - Use pure state flags, no timing guards
2. **Add Focus Region Coordination** - Emit `navigation:region-activated` event
3. **Event-Driven aria-describedby** - Use MutationObserver or accept one-event lag

### Should Address During Implementation

1. Add 30ms debounce to keyboard navigation (rate limiting, not race condition fix)
2. Simplify Page Up/Down calculation
3. Create integration test for focus coordination
4. Validate post row IDs exist before setting aria-describedby

### Nice to Have

1. Progressive enhancement
2. aria-live region for position announcements
3. Document focus management coordination patterns

---

## Recommended Approach

Start with **Phases 1-3 only** (basic ARIA without bidirectional sync):
- Phase 1: ARIA attributes
- Phase 2: Keyboard navigation
- Phase 3: RTL support

Test with NVDA before implementing Phase 5.

Treat **Phase 5 (Bidirectional Sync) as a separate PR** with its own review cycle due to focus coordination complexity.

---

## Alternative: Skip Keyboard Accessibility

**Question raised:** Since all navigation can be done from the post grid, is slider keyboard accessibility needed at all?

### Arguments for skipping:

1. **Duplicate functionality** - Arrow keys in the grid already navigate posts
2. **Complexity** - 75% success rate means 25% chance of regressions
3. **Focus coordination risk** - Adding a third navigation region increases bug surface
4. **Development time** - Could be spent on higher-impact accessibility work

### Arguments for keeping:

1. **WAI-ARIA compliance** - Interactive controls should be keyboard accessible
2. **Screen reader users** - Some prefer slider-style navigation for long topics
3. **Parity with mouse** - Keyboard users should have same capabilities

### Possible middle ground:

1. Make slider **focusable** (`tabindex="0"`) with proper ARIA attributes
2. But **skip keyboard navigation** - just announce current position
3. User can Tab to it, hear "Post 5 of 20", then Tab away
4. Navigation remains in the grid

This gives screen reader users the position information without the complexity of duplicate navigation.

---

## Decision Made

- [ ] Full implementation (Phases 1-6)
- [ ] Partial implementation (Phases 1-3 only, no sync)
- [ ] Minimal (focusable with ARIA, no keyboard nav)
- [x] **Remove from keyboard navigation** - Keep mouse functionality, skip Tab order

### Rationale

The post stream grid now provides full keyboard navigation for all posts:
- Arrow Up/Down moves between posts
- Arrow Left/Right navigates within post content
- Home/End jumps to first/last post
- All post actions are accessible from the grid

The timeline slider duplicates this functionality. Adding keyboard navigation to the slider would:
1. Create a third navigation region with 25% regression risk
2. Require complex bidirectional sync between slider and grid
3. Add development time better spent on higher-impact accessibility work

### Implementation

Added `tabindex="-1"` to all focusable elements in the timeline:
- Date links (start date, end date)
- DButtons (Show Summary, Reply, Jump to post)
- BackButton
- TopicNotificationsButton

**Result:** Mouse users can still click/drag the timeline. Keyboard users skip it entirely and use the grid instead.
