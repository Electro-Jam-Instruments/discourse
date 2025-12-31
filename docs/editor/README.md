# Discourse Editor Documentation

This folder contains documentation for the Discourse editor system, including architecture, extensions, accessibility, and testing guides.

## Documentation Index

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Editor system architecture - dual editor, components, data flow |
| [PROSEMIRROR-EXTENSIONS.md](PROSEMIRROR-EXTENSIONS.md) | Creating and modifying ProseMirror extensions |
| [INPUT-RULES.md](INPUT-RULES.md) | Input rule system for text transformations |
| [ACCESSIBILITY.md](ACCESSIBILITY.md) | Accessibility implementation including live region announcements |
| [TESTING.md](TESTING.md) | Testing guide for editor features (QUnit + System specs) |

## Quick Start

### Key Directories

```
frontend/discourse/app/
├── components/
│   └── d-editor.gjs              # Main editor component (textarea mode)
├── static/prosemirror/
│   ├── components/
│   │   └── prosemirror-editor.gjs  # ProseMirror rich editor component
│   ├── core/
│   │   ├── inputrules.js         # Input rule system
│   │   ├── parser.js             # Markdown to ProseMirror parser
│   │   └── serializer.js         # ProseMirror to Markdown serializer
│   └── extensions/               # ProseMirror extensions (nodes, marks, plugins)
└── services/
    └── a11y.js                   # Accessibility service for announcements
```

### Editor Modes

Discourse has two editor modes controlled by the `rich_editor` site setting:

1. **Textarea Editor** (default) - Traditional markdown textarea with toolbar
2. **Rich Editor** - ProseMirror-based WYSIWYG editor

Both modes share:
- The same toolbar buttons
- Preview functionality
- Upload handling
- Accessibility announcements (after implementation)

### Running Tests

```bash
# JavaScript integration tests
bin/qunit frontend/discourse/tests/integration/components/d-editor-test.js
bin/qunit frontend/discourse/tests/integration/components/prosemirror-editor

# Ruby system tests (full browser)
bin/rspec spec/system/composer_spec.rb
bin/rspec spec/system/composer_a11y_announcements_spec.rb
```

## Contributing

See the individual documentation files for detailed implementation guidance. When making changes:

1. Follow existing patterns in the codebase
2. Add tests for new functionality
3. Update relevant documentation
4. Ensure accessibility compliance (WCAG 2.1 AA)
