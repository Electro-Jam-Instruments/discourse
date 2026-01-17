import Component from "@glimmer/component";
import { service } from "@ember/service";
import DButton from "discourse/components/d-button";
import toolbarNavigation from "discourse/modifiers/toolbar-navigation";
import { i18n } from "discourse-i18n";

export default class AuthButtons extends Component {
  @service header;

  get showSignupButton() {
    return (
      this.args.canSignUp &&
      !this.header.headerButtonsHidden.includes("signup") &&
      !this.args.topicInfoVisible
    );
  }

  get showLoginButton() {
    return !this.header.headerButtonsHidden.includes("login");
  }

  get hasAnyButtons() {
    return this.showSignupButton || this.showLoginButton;
  }

  <template>
    {{#if this.hasAnyButtons}}
      <span
        class="auth-buttons"
        role="toolbar"
        aria-label={{i18n "header.auth_toolbar_label"}}
        {{toolbarNavigation}}
      >
        {{#if this.showSignupButton}}
          <DButton
            class="btn-primary btn-small sign-up-button"
            @action={{@showCreateAccount}}
            @label="sign_up"
          />
        {{/if}}

        {{#if this.showLoginButton}}
          <DButton
            class="btn-primary btn-small login-button"
            @action={{@showLogin}}
            @label="log_in"
            @icon="user"
          />
        {{/if}}
      </span>
    {{/if}}
  </template>
}
