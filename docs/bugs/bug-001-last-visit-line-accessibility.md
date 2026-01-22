# Bug 001: Last Visit Line Not Accessible

**Status:** Open
**Priority:** Medium
**Category:** Accessibility

## Problem

The "last visit" line that separates read posts from new/unread posts is not announced to screen reader users. Users have no way to know:
- Which posts are "unread" or "new"
- Which posts have "new replies"
- When they have passed over the "last visit" divider line

## Expected Behavior

Screen reader users should be able to:
1. Know when a post is unread/new (via aria-label or announcement)
2. Know when a post has new replies
3. Be notified when crossing the "last visit" separator line

## Possible Solutions

1. Add `aria-label` to post rows indicating unread/new status
2. Include "last visit" separator as a row in the grid with descriptive text
3. Use `aria-live` region to announce when crossing the separator
4. Add visual indicator status to the row's accessible name

## Files Likely Affected

- `frontend/discourse/app/components/post.gjs`
- `frontend/discourse/app/components/topic-list/item.gjs`
- Post stream navigation modifier

## Related

- Post stream grid accessibility (04-topic-thread.md)
