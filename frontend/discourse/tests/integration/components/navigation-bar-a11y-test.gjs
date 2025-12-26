import EmberObject from "@ember/object";
import { getOwner } from "@ember/owner";
import { focus, render, triggerKeyEvent } from "@ember/test-helpers";
import { module, test } from "qunit";
import sinon from "sinon";
import NavigationBar from "discourse/components/navigation-bar";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";

/**
 * Creates mock nav items for testing navigation bar
 * @returns {EmberObject[]} Array of mock nav items
 */
function createNavItems() {
  return [
    EmberObject.create({
      name: "latest",
      displayName: "Latest",
      href: "/latest",
      filterType: "latest",
    }),
    EmberObject.create({
      name: "hot",
      displayName: "Hot",
      href: "/hot",
      filterType: "hot",
    }),
    EmberObject.create({
      name: "new",
      displayName: "New",
      href: "/new",
      filterType: "new",
    }),
    EmberObject.create({
      name: "unread",
      displayName: "Unread",
      href: "/unread",
      filterType: "unread",
    }),
  ];
}

module(
  "Integration | Component | navigation-bar accessibility",
  function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(function () {
      this.navItems = createNavItems();

      const site = getOwner(this).lookup("service:site");
      sinon.stub(site, "mobileView").value(false);
    });

    hooks.afterEach(function () {
      sinon.restore();
    });

    test("renders as toolbar with correct ARIA attributes", async function (assert) {
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

    test("toolbar has descriptive aria-label for screen readers", async function (assert) {
      await render(<template>
        <NavigationBar @navItems={{this.navItems}} />
      </template>);

      const toolbar = document.querySelector('[role="toolbar"]');
      const ariaLabel = toolbar.getAttribute("aria-label");
      assert.ok(
        ariaLabel && ariaLabel.length > 0,
        "toolbar has non-empty aria-label"
      );
    });

    test("single tab stop for entire toolbar - first item has tabindex 0, others have -1", async function (assert) {
      await render(<template>
        <NavigationBar @navItems={{this.navItems}} />
      </template>);

      const items = document.querySelectorAll("#navigation-bar a");
      assert.ok(items.length >= 2, "has multiple navigation items");

      assert.strictEqual(
        items[0].getAttribute("tabindex"),
        "0",
        "first item has tabindex 0"
      );

      for (let i = 1; i < items.length; i++) {
        assert.strictEqual(
          items[i].getAttribute("tabindex"),
          "-1",
          `item ${i} has tabindex -1`
        );
      }
    });

    test("arrow right moves focus to next item", async function (assert) {
      await render(<template>
        <NavigationBar @navItems={{this.navItems}} />
      </template>);

      const items = document.querySelectorAll("#navigation-bar a");
      await focus(items[0]);

      await triggerKeyEvent(items[0], "keydown", "ArrowRight");

      assert.strictEqual(
        document.activeElement,
        items[1],
        "focus moved to second item after ArrowRight"
      );
      assert.strictEqual(
        items[1].getAttribute("tabindex"),
        "0",
        "focused item has tabindex 0"
      );
      assert.strictEqual(
        items[0].getAttribute("tabindex"),
        "-1",
        "previous item has tabindex -1"
      );
    });

    test("arrow left moves focus to previous item", async function (assert) {
      await render(<template>
        <NavigationBar @navItems={{this.navItems}} />
      </template>);

      const items = document.querySelectorAll("#navigation-bar a");
      await focus(items[0]);
      await triggerKeyEvent(items[0], "keydown", "ArrowRight");
      await triggerKeyEvent(items[1], "keydown", "ArrowLeft");

      assert.strictEqual(
        document.activeElement,
        items[0],
        "focus moved back to first item after ArrowLeft"
      );
    });

    test("home key moves focus to first item", async function (assert) {
      await render(<template>
        <NavigationBar @navItems={{this.navItems}} />
      </template>);

      const items = document.querySelectorAll("#navigation-bar a");
      await focus(items[0]);
      await triggerKeyEvent(items[0], "keydown", "ArrowRight");
      await triggerKeyEvent(items[1], "keydown", "ArrowRight");

      await triggerKeyEvent(items[2], "keydown", "Home");

      assert.strictEqual(
        document.activeElement,
        items[0],
        "focus moved to first item after Home key"
      );
    });

    test("end key moves focus to last item", async function (assert) {
      await render(<template>
        <NavigationBar @navItems={{this.navItems}} />
      </template>);

      const items = document.querySelectorAll("#navigation-bar a");
      await focus(items[0]);

      await triggerKeyEvent(items[0], "keydown", "End");

      assert.strictEqual(
        document.activeElement,
        items[items.length - 1],
        "focus moved to last item after End key"
      );
    });

    test("arrow navigation wraps from last to first item", async function (assert) {
      await render(<template>
        <NavigationBar @navItems={{this.navItems}} />
      </template>);

      const items = document.querySelectorAll("#navigation-bar a");
      const lastItem = items[items.length - 1];
      await focus(items[0]);
      await triggerKeyEvent(items[0], "keydown", "End");

      await triggerKeyEvent(lastItem, "keydown", "ArrowRight");

      assert.strictEqual(
        document.activeElement,
        items[0],
        "focus wrapped to first item after ArrowRight on last item"
      );
    });

    test("arrow navigation wraps from first to last item", async function (assert) {
      await render(<template>
        <NavigationBar @navItems={{this.navItems}} />
      </template>);

      const items = document.querySelectorAll("#navigation-bar a");
      await focus(items[0]);

      await triggerKeyEvent(items[0], "keydown", "ArrowLeft");

      assert.strictEqual(
        document.activeElement,
        items[items.length - 1],
        "focus wrapped to last item after ArrowLeft on first item"
      );
    });

    test("roving tabindex updates correctly during navigation", async function (assert) {
      await render(<template>
        <NavigationBar @navItems={{this.navItems}} />
      </template>);

      const items = document.querySelectorAll("#navigation-bar a");
      await focus(items[0]);

      await triggerKeyEvent(items[0], "keydown", "ArrowRight");
      await triggerKeyEvent(items[1], "keydown", "ArrowRight");

      assert.strictEqual(
        items[0].getAttribute("tabindex"),
        "-1",
        "first item has tabindex -1"
      );
      assert.strictEqual(
        items[1].getAttribute("tabindex"),
        "-1",
        "second item has tabindex -1"
      );
      assert.strictEqual(
        items[2].getAttribute("tabindex"),
        "0",
        "third item (focused) has tabindex 0"
      );
    });

    test("toolbar does not render in mobile view", async function (assert) {
      const site = getOwner(this).lookup("service:site");
      sinon.restore();
      sinon.stub(site, "mobileView").value(true);

      await render(<template>
        <NavigationBar @navItems={{this.navItems}} />
      </template>);

      assert
        .dom('[role="toolbar"]')
        .doesNotExist("toolbar role is not present in mobile view");
    });
  }
);
