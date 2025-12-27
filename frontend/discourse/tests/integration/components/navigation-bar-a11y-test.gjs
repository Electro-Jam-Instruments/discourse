import EmberObject from "@ember/object";
import { getOwner } from "@ember/owner";
import { render } from "@ember/test-helpers";
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

    test("renders navigation items as list", async function (assert) {
      await render(<template>
        <NavigationBar @navItems={{this.navItems}} />
      </template>);

      const list = document.querySelector("#navigation-bar");
      assert.ok(list, "navigation bar renders");
      assert.strictEqual(list.tagName, "UL", "renders as unordered list");

      const items = document.querySelectorAll("#navigation-bar a");
      assert.strictEqual(items.length, 4, "renders all nav items");
    });

    test("navigation items have correct display names", async function (assert) {
      await render(<template>
        <NavigationBar @navItems={{this.navItems}} />
      </template>);

      const items = document.querySelectorAll("#navigation-bar a");
      assert.strictEqual(items[0].textContent.trim(), "Latest");
      assert.strictEqual(items[1].textContent.trim(), "Hot");
      assert.strictEqual(items[2].textContent.trim(), "New");
      assert.strictEqual(items[3].textContent.trim(), "Unread");
    });

    test("active item has aria-current page", async function (assert) {
      this.navItems[0].active = true;

      await render(<template>
        <NavigationBar @navItems={{this.navItems}} />
      </template>);

      const items = document.querySelectorAll("#navigation-bar a");
      assert.strictEqual(
        items[0].getAttribute("aria-current"),
        "page",
        "active item has aria-current=page"
      );
    });
  }
);
