# Upstream accessibility overlap check, 2026-11-07

Checked `upstream/main` (fetched 2026-11-01) against our branch
`merge-upstream-2026-11` before planning upstream pull requests.

## Numbers

- Our branch is 132 commits ahead of upstream; 82 of them are titled A11Y.
- Upstream has 296 commits titled A11Y in total, running at roughly 3 to 11
  a month through 2026.
- Since the September merge upstream landed three A11Y-titled commits and a
  handful of keyboard fixes.

## What upstream already has

- `d-roving-focus` (ui-kit modifier, TypeScript, with strategies, keyboard
  router and diagnostics). One engine for lists and CSS-grid layouts, with
  two modes: roving tabindex and active-descendant. It is deliberately
  role-agnostic: consumers supply roles. The styleguide has examples for a
  toolbar, tree, listbox, radio group, multi-select and combobox.
- `d-tabs` ui-kit primitive with a proper tablist.
- `roving-button-bar` helper, used by the editor and ProseMirror toolbars.
- Used so far in the editor toolbars, the reorderable list, tabs and the
  Ask AI search options (single tab stop with arrow keys, #43709, #43739).
- #44200: post receives focus after it renders when jumping to a post. This
  overlaps our post stream focus handling (`focusWhenRendered`).
- #44768: keyboard selection is kept when more topics load. This is the
  existing `j`/`k` topic selection model, which is separate from our arrow
  key grid and will need explaining in review.

## What upstream does not have

Counts of files in the app using each ARIA role, upstream versus ours:

- `role="grid"`: 0 versus 7
- `role="tree"`: 0 versus 4, and `role="treeitem"`: 0 versus 5
- `role="toolbar"`: 2 versus 12
- `role="tablist"`: 2 versus 7
- `role="menu"`: 1 versus 2

So the topic list grid, category grid, post stream grid and sidebar tree are
unclaimed. Toolbars, tabs and menus are partly covered.

## What this means for our pull requests

- Our own modifiers (`toolbar-navigation`, `tablist-navigation`,
  `grid-navigation`, `sidebar-tree-navigation`) duplicate what `d-roving-focus`
  does. Reviewers will ask why. Submitting them as they are risks rejection.
- The plan should rebuild each pattern on `d-roving-focus`, keeping our roles,
  labels and behaviour, and only keep custom code for what the engine says is
  the consumer's job (grid semantics, post document mode, focus restoration).
- The post-jump focus change (#44200) has to be reconciled with our post
  stream navigation before that pull request is written.
- The focus-ring rule, tab groups, dropdown menu roles and alert banners do
  not conflict with anything upstream has.

## Open questions

- Does `d-roving-focus` support row-and-cell navigation in a table-based grid,
  or only CSS grid layouts? The topic list is a `<table>`.
- Do we ask the Discourse team on Meta whether `d-roving-focus` is the intended
  base for new patterns?

## Reconciliation decisions (2026-11-07)

Based on reading `d-roving-focus`: it supports a one-dimensional list or a CSS
grid. A CSS grid publishes a track list the engine reads; a `<table>` does not,
so a table navigates on one axis only. It has an `onCrossAxis` hook and a
styleguide tree example, and leaves pattern meaning to the consumer.

Per modifier of ours:

- `toolbar-navigation` and `tablist-navigation`: straight replacement with
  `d-roving-focus` (horizontal, item selector). Low risk, do first.
- `sidebar-tree-navigation`: feasible on the engine using `onCrossAxis` for
  expand and collapse; the styleguide tree is the model. Medium risk.
- `grid-navigation` (topic list, categories): our model is row first, then
  cells inside the row, on a table. That is two nested groups, not one CSS
  grid. Needs nested engine groups plus our Ctrl+Home/End and Page keys.
  Medium to high risk; do after toolbars and tabs are proven upstream.
- `post-stream-navigation` (1548 lines: cloaking, focus guards, document mode):
  stays custom. Too specific to the post stream to offer upstream as is.
  Candidate to split later.

Done in this branch:

- Post jump focus (#44200): upstream's `focusWhenRendered` focused the post
  body with `tabindex="0"`, which would leave a second Tab stop in our grid.
  Inside `[role="row"]` it now sets `tabindex="-1"` and the roving tabindex
  keeps the single stop. Our `handleFocusIn` already records the row, so the
  position stays in sync. Needs a browser test: open a link straight to a post
  from another page and from a fresh load, then check Tab and arrow keys.

Still open:

- `j`/`k` topic selection (upstream keyboard shortcuts service) versus our
  arrow-key grid: how the two interact and whether they share a selection.
- Whether upstream wants new patterns built on `d-roving-focus` (ask on Meta).
