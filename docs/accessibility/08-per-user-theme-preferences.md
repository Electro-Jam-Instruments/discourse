# Per-User Theme Preferences (Future Work)

**Status:** FUTURE WORK - Not yet implemented

This document collects accessibility-related preferences that individual users may want to customize. These will be implemented as per-user settings in a future phase, allowing each user to have their own accessibility preferences independent of the site-wide theme.

## Overview

Currently, Discourse theming is site-wide or theme-based. This document tracks preferences that would benefit from per-user customization, where different users on the same site may have different accessibility needs.

## Collected Preferences for Future Implementation

### 1. Focus Indicator Style

**Description:** Allow users to choose their preferred keyboard focus indicator style.

**Options to offer:**
- `rectangle` - Full rectangle outline around focused element
- `left-bar` - Left bar highlight only
- `both` - Both rectangle outline AND left bar highlight

**Why per-user:** Different users have different visual needs:
- Some find the rectangle too visually noisy
- Some need the full rectangle for visibility
- Some prefer consistency across all focus states

**Related global setting:** See `07-global-theme-accessibility.md` for the site-wide default.

---

### 2. (Add future preferences here)

As we identify more accessibility preferences that would benefit from per-user customization, document them here with:
- Description
- Options to offer
- Why it needs per-user control
- Related global setting (if any)

---

## Implementation Considerations

When implementing per-user preferences:

1. **Storage:** User preferences table or user custom fields
2. **Application:** CSS class on body element based on user preference
3. **Fallback:** Use global theme default when user hasn't set preference
4. **UI:** Add to user preferences page under Accessibility section

## References

- `07-global-theme-accessibility.md` - Site-wide defaults
- Discourse user preferences system
