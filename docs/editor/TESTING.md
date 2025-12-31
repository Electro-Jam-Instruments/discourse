# Editor Testing Guide

This document covers testing strategies for Discourse editor features, including QUnit integration tests and Capybara/Selenium system specs.

## Testing Layers

| Layer | Tool | What It Tests | Speed |
|-------|------|---------------|-------|
| Unit | QUnit | Individual functions, services | Fast |
| Integration | QUnit | Component interactions, DOM updates | Medium |
| System | RSpec/Capybara | Full browser, real user flows | Slow |

## QUnit Tests (JavaScript)

### Location

```
frontend/discourse/tests/
├── integration/
│   └── components/
│       ├── d-editor-test.js
│       └── prosemirror-editor/
│           ├── basic-test.js
│           ├── emoji-test.js
│           └── input-rule-announcer-test.js
└── unit/
    └── services/
        └── a11y-test.js
```

### Running Tests

```bash
# Run all QUnit tests
bin/qunit

# Run specific test file
bin/qunit frontend/discourse/tests/integration/components/d-editor-test.js

# Run tests matching filter
bin/qunit --filter "prosemirror"

# Run tests in directory
bin/qunit frontend/discourse/tests/integration/components/prosemirror-editor
```

### Test Structure

```javascript
import { module, test } from "qunit";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { render, typeIn, click } from "@ember/test-helpers";
import { hbs } from "ember-cli-htmlbars";

module("Integration | Component | d-editor", function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function () {
    // Setup for each test
    this.siteSettings.rich_editor = true;
  });

  test("applies bold formatting", async function (assert) {
    this.set("value", "");

    await render(hbs`<DEditor @value={{this.value}} />`);

    await typeIn(".d-editor-input", "hello");
    await click(".d-editor-button-bold");

    assert.dom(".d-editor-input").hasValue("**hello**");
  });
});
```

### Testing Rich Editor (ProseMirror)

```javascript
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { render, typeIn } from "@ember/test-helpers";

module("Integration | Component | prosemirror-editor", function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function () {
    this.siteSettings.rich_editor = true;
  });

  test("transforms **text** to bold", async function (assert) {
    await render(hbs`
      <ProsemirrorEditor @value={{this.value}} @onChange={{this.onChange}} />
    `);

    await typeIn(".ProseMirror", "**bold**");

    assert.dom(".ProseMirror strong").exists();
    assert.dom(".ProseMirror strong").hasText("bold");
  });
});
```

### Testing Accessibility Announcements

```javascript
import {
  disableClearA11yAnnouncementsInTests,
} from "discourse/tests/helpers/a11y-test-helpers";

module("Integration | Component | prosemirror-editor - announcements", function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function () {
    // Prevent announcements from auto-clearing
    disableClearA11yAnnouncementsInTests();
    this.siteSettings.rich_editor = true;
  });

  test("announces bold formatting", async function (assert) {
    await render(hbs`
      <ProsemirrorEditor @value={{this.value}} @onChange={{this.onChange}} />
    `);

    await typeIn(".ProseMirror", "**bold**");

    assert.dom("#a11y-announcements-polite").hasText("Bold applied");
  });

  test("announces emoji insertion", async function (assert) {
    await render(hbs`
      <ProsemirrorEditor @value={{this.value}} @onChange={{this.onChange}} />
    `);

    await typeIn(".ProseMirror", ":smile: ");

    assert.dom("#a11y-announcements-polite").hasText("smile");
  });
});
```

### Test Helpers

| Helper | Purpose |
|--------|---------|
| `setupRenderingTest(hooks)` | Standard component test setup |
| `disableClearA11yAnnouncementsInTests()` | Prevent announcement auto-clear |
| `render(hbs\`...\`)` | Render a template |
| `typeIn(selector, text)` | Type text into element |
| `click(selector)` | Click an element |
| `fillIn(selector, value)` | Fill input with value |
| `triggerKeyEvent(selector, type, key)` | Trigger keyboard event |

### Accessing Services in Tests

```javascript
test("uses a11y service", async function (assert) {
  const a11y = this.owner.lookup("service:a11y");

  a11y.announce("Test message", "polite");

  assert.dom("#a11y-announcements-polite").hasText("Test message");
});
```

## System Specs (Ruby/Capybara)

### Location

```
spec/system/
├── composer_spec.rb
├── composer_a11y_announcements_spec.rb
└── page_objects/
    └── components/
        ├── composer.rb
        └── a11y_announcer.rb
```

### Running System Specs

```bash
# Run all system specs
bin/rspec spec/system

# Run specific spec file
bin/rspec spec/system/composer_a11y_announcements_spec.rb

# Run with visible browser (for debugging)
SELENIUM_HEADLESS=0 bin/rspec spec/system/composer_spec.rb

# Run single test
bin/rspec spec/system/composer_spec.rb:42
```

### Spec Structure

```ruby
# frozen_string_literal: true

describe "Composer accessibility", type: :system do
  fab!(:user) { Fabricate(:user, refresh_auto_groups: true) }
  let(:composer) { PageObjects::Components::Composer.new }
  let(:a11y) { PageObjects::Components::A11yAnnouncer.new }

  before { sign_in(user) }

  context "with rich editor enabled" do
    before { SiteSetting.rich_editor = true }

    it "announces bold formatting" do
      page.visit "/new-topic"
      expect(composer).to be_opened
      composer.type_content("**bold text**")
      expect(a11y).to have_polite_announcement("Bold applied")
    end
  end
end
```

### Page Objects

Page objects encapsulate element selectors and interactions:

```ruby
# spec/system/page_objects/components/a11y_announcer.rb

module PageObjects
  module Components
    class A11yAnnouncer < PageObjects::Components::Base
      POLITE_REGION = "#a11y-announcements-polite"
      ASSERTIVE_REGION = "#a11y-announcements-assertive"

      def has_polite_announcement?(text)
        page.has_css?(POLITE_REGION, text: text)
      end

      def has_no_polite_announcement?
        page.has_css?(POLITE_REGION, text: "")
      end

      def has_assertive_announcement?(text)
        page.has_css?(ASSERTIVE_REGION, text: text)
      end

      def polite_region_has_aria_live?
        page.has_css?("#{POLITE_REGION}[aria-live='polite']")
      end

      def wait_for_announcement_clear(timeout: 3)
        page.has_css?(POLITE_REGION, text: "", wait: timeout)
      end
    end
  end
end
```

### Composer Page Object

```ruby
# spec/system/page_objects/components/composer.rb

module PageObjects
  module Components
    class Composer < PageObjects::Components::Base
      COMPOSER_ID = "#reply-control"

      def opened?
        page.has_css?("#{COMPOSER_ID}.open")
      end

      def type_content(content)
        composer_input.send_keys(content)
        self
      end

      def click_toolbar_button(button_class)
        find(".d-editor-button-bar button.#{button_class}").click
        self
      end

      private

      def composer_input
        find("#{COMPOSER_ID} .d-editor-input")
      end
    end
  end
end
```

### Testing ARIA Attributes

```ruby
describe "ARIA live regions", type: :system do
  it "has polite live region with correct attributes" do
    page.visit "/new-topic"

    expect(page).to have_css('[aria-live="polite"]')
    expect(page).to have_css('[role="status"]')
  end

  it "has assertive live region for errors" do
    page.visit "/new-topic"

    expect(page).to have_css('[aria-live="assertive"]')
    expect(page).to have_css('[role="alert"]')
  end
end
```

### Testing Announcement Timing

```ruby
it "clears announcement after delay" do
  page.visit "/new-topic"
  composer.type_content("**bold**")

  expect(a11y).to have_polite_announcement("Bold applied")

  # Wait for auto-clear (1500ms + buffer)
  expect(a11y.wait_for_announcement_clear(timeout: 3)).to eq(true)
end
```

## CI Integration

System specs run in GitHub Actions:

```yaml
# .github/workflows/tests.yml

system-tests:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Setup Ruby
      uses: ruby/setup-ruby@v1
    - name: Run system specs
      run: bin/rspec spec/system
      env:
        SELENIUM_HEADLESS: "1"
```

## Test Coverage Matrix

| Feature | QUnit Integration | System Spec |
|---------|-------------------|-------------|
| Bold input rule | `prosemirror-editor/formatting-test.js` | `composer_a11y_announcements_spec.rb` |
| Italic input rule | `prosemirror-editor/formatting-test.js` | `composer_a11y_announcements_spec.rb` |
| Emoji input rule | `prosemirror-editor/emoji-test.js` | `composer_a11y_announcements_spec.rb` |
| Heading input rule | `prosemirror-editor/blocks-test.js` | `composer_a11y_announcements_spec.rb` |
| Toolbar bold button | `d-editor-test.js` | `composer_spec.rb` |
| Announcement timing | `a11y-announcer-test.js` | `composer_a11y_announcements_spec.rb` |
| ARIA attributes | `a11y-announcer-test.js` | `composer_a11y_announcements_spec.rb` |

## Debugging Tests

### QUnit

```javascript
test("debugging test", async function (assert) {
  await render(hbs`<DEditor @value={{this.value}} />`);

  // Pause test for inspection
  await pauseTest();

  // Log DOM state
  console.log(document.querySelector(".d-editor").innerHTML);

  assert.ok(true);
});
```

### System Specs

```ruby
it "debugging spec" do
  page.visit "/new-topic"

  # Take screenshot
  page.save_screenshot("debug.png")

  # Pause for inspection (run with SELENIUM_HEADLESS=0)
  binding.pry

  # Print page HTML
  puts page.html
end
```

## Best Practices

### Do

- Use page objects for selectors
- Test behavior, not implementation
- Wait for async operations
- Test both editors (textarea and rich)
- Clean up state between tests

### Don't

- Store `find()` results (causes stale element errors)
- Test CSS styling in system specs
- Write brittle timing-dependent tests
- Skip accessibility tests

### Example: Complete Test Suite

```javascript
// tests/integration/components/prosemirror-editor/input-rule-announcer-test.js

import { module, test } from "qunit";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { render, typeIn } from "@ember/test-helpers";
import { hbs } from "ember-cli-htmlbars";
import {
  disableClearA11yAnnouncementsInTests,
} from "discourse/tests/helpers/a11y-test-helpers";

module("Integration | Component | prosemirror-editor - input rule announcements", function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function () {
    disableClearA11yAnnouncementsInTests();
    this.siteSettings.rich_editor = true;
    this.set("value", "");
    this.set("onChange", (v) => this.set("value", v));
  });

  test("announces emoji insertion", async function (assert) {
    await render(hbs`
      <ProsemirrorEditor @value={{this.value}} @onChange={{this.onChange}} />
    `);
    await typeIn(".ProseMirror", ":smile: ");
    assert.dom("#a11y-announcements-polite").hasText("smile");
  });

  test("announces bold formatting", async function (assert) {
    await render(hbs`
      <ProsemirrorEditor @value={{this.value}} @onChange={{this.onChange}} />
    `);
    await typeIn(".ProseMirror", "**bold**");
    assert.dom("#a11y-announcements-polite").hasText("Bold applied");
  });

  test("announces italic formatting", async function (assert) {
    await render(hbs`
      <ProsemirrorEditor @value={{this.value}} @onChange={{this.onChange}} />
    `);
    await typeIn(".ProseMirror", "*italic*");
    assert.dom("#a11y-announcements-polite").hasText("Italic applied");
  });

  test("announces heading creation", async function (assert) {
    await render(hbs`
      <ProsemirrorEditor @value={{this.value}} @onChange={{this.onChange}} />
    `);
    await typeIn(".ProseMirror", "# ");
    assert.dom("#a11y-announcements-polite").hasText("Heading 1");
  });

  test("announces bullet list creation", async function (assert) {
    await render(hbs`
      <ProsemirrorEditor @value={{this.value}} @onChange={{this.onChange}} />
    `);
    await typeIn(".ProseMirror", "- ");
    assert.dom("#a11y-announcements-polite").hasText("Bullet list");
  });

  test("announces blockquote creation", async function (assert) {
    await render(hbs`
      <ProsemirrorEditor @value={{this.value}} @onChange={{this.onChange}} />
    `);
    await typeIn(".ProseMirror", "> ");
    assert.dom("#a11y-announcements-polite").hasText("Blockquote");
  });
});
```
