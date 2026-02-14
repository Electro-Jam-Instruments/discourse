# Development Design Complete - Post Content Link Navigation

## Summary

I have completed a comprehensive development design for this feature. The full document is at:

**`docs/accessibility/16-post-content-link-navigation.md`**

## Success Probability: 72%

The main uncertainty is NVDA browse mode behavior when focus is on links within a `role="document"` container. Testing will be required to validate the approach.

## Key Design Decisions

### 1. Two Sub-Modes Within Document Mode

```
inDocumentMode = true
  |
  +-- linkNavigationActive = false (default)
  |     - Arrow keys: NVDA browse mode (character navigation)
  |     - Tab: Currently moves through every link (the problem)
  |
  +-- linkNavigationActive = true (new sub-mode)
        - Arrow keys: Jump between links
        - Tab/Shift+Tab: Exit document mode entirely
```

### 2. Mode Activation via Tab

When user presses Tab while in document mode:
- If `linkNavigationActive` is false: Activate link navigation, focus first link
- If `linkNavigationActive` is true: Exit document mode entirely

This is intuitive because Tab is what users naturally press when trying to interact with content.

### 3. Navigable Elements

Links and buttons within `.cooked`, excluding:
- `.lightbox` links (image viewers - better activated via Enter on image)
- Hidden elements (`aria-hidden="true"`, `.hidden`)
- Disabled buttons

### 4. Keyboard Mapping (in link navigation mode)

| Key | Action |
|-----|--------|
| Arrow Right/Down | Focus next link |
| Arrow Left/Up | Focus previous link |
| Tab | Exit document mode, next tab stop |
| Shift+Tab | Exit document mode, previous tab stop |
| Enter | Activate focused link |
| Escape | Exit document mode, return to row |
| Home | First link |
| End | Last link |

## Files to Modify

1. `frontend/discourse/app/modifiers/post-stream-navigation.js` - Core implementation
2. `app/assets/stylesheets/common/base/topic-post.scss` - Focus styles
3. `config/locales/client.en.yml` - Screen reader strings (if needed)
4. `docs/accessibility/04-topic-thread.md` - Documentation update

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| NVDA browse mode conflicts | Medium | High | Test early; may need alternative keys |
| Focus management bugs | Medium | Medium | Extensive testing, guard clauses |
| Breaking existing document mode | Low | High | Guard new behavior behind flag |

## Edge Cases Addressed

- Posts with no links (Tab exits normally)
- Quote blocks with buttons and links
- Dynamic content (quote expand/collapse)
- Oneboxes with multiple links
- Very long posts with 100+ links (caching)

## Estimated Implementation Time: 15 hours

- Phase 1: Core Navigation (4h)
- Phase 2: Focus Management (2h)
- Phase 3: Edge Cases (3h)
- Phase 4: Screen Reader Testing (4h)
- Phase 5: Documentation (2h)

## Next Steps

1. Review design document for any missed requirements
2. Prototype core arrow key navigation
3. Test with NVDA early to validate approach
4. Adjust implementation based on screen reader behavior
5. Complete implementation and testing

---

The full design document with implementation details is at `docs/accessibility/16-post-content-link-navigation.md`.
