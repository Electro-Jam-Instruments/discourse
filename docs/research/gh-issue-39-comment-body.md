## Research Complete - Development Design Ready

I've completed a thorough analysis of this issue and created a detailed development design document.

### Key Findings

**Root Cause:** The action buttons (edit pencil) are currently **nested inside** the treeitem link element. This violates WAI-ARIA spec (children of composite widget items are presentational) and makes them unreachable via keyboard.

**Note:** This is actually a known unsolved problem in the accessibility community. The W3C ARIA Working Group has an [open issue (#1440)](https://github.com/w3c/aria/issues/1440) specifically about "Secondary actions on items in composite widget roles" with no official pattern established yet.

### Recommended Solution: Extended Tree Item Navigation

Move action buttons to be **siblings** of the link (not children), then extend the `sidebar-tree-navigation.js` modifier to support horizontal navigation within rows:

- **Arrow Right** on tree item -> Focus moves to first action button
- **Arrow Left** on action button -> Focus returns to tree item
- **Arrow Up/Down** always navigate between rows

This matches the existing behavior in section headers, which already use a toolbar pattern with Left/Right navigation between the collapse button and edit button.

### Success Probability: 75%

**Positive factors:**
- Clear technical path (pattern already works in section headers)
- Well-understood focus management patterns
- Fixes underlying ARIA violation

**Risk factors:**
- Plugin API changes may reveal unexpected usage
- No official WAI-ARIA pattern to reference
- Screen reader testing needed

### Files to Modify

| File | Purpose |
|------|---------|
| `frontend/discourse/app/components/sidebar/section-link.gjs` | Restructure HTML - buttons as siblings |
| `frontend/discourse/app/modifiers/sidebar-tree-navigation.js` | Add horizontal navigation within rows |
| `app/assets/stylesheets/common/base/sidebar-section-link.scss` | CSS for new structure |
| `config/locales/client.en.yml` | Aria-label strings |

### Documentation

Full design document created at:
**`docs/accessibility/15-sidebar-action-buttons.md`**

Includes:
- Current behavior analysis
- WAI-ARIA requirements research
- Three implementation options with trade-offs
- Recommended approach with justification
- Edge cases and risk assessment
- Testing strategy

### Next Steps

1. Review the design document
2. Decide on implementation priority
3. Consider if this should be split into phases (restructure first, keyboard nav second)
