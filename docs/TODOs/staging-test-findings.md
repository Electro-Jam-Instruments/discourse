# Staging Test Findings — September 2026 Merge

Issues found while testing the `accessibility` branch on
`discoursestaging.electro-jam.com` after the 3306-commit upstream merge.

**Gathering only. Do not fix until the list is complete** — several of these may
share a root cause, and fixing them one at a time risks papering over it.

Staging is running commit `1babf658aa5` with production data restored from the
2026-09-05 backup.

---

## 1. Focus ring on navigation tabs is dark, should be white

**Status:** open — reported by Brett, not yet investigated

**Where:** Navigation bar tabs (`Latest` / `Hot` / `Categories`)

**Expected:** White focus ring around the focused tab.

**Actual:** The ring renders very dark — near-black against the dark header, so
the focused tab is hard to distinguish. Screenshot shows `Hot` focused with a
dark rounded rectangle where a white one should be.

**Why this matters:** This is the primary keyboard focus indicator for the
toolbar pattern. A low-contrast focus ring fails WCAG 2.4.7 (Focus Visible) and
2.4.11 (Focus Appearance), and makes keyboard navigation hard to follow for
sighted keyboard users.

**Suspected cause — unverified, listed worst-first:**

- The merge changed the design token values or their dark-theme mappings.
  `--token-color-background-accent-bolder` maps to `var(--tertiary)` in
  `common/tokens.scss`, and `--tertiary` may resolve differently in the dark
  scheme now.
- Commit `b7d96a6099b` in this branch swapped `var(--tertiary)` for
  `var(--token-color-background-accent-bolder)` in `sidebar-section.scss` and
  `sidebar-section-link.scss` to satisfy stylelint's
  `discourse/no-core-color-variables`. That change was verified as
  colour-identical for the sidebar, but the nav toolbar was not part of it —
  worth checking whether the toolbar picks up a related variable.
- Upstream restyled the nav bar during the merge and the focus ring is
  inheriting a new default.

**To investigate when fixing:**

- Computed `outline-color` / `box-shadow` on the focused tab, light vs dark
- Whether this reproduces in the light theme
- Compare against production (`community.electro-jam.com`), which is on the
  pre-merge commit, to confirm it is a regression rather than long-standing
- `_topic-list.scss`, `topic-post.scss`, and the toolbar focus styles listed in
  `docs/accessibility/00-index.md`

---

## 2. Cannot reset a password on staging — email is disabled

**Status:** open — worked around, root cause not addressed

**Where:** Staging login, any account

**Problem:** Staging restores production's password hashes, so anyone whose
password has changed since the backup — or who signs in to production with a
passkey or a saved browser credential — cannot log in. "I forgot my password"
also fails, because outgoing email is disabled on staging by design.

**Worked around by** generating a reset token via `rails runner` and handing
over the URL directly.

**Why this matters:** every future staging refresh hits this. It is a gap in
the staging setup, not a bug in the branch.

**Options:** document the reset-link command in `DEPLOYMENT.md`, or provision a
known staging-only admin account as part of the refresh procedure.

---

## 3. Focus ring on "New Topic" button is also poor

**Status:** open — reported by Brett, not yet investigated

**Where:** "New Topic" button in the topic list controls toolbar

**Expected:** Clearly visible, high-contrast focus ring.

**Actual:** Ring is dark and thin against the blue button — hard to see that
the button is focused.

**Why this matters:** Same WCAG 2.4.7 / 2.4.11 problem as finding 1. This is
part of the navigation controls toolbar
(`docs/accessibility/10-navigation-controls-toolbar.md`).

---

## 4. "Browse channels" button gets no focus ring

**Status:** open — strong lead, see below

**Where:** Chat sidebar, `CHANNELS` section header — the pencil / browse button
inside the section header row.

**Expected:** A visible focus ring on the button itself when it is focused.

**Actual:** The section header row draws a blue ring around the whole row, but
the button inside it gets only a subtle grey background. There is no ring on
the button, so it is unclear which control is focused.

**This is a different failure from findings 1 and 3.** Those are rings that
render but are too dark. This is a ring that is suppressed entirely.

**Likely cause — this is our own code, `sidebar-section.scss` line 82:**

```scss
// Remove individual focus outline - wrapper handles it now
&:focus {
  outline: none;
  background-color: var(--token-color-surface-focused);
}
```

`outline: none` is deliberate — the intent was that the section header wrapper
draws one ring for the whole row rather than the button drawing its own. But
the result is that when focus moves *to the button*, nothing distinguishes it
from the row being focused. The wrapper ring looks identical in both states.

This came through the merge in commit `b7d96a6099b` / the sidebar-section
conflict resolution, where our `outline: none` was kept alongside upstream's
new `background-color`. The background colour was presumably meant to be the
differentiator, but `--token-color-surface-focused` is too subtle against the
sidebar background to read as a focus state.

**When fixing, decide the intended model first:**

- If the wrapper owns the ring, the button needs a clearly distinct treatment
  when focus is on it specifically — the current background is not enough.
- If the button should own its ring, drop `outline: none` and let it draw one,
  and make sure the wrapper does not double up.

Do not simply delete `outline: none` without checking the wrapper behaviour —
that is what it was added to stop.

---

## 5. Sidebar drag-and-drop has no keyboard equivalent

**Status:** open — Brett knows the approach, logging so it is not lost

**Where:** Sidebar link and section reordering. Upstream added this during the
September merge; it did not exist in the version production runs.

**Problem:** Reordering sidebar links and sections, and dropping external links
into the sidebar, are pointer-only. There is no keyboard path to the same
outcome.

**Why this matters:** WCAG 2.5.7 Dragging Movements (2.2, Level AA) requires
that any function using a dragging movement has a single-pointer alternative —
and by extension a keyboard one for our purposes. This is new functionality
arriving with the merge, so it is a regression in coverage rather than a
long-standing gap: production has no sidebar drag-and-drop to be inaccessible.

**Upstream is aware it is pointer-only.** From
`sidebar/user/sections.gjs`, on the drop zone:

```
{{! Where a section created from the drop would go: after the last
    custom section. Pointer-only, like the drag it serves; creating a
    section by keyboard keeps its own path. }}
```

and the zone itself carries `aria-hidden="true"`. So the drop target is
deliberately hidden from assistive technology, with the reasoning that keyboard
users reach the same outcome by another route. Worth confirming that other
route actually exists and is discoverable, rather than assuming it does.

**Files carrying the drag-and-drop implementation:**

- `frontend/discourse/app/components/sidebar/section.gjs`
- `frontend/discourse/app/components/sidebar/common/custom-section.gjs`
- `frontend/discourse/app/components/sidebar/user/sections.gjs`

Modifiers involved: `dDragAndDropTarget`, `dDragAndDropExternalTarget`,
`dDragAndDropAutoScroll`, `dDragDwell`, plus `WEB_LINK_ADOPTION` /
`WEB_LINK_KINDS` from `discourse/lib/sidebar/link-drop`.

**Note:** this interacts with our sidebar tree navigation
(`sidebar-tree-navigation.js`). Any keyboard reorder mechanism has to coexist
with the existing roving tabindex and arrow-key handling rather than fight it
for the same keys.

---

## ROOT CAUSE — focus rings (findings 1 and 3)

**The toolbar pattern was never given a focus style. It is a gap, not a
regression.**

Measured on staging, tabbing to the `Latest` nav tab with a real keypress:

```
outline-style:  auto          <- browser default, not ours
outline-width:  0.67px        <- ours would be 2px
outline-color:  rgb(238,238,238)   <- ignored; `auto` overrides it
:focus-visible: true
```

`outline-style: auto` is the user-agent default. Chrome then draws its own ring
and **ignores `outline-color`**, which is why it renders dark whatever we set.

Audit result — grep across `app/assets/stylesheets`:

- **No rule anywhere targets `[role="toolbar"]`**
- **No focus rule targets `.nav-pills` or the nav tabs**

Six components were given `role="toolbar"` with roving tabindex and arrow-key
handling in JavaScript:

- `d-navigation.gjs`
- `header/auth-buttons.gjs`
- `header/icons.gjs`
- `post/menu.gjs`
- `sidebar/section.gjs`
- `topic-footer-buttons.gjs`

**None of them received a corresponding CSS focus indicator.** The keyboard
behaviour was built; the visible affordance for it was not. Every one of these
falls back to the browser ring.

By contrast, the **grid** pattern was done properly — `_topic-list.scss`,
`category-list.scss`, `categories-topic-list.scss`, `topic-post.scss` and
`latest-topic-list.scss` all define `:focus` and `:focus-visible` using
`--d-grid-focus-outline-color`. So grid rows are fine and toolbars are not.

**Corrections to two earlier wrong diagnoses of mine, recorded so they are not
repeated:**

- Not "blue ring on blue button". Root tokens do resolve to `#099dd7`, but that
  was measured on `:root`. These elements never read that token.
- Not a selector that stopped matching in the merge. There was never a rule to
  stop matching.
- Not commit `b7d96a6099b`. That swap was colour-identical and irrelevant here.

**Fix:** add focus styles for the toolbar pattern, mirroring what the grid
pattern already does. Likely a shared rule on `[role="toolbar"] > *:focus-visible`
plus whatever the individual components need, using the existing
`--d-grid-focus-*` tokens or a matching `--d-toolbar-focus-*` set.

Check all six components, not just the two reported. The same gap exists in the
post menu, header icons, auth buttons and topic footer buttons — nobody has
tabbed to those yet.

**Verify by measuring, not by looking:** the test is that `outline-style` is no
longer `auto` on a keyboard-focused control. If it still reads `auto`, the rule
is not matching, whatever the screenshot suggests.

---

## Finding 4 is a separate cause

Do not fold finding 4 into the above. That one is `outline: none` in
`sidebar-section.scss` suppressing the ring entirely — a different failure
needing a different fix.

---

## Template for further findings

```
## N. Short description

**Status:** open
**Where:** page / component
**Expected:**
**Actual:**
**Why this matters:**
**Suspected cause:**
```
