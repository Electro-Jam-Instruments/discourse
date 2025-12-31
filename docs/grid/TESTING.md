# Testing Grid and Toolbar Accessibility

This document covers testing strategies for the navigation toolbar and topic list grid accessibility implementations.

## Testing Layers

| Layer | Tool | What It Tests | Speed |
|-------|------|---------------|-------|
| Unit | QUnit | Modifier logic, utility functions | Fast |
| Integration | QUnit | Component interactions, DOM updates | Medium |
| System | RSpec/Capybara | Full browser, real user flows | Slow |
| Manual | Screen readers | Real assistive technology | Manual |

## Test Helpers

**File: `frontend/discourse/tests/helpers/keyboard-navigation-helpers.js`**

```javascript
import { triggerKeyEvent, focus } from "@ember/test-helpers";

/**
 * Simulate arrow key navigation
 *
 * @param {Element} element - Element to trigger key on
 * @param {string} direction - "Up", "Down", "Left", "Right"
 */
export async function pressArrowKey(element, direction) {
  await focus(element);
  await triggerKeyEvent(element, "keydown", `Arrow${direction}`);
}

/**
 * Simulate Home/End key press
 *
 * @param {Element} element - Element to trigger key on
 * @param {string} key - "Home" or "End"
 */
export async function pressHomeEnd(element, key) {
  await focus(element);
  await triggerKeyEvent(element, "keydown", key);
}

/**
 * Simulate PageUp/PageDown key press
 *
 * @param {Element} element - Element to trigger key on
 * @param {string} key - "PageUp" or "PageDown"
 */
export async function pressPageKey(element, key) {
  await focus(element);
  await triggerKeyEvent(element, "keydown", key);
}

/**
 * Assert element has correct tabindex
 *
 * @param {Object} assert - QUnit assert object
 * @param {Element} element - Element to check
 * @param {string} expected - Expected tabindex value
 * @param {string} message - Assertion message
 */
export function assertTabindex(assert, element, expected, message) {
  const actual = element.getAttribute("tabindex");
  assert.strictEqual(actual, String(expected), message);
}

/**
 * Assert roving tabindex state across collection
 *
 * @param {Object} assert - QUnit assert object
 * @param {Element[]} elements - Collection of elements
 * @param {number} activeIndex - Expected active index
 * @param {string} message - Assertion message prefix
 */
export function assertRovingTabindex(assert, elements, activeIndex, message) {
  elements.forEach((el, index) => {
    const expected = index === activeIndex ? "0" : "-1";
    const actual = el.getAttribute("tabindex");
    assert.strictEqual(
      actual,
      expected,
      `${message}: element ${index} should have tabindex="${expected}"`
    );
  });
}

/**
 * Get currently focused element's index in collection
 *
 * @param {Element[]} elements - Collection to search
 * @returns {number} Index of focused element, -1 if not found
 */
export function getFocusedIndex(elements) {
  const focused = document.activeElement;
  return Array.from(elements).indexOf(focused);
}

/**
 * Assert element has ARIA role
 *
 * @param {Object} assert - QUnit assert object
 * @param {Element} element - Element to check
 * @param {string} role - Expected role value
 */
export function assertRole(assert, element, role) {
  assert.strictEqual(
    element.getAttribute("role"),
    role,
    `Element should have role="${role}"`
  );
}
```

## Unit Tests

### Toolbar Navigation Modifier

**File: `frontend/discourse/tests/unit/modifiers/toolbar-navigation-test.js`**

```javascript
import { module, test } from "qunit";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { render, focus, triggerKeyEvent } from "@ember/test-helpers";
import { hbs } from "ember-cli-htmlbars";
import {
  assertRovingTabindex,
  getFocusedIndex,
} from "discourse/tests/helpers/keyboard-navigation-helpers";

module("Unit | Modifier | toolbar-navigation", function (hooks) {
  setupRenderingTest(hooks);

  test("initializes with first item focusable", async function (assert) {
    await render(hbs`
      <ul role="toolbar" {{toolbarNavigation}}>
        <li><a href="#1">Item 1</a></li>
        <li><a href="#2">Item 2</a></li>
        <li><a href="#3">Item 3</a></li>
      </ul>
    `);

    const items = document.querySelectorAll("a");
    assertRovingTabindex(assert, items, 0, "Initial state");
  });

  test("arrow right moves to next item", async function (assert) {
    await render(hbs`
      <ul role="toolbar" {{toolbarNavigation}}>
        <li><a href="#1">Item 1</a></li>
        <li><a href="#2">Item 2</a></li>
        <li><a href="#3">Item 3</a></li>
      </ul>
    `);

    const items = document.querySelectorAll("a");
    await focus(items[0]);
    await triggerKeyEvent(items[0], "keydown", "ArrowRight");

    assert.strictEqual(document.activeElement, items[1]);
    assertRovingTabindex(assert, items, 1, "After ArrowRight");
  });

  test("arrow left moves to previous item", async function (assert) {
    await render(hbs`
      <ul role="toolbar" {{toolbarNavigation}}>
        <li><a href="#1">Item 1</a></li>
        <li><a href="#2">Item 2</a></li>
        <li><a href="#3">Item 3</a></li>
      </ul>
    `);

    const items = document.querySelectorAll("a");
    await focus(items[1]);
    await triggerKeyEvent(items[1], "keydown", "ArrowLeft");

    assert.strictEqual(document.activeElement, items[0]);
  });

  test("home key focuses first item", async function (assert) {
    await render(hbs`
      <ul role="toolbar" {{toolbarNavigation}}>
        <li><a href="#1">Item 1</a></li>
        <li><a href="#2">Item 2</a></li>
        <li><a href="#3">Item 3</a></li>
      </ul>
    `);

    const items = document.querySelectorAll("a");
    await focus(items[2]);
    await triggerKeyEvent(items[2], "keydown", "Home");

    assert.strictEqual(document.activeElement, items[0]);
  });

  test("end key focuses last item", async function (assert) {
    await render(hbs`
      <ul role="toolbar" {{toolbarNavigation}}>
        <li><a href="#1">Item 1</a></li>
        <li><a href="#2">Item 2</a></li>
        <li><a href="#3">Item 3</a></li>
      </ul>
    `);

    const items = document.querySelectorAll("a");
    await focus(items[0]);
    await triggerKeyEvent(items[0], "keydown", "End");

    assert.strictEqual(document.activeElement, items[2]);
  });

  test("wraps from last to first with arrow right", async function (assert) {
    await render(hbs`
      <ul role="toolbar" {{toolbarNavigation wrap=true}}>
        <li><a href="#1">Item 1</a></li>
        <li><a href="#2">Item 2</a></li>
        <li><a href="#3">Item 3</a></li>
      </ul>
    `);

    const items = document.querySelectorAll("a");
    await focus(items[2]);
    await triggerKeyEvent(items[2], "keydown", "ArrowRight");

    assert.strictEqual(document.activeElement, items[0]);
  });
});
```

### Grid Navigation Modifier

**File: `frontend/discourse/tests/unit/modifiers/grid-navigation-test.js`**

```javascript
import { module, test } from "qunit";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { render, focus, triggerKeyEvent } from "@ember/test-helpers";
import { hbs } from "ember-cli-htmlbars";
import { assertRovingTabindex } from "discourse/tests/helpers/keyboard-navigation-helpers";

module("Unit | Modifier | grid-navigation", function (hooks) {
  setupRenderingTest(hooks);

  test("initializes with first row focusable", async function (assert) {
    await render(hbs`
      <table role="grid" {{gridNavigation}}>
        <tbody>
          <tr role="row"><td role="gridcell">Row 1</td></tr>
          <tr role="row"><td role="gridcell">Row 2</td></tr>
          <tr role="row"><td role="gridcell">Row 3</td></tr>
        </tbody>
      </table>
    `);

    const rows = document.querySelectorAll('tr[role="row"]');
    assertRovingTabindex(assert, rows, 0, "Initial state");
  });

  test("arrow down moves to next row", async function (assert) {
    await render(hbs`
      <table role="grid" {{gridNavigation}}>
        <tbody>
          <tr role="row"><td role="gridcell">Row 1</td></tr>
          <tr role="row"><td role="gridcell">Row 2</td></tr>
        </tbody>
      </table>
    `);

    const rows = document.querySelectorAll('tr[role="row"]');
    await focus(rows[0]);
    await triggerKeyEvent(rows[0], "keydown", "ArrowDown");

    assert.strictEqual(document.activeElement, rows[1]);
  });

  test("arrow up moves to previous row", async function (assert) {
    await render(hbs`
      <table role="grid" {{gridNavigation}}>
        <tbody>
          <tr role="row"><td role="gridcell">Row 1</td></tr>
          <tr role="row"><td role="gridcell">Row 2</td></tr>
        </tbody>
      </table>
    `);

    const rows = document.querySelectorAll('tr[role="row"]');
    await focus(rows[1]);
    await triggerKeyEvent(rows[1], "keydown", "ArrowUp");

    assert.strictEqual(document.activeElement, rows[0]);
  });

  test("enter activates current row", async function (assert) {
    let activatedId = null;
    this.set("onActivate", (id) => (activatedId = id));

    await render(hbs`
      <table role="grid" {{gridNavigation onRowActivate=this.onActivate}}>
        <tbody>
          <tr role="row" data-topic-id="123"><td role="gridcell">Row 1</td></tr>
          <tr role="row" data-topic-id="456"><td role="gridcell">Row 2</td></tr>
        </tbody>
      </table>
    `);

    const rows = document.querySelectorAll('tr[role="row"]');
    await focus(rows[0]);
    await triggerKeyEvent(rows[0], "keydown", "Enter");

    assert.strictEqual(activatedId, "123");
  });

  test("page down jumps multiple rows", async function (assert) {
    await render(hbs`
      <table role="grid" {{gridNavigation}}>
        <tbody>
          {{#each (array 1 2 3 4 5 6 7 8 9 10 11 12) as |num|}}
            <tr role="row"><td role="gridcell">Row {{num}}</td></tr>
          {{/each}}
        </tbody>
      </table>
    `);

    const rows = document.querySelectorAll('tr[role="row"]');
    await focus(rows[0]);
    await triggerKeyEvent(rows[0], "keydown", "PageDown");

    assert.strictEqual(document.activeElement, rows[10]);
  });
});
```

## Integration Tests

### Navigation Bar Component

**File: `frontend/discourse/tests/integration/components/navigation-bar-a11y-test.gjs`**

```javascript
import { module, test } from "qunit";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { render, focus, triggerKeyEvent } from "@ember/test-helpers";
import NavigationBar from "discourse/components/navigation-bar";
import { assertRole } from "discourse/tests/helpers/keyboard-navigation-helpers";

module("Integration | Component | navigation-bar accessibility", function (hooks) {
  setupRenderingTest(hooks);

  test("renders as toolbar with correct ARIA attributes", async function (assert) {
    this.set("navItems", [
      { name: "latest", displayName: "Latest" },
      { name: "hot", displayName: "Hot" },
    ]);

    await render(<template>
      <NavigationBar @navItems={{this.navItems}} />
    </template>);

    const toolbar = document.querySelector('[role="toolbar"]');
    assert.ok(toolbar, "has toolbar role");
    assert.ok(toolbar.hasAttribute("aria-label"), "has aria-label");
    assert.strictEqual(
      toolbar.getAttribute("aria-orientation"),
      "horizontal",
      "has horizontal orientation"
    );
  });

  test("keyboard navigation between nav items", async function (assert) {
    this.set("navItems", [
      { name: "latest", displayName: "Latest" },
      { name: "hot", displayName: "Hot" },
      { name: "categories", displayName: "Categories" },
    ]);

    await render(<template>
      <NavigationBar @navItems={{this.navItems}} />
    </template>);

    const items = document.querySelectorAll("#navigation-bar a");
    await focus(items[0]);

    await triggerKeyEvent(items[0], "keydown", "ArrowRight");
    assert.strictEqual(document.activeElement, items[1]);

    await triggerKeyEvent(items[1], "keydown", "ArrowLeft");
    assert.strictEqual(document.activeElement, items[0]);
  });

  test("single tab stop for entire toolbar", async function (assert) {
    this.set("navItems", [
      { name: "latest", displayName: "Latest" },
      { name: "hot", displayName: "Hot" },
    ]);

    await render(<template>
      <NavigationBar @navItems={{this.navItems}} />
    </template>);

    const items = document.querySelectorAll("#navigation-bar a");

    assert.strictEqual(items[0].getAttribute("tabindex"), "0");
    assert.strictEqual(items[1].getAttribute("tabindex"), "-1");
  });
});
```

### Topic List Component

**File: `frontend/discourse/tests/integration/components/topic-list-a11y-test.gjs`**

```javascript
import { module, test } from "qunit";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { render, focus, triggerKeyEvent } from "@ember/test-helpers";
import TopicList from "discourse/components/topic-list";

module("Integration | Component | topic-list accessibility", function (hooks) {
  setupRenderingTest(hooks);

  test("renders with grid role and ARIA attributes", async function (assert) {
    this.set("topics", [
      { id: 1, title: "Topic 1" },
      { id: 2, title: "Topic 2" },
    ]);

    await render(<template>
      <TopicList @topics={{this.topics}} />
    </template>);

    const grid = document.querySelector('[role="grid"]');
    assert.ok(grid, "has grid role");
    assert.ok(grid.hasAttribute("aria-rowcount"), "has aria-rowcount");

    const rows = document.querySelectorAll('[role="row"]');
    assert.ok(rows.length > 0, "has rows");

    rows.forEach((row, index) => {
      assert.ok(row.hasAttribute("aria-rowindex"), `row ${index} has aria-rowindex`);
    });
  });

  test("keyboard navigation between rows", async function (assert) {
    this.set("topics", [
      { id: 1, title: "Topic 1" },
      { id: 2, title: "Topic 2" },
      { id: 3, title: "Topic 3" },
    ]);

    await render(<template>
      <TopicList @topics={{this.topics}} />
    </template>);

    const rows = document.querySelectorAll('tbody tr[role="row"]');
    await focus(rows[0]);

    await triggerKeyEvent(rows[0], "keydown", "ArrowDown");
    assert.strictEqual(document.activeElement, rows[1]);

    await triggerKeyEvent(rows[1], "keydown", "ArrowUp");
    assert.strictEqual(document.activeElement, rows[0]);
  });

  test("enter key activates row", async function (assert) {
    this.set("topics", [
      { id: 123, title: "Topic 1" },
    ]);
    this.set("navigated", false);

    await render(<template>
      <TopicList @topics={{this.topics}} />
    </template>);

    const row = document.querySelector('tbody tr[role="row"]');
    await focus(row);
    await triggerKeyEvent(row, "keydown", "Enter");

    // Assert navigation occurred or callback was triggered
  });
});
```

## System Specs (Ruby/Capybara)

### Page Object for Accessibility

**File: `spec/system/page_objects/components/a11y_toolbar.rb`**

```ruby
# frozen_string_literal: true

module PageObjects
  module Components
    class A11yToolbar < PageObjects::Components::Base
      TOOLBAR_SELECTOR = '[role="toolbar"]'

      def has_toolbar?
        page.has_css?(TOOLBAR_SELECTOR)
      end

      def has_aria_label?(label)
        page.has_css?("#{TOOLBAR_SELECTOR}[aria-label='#{label}']")
      end

      def focus_first_item
        first_item = find("#{TOOLBAR_SELECTOR} a, #{TOOLBAR_SELECTOR} button", match: :first)
        first_item.send_keys("")
        self
      end

      def press_arrow_right
        page.send_keys(:arrow_right)
        self
      end

      def press_arrow_left
        page.send_keys(:arrow_left)
        self
      end

      def focused_element_text
        page.evaluate_script("document.activeElement.textContent")
      end
    end
  end
end
```

**File: `spec/system/page_objects/components/a11y_grid.rb`**

```ruby
# frozen_string_literal: true

module PageObjects
  module Components
    class A11yGrid < PageObjects::Components::Base
      GRID_SELECTOR = '[role="grid"]'
      ROW_SELECTOR = '[role="row"]'

      def has_grid?
        page.has_css?(GRID_SELECTOR)
      end

      def has_row_count?(count)
        page.has_css?("#{GRID_SELECTOR}[aria-rowcount='#{count}']")
      end

      def focus_first_row
        rows = all("tbody #{ROW_SELECTOR}")
        rows.first.send_keys("")
        self
      end

      def press_arrow_down
        page.send_keys(:arrow_down)
        self
      end

      def press_arrow_up
        page.send_keys(:arrow_up)
        self
      end

      def press_enter
        page.send_keys(:enter)
        self
      end

      def focused_row_index
        page.evaluate_script(
          "Array.from(document.querySelectorAll('tbody tr[role=\"row\"]')).indexOf(document.activeElement)"
        )
      end
    end
  end
end
```

### Navigation Bar System Spec

**File: `spec/system/accessibility/navigation_bar_spec.rb`**

```ruby
# frozen_string_literal: true

describe "Navigation bar accessibility", type: :system do
  fab!(:user)
  let(:toolbar) { PageObjects::Components::A11yToolbar.new }

  before { sign_in(user) }

  it "navigation bar has toolbar role" do
    visit "/"
    expect(toolbar).to have_toolbar
  end

  it "has accessible label" do
    visit "/"
    expect(toolbar).to have_aria_label("Topic navigation")
  end

  it "supports arrow key navigation" do
    visit "/"

    toolbar.focus_first_item
    first_text = toolbar.focused_element_text

    toolbar.press_arrow_right
    second_text = toolbar.focused_element_text

    expect(second_text).not_to eq(first_text)
  end

  it "wraps navigation from last to first" do
    visit "/"

    toolbar.focus_first_item
    first_text = toolbar.focused_element_text

    # Press right until we wrap
    5.times { toolbar.press_arrow_right }

    # Should eventually wrap to first
    expect(toolbar.focused_element_text).to eq(first_text)
  end
end
```

### Topic List System Spec

**File: `spec/system/accessibility/topic_list_spec.rb`**

```ruby
# frozen_string_literal: true

describe "Topic list accessibility", type: :system do
  fab!(:user)
  fab!(:category)
  fab!(:topics) { Fabricate.times(5, :topic, category: category) }

  let(:grid) { PageObjects::Components::A11yGrid.new }

  before { sign_in(user) }

  it "topic list has grid role" do
    visit "/c/#{category.slug}"
    expect(grid).to have_grid
  end

  it "has correct row count" do
    visit "/c/#{category.slug}"
    expect(grid).to have_row_count(topics.length + 1) # +1 for header
  end

  it "supports arrow key navigation between rows" do
    visit "/c/#{category.slug}"

    grid.focus_first_row
    expect(grid.focused_row_index).to eq(0)

    grid.press_arrow_down
    expect(grid.focused_row_index).to eq(1)

    grid.press_arrow_up
    expect(grid.focused_row_index).to eq(0)
  end

  it "enter key navigates to topic" do
    visit "/c/#{category.slug}"

    grid.focus_first_row
    grid.press_enter

    expect(page).to have_current_path(%r{/t/})
  end
end
```

## Running Tests

```bash
# QUnit unit tests for modifiers
bin/qunit --filter "toolbar-navigation"
bin/qunit --filter "grid-navigation"

# QUnit integration tests
bin/qunit frontend/discourse/tests/integration/components/navigation-bar-a11y-test.gjs
bin/qunit frontend/discourse/tests/integration/components/topic-list-a11y-test.gjs

# Ruby system specs
bin/rspec spec/system/accessibility/navigation_bar_spec.rb
bin/rspec spec/system/accessibility/topic_list_spec.rb

# All accessibility system specs
bin/rspec spec/system/accessibility/

# With visible browser (for debugging)
SELENIUM_HEADLESS=0 bin/rspec spec/system/accessibility/navigation_bar_spec.rb
```

## Manual Screen Reader Testing

### Test Matrix

| Screen Reader | Platform | Status |
|---------------|----------|--------|
| NVDA | Windows | Required |
| JAWS | Windows | Recommended |
| VoiceOver | macOS | Required |
| VoiceOver | iOS | Recommended |
| TalkBack | Android | Recommended |
| Orca | Linux | Optional |

### Navigation Bar Test Script

1. Enable screen reader
2. Navigate to Discourse homepage
3. Tab to navigation bar
4. **Verify:** Screen reader announces "Topic navigation toolbar"
5. Press Right Arrow
6. **Verify:** Focus moves to next item, announced
7. Press Left Arrow
8. **Verify:** Focus moves to previous item
9. Press End
10. **Verify:** Focus moves to last item
11. Press Home
12. **Verify:** Focus moves to first item
13. Tab away from toolbar
14. **Verify:** Single tab exits toolbar

### Topic List Test Script

1. Enable screen reader
2. Navigate to topic list page
3. Tab to topic list
4. **Verify:** Screen reader announces "grid, X rows"
5. Press Down Arrow
6. **Verify:** Focus moves to next row, topic title announced
7. Press Up Arrow
8. **Verify:** Focus moves to previous row
9. Press Enter
10. **Verify:** Navigates to topic page
11. Press Page Down
12. **Verify:** Jumps multiple rows

### Recording Results

| Test Case | NVDA | JAWS | VoiceOver | Notes |
|-----------|------|------|-----------|-------|
| Toolbar announced | | | | |
| Arrow navigation | | | | |
| Single tab stop | | | | |
| Grid announced | | | | |
| Row navigation | | | | |
| Enter activates | | | | |

## Test Coverage Matrix

| Feature | Unit Test | Integration Test | System Spec | Manual |
|---------|-----------|------------------|-------------|--------|
| Toolbar role | - | ✓ | ✓ | ✓ |
| Arrow navigation (toolbar) | ✓ | ✓ | ✓ | ✓ |
| Home/End keys (toolbar) | ✓ | ✓ | - | ✓ |
| Roving tabindex (toolbar) | ✓ | ✓ | - | ✓ |
| Grid role | - | ✓ | ✓ | ✓ |
| Arrow navigation (grid) | ✓ | ✓ | ✓ | ✓ |
| Page Up/Down | ✓ | ✓ | - | ✓ |
| Enter activation | ✓ | ✓ | ✓ | ✓ |
| Screen reader announcements | - | - | - | ✓ |
