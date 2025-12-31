# ProseMirror Extensions Guide

This document explains how to create and modify ProseMirror extensions in Discourse.

## Extension Location

Extensions are located in:
```
frontend/discourse/app/static/prosemirror/extensions/
```

## Extension Structure

A ProseMirror extension exports an object with these optional properties:

```javascript
// extensions/my-extension.js

import { Plugin } from "prosemirror-state";
import { InputRule } from "prosemirror-inputrules";

export default {
  // Node specifications
  nodes: {
    myNode: {
      group: "block",
      content: "inline*",
      parseDOM: [{ tag: "div.my-node" }],
      toDOM() {
        return ["div", { class: "my-node" }, 0];
      },
    },
  },

  // Mark specifications
  marks: {
    myMark: {
      parseDOM: [{ tag: "span.my-mark" }],
      toDOM() {
        return ["span", { class: "my-mark" }, 0];
      },
    },
  },

  // Input rules for text transformations
  inputRules({ schema }) {
    return [
      new InputRule(/pattern$/, (state, match, start, end) => {
        // Return transaction or null
      }),
    ];
  },

  // Plugins for behavior
  plugins({ context, schema }) {
    return [
      new Plugin({
        // Plugin spec
      }),
    ];
  },

  // Keyboard shortcuts
  keymap({ schema }) {
    return {
      "Mod-m": (state, dispatch) => {
        // Handle shortcut
        return true;
      },
    };
  },
};
```

## Core Concepts

### Nodes

Nodes represent block or inline content in the document:

```javascript
nodes: {
  // Block node (paragraph, heading, etc.)
  myBlock: {
    group: "block",
    content: "inline*",        // Contains inline content
    attrs: { level: { default: 1 } },
    parseDOM: [
      { tag: "div[data-my-block]", getAttrs: (dom) => ({ level: dom.dataset.level }) }
    ],
    toDOM(node) {
      return ["div", { "data-my-block": "", "data-level": node.attrs.level }, 0];
    },
  },

  // Inline node (emoji, mention, etc.)
  myInline: {
    group: "inline",
    inline: true,
    atom: true,                // Cannot be edited directly
    attrs: { id: {} },
    parseDOM: [{ tag: "span.my-inline" }],
    toDOM(node) {
      return ["span", { class: "my-inline", "data-id": node.attrs.id }];
    },
  },
}
```

### Marks

Marks are formatting applied to inline content:

```javascript
marks: {
  bold: {
    parseDOM: [
      { tag: "strong" },
      { tag: "b" },
      { style: "font-weight=bold" },
    ],
    toDOM() {
      return ["strong", 0];
    },
  },

  link: {
    attrs: { href: {}, title: { default: null } },
    inclusive: false,
    parseDOM: [
      {
        tag: "a[href]",
        getAttrs(dom) {
          return { href: dom.getAttribute("href"), title: dom.getAttribute("title") };
        },
      },
    ],
    toDOM(node) {
      return ["a", { href: node.attrs.href, title: node.attrs.title }, 0];
    },
  },
}
```

### Input Rules

Input rules transform text as the user types. See [INPUT-RULES.md](INPUT-RULES.md) for details.

```javascript
inputRules({ schema }) {
  return [
    // Transform **text** to bold
    new InputRule(
      /\*\*([^*]+)\*\*$/,
      (state, match, start, end) => {
        const boldMark = schema.marks.bold.create();
        return state.tr
          .delete(start, end)
          .insertText(match[1])
          .addMark(start, start + match[1].length, boldMark);
      }
    ),
  ];
}
```

### Plugins

Plugins add behavior to the editor:

```javascript
plugins({ context, schema }) {
  return [
    new Plugin({
      // State for this plugin
      state: {
        init() {
          return { count: 0 };
        },
        apply(tr, value) {
          return { count: value.count + 1 };
        },
      },

      // React to transactions
      appendTransaction(transactions, oldState, newState) {
        // Return a new transaction or null
      },

      // DOM event handlers
      props: {
        handleKeyDown(view, event) {
          // Return true if handled
        },
        handlePaste(view, event, slice) {
          // Handle paste
        },
      },

      // Decorations
      props: {
        decorations(state) {
          // Return DecorationSet
        },
      },
    }),
  ];
}
```

## Accessing Context

Extensions receive a `context` object with Discourse services:

```javascript
plugins({ context }) {
  const { appEvents, siteSettings, session, site, a11y } = context;

  return [
    new Plugin({
      view() {
        return {
          update(view, prevState) {
            // Use context services
            if (siteSettings.rich_editor) {
              a11y.announce("Editor updated", "polite");
            }
          },
        };
      },
    }),
  ];
}
```

Available context properties:
- `appEvents` - Ember application events
- `siteSettings` - Site configuration
- `session` - Current user session
- `site` - Site metadata
- `a11y` - Accessibility service

## Built-in Extensions

| Extension | Purpose |
|-----------|---------|
| `emoji.js` | Emoji shortcodes (`:smile:`) |
| `mention.js` | @username mentions |
| `hashtag.js` | #category/tag hashtags |
| `code-block.js` | Fenced code blocks with syntax highlighting |
| `link.js` | URL detection and linking |
| `image.js` | Image handling |
| `blockquote.js` | Quote blocks |
| `list.js` | Ordered and unordered lists |
| `heading.js` | Headings (h1-h6) |

## Example: Adding a Custom Node

```javascript
// extensions/callout.js

import { Plugin } from "prosemirror-state";
import { InputRule } from "prosemirror-inputrules";

export default {
  nodes: {
    callout: {
      group: "block",
      content: "inline*",
      attrs: { type: { default: "info" } },
      parseDOM: [
        {
          tag: "div.callout",
          getAttrs(dom) {
            return { type: dom.dataset.type || "info" };
          },
        },
      ],
      toDOM(node) {
        return ["div", { class: `callout callout-${node.attrs.type}`, "data-type": node.attrs.type }, 0];
      },
    },
  },

  inputRules({ schema }) {
    return [
      // :::info transforms to callout
      new InputRule(/^:::(info|warning|tip)\s$/, (state, match, start, end) => {
        const calloutType = schema.nodes.callout;
        return state.tr
          .delete(start, end)
          .setBlockType(start, start, calloutType, { type: match[1] });
      }),
    ];
  },

  keymap({ schema }) {
    return {
      // Ctrl+Shift+I inserts info callout
      "Mod-Shift-i": (state, dispatch) => {
        const calloutType = schema.nodes.callout;
        if (dispatch) {
          dispatch(state.tr.setBlockType(
            state.selection.from,
            state.selection.to,
            calloutType,
            { type: "info" }
          ));
        }
        return true;
      },
    };
  },
};
```

## Registering Extensions

Extensions are registered in the ProseMirror initialization. To add a new extension:

1. Create the extension file in `extensions/`
2. Import it in the extension loader
3. Add any necessary schema definitions
4. Add serializer/parser rules for markdown conversion

## Markdown Serialization

For new nodes/marks, add serialization rules:

```javascript
// In core/serializer.js or the extension

const myNodeSerializer = {
  callout(state, node) {
    state.write(`:::${node.attrs.type}\n`);
    state.renderContent(node);
    state.write(":::\n");
  },
};
```

## Markdown Parsing

For new nodes/marks, add parsing rules:

```javascript
// In core/parser.js or the extension

const myNodeParser = {
  callout: {
    block: "callout",
    getAttrs: (tok) => ({ type: tok.info || "info" }),
  },
};
```

## Testing Extensions

See [TESTING.md](TESTING.md) for testing guidance.

```javascript
// tests/integration/components/prosemirror-editor/callout-test.js

module("Integration | Component | prosemirror-editor - callout", function (hooks) {
  setupRenderingTest(hooks);

  test("creates callout from input rule", async function (assert) {
    // Setup and test
  });
});
```
