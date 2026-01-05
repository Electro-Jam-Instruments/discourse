# Topic Thread Accessibility (Planning)

This document plans the implementation of keyboard navigation for reading and replying to posts within a Discourse topic thread.

## Current State

When viewing a topic (e.g., `/t/phase-6-integration-test-1742/27`), users see:
- Topic title and category/tags
- A list of posts (the original post + replies)
- Each post contains: author, content, timestamp, reactions, action buttons

**Problem:** No structured keyboard navigation for moving between posts or accessing post actions.

## Proposed Pattern

Use a **feed/list pattern** similar to chat applications:
- Single tab stop for the post list
- Arrow Up/Down to navigate between posts
- Post content announced as composite label
- Toolbar pattern for post actions (like, reply, bookmark, etc.)
- Document mode for reading long post content

## Post Navigation

### Focus Flow

```
[Topic Header]
    ↓ Tab
[Post List] (role="feed" or role="list")
    ↓ Arrow Down/Up
[Post 1] → [Post 2] → [Post 3] → ...
```

### Post Announcement Order

When a post receives focus, announce in this order:
1. **Author name** - Who made the post
2. **Attachments indicator** - "has attachments" (if any)
3. **Reactions summary** - "3 likes" (if any)
4. **Message preview** - First ~100 chars or semantic summary
5. **Age** - "2 days ago"
6. **Reply count** - "5 replies" (if this post has replies)

Example: "aurora, 3 likes, This is a test bug report to verify the Phase 6..., 2 days ago, 5 replies"

## Post Actions Toolbar

Each post has actions: Like, Link/Share, Bookmark, Reply, Flag, etc.

### Toolbar Navigation

```
[Post focused]
    ↓ Arrow Right (or Tab?)
[Actions Toolbar] (role="toolbar")
    ↓ Arrow Left/Right
[Like] → [Link] → [Bookmark] → [Reply] → [More...]
```

**Question:** Should Arrow Right enter the toolbar, or should it be Tab?
- Arrow Right: Consistent with grid pattern
- Tab: Separates "reading" from "acting"

### Reply Button Location

**Question from user:** Can a user reply to any message?

In Discourse:
- Yes, users can reply to any post (not just the topic)
- Reply button appears on each post
- Replying to a specific post creates a threaded reply

**Recommendation:** Include Reply in the post toolbar so users can:
1. Navigate to a post
2. Arrow Right into toolbar
3. Navigate to Reply button
4. Press Enter to open reply composer

## Document Mode for Post Content

Long posts need virtual cursor navigation for screen readers.

### Implementation

```html
<article
  role="article"
  aria-label="Post by aurora, 2 days ago"
  tabindex="0"
>
  <div class="post-content" role="document">
    <!-- Post body content -->
  </div>
  <div role="toolbar" aria-label="Post actions">
    <!-- Action buttons -->
  </div>
</article>
```

### Keyboard Behavior

| Key | Context | Action |
|-----|---------|--------|
| Arrow Down | Post list | Move to next post |
| Arrow Up | Post list | Move to previous post |
| Arrow Right | On post | Enter actions toolbar |
| Arrow Left | In toolbar | Navigate toolbar / exit to post |
| Ctrl+Enter | On post | Enter document mode (content) |
| Escape | In document mode | Exit to post focus |
| Enter | On post | Enter document mode (alternative) |
| Tab | Post list | Exit to next region |

### Document Mode Details

When user presses Ctrl+Enter (or Enter):
1. Focus moves to `.post-content` element
2. Element has `role="document"`
3. Screen reader switches to browse/virtual cursor mode
4. User can navigate headings, links, lists within post
5. Escape returns focus to the post container

## Component Structure

```
div.topic-page
├── header (topic title, category, tags)
└── div.post-stream (role="feed", aria-label="Posts")
    ├── article.post (role="article", tabindex, aria-label)
    │   ├── div.post-avatar
    │   ├── div.post-content (role="document")
    │   │   └── [cooked HTML content]
    │   └── div.post-actions (role="toolbar")
    │       ├── button[Like]
    │       ├── button[Link]
    │       ├── button[Bookmark]
    │       ├── button[Reply]
    │       └── button[More...]
    ├── article.post (next post...)
    └── ...
```

## ARIA Roles

| Element | Role | Notes |
|---------|------|-------|
| Post container | `feed` or `list` | Feed allows dynamic loading |
| Individual post | `article` | Standalone content unit |
| Post content | `document` | Enables virtual cursor |
| Actions | `toolbar` | Grouped actions |
| Action buttons | `button` | Individual actions |

## Confirmed Decisions

1. **Arrow Right to enter toolbar** - Matches grid pattern (CONFIRMED)

2. **Ctrl+Enter for document mode** - Enter could mean "reply" (CONFIRMED)

3. **Announcement order for regular posts** (CONFIRMED):
   - Author → Replying to [user] → Attachments → Reactions → Edited → Wiki → Message preview → Age → Reply count

4. **"In reply to" threading** (CONFIRMED):
   - When a post is a reply to a specific post (not topic), announce "replying to [username]"

5. **Real-time new posts** (CONFIRMED):
   - Use live region to announce "New message from [username]"
   - Can refine later based on testing

6. **Wiki posts** (CONFIRMED):
   - Announce "wiki post" since it's uncommon and notable

7. **Small action posts** (CONFIRMED):
   - Include in navigation
   - Announce as: "System: [action description], [time ago]"
   - Examples: "System: Topic closed by moderator, 2 hours ago"

## Small Action Posts

System messages that appear inline in threads:

| Action Code | Announcement |
|-------------|--------------|
| `closed.enabled` | "System: Topic closed by [user], [time]" |
| `closed.disabled` | "System: Topic reopened by [user], [time]" |
| `archived.enabled` | "System: Topic archived by [user], [time]" |
| `pinned.enabled` | "System: Topic pinned by [user], [time]" |
| `split_topic` | "System: Posts moved to new topic by [user], [time]" |
| `invited_user` | "System: [user] invited [other user], [time]" |
| `user_left` | "System: [user] left the topic, [time]" |
| `removed_user` | "System: [user] removed by [other user], [time]" |

These are navigable like regular posts but have a simpler announcement format.

## New vs Old Messages (Visited Line)

Discourse has a **"new messages marker"** (`PostVisitedLine` component):
- Shown after the last post the user read before returning to the topic
- Uses `lastReadPostNumber` from the topic model
- Rendered via `post/visited-line.gjs`
- i18n key: `"topics.new_messages_marker"`

### Accessibility Approach

**Group new/unread posts** using `role="group"` with label:
```html
<div role="group" aria-label="5 new posts since your last visit">
  <!-- New posts here -->
</div>
```

When navigating from old to new posts, the group label announces the transition.

## Available Post Metadata

From `Post` model, we can use:

| Property | Use in Announcement |
|----------|---------------------|
| `username` | Author name |
| `reply_count` | "X replies" |
| `actions_summary` | Reactions (likes, etc.) |
| `link_counts` | Has attachments/links |
| `created_at` | Age ("2 days ago") |
| `excerpt` / `cooked` | Message preview |
| `read` | Whether user has read it |
| `version` | Edited indicator (>1) |
| `wiki` | Wiki mode indicator |
| `yours` | "Your post" indicator |
| `via_email` | Posted via email |

### Final Announcement Order (Regular Posts)

1. **Author** - "aurora" (use username even if it's your own post)
2. **Replying to** - "replying to [username]" (if reply to specific post)
3. **Attachments** - "has attachments" (if `link_counts` shows attachments)
4. **Reactions** - "3 likes" (from `actions_summary`)
5. **Edited** - "edited" (if `version > 1`)
6. **Wiki** - "wiki post" (if `wiki === true`)
7. **Message preview** - First ~100 chars
8. **Age** - "2 days ago"
9. **Reply count** - "5 replies"

**Example announcements:**
- Regular: "aurora, 3 likes, This is a test bug report..., 2 days ago, 5 replies"
- Reply: "bob, replying to aurora, Thanks for the report..., 1 hour ago"
- Edited wiki: "admin, edited, wiki post, Welcome to our community..., 3 months ago, 12 replies"

## Timeline Component (Separate Doc)

There's a `topic-timeline` component showing:
- Vertical scrollbar for long threads
- Current position indicator
- "Last read" marker
- "Back to last read" button
- Date display at scroll position

**Deferred to:** `docs/accessibility/05-topic-timeline.md` (future)

## Resolved Questions

1. **"Reply to topic" vs "Reply to post"?** - RESOLVED
   - Post-level reply in toolbar replies to that specific post
   - Announce "replying to [username]" when post is a threaded reply

2. **Nested replies (threading)?** - RESOLVED
   - Announce "replying to [username]" in the post label

3. **Real-time updates?** - RESOLVED
   - Live region announces "New message from [username]"
   - Refine based on user testing

4. **Small action posts?** - RESOLVED
   - Include in navigation with "System: [description], [time]" format

## Open Questions

1. **Dynamic loading and new posts group?**
   - How does the "new posts" group work with infinite scroll/dynamic loading?
   - May need to handle edge cases

2. **Topic-level reply button location?**
   - There's a separate "Reply" button for replying to the topic (not a specific post)
   - Where should this be in the tab order?

---

## DECIDED: Grid Pattern for Posts (CONFIRMED)

**Decision:** Use WAI-ARIA Grid pattern for post stream, matching topic list and category list.

**Rationale:** Consistency across all vertical lists + "glance down column" capability for screen reader users.

### Grid Column Mapping

The current visual layout maps naturally to columns:

| Column | Content | Current CSS Class | Width |
|--------|---------|-------------------|-------|
| 1. Avatar | User avatar + flair | `.topic-avatar` | ~45-60px |
| 2. Author/Meta | Username, badges, timestamp | `.names`, `.post-infos` | auto |
| 3. Content | Post body (cooked HTML) | `.cooked` | flex/wide |
| 4. Actions | Like, reply, bookmark, etc. | `.post-controls .actions` | auto |

### Visual Layout Preservation

**Key insight:** We can add ARIA grid semantics WITHOUT changing the visual layout.

Current structure:
```html
<div class="topic-post">
  <article class="boxed">
    <div class="row">
      <div class="topic-avatar">...</div>
      <div class="topic-body">
        <div class="topic-meta-data">...</div>
        <div class="cooked">...</div>
        <nav class="post-controls">...</nav>
      </div>
    </div>
  </article>
</div>
```

Grid-accessible structure (2-cell, current implementation):
```html
<div class="post-stream" role="grid" aria-label="Posts">
  <div class="topic-post" role="row" tabindex="0" aria-rowindex="1" aria-label="...">
    <article class="boxed">
      <div class="row">
        <!-- Cell 1: Avatar -->
        <div class="topic-avatar" role="gridcell">...</div>
        <!-- Cell 2: Body (includes meta, content, AND actions) -->
        <div class="topic-body" role="gridcell">
          <div class="topic-meta-data">...</div>
          <div class="cooked" role="document">...</div>
          <nav class="post-controls">
            <div class="actions" role="toolbar" aria-label="Post actions">
              <button>Like</button>
              <button>Share</button>
              <button>Bookmark</button>
              <button>Reply</button>
              ...
            </div>
          </nav>
        </div>
      </div>
    </article>
  </div>
</div>
```

**Note:** This 2-cell structure matches the current DOM exactly. No template restructuring needed. Arrow Right navigation still reaches toolbar buttons by continuing past the Body cell into the toolbar.

Future 3-cell structure (planned):
```html
<!-- Cell 2 would be split, with post-controls moved out as Cell 3 -->
<div class="topic-body-content" role="gridcell">...</div>
<nav class="post-controls" role="gridcell">...</nav>
```

### Keyboard Navigation

| Key | Context | Action |
|-----|---------|--------|
| Arrow Down | On post row | Move to next post |
| Arrow Up | On post row | Move to previous post |
| Arrow Right | On post row | Move to next cell (avatar → body → actions) |
| Arrow Left | On post row | Move to previous cell |
| Enter | On post row | Enter document mode for reading content |
| Escape | In document mode | Return to post row |
| Tab | On post row | Move to actions toolbar (or exit grid) |
| Home | On post row | Move to first post |
| End | On post row | Move to last loaded post |

### Screen Reader Column Navigation

With grid role, screen reader users can:
- **Ctrl+Alt+Down** (NVDA): Move down same column (e.g., scan all avatars)
- **Ctrl+Alt+Right**: Move to next column in same row
- **Read column header**: Understand what data is in each column

### DECIDED: Phased Cell Structure Approach

#### Phase 1: 2-Cell Structure (CURRENT IMPLEMENTATION)

**Decision:** Start with 2 cells to validate the approach with high confidence.

```
[Avatar] [Body (meta + content + actions)]
```

| Cell | Content | CSS Class | Notes |
|------|---------|-----------|-------|
| 1. Avatar | User avatar + flair | `.topic-avatar` | Visual identifier |
| 2. Body | Meta-data + content + actions | `.topic-body` | Everything else |

**Rationale for starting with 2-cell:**
- Matches current DOM structure exactly (no restructuring needed)
- 85-90% confidence vs 65% for 3-cell
- LOW risk - no CSS changes, no plugin outlet disruption
- Validates the grid pattern approach before major restructuring
- Arrow navigation STILL reaches toolbar buttons directly

**Keyboard Flow (2-cell):**
```
[Post Row]
    ↓ Arrow Right
[Avatar] → [Body] → [Like] → [Share] → [Bookmark] → [Reply] → ...
```

#### Phase 2: 3-Cell Structure (PLANNED FUTURE)

**Goal:** After 2-cell is validated and working, refactor to true 3-cell separation.

```
[Avatar] [Body (meta + content)] [Actions]
```

| Cell | Content | CSS Class | Notes |
|------|---------|-----------|-------|
| 1. Avatar | User avatar + flair | `.topic-avatar` | Visual identifier |
| 2. Body | Meta-data + post content | `.topic-body-content` (new) | Semantically related info |
| 3. Actions | Toolbar buttons | `.post-controls` | Operations on the post |

**Why 3-cell is valuable (future):**
- True column separation for screen reader column navigation (Ctrl+Alt+Down)
- Cleaner semantic structure
- Better "glance down column" capability

**Why deferred:**
- Requires moving `<PostMenu>` out of `.topic-body` (4 levels deep currently)
- Template restructuring could break plugins
- CSS changes needed to maintain visual layout
- Higher risk, lower confidence (65%)

**Transition Plan:**
1. Implement 2-cell, gather user feedback
2. If 3-cell column navigation is requested, plan DOM restructuring
3. Move PostMenu component to be sibling of topic-body
4. Update CSS to maintain visual layout

**Feasibility Assessment:** See `docs/research/post-stream-grid-feasibility-assessment.md`

### DECIDED: Direct Button Navigation (CONFIRMED)

**Question:** When Arrow Right moves from Body cell to Actions cell, where does focus go?
- **Option A:** Focus Actions cell container, then Tab/Enter to enter buttons
- **Option B:** Focus directly on first toolbar button (Like)

**Decision:** Option B - Arrow Right moves focus directly into toolbar buttons.

**Rationale:**
- Matches existing grid pattern in topic list and category list
- More direct for acting on a post (fewer keystrokes)
- Consistent with "arrows navigate through interactive elements" pattern
- Can revisit if user testing shows issues

**Keyboard Flow:**
```
[Post Row focused]
    ↓ Arrow Right
[Avatar Cell] → [Body Cell] → [Like button] → [Share] → [Bookmark] → [Reply] → ...
    ↓ Arrow Left (from Like)
[Body Cell]
```

### Implementation Plan (2-Cell)

#### Phase 1: Basic Grid Structure (2-Cell)
1. Add `role="grid"` to `.post-stream`
2. Add `role="row"` and `tabindex` to `.topic-post`
3. Add `role="gridcell"` to:
   - `.topic-avatar` (Cell 1)
   - `.topic-body` (Cell 2 - includes actions)
4. Create `post-stream-navigation.js` modifier (adapt grid-navigation patterns)
5. Add composite `aria-label` for each post row

#### Phase 2: Actions Toolbar Integration
1. Add `role="toolbar"` to `.actions` inside `.post-controls`
2. Arrow Right from Body cell → focus first toolbar button directly
3. Arrow Left/Right navigates between toolbar buttons
4. Arrow Left from first button → returns to Body cell
5. Implement roving tabindex for toolbar buttons

#### Phase 3: Document Mode for Reading
1. Add `role="document"` to `.cooked` container
2. Enter on Body cell → focus moves to `.cooked` content
3. Escape returns to row
4. Screen reader virtual cursor works inside document

#### Phase 4: Polish & Edge Cases
1. Focus styles using CSS variables (`--d-grid-focus-*`)
2. Empty state handling (no posts)
3. New post announcements via live region
4. Load more / infinite scroll handling
5. Small action posts (system messages)
6. New posts group marker accessibility

#### Future Phase: 3-Cell Restructuring
- See "Phase 2: 3-Cell Structure" section above
- Requires DOM restructuring work

## Files to Modify

### Components (likely)
- `frontend/discourse/app/components/post-stream.gjs` - Post list container
- `frontend/discourse/app/components/post.gjs` - Individual post
- `frontend/discourse/app/components/post-menu.gjs` - Post actions

### New Modifier
- `frontend/discourse/app/modifiers/feed-navigation.js` - Feed/list keyboard nav

### i18n
- `config/locales/client.en.yml` - Screen reader strings for posts

## Implementation Phases

### Phase 1: Post List Navigation
- Add feed role to post stream
- Add article role to posts
- Implement Up/Down arrow navigation
- Create composite accessible names

### Phase 2: Post Actions Toolbar
- Add toolbar role to post actions
- Implement Left/Right navigation within toolbar
- Connect post focus to toolbar entry

### Phase 3: Document Mode
- Add document role to post content
- Implement Ctrl+Enter to enter
- Implement Escape to exit
- Test with screen readers

### Phase 4: Polish
- Announce new posts
- Handle edge cases (deleted posts, etc.)
- Optimize for long threads

## Implementation Status

### Phase 1: 2-Cell Grid Pattern - COMPLETED (2026-01-02)

**Files Modified:**

| File | Changes |
|------|---------|
| `components/post-stream.gjs` | Added `role="grid"`, `aria-label`, `PostStreamNavigation` modifier |
| `components/post.gjs` | Added `role="row"`, `tabindex="-1"`, `aria-label`, gridcell roles on avatar/body |
| `components/post/avatar.gjs` | Added `...attributes` to accept role/tabindex |
| `components/post/menu.gjs` | Added `role="toolbar"`, `aria-label` on `.actions` |
| `components/post/small-action.gjs` | Added `role="row"`, `tabindex="-1"`, `aria-label` |
| `components/post/cooked-html.gjs` | Added `role` getter returning "document" for stream elements |
| `components/decorated-html.gjs` | Added support for `@role` argument |
| `modifiers/post-stream-navigation.js` | **NEW** - Full keyboard navigation modifier |
| `config/locales/client.en.yml` | Added i18n strings for grid accessibility |
| `stylesheets/common/base/topic-post.scss` | Added focus outline styles for `.topic-post[role="row"]` and gridcells |

### Phase 1.1: Fix NVDA Arrow Navigation - COMPLETED (2026-01-04)

**Problem:** Static `role="document"` on `.cooked` elements was blocking NVDA application mode, preventing arrow key navigation.

**Solution:** Made `role="document"` dynamic - only added when user enters document mode (Ctrl+Enter).

| Commit | Changes |
|--------|---------|
| `b14576b549` | Remove static role="document", add dynamically on Ctrl+Enter, remove on Escape |

### Phase 1.2: Simplified Navigation - COMPLETED (2026-01-04)

**Problem:** NVDA doesn't announce `aria-label` on gridcells containing interactive elements. The post body gridcell contains the toolbar buttons, so even with `aria-label` set correctly, NVDA ignores it and focuses the first button instead.

**Investigation:**
1. First tried `aria-describedby` - NVDA didn't auto-read
2. Then tried `aria-labelledby` - doesn't work with complex HTML div content
3. Then tried `aria-label` with computed text - NVDA still ignores because gridcell has interactive children
4. Research confirmed: NVDA shifts focus to child elements in gridcells, announcing child's name instead of parent's aria-label

**Solution:** Simplified navigation to skip post content in arrow key flow. Post content is accessed via Ctrl+Enter document mode only.

| Commit | Changes |
|--------|---------|
| Multiple | Various attempts with aria-describedby, aria-labelledby, aria-label |
| Latest | Remove post body from arrow navigation, keep Ctrl+Enter for content access |

**Files Modified:**

| File | Changes |
|------|---------|
| `modifiers/post-stream-navigation.js` | Arrow Left/Right now skips post body gridcell, goes directly to interactive elements |
| `components/post.gjs` | Removed aria-label and tabindex from post body gridcell |

**Keyboard Behavior:**
- Arrow Right: Row -> Avatar -> Like -> Share -> Bookmark -> Reply (skips content)
- Ctrl+Enter: Enters document mode (adds role="document" to .cooked, focuses it for reading)
- Escape: Exits document mode (removes role="document", returns focus to row)

**Rationale:**
This approach provides consistent, predictable navigation where Left/Right always moves through interactive elements. Users who want to read post content use Ctrl+Enter to enter document mode, which enables full NVDA browse mode navigation within the post.

**i18n Keys:**
- `post_stream.aria_label`: "Post stream"
- `post.sr_replying_to`: "replying to %{username}"
- `post.sr_like_count`: "%{count} like(s)"
- `post.sr_edited`: "edited"
- `post.sr_wiki`: "wiki"
- `post.sr_reply_count`: "%{count} reply(ies)"
- `post.sr_post_actions`: "Post actions"
- `post.sr_avatar_cell`: "Avatar for %{username}"

**Keyboard Navigation:**
- Arrow Up/Down: Move between posts
- Arrow Left/Right: Move through avatar and toolbar buttons (skips content)
- Ctrl+Enter: Enter document mode for reading post content
- Escape: Exit document mode
- Home/End: First/last post
- PageUp/PageDown: Jump multiple posts
- Ctrl+Arrow Up/Down: First/last post

**Sub-Agent Validation:**
- Used `strategic-planner` agent with ULTRATHINK directive
- Initial 3-cell confidence: 65% (deferred)
- 2-cell confidence: 85-90%
- Post-implementation review: 78% → 92% after fixes
- See `docs/research/post-stream-grid-feasibility-assessment.md`
- See `docs/research/sub-agent-definitions.md`

## References

- [WAI-ARIA Feed Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/feed/)
- [WAI-ARIA Article Role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/article_role)
- [Document Role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/document_role)
- Slack/Teams/Discord accessibility patterns
