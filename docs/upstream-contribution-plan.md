# Upstream Contribution Plan

This document outlines our plan to contribute our accessibility work back to the Discourse community.

## Demo Environment

Our accessibility implementation can be tested at:
- **URL**: https://community.electro-jam.com
- **Status**: Running our `accessibility` branch with 132 commits ahead of upstream, 82 of them titled A11Y (as of 2026-11-07)

This live deployment serves as a demonstration of all accessibility features working together in production.

## Contribution Strategy

### Phase 1: RFC on Meta

Before submitting code, post an RFC (Request for Comments) on meta.discourse.org to:

1. **Explain the accessibility approach**
   - WAI-ARIA patterns being implemented (toolbar, grid, tree)
   - Why single tab stop navigation matters for screen reader users
   - Overview of the keyboard navigation model (roving tabindex)

2. **Get community feedback**
   - Validate approach with Discourse team
   - Identify potential conflicts with existing features
   - Build consensus before code review

3. **Share demo**
   - Link to community.electro-jam.com for live testing
   - Invite screen reader users to test and provide feedback

### Phase 2: Bundles that make a complete experience

Updated 2026-11-07. The original nine pull requests were split by file. A
member experiences the work as whole journeys, and several pieces only make
sense together (a single Tab stop is only useful if the next stop lands
somewhere sensible), so the pull requests are now grouped by experience.

Upstream already ships a general keyboard engine, `d-roving-focus`, and has
no grid or tree patterns at all. See
`docs/research/upstream-a11y-overlap-2026-11.md`. Every bundle below is built
on that engine, keeping our roles, labels and behaviour, and keeps upstream's
j/k row selection working alongside our arrow keys.

Always on (no flag, nothing else depends on them):

1. **Visible focus ring.** The single focus rule and its tokens.
2. **Announcements.** Alert banners and live regions.

Behind the opt-in setting (they change how Tab works). The setting ships with
the first of these, bundle 3, not after it:

3. **The top of every page.** Nav bar tabs, the breadcrumb toolbar, the New
   Topic and dismiss toolbar, the New list All/Topics/Replies tab group,
   dropdown menus, and focus landing in the list after a filter is chosen.
4. **Find and open a topic.** Topic list grid, header row, empty states,
   focus on the first unread, and focus restored on browser back.
5. **Browse categories.** Category grid, its empty state, and the latest
   topics list on that page. Reuses bundle 4's grid code.
6. **Read a topic.** Post stream grid, topic header row, action toolbar, and
   reading a post's content. Depends on bundle 4. Link-by-link navigation in
   post text (docs/accessibility/16) is not built and stays out.
7. **Site chrome.** Sidebar tree, header icon and sign-in toolbars. Sidebar
   drag and drop needs a keyboard alternative; upstream's reorderable list
   has a move menu that may supply one.

Order: 1 and 2, then 3 with the setting, then 4, 5, 6, 7. Each bundle is
rebuilt on upstream's code fresh from `upstream/main`, not copied from our branch.

#### Where our branch stands against these bundles (2026-11-08)

- Done and tested on staging: focus ring rule; New list tab group; toolbars and
  tab groups running on `d-roving-focus` (same results as before); selected
  row kept in step with focus so j/k, o, l and s act on the row you are on;
  one Tab stop kept after upstream's post-jump focus; header toolbar arrows no
  longer pulled into the posts on a fresh topic page.
- Deliberately deferred: sidebar tree on the engine. It has nested toolbars,
  popups and, today, more than one Tab stop inside the tree, so it needs its
  own careful before and after test.
- For the upstream pull requests only: the grid, toolbar and tree roles render
  even when the enhanced keyboard navigation setting is off. That is fine for
  our site, since a screen reader still gets rows, columns and headers in browse
  mode. Reviewers may want the default experience unchanged unless the setting
  is on, so decide when preparing each bundle whether the roles follow the flag.
- Known gap: sidebar drag and drop has no keyboard path (staging finding 5).
- Known gap: the first j after arrowing used to select instead of move; fixed
  by the selection sync, but upstream's own first-press behaviour is unchanged.

### Phase 3: Iteration and Review

For each PR:

1. **Submit PR** with clear description referencing:
   - The RFC discussion
   - WAI-ARIA pattern documentation
   - Testing instructions for screen readers

2. **Respond to feedback** - Be prepared for:
   - Code style changes
   - Alternative implementation approaches
   - Requests for additional testing

3. **Maintain PRs** - Keep PRs rebased on upstream main as they evolve

## Documentation to Include

Each PR should reference:
- Our `docs/accessibility/` documentation
- WAI-ARIA APG patterns
- Testing done with NVDA, JAWS, VoiceOver

## Timeline Tracking

- Demo deployed: done, community.electro-jam.com (staging for testing)
- Request for comments drafted: pending
- Request for comments posted to Meta: pending
- Bundle 1, focus ring: pending
- Bundle 2, announcements: pending
- Bundle 3, top of every page, with the opt-in setting: pending
- Bundle 4, topic list: pending
- Bundle 5, categories: pending
- Bundle 6, reading a topic: pending
- Bundle 7, site chrome: pending

## Community Testing Topic

Create a topic on community.electro-jam.com to guide testers and collect feedback.

### Suggested Topic Title
"Accessibility Testing Guide - Help Us Improve Keyboard & Screen Reader Navigation"

### Topic Content Template

```markdown
# Accessibility Testing Guide

We've implemented comprehensive keyboard navigation and screen reader support for Discourse. We'd love your feedback!

## What We've Built

This forum now supports WAI-ARIA patterns for accessible navigation:
- **Single tab stop navigation** - Complex UI regions work as single tab stops with arrow keys inside
- **Screen reader optimizations** - Proper labels, roles, and announcements for assistive technology
- **Keyboard parity** - Everything accessible via keyboard

## How to Test

### 1. Topic List Navigation (Homepage)

**Keyboard users:**
1. Tab to the topic list
2. Use **Arrow Up/Down** to move between topics
3. Use **Arrow Left/Right** to navigate within a row (title, category, etc.)
4. Press **Enter** to open a topic
5. Use **Ctrl+Home/End** to jump to first/last topic

**Screen reader users:**
- Each row announces: topic title, author, reply count, last activity
- Grid role provides structured navigation

**Try it:** Go to the homepage and navigate through topics without using a mouse.

---

### 2. Navigation Bar (Categories, Tags, Tabs)

**Keyboard users:**
1. Tab to the navigation bar
2. Use **Arrow Left/Right** to move between items (Latest, Hot, Categories, etc.)
3. Press **Enter** to select

**Screen reader users:**
- Toolbar role announces available options
- Current selection is indicated

**Try it:** Navigate from "Latest" to "Categories" using only arrow keys.

---

### 3. Reading Posts in a Topic

**Keyboard users:**
1. Open any topic
2. Use **Arrow Up/Down** to move between posts
3. Press **Arrow Right** to enter the post content for reading
4. Press **Arrow Left** to exit back to post navigation
5. Use **Tab** within a post to access actions (like, reply, etc.)

**Screen reader users:**
- Posts announce author and content summary
- Full post content readable when you arrow into it
- Post actions available as toolbar

**Try it:** Open a topic and read through posts using only the keyboard.

---

### 4. Sidebar Navigation

**Keyboard users:**
1. Tab to the sidebar
2. Use **Arrow Up/Down** to move between items
3. Use **Arrow Left/Right** to collapse/expand sections
4. Press **Enter** to select

**Screen reader users:**
- Tree role provides hierarchical navigation
- Expanded/collapsed state announced

**Try it:** Navigate the sidebar categories without using a mouse.

---

### 5. Browser Back/Forward

**Keyboard users:**
- **Alt+Left** goes back in browser history
- **Alt+Right** goes forward
- These now work even when grid rows have focus

**Try it:** Navigate to a topic, then use Alt+Left to go back.

---

## Testing with Screen Readers

We've tested with:
- **NVDA** (Windows) - Free, recommended
- **JAWS** (Windows)
- **VoiceOver** (Mac)

If you use a screen reader, we especially want your feedback on:
- Are announcements clear and helpful?
- Is navigation intuitive?
- Are there any confusing or missing labels?

---

## Give Feedback

Reply to this topic with:
1. **What you tested** (which feature)
2. **How you tested** (keyboard only, screen reader, which one)
3. **What worked well**
4. **What could be improved**
5. **Any bugs or issues**

Your feedback helps us improve accessibility for everyone and will be shared with the broader Discourse community.

---

## Technical Details

For developers interested in the implementation:
- GitHub: [Electro-Jam-Instruments/discourse](https://github.com/Electro-Jam-Instruments/discourse) (accessibility branch)
- 132 commits ahead of upstream (82 titled A11Y) implementing WAI-ARIA patterns
- Based on [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
```

### Post This Topic When
- Before posting RFC to meta.discourse.org
- After deploying latest accessibility changes
- When inviting testers from the Discourse community

## Issue Tracking & Feedback Pipeline

### Why We Need This

Until accessibility work is merged upstream to Discourse, we need to:
1. **Collect feedback** from our community.electro-jam.com users
2. **Track bugs locally** so nothing falls through the cracks
3. **Integrate with Electro Jam's existing workflow** via Microsoft Teams
4. **Triage and prioritize** issues using our standard process
5. **Document fixes** so they can be included in upstream PRs

This pipeline connects community feedback directly to our Teams channels where the Electro Jam team already works, ensuring accessibility issues get the same visibility and response as other product work.

### How We'll Manage It (Short-Term)

1. **Community reports issue** on community.electro-jam.com testing topic
2. **We create GitHub issue** with `accessibility` label in our fork
3. **Teams notification fires** to `#discourse-accessibility` channel
4. **Team triages** using priority levels below
5. **Fix is implemented** and deployed to community.electro-jam.com
6. **Issue closed** and tracked in local docs for upstream inclusion

This keeps accessibility work visible alongside other Electro Jam projects and ensures timely response to user feedback.

### GitHub Issues Setup

Create a dedicated label and issue template in our fork:

**Label:** `accessibility` (color: `#0052CC`)

**Issue Template:** `.github/ISSUE_TEMPLATE/accessibility-feedback.md`

```markdown
---
name: Accessibility Feedback
about: Report accessibility issues or suggest improvements
title: '[A11Y] '
labels: accessibility
assignees: ''
---

## Type
- [ ] Bug - Something doesn't work as expected
- [ ] Enhancement - Suggestion for improvement
- [ ] Screen Reader Issue - Announcement/navigation problem
- [ ] Keyboard Navigation - Can't reach or interact with something

## Environment
- **Browser:** (Chrome, Firefox, Edge, Safari)
- **Screen Reader:** (NVDA, JAWS, VoiceOver, None)
- **Operating System:** (Windows, Mac, Linux)

## Description
[Describe the issue or suggestion]

## Steps to Reproduce (for bugs)
1.
2.
3.

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Screenshots/Recordings
[If applicable, add screenshots or screen recordings]

## Additional Context
[Any other relevant information]
```

### Teams Integration

Connect GitHub issues to Microsoft Teams for real-time notifications.

**Setup Steps:**
1. In Teams, go to the target channel (e.g., `#discourse-accessibility`)
2. Add the GitHub connector: Apps > GitHub > Add to a team
3. Configure notifications for:
   - New issues with `accessibility` label
   - Issue comments
   - Issue closed/reopened

**Webhook URL Format:**
```
https://outlook.office.com/webhook/{team-id}/IncomingWebhook/{webhook-id}
```

**Alternative: Power Automate Flow**
1. Trigger: When a GitHub issue is created/updated
2. Condition: Labels contain "accessibility"
3. Action: Post to Teams channel with:
   - Issue title
   - Reporter
   - Link to issue
   - Type (bug/enhancement)

### Local Bug Tracking

Track issues locally in `docs/bugs/` until resolved:

**File:** `docs/bugs/accessibility-issues.md`

```markdown
# Accessibility Issues Tracker

## Open Issues

| # | Title | Type | Reported | Status |
|---|-------|------|----------|--------|
| 1 | Example issue | Bug | 2026-01-17 | Investigating |

## Resolved Issues

| # | Title | Resolution | Closed |
|---|-------|------------|--------|
```

### Workflow

```
Community Feedback (Discourse topic)
         │
         ▼
GitHub Issue Created (accessibility label)
         │
         ▼
Teams Notification ──────► Team Awareness
         │
         ▼
Local Tracking (docs/bugs/)
         │
         ▼
Fix Implemented
         │
         ▼
Deploy to community.electro-jam.com
         │
         ▼
Close Issue + Update Local Tracker
         │
         ▼
Include in Upstream PR (if applicable)
```

### Transition to Upstream

Once accessibility work is merged to Discourse main:

1. **Close our GitHub issues** with note: "Merged upstream in PR #XXX"
2. **Archive local tracker** to `docs/bugs/archived/`
3. **Update community topic** directing future feedback to:
   - meta.discourse.org for Discourse-wide issues
   - Our community for site-specific issues
4. **Remove Teams webhook** for accessibility label (or keep for site-specific)

### Issue Triage Guidelines

**Priority Levels:**
- **P0 - Critical:** Completely blocks access (can't navigate at all)
- **P1 - High:** Major functionality inaccessible
- **P2 - Medium:** Workaround exists but experience is poor
- **P3 - Low:** Minor annoyance, nice-to-have improvement

**Response Times:**
- P0: Same day acknowledgment, fix ASAP
- P1: 24-48 hour acknowledgment
- P2-P3: Weekly triage

## Contact

For questions about this accessibility work:
- Demo: community.electro-jam.com
- GitHub: Electro-Jam-Instruments/discourse (accessibility branch)
