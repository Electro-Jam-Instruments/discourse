import { render } from "@ember/test-helpers";
import { module, test } from "qunit";
import { setupRenderingTest } from "discourse/tests/helpers/component-test";
import DFlashMessage from "discourse/ui-kit/d-flash-message";

module("Integration | ui-kit | DFlashMessage", function (hooks) {
  setupRenderingTest(hooks);

  test("it renders the correct class for a success flash", async function (assert) {
    const flash = "Success message";
    const type = "success";

    await render(
      <template><DFlashMessage @flash={{flash}} @type={{type}} /></template>
    );

    assert.dom(".alert.alert-success").hasText(flash);
    assert.dom(".alert").hasClass("alert-success");
  });

  test("it renders the correct class for an error flash", async function (assert) {
    const flash = "Error message";
    const type = "error";

    await render(
      <template><DFlashMessage @flash={{flash}} @type={{type}} /></template>
    );

    assert.dom(".alert.alert-error").hasText(flash);
    assert.dom(".alert").hasClass("alert-error");
  });

  test("it renders the correct class for a warning flash", async function (assert) {
    const flash = "Warning message";
    const type = "warning";

    await render(
      <template><DFlashMessage @flash={{flash}} @type={{type}} /></template>
    );

    assert.dom(".alert.alert-warning").hasText(flash);
    assert.dom(".alert").hasClass("alert-warning");
  });

  test("it renders the correct class for an info flash", async function (assert) {
    const flash = "Info message";
    const type = "info";

    await render(
      <template><DFlashMessage @flash={{flash}} @type={{type}} /></template>
    );

    assert.dom(".alert.alert-info").hasText(flash);
    assert.dom(".alert").hasClass("alert-info");
  });

  test("an error is announced as an alert", async function (assert) {
    const flash = "Error message";
    const type = "error";

    await render(
      <template><DFlashMessage @flash={{flash}} @type={{type}} /></template>
    );

    assert.dom(".alert").hasAttribute("role", "alert");
  });

  test("success, warning, info and untyped messages are announced as a status", async function (assert) {
    const flash = "A message";
    const types = ["success", "warning", "info", undefined];

    for (const type of types) {
      await render(
        <template><DFlashMessage @flash={{flash}} @type={{type}} /></template>
      );

      assert
        .dom(".alert")
        .hasAttribute("role", "status", `${type ?? "untyped"} is a status`);
    }
  });

  test("@announce overrides how a message is announced", async function (assert) {
    const flash = "A message";

    await render(
      <template>
        <DFlashMessage @announce="alert" @flash={{flash}} @type="warning" />
      </template>
    );
    assert.dom(".alert").hasAttribute("role", "alert");

    await render(
      <template>
        <DFlashMessage @announce={{false}} @flash={{flash}} @type="error" />
      </template>
    );
    assert.dom(".alert").doesNotHaveAttribute("role");
  });

  test("it does not render anything when flash is not provided", async function (assert) {
    await render(<template><DFlashMessage /></template>);

    assert.dom(".alert").doesNotExist();
  });
});
