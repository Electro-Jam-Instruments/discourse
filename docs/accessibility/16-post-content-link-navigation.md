# Post Content Link Navigation

**GitHub Issue:** [#42](https://github.com/Electro-Jam-Instruments/discourse/issues/42)
**Status:** Planning Complete
**Created:** 2026-01-23

## Executive Summary

Posts with many inline links create excessive tab stops, making keyboard navigation tedious. This document details a design for arrow key navigation between links within post content during document mode, with Tab exiting the content entirely.

**Success Probability: 72%** (See Risk Assessment section)

---

## 1. Current Behavior Analysis

### 1.1 Document Mode (Ctrl+Enter)

The `post-stream-navigation.js` modifier implements document mode:

```javascript
// Lines 1306-1315 of post-stream-navigation.js
enterDocumentMode(row) {
  const cookedElement = row.querySelector(this.options.cookedSelector);
  if (cookedElement) {
    this.inDocumentMode = true;
    // Add role="document" to enable NVDA browse mode
    cookedElement.setAttribute("role", "document");
    cookedElement.setAttribute("tabindex", "0");
    cookedElement.focus();
  }
}
```

**Current keyboard flow:**
1. User presses Ctrl+Enter on a post row
2. `role="document"` is added to `.cooked` element
3. Focus moves to `.cooked` container
4. NVDA enters browse mode for virtual cursor navigation
5. User can read content with arrow keys (character-by-character in browse mode)
6. **PROBLEM:** Tab moves through EVERY link in the post content
7. Escape returns to post row

### 1.2 How Links Exist in .cooked Content

Post content (`.cooked` div) contains rendered Markdown/HTML with links scattered throughout:

```html
<div class="cooked">
  <p>Check out <a href="/link1">this article</a> about keyboards.
  You might also like <a href="/link2">this resource</a> and
  <a href="/link3">this guide</a> for more details.</p>

  <p>For advanced topics, see <a href="/link4">the documentation</a>.</p>

  <!-- Oneboxes (link previews) -->
  <aside class="onebox">
    <header>
      <a href="/link5">GitHub - Project Name</a>
    </header>
    ...
  </aside>

  <!-- Quote blocks with controls -->
  <aside class="quote">
    <div class="title">
      <a href="/t/123/5" class="back">...</a> <!-- Back button -->
      <button class="quote-toggle">...</button>
    </div>
    <blockquote>Quoted content with <a href="/link6">a link</a></blockquote>
  </aside>
</div>
```

### 1.3 Link Types Present in .cooked

| Type | Selector | Notes |
|------|----------|-------|
| Inline links | `a[href]` | Most common, scattered in paragraphs |
| Mention links | `a.mention` | @username links |
| Category hashtags | `a.hashtag-cooked` | #category links |
| Attachment links | `a.attachment` | File downloads |
| Onebox header links | `.onebox header a` | Link preview titles |
| Quote navigation | `aside.quote a.back` | Navigate to quoted post |
| Quote toggle buttons | `aside.quote button.quote-toggle` | Expand/collapse quote |
| Lightbox links | `a.lightbox` | Image viewers |

### 1.4 Click Tracking

Links in `.cooked` have click tracking via `click-track.js`. The `isValidLink()` function excludes certain link types from tracking:
- `.lightbox` - Image lightbox triggers
- `.no-track-link` - Explicitly excluded
- `.hashtag`, `.hashtag-cooked` - Category/tag links
- `.back` - Quote back buttons

This is relevant because our navigation should respect these semantics.

---

## 2. Proposed Keyboard Behavior

### 2.1 New Keyboard Mapping (Document Mode)

| Key | Action | Notes |
|-----|--------|-------|
| Arrow Right | Focus next navigable element | Links, buttons in content |
| Arrow Left | Focus previous navigable element | Links, buttons in content |
| Tab | Exit document mode, move to next tab stop | Leave content entirely |
| Shift+Tab | Exit document mode, move to previous tab stop | Leave content entirely |
| Enter | Activate focused link/button | Click the element |
| Escape | Exit document mode, return to post row | Existing behavior |
| Home | Focus first navigable element in content | |
| End | Focus last navigable element in content | |

### 2.2 Navigable Elements Within .cooked

Elements included in arrow key navigation (in DOM order):

```javascript
const LINK_NAV_SELECTOR = [
  'a[href]:not(.lightbox)',           // All links except lightbox
  'button:not([disabled])',            // Quote toggle buttons, etc.
  '[role="button"]:not([disabled])',   // ARIA buttons
].join(', ');
```

**Excluded:**
- `.lightbox` links - These should be activated via their image wrappers
- Hidden elements (`aria-hidden="true"`, `.hidden`)
- Elements with `tabindex="-1"` explicitly set by other code
- Elements outside viewport (optional optimization)

### 2.3 Visual Focus Indicator

Links/buttons receiving focus need visible focus rings:

```scss
// In app/assets/stylesheets/common/base/topic-post.scss
.cooked[role="document"] {
  // Document mode link focus
  a:focus,
  button:focus {
    outline: 2px solid var(--tertiary);
    outline-offset: 2px;
    border-radius: 2px;
  }
}
```

### 2.4 Screen Reader Announcements

When arrow key navigation moves focus:
- Link text is announced (default browser behavior)
- `aria-label` from `link-counts.js` decorator is used if present
- For mentions: "at username" pattern

---

## 3. Integration with Existing Document Mode

### 3.1 Two Sub-Modes Within Document Mode

```
inDocumentMode = true
  |
  +-- linkNavigationActive = false (default)
  |     - Arrow keys: NVDA browse mode (character navigation)
  |     - Tab: Moves to links (current problematic behavior)
  |
  +-- linkNavigationActive = true (proposed new mode)
        - Arrow keys: Jump between links (our custom navigation)
        - Tab: Exit document mode entirely
```

### 3.2 Mode Activation

**Option A: Automatic on First Tab**
```
User presses Ctrl+Enter -> Document mode (browse sub-mode)
User presses Tab -> Activate link navigation sub-mode
Arrow keys now navigate links
Tab/Shift+Tab exits document mode
```

**Option B: Explicit Activation Key**
```
User presses Ctrl+Enter -> Document mode (browse sub-mode)
User presses L -> Activate link navigation sub-mode
Arrow keys now navigate links
L again or Escape exits link navigation
```

**Recommendation:** Option A is more intuitive. Tab is the natural key users press when trying to interact with content.

### 3.3 Modified enterDocumentMode Flow

```javascript
enterDocumentMode(row) {
  const cookedElement = row.querySelector(this.options.cookedSelector);
  if (cookedElement) {
    this.inDocumentMode = true;
    this.linkNavigationActive = false;  // NEW
    this.currentLinkIndex = -1;         // NEW: no link focused initially
    cookedElement.setAttribute("role", "document");
    cookedElement.setAttribute("tabindex", "0");
    cookedElement.focus();

    // NEW: Set up link navigation handlers
    this.setupLinkNavigation(cookedElement);
  }
}
```

---

## 4. Implementation Approach

### 4.1 Phase 1: Link Collection and Navigation

**New method to gather navigable elements:**

```javascript
/**
 * Get all navigable elements within .cooked content in DOM order.
 * Caches result to avoid repeated DOM queries during rapid navigation.
 * @param {HTMLElement} cookedElement - The .cooked container
 * @returns {HTMLElement[]} Array of focusable elements
 */
getNavigableLinksInContent(cookedElement) {
  if (!cookedElement) return [];

  const selector = [
    'a[href]:not(.lightbox):not([aria-hidden="true"])',
    'button:not([disabled]):not([aria-hidden="true"])',
  ].join(', ');

  const elements = Array.from(cookedElement.querySelectorAll(selector));

  // Filter to only visible, enabled elements
  return elements.filter(el => {
    // Has layout (not display:none)
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') {
      return false;
    }
    // Not in hidden container
    if (el.closest('[aria-hidden="true"]')) {
      return false;
    }
    return true;
  });
}
```

### 4.2 Phase 2: Keyboard Handler for Link Navigation

```javascript
handleDocumentModeKeydown(event) {
  // Only handle if in document mode
  if (!this.inDocumentMode) return false;

  const { key } = event;
  const cookedElement = this.getCurrentCookedElement();

  // Tab activates link navigation mode OR exits
  if (key === 'Tab') {
    if (this.linkNavigationActive) {
      // Exit document mode entirely
      this.exitDocumentMode();
      // Let Tab propagate to move focus to next tab stop
      return false;
    } else {
      // Activate link navigation, focus first/last link
      const links = this.getNavigableLinksInContent(cookedElement);
      if (links.length > 0) {
        this.linkNavigationActive = true;
        this.currentLinkIndex = event.shiftKey ? links.length - 1 : 0;
        links[this.currentLinkIndex].focus();
        event.preventDefault();
        return true;
      }
      // No links - let Tab propagate normally
      return false;
    }
  }

  // Arrow navigation only when link navigation is active
  if (this.linkNavigationActive) {
    const links = this.getNavigableLinksInContent(cookedElement);

    switch (key) {
      case 'ArrowRight':
      case 'ArrowDown':
        this.currentLinkIndex = getNextIndex(links, this.currentLinkIndex, false);
        links[this.currentLinkIndex]?.focus();
        event.preventDefault();
        return true;

      case 'ArrowLeft':
      case 'ArrowUp':
        this.currentLinkIndex = getPreviousIndex(links, this.currentLinkIndex, false);
        links[this.currentLinkIndex]?.focus();
        event.preventDefault();
        return true;

      case 'Home':
        this.currentLinkIndex = 0;
        links[0]?.focus();
        event.preventDefault();
        return true;

      case 'End':
        this.currentLinkIndex = links.length - 1;
        links[links.length - 1]?.focus();
        event.preventDefault();
        return true;

      case 'Enter':
        // Activate current link
        links[this.currentLinkIndex]?.click();
        event.preventDefault();
        return true;
    }
  }

  return false;
}
```

### 4.3 Phase 3: Integration with Main Keydown Handler

Modify `handleKeydown()` in `post-stream-navigation.js`:

```javascript
handleKeydown(event) {
  // ... existing code ...

  // Handle document mode link navigation FIRST
  if (this.inDocumentMode && this.handleDocumentModeKeydown(event)) {
    return;
  }

  // ... rest of existing keydown handling ...
}
```

### 4.4 Phase 4: Focus Tracking

Track focus changes within .cooked to maintain `currentLinkIndex`:

```javascript
setupLinkNavigation(cookedElement) {
  // Store reference for cleanup
  this._documentModeFocusHandler = (event) => {
    if (!this.linkNavigationActive) return;

    const links = this.getNavigableLinksInContent(cookedElement);
    const focusedIndex = links.indexOf(event.target);

    if (focusedIndex !== -1) {
      this.currentLinkIndex = focusedIndex;
    }
  };

  cookedElement.addEventListener('focusin', this._documentModeFocusHandler);
}

cleanupLinkNavigation(cookedElement) {
  if (this._documentModeFocusHandler && cookedElement) {
    cookedElement.removeEventListener('focusin', this._documentModeFocusHandler);
    this._documentModeFocusHandler = null;
  }
}
```

---

## 5. Screen Reader Compatibility (NVDA)

### 5.1 The Browse Mode Challenge

NVDA's browse mode intercepts arrow keys for character/word navigation. Our custom arrow key handling must work when focus is on interactive elements.

**Key insight:** When focus is on an `<a>` or `<button>` element (not the document container), NVDA is typically in focus/forms mode for that element. Arrow keys should pass through.

### 5.2 Testing Matrix

| Scenario | NVDA Mode | Arrow Behavior |
|----------|-----------|----------------|
| Focus on `.cooked` container | Browse | NVDA virtual cursor |
| Focus on `<a>` in content | Forms/Focus | Our handler receives keys |
| Focus on `<button>` in content | Forms/Focus | Our handler receives keys |

### 5.3 Fallback for Browse Mode Conflicts

If NVDA browse mode intercepts arrows when on links:

```javascript
// Alternative: Use different keys for screen reader users
// K = next link, Shift+K = previous link (matches NVDA's K for link)
// But we should test first before adding alternatives
```

### 5.4 NVDA-Specific Announcements

Consider adding live region for navigation feedback:

```javascript
announceLink(link) {
  // Only if needed - browser may announce focus changes adequately
  const announcer = document.getElementById('a11y-announcer');
  if (announcer) {
    const text = link.getAttribute('aria-label') || link.textContent.trim();
    announcer.textContent = text;
  }
}
```

---

## 6. Edge Cases

### 6.1 Nested Interactive Elements

**Quote blocks with buttons and links:**
```html
<aside class="quote">
  <div class="title">
    <button class="quote-toggle">Expand</button>
    <a href="/t/123" class="back">Jump to post</a>
  </div>
  <blockquote>Content with <a href="/link">a link</a></blockquote>
</aside>
```

All three interactive elements should be in navigation order: toggle button, back link, content link.

### 6.2 Dynamic Content

Quotes can expand/collapse, adding/removing links:

```javascript
// Re-query links when content changes
refreshNavigableLinks() {
  const cookedElement = this.getCurrentCookedElement();
  if (cookedElement && this.linkNavigationActive) {
    const links = this.getNavigableLinksInContent(cookedElement);
    // Clamp currentLinkIndex to valid range
    this.currentLinkIndex = Math.min(this.currentLinkIndex, links.length - 1);
    this.currentLinkIndex = Math.max(this.currentLinkIndex, 0);
  }
}
```

### 6.3 Oneboxes (Link Previews)

Oneboxes contain multiple links. The `link-counts.js` decorator identifies the "best" link in each onebox. We should include all links but give special handling:

```javascript
// Mark primary onebox links for screen readers
const primaryLinks = bestElements.values();
primaryLinks.forEach(link => {
  link.setAttribute('aria-current', 'true');
});
```

### 6.4 Images with Links (Lightboxes)

Lightbox links (`a.lightbox`) wrap images. These are excluded because:
1. They trigger a full-screen viewer
2. Better activated via Enter on the image
3. Navigating "through" them would skip visual content

### 6.5 Posts with No Links

If `.cooked` contains no navigable links:
- Tab should still exit document mode
- Arrow keys fall back to NVDA browse mode behavior

```javascript
if (key === 'Tab' && !this.linkNavigationActive) {
  const links = this.getNavigableLinksInContent(cookedElement);
  if (links.length === 0) {
    // No links - exit document mode
    this.exitDocumentMode();
    return false; // Let Tab propagate
  }
  // ... activate link navigation ...
}
```

### 6.6 Very Long Posts (Performance)

Posts with 100+ links could cause performance issues with repeated `querySelectorAll`:

```javascript
// Cache navigable links when entering document mode
enterDocumentMode(row) {
  // ...
  this._cachedNavigableLinks = this.getNavigableLinksInContent(cookedElement);
}

getNavigableLinksInContent(cookedElement) {
  // Return cached if available
  if (this._cachedNavigableLinks && this.inDocumentMode) {
    return this._cachedNavigableLinks;
  }
  // ... query DOM ...
}

exitDocumentMode() {
  // ...
  this._cachedNavigableLinks = null;
}
```

---

## 7. Files to Modify

| File | Changes |
|------|---------|
| `frontend/discourse/app/modifiers/post-stream-navigation.js` | Add link navigation state, handlers, and integration |
| `frontend/discourse/app/lib/keyboard-navigation-utils.js` | Potentially add new utility functions |
| `app/assets/stylesheets/common/base/topic-post.scss` | Focus styles for links in document mode |
| `config/locales/client.en.yml` | Any new screen reader strings |
| `docs/accessibility/04-topic-thread.md` | Update documentation |
| `docs/accessibility/00-index.md` | Update index with new doc reference |

### 7.1 New Files (if needed)

None required - all functionality fits within existing modifier.

---

## 8. Risk Assessment

### 8.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| NVDA browse mode conflicts with arrow keys | Medium | High | Test early; may need alternative keys |
| Focus management bugs | Medium | Medium | Extensive testing, guard clauses |
| Performance with many links | Low | Medium | Caching, lazy evaluation |
| Breaking existing document mode | Low | High | Guard new behavior behind flag |
| Quote expand/collapse breaks link list | Medium | Low | Refresh cache on mutation |

### 8.2 Confidence Levels

| Aspect | Confidence |
|--------|------------|
| Core arrow navigation logic | 90% |
| Tab exits content entirely | 85% |
| NVDA compatibility | 55% |
| Edge case handling | 70% |
| No regressions to existing behavior | 80% |

**Overall Success Probability: 72%**

The main uncertainty is NVDA behavior when focus is on links within a `role="document"` container. Testing is required.

### 8.3 Testing Strategy

1. **Unit tests:** Link collection, index navigation
2. **Integration tests:** Full keyboard flow with mock DOM
3. **Manual NVDA testing:** Critical before shipping
4. **Manual JAWS testing:** Secondary screen reader
5. **Regression tests:** Ensure Ctrl+Enter, Escape still work

---

## 9. Alternative Approaches Considered

### 9.1 Option A: Using aria-activedescendant

Instead of actually moving focus, use `aria-activedescendant` on the `.cooked` container:

```html
<div class="cooked" role="document" aria-activedescendant="link-3">
  <a id="link-1" href="...">Link 1</a>
  <a id="link-2" href="...">Link 2</a>
  <a id="link-3" href="...">Link 3</a> <!-- Currently "active" -->
</div>
```

**Pros:** No actual focus movement, potentially better screen reader support
**Cons:** Requires unique IDs on all links, more complex implementation, may not trigger proper click tracking

**Decision:** Rejected in favor of actual focus movement for simplicity and better interaction with click tracking.

### 9.2 Option B: Disable Tab Navigation Entirely

Set `tabindex="-1"` on all links within `.cooked` during document mode:

```javascript
enterDocumentMode(row) {
  const links = cookedElement.querySelectorAll('a, button');
  links.forEach(link => {
    link.dataset.originalTabindex = link.getAttribute('tabindex');
    link.setAttribute('tabindex', '-1');
  });
}
```

**Pros:** Prevents Tab from stopping on links
**Cons:** Disruptive, may break other functionality, cleanup complexity

**Decision:** Rejected - too invasive.

### 9.3 Option C: Use F-key Shortcuts (F6, etc.)

Use function keys for navigation instead of arrows:

**Pros:** Never conflicts with browse mode
**Cons:** Non-standard, hard to discover, conflicts with browser shortcuts

**Decision:** Rejected - poor usability.

---

## 10. Implementation Phases

### Phase 1: Core Navigation (Estimated: 4 hours)
- [ ] Add state variables: `linkNavigationActive`, `currentLinkIndex`
- [ ] Implement `getNavigableLinksInContent()`
- [ ] Implement `handleDocumentModeKeydown()`
- [ ] Integrate with main `handleKeydown()`

### Phase 2: Focus Management (Estimated: 2 hours)
- [ ] Implement `setupLinkNavigation()` and `cleanupLinkNavigation()`
- [ ] Handle focus tracking within `.cooked`
- [ ] Handle Tab/Shift+Tab exit behavior

### Phase 3: Edge Cases (Estimated: 3 hours)
- [ ] Handle empty content (no links)
- [ ] Handle dynamic content (quote expand/collapse)
- [ ] Implement link caching for performance
- [ ] Add focus styles in SCSS

### Phase 4: Screen Reader Testing (Estimated: 4 hours)
- [ ] NVDA testing on Windows
- [ ] JAWS testing (if available)
- [ ] Adjust implementation based on findings
- [ ] Document any workarounds needed

### Phase 5: Documentation and Cleanup (Estimated: 2 hours)
- [ ] Update `04-topic-thread.md`
- [ ] Update `00-index.md`
- [ ] Add JSDoc comments
- [ ] Final code review

**Total Estimated: 15 hours**

---

## 11. Success Criteria

1. **Tab exits content:** Single Tab press exits `.cooked` entirely
2. **Arrow navigation works:** Left/Right move between links in DOM order
3. **Enter activates links:** Pressing Enter on focused link triggers navigation
4. **Escape still works:** Returns to post row focus
5. **NVDA compatible:** Link text announced when focused
6. **No regression:** Ctrl+Enter still enters document mode, browse mode still works for reading
7. **Visual feedback:** Focused links have visible focus rings

---

## 12. References

- [WAI-ARIA Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) - Focus management patterns
- [Understanding Screen Reader Interaction Modes](https://tink.uk/understanding-screen-reader-interaction-modes/) - Browse vs Focus mode
- [NVDA Keyboard Shortcuts](https://dequeuniversity.com/screenreaders/nvda-keyboard-shortcuts) - Screen reader navigation
- [NVDA GitHub Issue #8395](https://github.com/nvaccess/nvda/issues/8395) - Arrow keys in gridcells
- [Roving Tabindex Pattern](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_roving_tabindex) - Focus management in composites
