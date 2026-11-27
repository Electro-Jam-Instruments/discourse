import { focus, render, triggerKeyEvent } from "@ember/test-helpers";
import { module, test } from "qunit";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import DDropdownMenu from "discourse/ui-kit/d-dropdown-menu";

module("Integration | ui-kit | DDropdownMenu", function (hooks) {
  setupRenderingTest(hooks);

  test("dropdown menu", async function (assert) {
    await render(<template><DDropdownMenu class="test" /></template>);

    assert
      .dom("ul.dropdown-menu.test")
      .exists("it renders the dropdown menu with custom class");
  });

  test("dropdown menu item", async function (assert) {
    await render(
      <template>
        <DDropdownMenu as |dm|><dm.item
            class="test"
          >test</dm.item></DDropdownMenu>
      </template>
    );

    assert
      .dom("li.dropdown-menu__item.test")
      .exists("it renders the item with custom class")
      .hasText("test");
  });

  test("dropdown menu divider", async function (assert) {
    await render(
      <template>
        <DDropdownMenu as |dm|><dm.divider class="test" /></DDropdownMenu>
      </template>
    );

    assert
      .dom("li.test hr.dropdown-menu__divider")
      .exists("it renders the divider with custom class");
  });

  module("keyboard navigation", function () {
    const menu = <template>
      <DDropdownMenu as |dm|>
        <dm.item><button class="first" type="button">First</button></dm.item>
        <dm.item><button class="second" type="button">Second</button></dm.item>
        <dm.item class="unavailable"><button
            disabled
            type="button"
          >Unavailable</button></dm.item>
        <dm.item><a class="last" href="/last">Last</a></dm.item>
      </DDropdownMenu>
    </template>;

    test("the down arrow moves to the next entry, including a disabled one", async function (assert) {
      await render(menu);
      await focus(".first");

      await triggerKeyEvent(".first", "keydown", "ArrowDown");
      assert.dom(".second").isFocused();

      await triggerKeyEvent(".second", "keydown", "ArrowDown");
      assert
        .dom(".unavailable")
        .isFocused("the disabled entry takes focus, since its button cannot")
        .hasAttribute("aria-disabled", "true");

      await triggerKeyEvent(".unavailable", "keydown", "ArrowDown");
      assert.dom(".last").isFocused();
    });

    test("the up arrow moves to the previous entry, including a disabled one", async function (assert) {
      await render(menu);
      await focus(".last");

      await triggerKeyEvent(".last", "keydown", "ArrowUp");
      assert.dom(".unavailable").isFocused();

      await triggerKeyEvent(".unavailable", "keydown", "ArrowUp");
      assert.dom(".second").isFocused();
    });

    test("focus stops at the first and last entry", async function (assert) {
      await render(menu);

      await focus(".last");
      await triggerKeyEvent(".last", "keydown", "ArrowDown");
      assert.dom(".last").isFocused("the down arrow does not wrap");

      await focus(".first");
      await triggerKeyEvent(".first", "keydown", "ArrowUp");
      assert.dom(".first").isFocused("the up arrow does not wrap");
    });

    test("Home and End move to the first and last entry", async function (assert) {
      await render(menu);
      await focus(".second");

      await triggerKeyEvent(".second", "keydown", "End");
      assert.dom(".last").isFocused();

      await triggerKeyEvent(".last", "keydown", "Home");
      assert.dom(".first").isFocused();
    });

    test("a key with a modifier is left alone", async function (assert) {
      await render(menu);
      await focus(".first");

      await triggerKeyEvent(".first", "keydown", "ArrowDown", {
        shiftKey: true,
      });
      assert.dom(".first").isFocused();
    });

    test("a text field keeps the arrow keys", async function (assert) {
      await render(
        <template>
          <DDropdownMenu as |dm|>
            <dm.item><button
                class="first"
                type="button"
              >First</button></dm.item>
            <dm.item><input class="field" type="text" /></dm.item>
            <dm.item><button class="last" type="button">Last</button></dm.item>
          </DDropdownMenu>
        </template>
      );
      await focus(".field");

      await triggerKeyEvent(".field", "keydown", "ArrowDown");
      assert.dom(".field").isFocused();
    });
  });
});
