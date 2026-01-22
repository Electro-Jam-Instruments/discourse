# Issue #12: Post Read Status Announcement

**GitHub:** https://github.com/Electro-Jam-Instruments/discourse/issues/12
**Status:** Ready to implement

## Problem

Screen reader users can't tell which posts are unread.

## Technical Solution

### Data Check

- `topic.last_read_post_number` - Last post user has read
- `post.post_number` - Current post number
- Unread when: `post.post_number > topic.last_read_post_number`

### Component to Modify

**`frontend/discourse/app/components/post.gjs`**

In `postRowAriaLabel` getter (around line 174), add unread status check at the beginning:

```javascript
get postRowAriaLabel() {
  const post = this.args.post;
  const topic = post.topic;
  const parts = [];

  // 0. Unread status (if applicable)
  if (topic?.last_read_post_number && post.post_number > topic.last_read_post_number) {
    parts.push(i18n("post.sr_unread"));
  }

  // 1. Author
  parts.push(post.username);
  // ... rest unchanged
}
```

### i18n String

**`config/locales/client.en.yml`**:
```yaml
post:
  sr_unread: "unread"
```

## Result

- Unread posts: "unread, Otto_Tester, replying to Jane, ..."
- Read posts: "Otto_Tester, replying to Jane, ..."
