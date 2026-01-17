# Upstream Contribution Plan

This document outlines our plan to contribute our accessibility work back to the Discourse community.

## Demo Environment

Our accessibility implementation can be tested at:
- **URL**: https://community.electrojam.net
- **Status**: Running our `accessibility` branch with 39 A11Y commits

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
   - Link to community.electrojam.net for live testing
   - Invite screen reader users to test and provide feedback

### Phase 2: Feature-by-Feature PRs

Split the 39 A11Y commits into logical PRs in dependency order:

#### PR 1: Foundation - Keyboard Navigation Utilities
**Files:**
- `frontend/discourse/app/lib/keyboard-navigation-utils.js`

**Commits to include:**
- Shared navigation helpers

---

#### PR 2: Toolbar Navigation Pattern
**Files:**
- `frontend/discourse/app/modifiers/toolbar-navigation.js`
- `frontend/discourse/app/components/d-navigation.gjs`
- `frontend/discourse/app/components/navigation-bar.gjs`
- Related i18n strings

**Commits to include:**
- A11Y: Implement WAI-ARIA toolbar pattern for navigation
- A11Y: Add tablist pattern to navigation

**Features:**
- Arrow key navigation between categories, tags, nav tabs
- Single tab stop for entire navigation bar
- Screen reader announcements

---

#### PR 3: Topic List Grid Pattern
**Files:**
- `frontend/discourse/app/modifiers/grid-navigation.js`
- `frontend/discourse/app/components/topic-list/list.gjs`
- `frontend/discourse/app/components/topic-list/item.gjs`
- `frontend/discourse/app/components/topic-list/header.gjs`
- Related styles and i18n strings

**Commits to include:**
- A11Y: Implement WAI-ARIA grid pattern for topic list
- A11Y: Enhance grid navigation with Left/Right arrows and row labels
- A11Y: Fix grid focus persistence and add poster names to row labels
- A11Y: Allow Alt+Arrow for browser back/forward navigation

**Features:**
- Arrow Up/Down for row navigation
- Arrow Left/Right for cell navigation within rows
- Ctrl+Home/End for first/last row
- Screen reader row labels with topic title, author, activity

---

#### PR 4: Category List Grid Pattern
**Files:**
- `frontend/discourse/app/components/categories-only.gjs`
- `frontend/discourse/app/components/parent-category-row.gjs`

**Features:**
- Same grid pattern as topic list
- Category-specific row labels

---

#### PR 5: Post Stream Grid Pattern
**Files:**
- `frontend/discourse/app/modifiers/post-stream-navigation.js`
- `frontend/discourse/app/components/post-stream.gjs`
- `frontend/discourse/app/components/post-stream/header-row.gjs`
- `frontend/discourse/app/components/post.gjs`
- `frontend/discourse/app/components/post/cooked-html.gjs`
- `frontend/discourse/app/components/post/menu.gjs`

**Commits to include:**
- A11Y: Screen readers can now navigate posts with left/right arrow keys
- A11Y: Enable full post content reading during keyboard navigation
- A11Y: Fix NVDA reading post content when navigating
- A11Y: Add topic header row to post stream grid navigation
- A11Y: Unify topic header into post stream grid row

**Features:**
- Arrow Up/Down for post navigation
- Arrow Right to enter post content for reading
- Arrow Left to exit post content
- Post actions toolbar with arrow key navigation
- Topic header as first grid row

---

#### PR 6: Sidebar Tree Navigation
**Files:**
- `frontend/discourse/app/components/sidebar/` (multiple files)
- Tree navigation modifier

**Commits to include:**
- A11Y: Implement sidebar tree navigation with single tab stop

**Features:**
- Single tab stop for entire sidebar
- Arrow Up/Down for item navigation
- Arrow Left/Right for expand/collapse
- Home/End for first/last item

---

#### PR 7: Navigation Controls Toolbar
**Files:**
- Navigation controls component
- Toolbar modifier integration

**Commits to include:**
- A11Y: Convert navigation controls to toolbar with arrow key navigation

**Features:**
- Dismiss, New Topic buttons as toolbar
- Arrow key navigation between actions

---

#### PR 8: Focus Management
**Files:**
- `frontend/discourse/app/instance-initializers/navigation-focus-restoration.js`
- Focus restoration logic

**Commits to include:**
- A11Y: Move focus to first topic row after keyboard filter selection
- A11Y: Add focus history restoration and header/sidebar toolbar patterns

**Features:**
- Focus restoration on browser back/forward
- Focus moves to content after filter selection

---

#### PR 9: Live Regions and Announcements
**Files:**
- Alert banner components
- Live region setup

**Commits to include:**
- A11Y: Add assertive live regions and labels to alert banners

**Features:**
- Screen reader announcements for dynamic content
- Alert banners with proper ARIA live regions

---

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

| Phase | Status | Notes |
|-------|--------|-------|
| Demo deployed | Done | community.electrojam.net |
| RFC drafted | Pending | |
| RFC posted to Meta | Pending | |
| PR 1: Foundation | Pending | |
| PR 2: Toolbar | Pending | |
| PR 3: Topic Grid | Pending | |
| PR 4: Category Grid | Pending | |
| PR 5: Post Stream | Pending | |
| PR 6: Sidebar Tree | Pending | |
| PR 7: Nav Controls | Pending | |
| PR 8: Focus Management | Pending | |
| PR 9: Live Regions | Pending | |

## Community Testing Topic

Create a topic on community.electrojam.net to guide testers and collect feedback.

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
- 39 accessibility commits implementing WAI-ARIA patterns
- Based on [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
```

### Post This Topic When
- Before posting RFC to meta.discourse.org
- After deploying latest accessibility changes
- When inviting testers from the Discourse community

## Issue Tracking & Feedback Pipeline

### Why We Need This

Until accessibility work is merged upstream to Discourse, we need to:
1. **Collect feedback** from our community.electrojam.net users
2. **Track bugs locally** so nothing falls through the cracks
3. **Integrate with Electro Jam's existing workflow** via Microsoft Teams
4. **Triage and prioritize** issues using our standard process
5. **Document fixes** so they can be included in upstream PRs

This pipeline connects community feedback directly to our Teams channels where the Electro Jam team already works, ensuring accessibility issues get the same visibility and response as other product work.

### How We'll Manage It (Short-Term)

1. **Community reports issue** on community.electrojam.net testing topic
2. **We create GitHub issue** with `accessibility` label in our fork
3. **Teams notification fires** to `#discourse-accessibility` channel
4. **Team triages** using priority levels below
5. **Fix is implemented** and deployed to community.electrojam.net
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
Deploy to community.electrojam.net
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
- Demo: community.electrojam.net
- GitHub: Electro-Jam-Instruments/discourse (accessibility branch)
