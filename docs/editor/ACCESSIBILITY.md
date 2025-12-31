# Editor Accessibility

This document covers accessibility implementation for the Discourse editor, with a focus on live region announcements for screen reader users.

## Overview

Discourse follows WCAG 2.1 AA guidelines. The editor provides:
- Keyboard navigation
- Screen reader announcements
- Focus management
- ARIA attributes

## ARIA Live Regions

### What Are Live Regions?

ARIA live regions announce dynamic content changes to screen readers without requiring focus:

```html
<div id="a11y-announcements-polite" role="status" aria-live="polite"></div>
<div id="a11y-announcements-assertive" role="alert" aria-live="assertive"></div>
```

- **polite**: Announces when the screen reader is idle (non-interrupting)
- **assertive**: Interrupts current speech immediately

### The a11y Service

**Location:** `frontend/discourse/app/services/a11y.js`

```javascript
@service a11y;

// Make a polite announcement (doesn't interrupt)
this.a11y.announce("Bold applied", "polite", 1500);

// Make an assertive announcement (interrupts)
this.a11y.announce("Error: Invalid mention", "assertive", 3000);
```

Parameters:
- `message` (string): Text to announce
- `type` (string): "polite" or "assertive" (default: "polite")
- `clearDelay` (number): Milliseconds before clearing (default: 3000)

## Input Rule Announcements

When users trigger input rules (like `**bold**` or `:smile:`), the editor announces the action.

### Architecture

```
User types "**text**"
        ↓
Input rule matches pattern
        ↓
Handler creates transaction
        ↓
Transaction.setMeta("inputRuleTriggered", { type, content })
        ↓
InputRuleAnnouncer plugin reads metadata
        ↓
a11y.announce() called
        ↓
Live region updated
        ↓
Screen reader announces "Bold applied"
```

### Implementation Files

| File | Purpose |
|------|---------|
| `prosemirror-editor.gjs` | Provides `a11y` service in context |
| `core/inputrules.js` | Wrapper attaches metadata to transactions |
| `extensions/input-rule-announcer.js` | Plugin reads metadata, calls announce |
| `services/a11y.js` | Service updates live region DOM |
| `config/locales/client.en.yml` | i18n strings for announcements |

### Adding a11y Service to Context

```javascript
// prosemirror-editor.gjs

@service a11y;

getContext() {
  return {
    // ...other services
    a11y: this.a11y,
  };
}
```

### Input Rule Wrapper

```javascript
// core/inputrules.js

function wrapHandlerWithBacktickCheck(handler, a11yType = null) {
  return (state, match, start, end) => {
    // Skip inside code
    if (isInCode(state.doc.resolve(start))) {
      return null;
    }

    const result = handler(state, match, start, end);

    // Attach metadata for announcements
    if (result && a11yType) {
      result.setMeta("inputRuleTriggered", {
        type: a11yType,
        match: match,
        content: match[2] || match[1] || match[0],
      });
    }

    return result;
  };
}
```

### Announcer Plugin

```javascript
// extensions/input-rule-announcer.js

import { Plugin } from "prosemirror-state";
import I18n from "discourse-i18n";

export default function inputRuleAnnouncer(context) {
  return new Plugin({
    appendTransaction(transactions, oldState, newState) {
      for (const tr of transactions) {
        const meta = tr.getMeta("inputRuleTriggered");
        if (meta) {
          announceInputRule(context.a11y, meta);
        }
      }
      return null;
    },
  });
}

function announceInputRule(a11y, meta) {
  const { type, content } = meta;

  let message;
  switch (type) {
    case "emoji":
      message = content; // Just the emoji name
      break;
    case "mention":
      message = content; // Just the username
      break;
    case "hashtag":
      message = content; // Just the tag
      break;
    case "heading":
      message = I18n.t("composer.a11y.input_rule.heading_created", {
        level: meta.level || 1,
      });
      break;
    default:
      message = I18n.t(`composer.a11y.input_rule.${type}_applied`);
  }

  a11y.announce(message, "polite", 1500);
}
```

### i18n Strings

```yaml
# config/locales/client.en.yml

en:
  js:
    composer:
      a11y:
        input_rule:
          emoji_inserted: "%{emoji}"
          mention_inserted: "%{username}"
          hashtag_inserted: "%{tag}"
          bold_applied: "Bold applied"
          italic_applied: "Italic applied"
          code_applied: "Code applied"
          strikethrough_applied: "Strikethrough applied"
          heading_created: "Heading %{level}"
          bullet_list_created: "Bullet list"
          ordered_list_created: "Numbered list"
          blockquote_created: "Blockquote"
          code_block_created: "Code block"
          horizontal_rule_created: "Horizontal rule"
        mention_invalid: "%{username} not found"
        hashtag_invalid: "%{tag} not found"
```

## Toolbar Button Announcements

For the textarea editor, toolbar buttons also announce their actions.

### Implementation

```javascript
// components/d-editor.gjs

@service a11y;

@action
applyBold() {
  this.textManipulation.applyBold();
  this.a11y.announce(I18n.t("composer.a11y.input_rule.bold_applied"), "polite", 1500);
}
```

## Announcement Guidelines

### Message Content

Keep announcements brief and actionable:

| Good | Bad |
|------|-----|
| "Bold applied" | "The selected text has been formatted as bold" |
| "smile" (for emoji) | "Emoji smile has been inserted into the document" |
| "Heading 1" | "You have created a level 1 heading" |

### Timing

- Use `polite` for normal operations (doesn't interrupt)
- Use `assertive` only for errors or critical info
- Clear delay: 1500ms for frequent actions, 3000ms for important messages

### Avoid Duplicate Announcements

Don't announce when:
- The action was triggered by a keyboard shortcut (the key combo was already announced)
- Multiple transformations happen at once (announce only the most relevant)
- The same announcement was just made

## Validation Announcements

For async validation (mentions, hashtags), announce the result:

```javascript
// When mention is validated
validateMention(username) {
  return fetch(`/users/${username}`)
    .then(response => {
      if (!response.ok) {
        this.a11y.announce(
          I18n.t("composer.a11y.mention_invalid", { username }),
          "assertive",
          3000
        );
        return false;
      }
      return true;
    });
}
```

## Keyboard Navigation

### Editor Shortcuts

| Shortcut | Action |
|----------|--------|
| Tab | Move to next element (when at end) |
| Shift+Tab | Move to previous element |
| Escape | Exit editor, return to composer |
| Ctrl/Cmd+B | Bold |
| Ctrl/Cmd+I | Italic |
| Ctrl/Cmd+K | Insert link |

### Focus Management

```javascript
// Focus the reply button when tabbing out
composer.focus();
page.send_keys(:tab);
expect(composer.reply_button_focused?).to eq(true);
```

## Testing Accessibility

### QUnit Tests

```javascript
test("announces bold formatting", async function (assert) {
  disableClearA11yAnnouncementsInTests();
  await setupRichEditor(assert, "");

  await typeIn(".ProseMirror", "**bold**");

  assert.dom("#a11y-announcements-polite").hasText("Bold applied");
});
```

### System Specs

```ruby
# spec/system/composer_a11y_announcements_spec.rb

it "announces bold formatting" do
  page.visit "/new-topic"
  composer.type_content("**bold text**")
  expect(a11y).to have_polite_announcement("Bold applied")
end
```

### Screen Reader Testing

| Screen Reader | Platform | Notes |
|---------------|----------|-------|
| NVDA | Windows | Most common, free |
| JAWS | Windows | Enterprise standard |
| VoiceOver | macOS/iOS | Built-in to Apple devices |
| TalkBack | Android | Built-in to Android |

#### Manual Testing Steps

1. Enable screen reader
2. Navigate to composer
3. Type input rule triggers (e.g., `**bold**`)
4. Verify announcement is read
5. Check timing (should not interrupt typing flow)

## ARIA Attributes

### Editor Container

```html
<div class="d-editor-container"
     role="region"
     aria-label="Post editor">
```

### Toolbar

```html
<div class="d-editor-button-bar"
     role="toolbar"
     aria-label="Formatting toolbar">
  <button aria-label="Bold (Ctrl+B)"
          aria-pressed="false">
```

### Preview

```html
<div class="d-editor-preview"
     role="region"
     aria-label="Preview"
     aria-live="polite">
```

## Common Accessibility Issues

### Issue: Announcements Not Firing

Check:
1. a11y service is injected: `@service a11y;`
2. Service is in context: `a11y: this.a11y` in `getContext()`
3. Transaction has metadata: `tr.getMeta("inputRuleTriggered")`
4. Live region exists in DOM

### Issue: Announcements Too Verbose

Solution: Shorten messages, use `polite` mode, reduce clear delay

### Issue: Missing Keyboard Focus

Check:
1. Element has `tabindex="0"` or is natively focusable
2. Focus styles are visible (not `outline: none`)
3. Focus order is logical

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/TR/WCAG21/)
- [ARIA Live Regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions)
- [Discourse Accessibility](https://meta.discourse.org/c/accessibility)
- Report issues: accessibility@discourse.org
