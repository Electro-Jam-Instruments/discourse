# Orchestration Plan: Toolbar and Grid Accessibility

This document defines the orchestration workflow for implementing navigation toolbar and topic list grid accessibility features. Work is broken into discrete tasks that can be delegated to sub-agents for implementation and testing.

## Orchestration Overview

```
ORCHESTRATOR (Claude)
    │
    ├── BUILD AGENT: Implements code changes
    │       └── Returns: Modified files, implementation notes
    │
    ├── TEST AGENT: Writes and runs tests
    │       └── Returns: Test results, coverage report
    │
    └── REVIEW AGENT: Validates accessibility compliance
            └── Returns: ARIA audit, keyboard navigation verification
```

## Phase 1: Navigation Bar Toolbar

### Task 1.1: Create Toolbar Navigation Modifier

**Assign to:** Build Agent

**Deliverable:** New file `frontend/discourse/app/modifiers/toolbar-navigation.js`

**Requirements:**
- Implement roving tabindex pattern
- Handle ArrowLeft/ArrowRight for horizontal navigation
- Handle Home/End for first/last item
- Wrap navigation at ends
- Skip disabled/hidden items

**Files to create:**
```
frontend/discourse/app/modifiers/toolbar-navigation.js
```

**Acceptance criteria:**
- [ ] Modifier exports default class extending Modifier
- [ ] Handles keydown events for arrow keys
- [ ] Updates tabindex on focus changes
- [ ] Cleans up event listeners on destroy

---

### Task 1.2: Create Keyboard Navigation Utilities

**Assign to:** Build Agent

**Deliverable:** New file `frontend/discourse/app/lib/keyboard-navigation-utils.js`

**Requirements:**
- `getNextIndex(elements, currentIndex, wrap)` function
- `getPreviousIndex(elements, currentIndex, wrap)` function
- `isNavigable(element)` function
- `updateRovingTabindex(elements, activeIndex)` function

**Files to create:**
```
frontend/discourse/app/lib/keyboard-navigation-utils.js
```

**Acceptance criteria:**
- [ ] All functions exported and documented with JSDoc
- [ ] Handles edge cases (empty arrays, out of bounds)
- [ ] Pure functions with no side effects (except updateRovingTabindex)

---

### Task 1.3: Update Navigation Bar Component

**Assign to:** Build Agent

**Deliverable:** Modified `navigation-bar.gjs` with toolbar role and modifier

**Requirements:**
- Add `role="toolbar"` to container
- Add `aria-label` for screen readers
- Add `aria-orientation="horizontal"`
- Apply `{{toolbarNavigation}}` modifier
- Import and wire up the modifier

**Files to modify:**
```
frontend/discourse/app/components/navigation-bar.gjs
```

**Acceptance criteria:**
- [ ] Container has `role="toolbar"`
- [ ] Modifier attached and functional
- [ ] Existing functionality preserved

---

### Task 1.4: Update Navigation Item Component

**Assign to:** Build Agent

**Deliverable:** Modified `navigation-item.gjs` with proper tabindex

**Requirements:**
- Accept tabindex as argument
- Add `aria-current="page"` for active item
- Ensure focusable elements have correct tabindex

**Files to modify:**
```
frontend/discourse/app/components/navigation-item.gjs
```

**Acceptance criteria:**
- [ ] Tabindex passed through correctly
- [ ] Active page marked with aria-current
- [ ] No breaking changes to existing behavior

---

### Task 1.5: Add Toolbar i18n Strings

**Assign to:** Build Agent

**Deliverable:** Updated locale file with toolbar labels

**Requirements:**
- Add `navigation.toolbar_label` string
- Keep string concise for screen readers

**Files to modify:**
```
config/locales/client.en.yml
```

**Acceptance criteria:**
- [ ] String added under correct YAML path
- [ ] No YAML syntax errors

---

### Task 1.6: Write Toolbar Unit Tests

**Assign to:** Test Agent

**Deliverable:** QUnit tests for toolbar modifier

**Requirements:**
- Test arrow key navigation
- Test Home/End keys
- Test tabindex updates
- Test focus management

**Files to create:**
```
frontend/discourse/tests/unit/modifiers/toolbar-navigation-test.js
```

**Acceptance criteria:**
- [ ] All keyboard shortcuts tested
- [ ] Edge cases covered (first/last item)
- [ ] Tests pass with `bin/qunit`

---

### Task 1.7: Write Toolbar Integration Tests

**Assign to:** Test Agent

**Deliverable:** Integration tests for navigation-bar component

**Requirements:**
- Test toolbar renders with correct ARIA
- Test keyboard navigation works end-to-end
- Test dropdown interaction doesn't break toolbar

**Files to create:**
```
frontend/discourse/tests/integration/components/navigation-bar-a11y-test.js
```

**Acceptance criteria:**
- [ ] ARIA attributes verified
- [ ] Keyboard navigation verified
- [ ] Tests pass with `bin/qunit`

---

### Task 1.8: Write Toolbar System Specs

**Assign to:** Test Agent

**Deliverable:** System specs for full browser testing

**Requirements:**
- Test in real browser with Capybara
- Verify ARIA attributes in DOM
- Test keyboard navigation flow

**Files to create:**
```
spec/system/navigation_toolbar_a11y_spec.rb
```

**Acceptance criteria:**
- [ ] Tests run in headless Chrome
- [ ] ARIA roles verified
- [ ] Tests pass with `bin/rspec`

---

### Task 1.9: Accessibility Review

**Assign to:** Review Agent

**Deliverable:** Accessibility audit report

**Requirements:**
- Verify ARIA roles match W3C toolbar pattern
- Verify keyboard navigation matches Fluent UI behavior
- Check screen reader announcements
- Validate roving tabindex implementation

**Acceptance criteria:**
- [ ] All ARIA attributes correct
- [ ] Keyboard behavior matches spec
- [ ] No accessibility violations

---

## Phase 2: Topic List Grid

### Task 2.1: Create Grid Navigation Modifier

**Assign to:** Build Agent

**Deliverable:** New file `frontend/discourse/app/modifiers/grid-navigation.js`

**Requirements:**
- Handle ArrowUp/ArrowDown for row navigation
- Handle Home/End for first/last row
- Handle PageUp/PageDown for jumping rows
- Handle Enter to activate row
- Implement roving tabindex on rows
- Support infinite scroll loading

**Files to create:**
```
frontend/discourse/app/modifiers/grid-navigation.js
```

**Acceptance criteria:**
- [ ] All keyboard shortcuts implemented
- [ ] Infinite scroll triggered at boundary
- [ ] Focus management correct

---

### Task 2.2: Update Topic List Component

**Assign to:** Build Agent

**Deliverable:** Modified `list.gjs` with grid role

**Requirements:**
- Add `role="grid"` to table
- Add `aria-rowcount` for total topics
- Add `role="rowgroup"` to thead/tbody
- Apply `{{gridNavigation}}` modifier
- Pass onRowActivate callback

**Files to modify:**
```
frontend/discourse/app/components/topic-list/list.gjs
```

**Acceptance criteria:**
- [ ] Grid role applied correctly
- [ ] Row count reflects total (for virtualization)
- [ ] Modifier wired up

---

### Task 2.3: Update Topic List Item Component

**Assign to:** Build Agent

**Deliverable:** Modified `item.gjs` with row role

**Requirements:**
- Add `role="row"` to tr
- Add `aria-rowindex` for logical position
- Add `role="gridcell"` to td elements
- Accept and apply tabindex

**Files to modify:**
```
frontend/discourse/app/components/topic-list/item.gjs
```

**Acceptance criteria:**
- [ ] Row role applied
- [ ] Row index correct (2-based, 1 is header)
- [ ] Gridcell role on cells

---

### Task 2.4: Update Topic List Header Component

**Assign to:** Build Agent

**Deliverable:** Modified `header.gjs` with header row role

**Requirements:**
- Add `role="row"` to header tr
- Add `aria-rowindex="1"` for header row
- Add `role="columnheader"` to th elements

**Files to modify:**
```
frontend/discourse/app/components/topic-list/header.gjs
```

**Acceptance criteria:**
- [ ] Header row marked correctly
- [ ] Column headers have correct role

---

### Task 2.5: Add Grid i18n Strings

**Assign to:** Build Agent

**Deliverable:** Updated locale file with grid labels

**Requirements:**
- Add screen reader announcement strings
- Add grid/row/cell labels if needed

**Files to modify:**
```
config/locales/client.en.yml
```

**Acceptance criteria:**
- [ ] Strings added correctly
- [ ] No YAML errors

---

### Task 2.6: Write Grid Unit Tests

**Assign to:** Test Agent

**Deliverable:** QUnit tests for grid modifier

**Requirements:**
- Test arrow key navigation
- Test Home/End/PageUp/PageDown
- Test Enter activation
- Test tabindex management
- Test infinite scroll trigger

**Files to create:**
```
frontend/discourse/tests/unit/modifiers/grid-navigation-test.js
```

**Acceptance criteria:**
- [ ] All keyboard shortcuts tested
- [ ] Infinite scroll tested
- [ ] Tests pass

---

### Task 2.7: Write Grid Integration Tests

**Assign to:** Test Agent

**Deliverable:** Integration tests for topic-list component

**Requirements:**
- Test grid renders with correct ARIA
- Test row navigation
- Test Enter opens topic

**Files to create:**
```
frontend/discourse/tests/integration/components/topic-list-a11y-test.js
```

**Acceptance criteria:**
- [ ] ARIA verified
- [ ] Navigation verified
- [ ] Tests pass

---

### Task 2.8: Write Grid System Specs

**Assign to:** Test Agent

**Deliverable:** System specs for grid

**Requirements:**
- Full browser test
- Verify keyboard navigation
- Verify topic opens on Enter

**Files to create:**
```
spec/system/topic_list_grid_a11y_spec.rb
```

**Acceptance criteria:**
- [ ] Tests run in browser
- [ ] Navigation works
- [ ] Tests pass

---

### Task 2.9: Accessibility Review

**Assign to:** Review Agent

**Deliverable:** Grid accessibility audit

**Requirements:**
- Verify ARIA matches Fluent UI DataGrid pattern
- Verify keyboard behavior
- Check virtualization aria-rowindex correctness

**Acceptance criteria:**
- [ ] ARIA correct
- [ ] Keyboard correct
- [ ] No violations

---

## Task Execution Order

```
Phase 1: Toolbar
├── 1.1 Create modifier ──────────────────┐
├── 1.2 Create utilities ─────────────────┤
│                                         ├──► 1.3 Update navigation-bar
│                                         │    └──► 1.4 Update navigation-item
│                                         │         └──► 1.5 Add i18n
│                                         │              └──► 1.6 Unit tests
│                                         │                   └──► 1.7 Integration tests
│                                         │                        └──► 1.8 System specs
│                                         │                             └──► 1.9 Review
Phase 2: Grid
├── 2.1 Create modifier ──────────────────┐
│                                         ├──► 2.2 Update list.gjs
│                                         │    └──► 2.3 Update item.gjs
│                                         │         └──► 2.4 Update header.gjs
│                                         │              └──► 2.5 Add i18n
│                                         │                   └──► 2.6 Unit tests
│                                         │                        └──► 2.7 Integration tests
│                                         │                             └──► 2.8 System specs
│                                         │                                  └──► 2.9 Review
```

## Agent Handoff Protocol

### Build Agent Handoff

```
ORCHESTRATOR → BUILD AGENT
├── Task ID and description
├── Files to create/modify
├── Specific requirements
├── Acceptance criteria
└── Reference documentation links

BUILD AGENT → ORCHESTRATOR
├── Files created/modified (with paths)
├── Implementation notes
├── Any blockers encountered
└── Ready for testing confirmation
```

### Test Agent Handoff

```
ORCHESTRATOR → TEST AGENT
├── Task ID and description
├── Files to test
├── Test scenarios required
├── Expected behavior
└── Test file locations

TEST AGENT → ORCHESTRATOR
├── Test files created
├── Test results (pass/fail)
├── Coverage notes
└── Any failures to address
```

### Review Agent Handoff

```
ORCHESTRATOR → REVIEW AGENT
├── Feature to review
├── ARIA patterns to verify
├── Keyboard behaviors to check
├── Reference specs (Fluent UI, W3C)

REVIEW AGENT → ORCHESTRATOR
├── ARIA audit results
├── Keyboard navigation verification
├── Issues found
└── Approval or rework needed
```

## Rollback Plan

If issues are found after deployment:

1. **Immediate:** Disable via site setting (if implemented)
2. **Short-term:** Revert specific commits
3. **Long-term:** Fix issues and re-deploy

## Success Metrics

| Metric | Target |
|--------|--------|
| All tests passing | 100% |
| ARIA roles correct | 100% |
| Keyboard navigation working | All shortcuts |
| Screen reader announces correctly | Verified with NVDA |
| No regressions | Existing tests pass |
| Linting passes | No errors |

## References

- [Fluent UI DataGrid](https://react.fluentui.dev/?path=/docs/components-datagrid--docs)
- [W3C Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)
- [W3C Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
- [docs/grid/NAVIGATION-TOOLBAR.md](NAVIGATION-TOOLBAR.md)
- [docs/grid/TOPIC-LIST-GRID.md](TOPIC-LIST-GRID.md)
- [docs/grid/TESTING.md](TESTING.md)
