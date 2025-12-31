# Editor Architecture

This document describes the architecture of the Discourse editor system.

## Overview

Discourse uses a dual-editor architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                      Composer Component                      │
│                    (app/components/composer.gjs)             │
├─────────────────────────────────────────────────────────────┤
│                        d-editor.gjs                          │
│              (app/components/d-editor.gjs)                   │
│                                                              │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │   Textarea Editor   │ OR │    ProseMirror Editor       │ │
│  │   (default mode)    │    │    (rich_editor=true)       │ │
│  └─────────────────────┘    └─────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                    Shared Infrastructure                     │
│  - Toolbar (d-editor-button-bar)                            │
│  - Preview (d-editor-preview)                               │
│  - Uploads (composer-upload-uppy)                           │
│  - Autocomplete (emoji, mentions, hashtags)                 │
└─────────────────────────────────────────────────────────────┘
```

## Components

### d-editor.gjs

**Location:** `frontend/discourse/app/components/d-editor.gjs`

The main editor wrapper component that:
- Manages editor state and content
- Handles keyboard shortcuts
- Provides toolbar functionality
- Switches between textarea and ProseMirror based on `rich_editor` setting
- Manages text manipulation (formatting, insertions)

Key properties:
- `@value` - The markdown content
- `@processPreview` - Whether to render preview
- `@placeholder` - Placeholder text

### prosemirror-editor.gjs

**Location:** `frontend/discourse/app/static/prosemirror/components/prosemirror-editor.gjs`

The ProseMirror rich editor component that:
- Initializes ProseMirror EditorView
- Provides context to extensions via `getContext()`
- Handles markdown synchronization
- Manages focus and selection

Key services available in context:
- `appEvents` - Ember app events
- `siteSettings` - Site configuration
- `session` - User session
- `site` - Site metadata
- `a11y` - Accessibility service (for announcements)

## Data Flow

### Textarea Mode

```
User Input → Textarea → @value binding → Markdown string
                ↓
           Preview renders markdown → HTML
```

### Rich Editor Mode

```
User Input → ProseMirror EditorState → Transaction
                      ↓
              Extension handlers
                      ↓
              New EditorState → DOM
                      ↓
              Serializer → Markdown string → @value
```

## Key Files

### Core Editor

| File | Purpose |
|------|---------|
| `app/components/d-editor.gjs` | Main editor component |
| `app/components/d-editor-button-bar.gjs` | Toolbar buttons |
| `app/lib/composer/text-manipulation.js` | Text formatting utilities |

### ProseMirror

| File | Purpose |
|------|---------|
| `static/prosemirror/components/prosemirror-editor.gjs` | Rich editor component |
| `static/prosemirror/core/inputrules.js` | Input rule system |
| `static/prosemirror/core/parser.js` | Markdown → ProseMirror |
| `static/prosemirror/core/serializer.js` | ProseMirror → Markdown |
| `static/prosemirror/core/schema.js` | Document schema |

### Extensions

| File | Purpose |
|------|---------|
| `static/prosemirror/extensions/emoji.js` | Emoji input rules and nodes |
| `static/prosemirror/extensions/mention.js` | @mention handling |
| `static/prosemirror/extensions/hashtag.js` | #hashtag handling |
| `static/prosemirror/extensions/code-block.js` | Code block with syntax highlighting |

## Extension System

ProseMirror extensions are registered via the extension system:

```javascript
// extensions/my-extension.js
export default {
  // Node types this extension provides
  nodes: {
    myNode: { /* node spec */ }
  },

  // Mark types this extension provides
  marks: {
    myMark: { /* mark spec */ }
  },

  // Input rules for text transformations
  inputRules: [
    // See INPUT-RULES.md
  ],

  // Plugins for behavior
  plugins({ context }) {
    return [
      new Plugin({ /* plugin spec */ })
    ];
  }
};
```

## Site Settings

| Setting | Type | Description |
|---------|------|-------------|
| `rich_editor` | boolean | Enable ProseMirror rich editor |
| `enable_emoji` | boolean | Enable emoji autocomplete |
| `enable_mentions` | boolean | Enable @mentions |
| `enable_hashtags` | boolean | Enable #hashtags |

## Services

### a11y Service

**Location:** `frontend/discourse/app/services/a11y.js`

Provides accessibility announcements via ARIA live regions:

```javascript
// Inject the service
@service a11y;

// Make an announcement
this.a11y.announce("Bold applied", "polite", 1500);
```

Parameters:
- `message` - Text to announce
- `type` - "polite" (default) or "assertive"
- `clearDelay` - ms before clearing (default: 3000)

### appEvents Service

Used for cross-component communication:

```javascript
// Trigger
this.appEvents.trigger("composer:insert-text", { text: "Hello" });

// Listen
this.appEvents.on("composer:insert-text", this, this.handleInsert);
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl/Cmd + B | Bold |
| Ctrl/Cmd + I | Italic |
| Ctrl/Cmd + K | Insert link |
| Ctrl/Cmd + Shift + C | Code block |
| Tab | Indent / move focus |
| Shift + Tab | Outdent |
