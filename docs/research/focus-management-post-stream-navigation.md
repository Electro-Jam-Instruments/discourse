# Focus Management Issue: Post Stream Navigation to Unread Posts

## Executive Summary

When a user navigates from the topic list to a topic via keyboard, focus should automatically land on the first unread post. However, when that post is not initially loaded (needs to be paged in), focus may be lost because:

1. The `post-stream-navigation.js` modifier attempts to focus a post that does not yet exist in the DOM
2. The post stream uses "cloaking" (virtualization) that dynamically loads/unloads posts based on viewport position
3. There is a timing mismatch between when focus is attempted and when the target post DOM element becomes available

This document provides a detailed analysis of the loading sequence, identifies where focus is lost, and recommends solutions.

---

## Detailed Research Findings

### 1. Post Stream Loading Architecture

#### 1.1 Route Layer (`routes/topic/from-params.js`)

When navigating to a topic:

```javascript
// from-params.js:30-41
return postStream
  .refresh(params)
  .then(() => params)
  .catch((e) => { ... });
```

The route calls `postStream.refresh()` with parameters including `nearPost` (the target post number). The route **waits** for the refresh to complete before proceeding.

After the model loads, `setupController` is called:

```javascript
// from-params.js:81-84
const closestPost = postStream.closestPostForPostNumber(
  params.nearPost || 1
);
const closest = closestPost.post_number;
```

Then it triggers a visual scroll:

```javascript
// from-params.js:108
DiscourseURL.jumpToPost(closest, opts);
```

**Key Finding**: The route ensures the target post is loaded into `postStream.posts` before rendering, but it does NOT handle focus - it only scrolls.

#### 1.2 Post Stream Model (`models/post-stream.js`)

The `refresh()` method:

```javascript
// post-stream.js:353-411
refresh(opts) {
  // If we already have the post, just return (no server call)
  const postWeWant = this.posts.find(
    (p) => p.post_number === opts.nearPost
  );
  if (postWeWant) {
    return Promise.resolve().then(() => this._checkIfShouldShowRevisions());
  }

  // Otherwise, fetch from server
  this.loadingFilter = true;
  this.loadingNearPost = opts.nearPost;

  return loadTopicView(this.topic, opts)
    .then((json) => {
      this.updateFromJson(json.post_stream);
      this.loaded = true;
      // ...
    });
}
```

**Key Finding**: The refresh loads a **chunk** of posts around the target, but not necessarily all posts. The chunk size is determined by `topic.chunk_size`.

#### 1.3 Cloaking/Virtualization (`modifiers/post-stream-viewport-tracker.js`)

The viewport tracker implements performance optimization:

```javascript
// post-stream-viewport-tracker.js:14-27
/**
 * How Cloaking Works:
 * 1. Intersection Observers track which posts are visible in the viewport
 * 2. Posts that are far from the viewport (beyond the cloakOffset) are "cloaked"
 * 3. Cloaked posts are replaced with placeholder divs of the same height
 * 4. As the user scrolls, posts are dynamically uncloaked when they approach the viewport
 */
```

The `getCloakingData` function (lines 439-468) determines if a post should be cloaked:

```javascript
getCloakingData(post, { above, below }) {
  if (!cloakingEnabled || !post || cloakingPrevented.posts.has(post.id) || this.#postsOnScreen[post.post_number]) {
    return { active: false };
  }

  // Posts outside above/below boundaries get cloaked
  if (style && (post.post_number < above || post.post_number > below)) {
    return { active: true, style: htmlSafe(...) };
  }
}
```

**Key Finding**: Cloaking happens based on viewport position. Posts far from the current scroll position may have `class="post-stream--cloaked"` which makes them invisible/simplified in the DOM.

#### 1.4 Focus Management (`modifiers/post-stream-navigation.js`)

The modifier attempts to auto-focus on initial load:

```javascript
// post-stream-navigation.js:117-121
if (!this.initialFocusComplete && this.focusHistory.keyboardMode) {
  this.scheduleInitialFocus(named.lastReadPostNumber);
}

// post-stream-navigation.js:129-138
scheduleInitialFocus(lastReadPostNumber) {
  this.initialFocusComplete = true;

  schedule("afterRender", () => {
    requestAnimationFrame(() => {
      this.focusFirstUnreadPost(lastReadPostNumber);
    });
  });
}

// post-stream-navigation.js:147-170
focusFirstUnreadPost(lastReadPostNumber) {
  const rows = this.rows;
  if (rows.length === 0) {
    return;  // <-- PROBLEM: If no rows, focus fails silently
  }

  const targetPostNumber = (lastReadPostNumber || 0) + 1;
  const targetRowId = String(targetPostNumber);
  const targetIndex = this.findRowIndexById(targetRowId);

  if (targetIndex !== -1) {
    this.focusRow(targetIndex);  // Found it
  } else {
    // Target not found, fallback to first content row
    const fallbackIndex = rows.length > 1 ? 1 : 0;
    this.focusRow(fallbackIndex);
  }
}
```

The `rows` getter filters out cloaked posts:

```javascript
// post-stream-navigation.js:192-196
get rows() {
  return Array.from(
    this.element.querySelectorAll(this.options.rowSelector)
  ).filter((row) => !row.closest(".post-stream--cloaked"));  // <-- EXCLUDES cloaked posts
}
```

**Key Finding**: The focus logic explicitly excludes cloaked posts from navigation. If the target post is cloaked at the moment focus is attempted, it will not be found.

---

### 2. The Loading Sequence

Here is the complete sequence when navigating to a topic with a target unread post:

```
1. User clicks topic link from topic list (keyboard mode)
   |
2. Router transitions to topic.fromParams route
   |
3. from-params.js model() calls postStream.refresh({nearPost: X})
   |
4. Server returns chunk of posts (including target or closest)
   |
5. postStream.updateFromJson() populates this.posts array
   |
6. from-params.js setupController() runs
   |-- Sets model.currentPost = closest
   |-- Triggers DiscourseURL.jumpToPost(closest)
   |
7. Template renders (topic.gjs)
   |-- PostStream component renders
   |-- PostStreamNavigation modifier's modify() is called
   |
8. PostStreamNavigation.modify() schedules initial focus:
   |-- schedule("afterRender", ...)
   |-- requestAnimationFrame(...)
   |-- focusFirstUnreadPost(lastReadPostNumber)
   |
9. CONCURRENT: DiscourseURL.jumpToPost() scrolls to target
   |
10. CONCURRENT: PostStreamViewportTracker processes cloaking
    |-- IntersectionObserver fires for visible/hidden posts
    |-- Cloaking boundaries (above/below) get updated
    |-- setCloakingBoundaries() triggers re-render
   |
11. Post rows get class="post-stream--cloaked" or not
    |
12. focusFirstUnreadPost() calls this.rows which EXCLUDES cloaked
    |
13. Target post may be cloaked -> NOT FOUND -> fallback focus
```

---

### 3. Identified Problems

#### Problem 1: Race Condition Between Cloaking and Focus

The cloaking system uses `IntersectionObserver` which fires asynchronously. The sequence is:

1. Posts render
2. `schedule("afterRender")` triggers
3. `requestAnimationFrame` triggers
4. `focusFirstUnreadPost()` queries for rows
5. **BUT** `IntersectionObserver` may not have fired yet
6. Cloaking boundaries may be stale
7. Target post may be incorrectly excluded

#### Problem 2: Initial Scroll Not Complete

When `DiscourseURL.jumpToPost()` is called, it uses `LockOn` to scroll:

```javascript
// url.js:130-137
lockOn = new LockOn(selector, {
  originalTopOffset: opts.originalTopOffset,
  finished() {
    _transitioning = false;
    lockOn = null;
  },
});
lockOn.lock();
```

The scroll happens asynchronously. Focus may be attempted before scroll completes, meaning the target post might still be outside the viewport and thus cloaked.

#### Problem 3: Dynamic Re-renders Invalidate Focus

The post stream re-renders when:
- Cloaking boundaries change (`cloakAbove`, `cloakBelow` are tracked)
- Posts load (`loadingAbove`, `loadingBelow`)
- Gap filling
- New posts from message bus

Each re-render calls `modify()` again, but `initialFocusComplete` is already `true`, so focus is not re-attempted.

#### Problem 4: Target Post Not Loaded At All

If the user navigates to a post that is many posts away from any loaded chunk, the post may not exist in `postStream.posts` at all (only as an ID in `postStream.stream`).

---

### 4. Comparison with Similar Patterns in Discourse

#### Pattern A: URL jumpToPost

The `DiscourseURL.jumpToPost()` function handles async waiting via `LockOn`:

```javascript
// url.js - LockOn waits for element to exist
lockOn = new LockOn(selector, { finished() { ... } });
lockOn.lock();
```

`LockOn` polls for the element and waits until it exists before scrolling.

#### Pattern B: Post Highlight

After navigation, post highlighting is scheduled:

```javascript
// from-params.js:98-100
schedule("afterRender", () =>
  this.appEvents.trigger("post:highlight", closest)
);
```

This just triggers an event, doesn't wait for the element.

#### Pattern C: Filter Replies Jump

When filtering replies, focus is managed:

```javascript
// post-stream.js:317-328
return this.refresh({ refreshInPlace: true }).then(() => {
  const element = document.querySelector(`#post_${postNumber}`);
  const originalTopOffset = element ? element.getBoundingClientRect().top : null;
  DiscourseURL.jumpToPost(postNumber, { originalTopOffset });
  schedule("afterRender", () => highlightPost(postNumber));
});
```

This queries for the element after the promise resolves, assuming it exists.

---

## Analysis of Options

### Option 1: Wait for Post to Become Uncloaked

**Approach**: Use a MutationObserver to watch for the target post element to gain/lose the cloaked class, then focus.

**Implementation**:
```javascript
scheduleInitialFocus(lastReadPostNumber) {
  this.initialFocusComplete = true;
  const targetPostNumber = (lastReadPostNumber || 0) + 1;

  // Try immediately first
  schedule("afterRender", () => {
    requestAnimationFrame(() => {
      if (this.tryFocusPost(targetPostNumber)) {
        return; // Success
      }
      // Not found - set up observer
      this.waitForPostAndFocus(targetPostNumber);
    });
  });
}

waitForPostAndFocus(targetPostNumber) {
  const observer = new MutationObserver((mutations) => {
    if (this.tryFocusPost(targetPostNumber)) {
      observer.disconnect();
    }
  });

  observer.observe(this.element, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });

  // Timeout fallback
  setTimeout(() => {
    observer.disconnect();
    this.focusFirstContentRow(); // Fallback
  }, 2000);
}
```

**Pros**:
- Handles async timing naturally
- Works regardless of when cloaking resolves
- Follows reactive paradigm

**Cons**:
- MutationObserver has performance overhead
- May not trigger if post never becomes uncloaked
- Complexity in cleanup

**Risk Assessment**: Medium risk - MutationObservers are reliable but need careful lifecycle management

---

### Option 2: Prevent Cloaking for Target Post

**Approach**: Use the existing `preventCloaking()` API to keep the target post uncloaked until focused.

**Implementation**:
```javascript
// In post-stream-navigation.js
scheduleInitialFocus(lastReadPostNumber) {
  this.initialFocusComplete = true;
  const targetPostNumber = (lastReadPostNumber || 0) + 1;

  // Find the post ID from postStream model
  const postId = this.getPostIdForNumber(targetPostNumber);
  if (postId) {
    preventCloaking(postId, true);
  }

  schedule("afterRender", () => {
    requestAnimationFrame(() => {
      this.focusFirstUnreadPost(lastReadPostNumber);
      if (postId) {
        preventCloaking(postId, false); // Allow cloaking again
      }
    });
  });
}
```

**Pros**:
- Uses existing API designed for this purpose
- Minimal changes needed
- Post is guaranteed to be in DOM

**Cons**:
- Requires access to post ID (not just post number)
- Need to coordinate with post-stream component to get post ID
- Doesn't help if post is not loaded at all

**Risk Assessment**: Low-Medium risk - Uses existing pattern but requires data flow changes

---

### Option 3: Hook into Post Stream Loading Events

**Approach**: Listen for `postStream.loaded` changes or app events, then attempt focus when appropriate.

**Implementation**:
```javascript
// In post-stream-navigation.js
constructor(owner, args) {
  super(owner, args);
  this.appEvents = owner.lookup('service:app-events');
  this.appEvents.on('page:topic-loaded', this, this.onTopicLoaded);
  registerDestructor(this, (instance) => instance.cleanup());
}

onTopicLoaded(topic) {
  if (this.focusHistory.keyboardMode && !this.initialFocusComplete) {
    // Topic is fully loaded, posts are in DOM
    schedule("afterRender", () => {
      requestAnimationFrame(() => {
        this.focusFirstUnreadPost(topic.last_read_post_number);
      });
    });
  }
}
```

**Pros**:
- Hooks into existing event system
- Fires at the right time in loading sequence
- Clear lifecycle

**Cons**:
- Need to ensure event fires after DOM update
- May miss the event if modifier initializes late
- Coupling to app events

**Risk Assessment**: Medium risk - Good approach but timing may still be off

---

### Option 4: Integrate Focus into Route Layer

**Approach**: Move focus management to the route, which has full control over the loading sequence.

**Implementation**:
```javascript
// In routes/topic/from-params.js
setupController(controller, params, transition) {
  // ... existing code ...

  // Focus management for keyboard users
  if (this.focusHistory.keyboardMode) {
    const targetPostNumber = (controller.get('userLastReadPostNumber') || 0) + 1;

    // Wait for render and scroll to complete
    schedule("afterRender", () => {
      requestAnimationFrame(() => {
        this.attemptFocusPost(targetPostNumber);
      });
    });
  }
}

attemptFocusPost(postNumber) {
  const selector = `.topic-post[data-post-number="${postNumber}"]`;
  const element = document.querySelector(selector);
  if (element && !element.closest('.post-stream--cloaked')) {
    element.focus();
  } else {
    // Fallback to first visible post
    const firstPost = document.querySelector('.topic-post[role="row"]:not(.post-stream--cloaked)');
    firstPost?.focus();
  }
}
```

**Pros**:
- Route has full context about what's being loaded
- Can coordinate with jumpToPost
- Clear ownership of focus responsibility

**Cons**:
- Duplicates logic between route and modifier
- Route shouldn't manage DOM focus directly (separation of concerns)
- Harder to maintain

**Risk Assessment**: Medium-High risk - Works but violates architecture patterns

---

## Recommendation

### Recommended Approach: Hybrid of Options 1 and 2

The recommended solution combines MutationObserver with the `preventCloaking` API:

1. **Prevent cloaking of target post** during initial load to ensure it remains in DOM
2. **Use retry with timeout** if the post is not immediately focusable
3. **Fall back gracefully** to first visible post if target cannot be focused

### Implementation Plan

#### Step 1: Pass post stream reference to modifier

The modifier needs access to the post stream model to:
- Get the post ID from post number
- Check if post is loaded

```javascript
// In post-stream.gjs template
{{PostStreamNavigation
  lastReadPostNumber=@lastReadPostNumber
  postStream=@postStream
}}
```

#### Step 2: Enhanced focus scheduling

```javascript
// In post-stream-navigation.js
scheduleInitialFocus(lastReadPostNumber) {
  this.initialFocusComplete = true;
  const targetPostNumber = (lastReadPostNumber || 0) + 1;

  // Find the post and prevent cloaking
  const targetPost = this.options.postStream?.postForPostNumber(targetPostNumber);
  if (targetPost?.id) {
    preventCloaking(targetPost.id, true);
    this._focusTargetPostId = targetPost.id;
  }

  this.attemptFocusWithRetry(targetPostNumber, 5, 100);
}

attemptFocusWithRetry(targetPostNumber, retriesLeft, delay) {
  schedule("afterRender", () => {
    requestAnimationFrame(() => {
      const targetRowId = String(targetPostNumber);
      const targetIndex = this.findRowIndexById(targetRowId);

      if (targetIndex !== -1) {
        this.focusRow(targetIndex);
        this.cleanupFocusPrevent();
      } else if (retriesLeft > 0) {
        setTimeout(() => {
          this.attemptFocusWithRetry(targetPostNumber, retriesLeft - 1, delay);
        }, delay);
      } else {
        // Final fallback
        const fallbackIndex = this.rows.length > 1 ? 1 : 0;
        this.focusRow(fallbackIndex);
        this.cleanupFocusPrevent();
      }
    });
  });
}

cleanupFocusPrevent() {
  if (this._focusTargetPostId) {
    preventCloaking(this._focusTargetPostId, false);
    this._focusTargetPostId = null;
  }
}
```

#### Step 3: Handle case where target post is not loaded

If the target post is not in `postStream.posts` (only in `postStream.stream`), we need to:
1. Recognize this situation
2. Fall back to closest loaded post
3. Consider triggering a load of the missing post

```javascript
focusFirstUnreadPost(lastReadPostNumber) {
  const rows = this.rows;
  if (rows.length === 0) {
    return;
  }

  const targetPostNumber = (lastReadPostNumber || 0) + 1;

  // Check if post is loaded
  const postStream = this.options.postStream;
  const targetPost = postStream?.postForPostNumber(targetPostNumber);

  if (!targetPost) {
    // Post not loaded - focus closest available
    const closestPost = postStream?.closestPostForPostNumber(targetPostNumber);
    if (closestPost) {
      const closestIndex = this.findRowIndexById(String(closestPost.post_number));
      if (closestIndex !== -1) {
        this.focusRow(closestIndex);
        return;
      }
    }
  }

  // Continue with existing logic...
}
```

---

## Implementation Considerations

### Testing Approach

1. **Unit test**: Focus scheduling with mocked post stream
2. **Integration test**: Navigate from topic list to topic with unread posts
3. **System test**: Full browser test with cloaking enabled
4. **Edge cases**:
   - Target post is first post
   - Target post is last post
   - All posts are read (focus first)
   - Topic has 1000+ posts (heavy cloaking)
   - Network is slow (posts load late)

### Performance Impact

- `preventCloaking` adds a post ID to a Set - O(1) operation
- Retry mechanism adds at most 5 * 100ms = 500ms worst case
- No MutationObserver overhead in happy path

### Accessibility Verification

- Focus should be visible (focus ring)
- Screen reader should announce the focused post
- Tab order should work from focused post
- Arrow key navigation should work from focused post

---

## References

### Key Files

| File | Purpose |
|------|---------|
| `modifiers/post-stream-navigation.js` | Focus management and keyboard navigation |
| `modifiers/post-stream-viewport-tracker.js` | Cloaking/virtualization logic |
| `components/post-stream.gjs` | Post stream component |
| `models/post-stream.js` | Post data management |
| `routes/topic/from-params.js` | Route that loads topic |
| `lib/url.js` | Navigation and scrolling |

### Related Documentation

- [WAI-ARIA Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
- [12-focus-history-restoration.md](../accessibility/12-focus-history-restoration.md)
- [04-topic-thread.md](../accessibility/04-topic-thread.md)

---

## Conclusion

The focus management issue when navigating to an unread post that needs paging is caused by a race condition between:
1. The cloaking system hiding posts outside the viewport
2. The focus system attempting to focus before the post is visible

The recommended solution uses a combination of:
1. Temporarily preventing cloaking on the target post
2. Retry logic with timeout
3. Graceful fallback to nearest visible post

This approach minimizes complexity while ensuring focus is reliably set for keyboard users.
