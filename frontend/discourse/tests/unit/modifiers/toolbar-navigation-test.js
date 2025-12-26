import { module, test } from "qunit";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import { render, focus, triggerKeyEvent } from "@ember/test-helpers";
import { hbs } from "ember-cli-htmlbars";

module("Unit | Modifier | toolbar-navigation", function (hooks) {
  setupRenderingTest(hooks);

  function assertRovingTabindex(assert, items, activeIndex, message) {
    items.forEach((item, index) => {
      const expected = index === activeIndex ? "0" : "-1";
      const actual = item.getAttribute("tabindex");
      assert.strictEqual(
        actual,
        expected,
        `${message}: item ${index} should have tabindex="${expected}"`
      );
    });
  }

  test("initializes with first item focusable", async function (assert) {
    await render(hbs`
      <ul role="toolbar" {{toolbar-navigation}}>
        <li><a href="#1">Item 1</a></li>
        <li><a href="#2">Item 2</a></li>
        <li><a href="#3">Item 3</a></li>
      </ul>
    `);

    const items = document.querySelectorAll("a");
    assert.strictEqual(
      items[0].getAttribute("tabindex"),
      "0",
      "first item has tabindex 0"
    );
    assert.strictEqual(
      items[1].getAttribute("tabindex"),
      "-1",
      "second item has tabindex -1"
    );
    assert.strictEqual(
      items[2].getAttribute("tabindex"),
      "-1",
      "third item has tabindex -1"
    );
  });

  test("arrow right moves to next item", async function (assert) {
    await render(hbs`
      <ul role="toolbar" {{toolbar-navigation}}>
        <li><a href="#1">Item 1</a></li>
        <li><a href="#2">Item 2</a></li>
        <li><a href="#3">Item 3</a></li>
      </ul>
    `);

    const items = document.querySelectorAll("a");
    await focus(items[0]);
    await triggerKeyEvent(items[0], "keydown", "ArrowRight");

    assert.strictEqual(
      document.activeElement,
      items[1],
      "focus moved to second item"
    );
    assertRovingTabindex(assert, items, 1, "After ArrowRight");
  });

  test("arrow left moves to previous item", async function (assert) {
    await render(hbs`
      <ul role="toolbar" {{toolbar-navigation}}>
        <li><a href="#1">Item 1</a></li>
        <li><a href="#2">Item 2</a></li>
        <li><a href="#3">Item 3</a></li>
      </ul>
    `);

    const items = document.querySelectorAll("a");
    await focus(items[1]);
    await triggerKeyEvent(items[1], "keydown", "ArrowLeft");

    assert.strictEqual(
      document.activeElement,
      items[0],
      "focus moved to first item"
    );
    assertRovingTabindex(assert, items, 0, "After ArrowLeft");
  });

  test("home key focuses first item", async function (assert) {
    await render(hbs`
      <ul role="toolbar" {{toolbar-navigation}}>
        <li><a href="#1">Item 1</a></li>
        <li><a href="#2">Item 2</a></li>
        <li><a href="#3">Item 3</a></li>
      </ul>
    `);

    const items = document.querySelectorAll("a");
    await focus(items[2]);
    await triggerKeyEvent(items[2], "keydown", "Home");

    assert.strictEqual(
      document.activeElement,
      items[0],
      "focus moved to first item"
    );
    assertRovingTabindex(assert, items, 0, "After Home key");
  });

  test("end key focuses last item", async function (assert) {
    await render(hbs`
      <ul role="toolbar" {{toolbar-navigation}}>
        <li><a href="#1">Item 1</a></li>
        <li><a href="#2">Item 2</a></li>
        <li><a href="#3">Item 3</a></li>
      </ul>
    `);

    const items = document.querySelectorAll("a");
    await focus(items[0]);
    await triggerKeyEvent(items[0], "keydown", "End");

    assert.strictEqual(
      document.activeElement,
      items[2],
      "focus moved to last item"
    );
    assertRovingTabindex(assert, items, 2, "After End key");
  });

  test("wraps from last to first with arrow right (wrap enabled by default)", async function (assert) {
    await render(hbs`
      <ul role="toolbar" {{toolbar-navigation}}>
        <li><a href="#1">Item 1</a></li>
        <li><a href="#2">Item 2</a></li>
        <li><a href="#3">Item 3</a></li>
      </ul>
    `);

    const items = document.querySelectorAll("a");
    await focus(items[2]);
    await triggerKeyEvent(items[2], "keydown", "ArrowRight");

    assert.strictEqual(
      document.activeElement,
      items[0],
      "focus wrapped to first item"
    );
    assertRovingTabindex(assert, items, 0, "After wrap ArrowRight");
  });

  test("wraps from first to last with arrow left (wrap enabled by default)", async function (assert) {
    await render(hbs`
      <ul role="toolbar" {{toolbar-navigation}}>
        <li><a href="#1">Item 1</a></li>
        <li><a href="#2">Item 2</a></li>
        <li><a href="#3">Item 3</a></li>
      </ul>
    `);

    const items = document.querySelectorAll("a");
    await focus(items[0]);
    await triggerKeyEvent(items[0], "keydown", "ArrowLeft");

    assert.strictEqual(
      document.activeElement,
      items[2],
      "focus wrapped to last item"
    );
    assertRovingTabindex(assert, items, 2, "After wrap ArrowLeft");
  });

  test("does not wrap when wrap option is false", async function (assert) {
    await render(hbs`
      <ul role="toolbar" {{toolbar-navigation wrap=false}}>
        <li><a href="#1">Item 1</a></li>
        <li><a href="#2">Item 2</a></li>
        <li><a href="#3">Item 3</a></li>
      </ul>
    `);

    const items = document.querySelectorAll("a");
    await focus(items[2]);
    await triggerKeyEvent(items[2], "keydown", "ArrowRight");

    assert.strictEqual(
      document.activeElement,
      items[2],
      "focus stays on last item when wrap is disabled"
    );

    await focus(items[0]);
    await triggerKeyEvent(items[0], "keydown", "ArrowLeft");

    assert.strictEqual(
      document.activeElement,
      items[0],
      "focus stays on first item when wrap is disabled"
    );
  });

  test("updates tabindex when focus changes via focusin", async function (assert) {
    await render(hbs`
      <ul role="toolbar" {{toolbar-navigation}}>
        <li><a href="#1">Item 1</a></li>
        <li><a href="#2">Item 2</a></li>
        <li><a href="#3">Item 3</a></li>
      </ul>
    `);

    const items = document.querySelectorAll("a");

    await focus(items[2]);

    assertRovingTabindex(assert, items, 2, "After direct focus on third item");
  });

  test("works with button elements", async function (assert) {
    await render(hbs`
      <div role="toolbar" {{toolbar-navigation}}>
        <button type="button">Button 1</button>
        <button type="button">Button 2</button>
        <button type="button">Button 3</button>
      </div>
    `);

    const items = document.querySelectorAll("button");
    await focus(items[0]);
    await triggerKeyEvent(items[0], "keydown", "ArrowRight");

    assert.strictEqual(
      document.activeElement,
      items[1],
      "focus moved to second button"
    );
  });

  test("skips disabled items", async function (assert) {
    await render(hbs`
      <div role="toolbar" {{toolbar-navigation}}>
        <button type="button">Button 1</button>
        <button type="button" disabled>Button 2</button>
        <button type="button">Button 3</button>
      </div>
    `);

    const allButtons = document.querySelectorAll("button");
    const enabledButtons = document.querySelectorAll("button:not([disabled])");

    await focus(enabledButtons[0]);
    await triggerKeyEvent(enabledButtons[0], "keydown", "ArrowRight");

    assert.strictEqual(
      document.activeElement,
      allButtons[2],
      "focus skipped disabled button and moved to third button"
    );
  });

  test("works with custom itemSelector", async function (assert) {
    await render(hbs`
      <div role="toolbar" {{toolbar-navigation itemSelector="[data-toolbar-item]"}}>
        <span data-toolbar-item tabindex="-1">Item 1</span>
        <span>Not an item</span>
        <span data-toolbar-item tabindex="-1">Item 2</span>
        <span data-toolbar-item tabindex="-1">Item 3</span>
      </div>
    `);

    const items = document.querySelectorAll("[data-toolbar-item]");

    assert.strictEqual(
      items[0].getAttribute("tabindex"),
      "0",
      "first matching item has tabindex 0"
    );
    assert.strictEqual(
      items[1].getAttribute("tabindex"),
      "-1",
      "second matching item has tabindex -1"
    );

    await focus(items[0]);
    await triggerKeyEvent(items[0], "keydown", "ArrowRight");

    assert.strictEqual(
      document.activeElement,
      items[1],
      "focus moved to second matching item"
    );
  });

  test("supports vertical navigation with horizontal=false", async function (assert) {
    await render(hbs`
      <div role="toolbar" aria-orientation="vertical" {{toolbar-navigation horizontal=false}}>
        <button type="button">Button 1</button>
        <button type="button">Button 2</button>
        <button type="button">Button 3</button>
      </div>
    `);

    const items = document.querySelectorAll("button");
    await focus(items[0]);

    await triggerKeyEvent(items[0], "keydown", "ArrowDown");
    assert.strictEqual(
      document.activeElement,
      items[1],
      "ArrowDown moves to next item in vertical mode"
    );

    await triggerKeyEvent(items[1], "keydown", "ArrowUp");
    assert.strictEqual(
      document.activeElement,
      items[0],
      "ArrowUp moves to previous item in vertical mode"
    );

    await triggerKeyEvent(items[0], "keydown", "ArrowRight");
    assert.strictEqual(
      document.activeElement,
      items[0],
      "ArrowRight does not move focus in vertical mode"
    );
  });

  test("prevents default and stops propagation on handled keys", async function (assert) {
    let propagated = false;

    await render(hbs`
      <div {{on "keydown" this.outerHandler}}>
        <ul role="toolbar" {{toolbar-navigation}}>
          <li><a href="#1">Item 1</a></li>
          <li><a href="#2">Item 2</a></li>
        </ul>
      </div>
    `);

    this.set("outerHandler", (event) => {
      if (event.key === "ArrowRight") {
        propagated = true;
      }
    });

    const items = document.querySelectorAll("a");
    await focus(items[0]);
    await triggerKeyEvent(items[0], "keydown", "ArrowRight");

    assert.false(propagated, "ArrowRight event did not propagate");
  });

  test("allows unhandled keys to propagate", async function (assert) {
    let propagated = false;

    await render(hbs`
      <div {{on "keydown" this.outerHandler}}>
        <ul role="toolbar" {{toolbar-navigation}}>
          <li><a href="#1">Item 1</a></li>
          <li><a href="#2">Item 2</a></li>
        </ul>
      </div>
    `);

    this.set("outerHandler", (event) => {
      if (event.key === "Enter") {
        propagated = true;
      }
    });

    const items = document.querySelectorAll("a");
    await focus(items[0]);
    await triggerKeyEvent(items[0], "keydown", "Enter");

    assert.true(propagated, "Enter key event propagated");
  });

  test("sequential navigation through all items", async function (assert) {
    await render(hbs`
      <ul role="toolbar" {{toolbar-navigation}}>
        <li><a href="#1">Item 1</a></li>
        <li><a href="#2">Item 2</a></li>
        <li><a href="#3">Item 3</a></li>
        <li><a href="#4">Item 4</a></li>
      </ul>
    `);

    const items = document.querySelectorAll("a");
    await focus(items[0]);

    await triggerKeyEvent(items[0], "keydown", "ArrowRight");
    assert.strictEqual(document.activeElement, items[1], "moved to item 2");

    await triggerKeyEvent(items[1], "keydown", "ArrowRight");
    assert.strictEqual(document.activeElement, items[2], "moved to item 3");

    await triggerKeyEvent(items[2], "keydown", "ArrowRight");
    assert.strictEqual(document.activeElement, items[3], "moved to item 4");

    await triggerKeyEvent(items[3], "keydown", "ArrowRight");
    assert.strictEqual(
      document.activeElement,
      items[0],
      "wrapped back to item 1"
    );
  });
});
