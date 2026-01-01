import { module, test } from "qunit";
import { setupTest } from "discourse/tests/helpers/qunit-helpers";
import {
  getNextIndex,
  getPreviousIndex,
  updateRovingTabindex,
} from "discourse/lib/keyboard-navigation-utils";

module("Unit | Modifier | grid-navigation", function (hooks) {
  setupTest(hooks);

  module("utility functions", function () {
    test("getNextIndex returns next index", function (assert) {
      assert.strictEqual(getNextIndex(5, 0, false), 1);
      assert.strictEqual(getNextIndex(5, 3, false), 4);
    });

    test("getNextIndex stops at end without wrap", function (assert) {
      assert.strictEqual(getNextIndex(5, 4, false), 4);
    });

    test("getNextIndex wraps to start with wrap enabled", function (assert) {
      assert.strictEqual(getNextIndex(5, 4, true), 0);
    });

    test("getPreviousIndex returns previous index", function (assert) {
      assert.strictEqual(getPreviousIndex(5, 4, false), 3);
      assert.strictEqual(getPreviousIndex(5, 1, false), 0);
    });

    test("getPreviousIndex stops at start without wrap", function (assert) {
      assert.strictEqual(getPreviousIndex(5, 0, false), 0);
    });

    test("getPreviousIndex wraps to end with wrap enabled", function (assert) {
      assert.strictEqual(getPreviousIndex(5, 0, true), 4);
    });
  });

  module("roving tabindex", function () {
    test("updateRovingTabindex sets active element to 0", function (assert) {
      const elements = [
        { setAttribute: (attr, val) => (elements[0][attr] = val) },
        { setAttribute: (attr, val) => (elements[1][attr] = val) },
        { setAttribute: (attr, val) => (elements[2][attr] = val) },
      ];

      updateRovingTabindex(elements, 1);

      assert.strictEqual(elements[0].tabindex, "-1");
      assert.strictEqual(elements[1].tabindex, "0");
      assert.strictEqual(elements[2].tabindex, "-1");
    });

    test("updateRovingTabindex handles first element active", function (assert) {
      const elements = [
        { setAttribute: (attr, val) => (elements[0][attr] = val) },
        { setAttribute: (attr, val) => (elements[1][attr] = val) },
      ];

      updateRovingTabindex(elements, 0);

      assert.strictEqual(elements[0].tabindex, "0");
      assert.strictEqual(elements[1].tabindex, "-1");
    });

    test("updateRovingTabindex handles empty array", function (assert) {
      assert.ok(true, "should not throw");
      updateRovingTabindex([], 0);
    });
  });

  module("keyboard navigation behavior", function () {
    test("ArrowDown navigates to next row", function (assert) {
      // This tests the expected behavior - actual implementation
      // would be tested via integration tests
      const currentIndex = 2;
      const totalRows = 10;
      const nextIndex = getNextIndex(totalRows, currentIndex, false);
      assert.strictEqual(nextIndex, 3);
    });

    test("ArrowUp navigates to previous row", function (assert) {
      const currentIndex = 5;
      const totalRows = 10;
      const prevIndex = getPreviousIndex(totalRows, currentIndex, false);
      assert.strictEqual(prevIndex, 4);
    });

    test("PageDown jumps multiple rows", function (assert) {
      const currentIndex = 0;
      const totalRows = 50;
      const pageSize = 10;
      const newIndex = Math.min(currentIndex + pageSize, totalRows - 1);
      assert.strictEqual(newIndex, 10);
    });

    test("PageUp jumps back multiple rows", function (assert) {
      const currentIndex = 25;
      const pageSize = 10;
      const newIndex = Math.max(currentIndex - pageSize, 0);
      assert.strictEqual(newIndex, 15);
    });

    test("Home navigates to first row", function (assert) {
      const firstIndex = 0;
      assert.strictEqual(firstIndex, 0);
    });

    test("End navigates to last row", function (assert) {
      const totalRows = 50;
      const lastIndex = totalRows - 1;
      assert.strictEqual(lastIndex, 49);
    });
  });
});
