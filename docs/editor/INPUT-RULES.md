# Input Rules Documentation

Input rules transform text as the user types, enabling markdown-style shortcuts in the rich editor.

## Overview

Input rules are patterns that match text and automatically transform it. For example:
- `**text**` becomes **bold**
- `:smile:` becomes an emoji
- `# ` at line start becomes a heading

## Location

Input rules are defined in:
```
frontend/discourse/app/static/prosemirror/core/inputrules.js
frontend/discourse/app/static/prosemirror/extensions/*.js
```

## How Input Rules Work

```
User types: "**hello**"
                 ↓
Input rule regex matches: /\*\*([^*]+)\*\*$/
                 ↓
Handler creates transaction with:
  - Delete the matched text
  - Insert "hello" with bold mark
                 ↓
EditorState updates, DOM re-renders
                 ↓
(With accessibility) a11y.announce("Bold applied")
```

## Creating Input Rules

### Basic Structure

```javascript
import { InputRule } from "prosemirror-inputrules";

const myRule = new InputRule(
  /pattern$/,                           // Regex ending with $
  (state, match, start, end) => {       // Handler function
    // state: current EditorState
    // match: regex match array
    // start: match start position
    // end: match end position (cursor)

    // Return a transaction or null
    return state.tr.delete(start, end).insertText("replacement");
  }
);
```

### Pattern Requirements

- Must end with `$` to match at cursor position
- Avoid greedy patterns that match too much
- Use non-capturing groups `(?:...)` when possible

### Handler Return Values

- **Transaction**: Apply the transformation
- **null**: Don't transform (let other rules try)

## Built-in Input Rules

### Formatting Rules

| Pattern | Trigger | Result |
|---------|---------|--------|
| `**text**` | Type closing `*` | Bold text |
| `*text*` | Type closing `*` | Italic text |
| `` `code` `` | Type closing `` ` `` | Inline code |
| `~~text~~` | Type closing `~` | Strikethrough |

### Block Rules

| Pattern | Trigger | Result |
|---------|---------|--------|
| `# ` | Space after `#` | Heading 1 |
| `## ` | Space after `##` | Heading 2 |
| `- ` | Space after `-` | Bullet list |
| `1. ` | Space after number | Numbered list |
| `> ` | Space after `>` | Blockquote |
| ` ``` ` | Three backticks | Code block |
| `---` | Three dashes | Horizontal rule |

### Special Rules

| Pattern | Trigger | Result |
|---------|---------|--------|
| `:emoji:` | Space after emoji code | Emoji character |
| `@username` | Space after mention | Mention node |
| `#hashtag` | Space after hashtag | Hashtag node |

## The Input Rule Wrapper

Discourse wraps input rules with `wrapHandlerWithBacktickCheck()`:

```javascript
// core/inputrules.js

function wrapHandlerWithBacktickCheck(handler, a11yType = null) {
  return (state, match, start, end) => {
    // Skip if inside code block or inline code
    const $start = state.doc.resolve(start);
    if (isInCode($start)) {
      return null;
    }

    // Call original handler
    const result = handler(state, match, start, end);

    // Attach accessibility metadata
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

This wrapper:
1. Prevents rules from firing inside code blocks
2. Attaches metadata for accessibility announcements
3. Preserves the original rule behavior

## Adding Accessibility to Rules

To make an input rule announce its action:

### Step 1: Add a11yType to the Rule

```javascript
// In your extension
inputRules({ schema }) {
  return [
    {
      rule: new InputRule(/\*\*([^*]+)\*\*$/, (state, match, start, end) => {
        // Transform logic
      }),
      a11yType: "bold",  // Accessibility type identifier
    },
  ];
}
```

### Step 2: Add i18n String

```yaml
# config/locales/client.en.yml
composer:
  a11y:
    input_rule:
      bold_applied: "Bold applied"
```

### Step 3: Announcer Plugin Reads Metadata

The `input-rule-announcer` plugin reads transaction metadata and announces:

```javascript
// extensions/input-rule-announcer.js

new Plugin({
  appendTransaction(transactions, oldState, newState) {
    for (const tr of transactions) {
      const meta = tr.getMeta("inputRuleTriggered");
      if (meta) {
        const message = I18n.t(`composer.a11y.input_rule.${meta.type}_applied`);
        context.a11y.announce(message, "polite", 1500);
      }
    }
    return null;
  },
});
```

## Input Rule Types

### a11yType Values

| Type | Announcement |
|------|--------------|
| `emoji` | Emoji name (e.g., "smile") |
| `mention` | Username (e.g., "john") |
| `hashtag` | Tag name (e.g., "help") |
| `bold` | "Bold applied" |
| `italic` | "Italic applied" |
| `code` | "Code applied" |
| `heading` | "Heading N" |
| `bullet_list` | "Bullet list" |
| `ordered_list` | "Numbered list" |
| `blockquote` | "Blockquote" |
| `code_block` | "Code block" |
| `horizontal_rule` | "Horizontal rule" |

## Example: Custom Input Rule

Create a rule that transforms `->` into an arrow `→`:

```javascript
// extensions/arrow.js

import { InputRule } from "prosemirror-inputrules";

export default {
  inputRules({ schema }) {
    return [
      {
        rule: new InputRule(
          /->$/,
          (state, match, start, end) => {
            return state.tr.delete(start, end).insertText("→");
          }
        ),
        a11yType: "arrow",
      },
    ];
  },
};
```

Add the i18n string:

```yaml
composer:
  a11y:
    input_rule:
      arrow_applied: "Arrow inserted"
```

## Testing Input Rules

```javascript
// tests/integration/components/prosemirror-editor/arrow-test.js

import { module, test } from "qunit";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { typeIn } from "@ember/test-helpers";

module("Integration | ProseMirror | arrow input rule", function (hooks) {
  setupRenderingTest(hooks);

  test("transforms -> to arrow", async function (assert) {
    // Setup editor
    await setupRichEditor(assert, "");

    // Type the trigger
    await typeIn(".ProseMirror", "->");

    // Verify transformation
    assert.dom(".ProseMirror").hasText("→");
  });

  test("announces arrow insertion", async function (assert) {
    disableClearA11yAnnouncementsInTests();
    await setupRichEditor(assert, "");

    await typeIn(".ProseMirror", "->");

    assert.dom("#a11y-announcements-polite").hasText("Arrow inserted");
  });
});
```

## Common Patterns

### Wrapping Selection with Marks

```javascript
new InputRule(/\*\*([^*]+)\*\*$/, (state, match, start, end) => {
  const boldMark = schema.marks.bold.create();
  return state.tr
    .delete(start, end)
    .insertText(match[1])
    .addMark(start, start + match[1].length, boldMark);
});
```

### Replacing with Node

```javascript
new InputRule(/:([a-z_]+):$/, (state, match, start, end) => {
  const emojiNode = schema.nodes.emoji.create({ name: match[1] });
  return state.tr.replaceWith(start, end, emojiNode);
});
```

### Block Type Change

```javascript
new InputRule(/^#\s$/, (state, match, start, end) => {
  return state.tr
    .delete(start, end)
    .setBlockType(start, start, schema.nodes.heading, { level: 1 });
});
```

## Debugging Input Rules

1. Add console logging in the handler:
   ```javascript
   (state, match, start, end) => {
     console.log("Input rule matched:", { match, start, end });
     // ...
   }
   ```

2. Check if inside code block:
   ```javascript
   const $start = state.doc.resolve(start);
   console.log("Is in code:", isInCode($start));
   ```

3. Verify transaction is returned:
   ```javascript
   const tr = state.tr.delete(start, end).insertText("test");
   console.log("Transaction:", tr);
   return tr;
   ```
