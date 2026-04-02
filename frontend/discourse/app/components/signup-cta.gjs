/* eslint-disable ember/no-classic-components */
import Component from "@ember/component";
import { action } from "@ember/object";
import { trustHTML } from "@ember/template";
import { tagName } from "@ember-decorators/component";
import { on } from "@ember-decorators/object";
import DButton from "discourse/components/d-button";
import replaceEmoji from "discourse/helpers/replace-emoji";
import routeAction from "discourse/helpers/route-action";
import discourseLater from "discourse/lib/later";
import { i18n } from "discourse-i18n";

@tagName("")
export default class SignupCta extends Component {
  @action
  hideForSession() {
    this.session.set("hideSignupCta", true);
    this.keyValueStore.setItem("anon-cta-hidden", Date.now());
    discourseLater(() => this.session.set("showSignupCta", false), 20 * 1000);
  }

  @action
  hideForever() {
    this.session.set("showSignupCta", false);
    this.keyValueStore.setItem("anon-cta-never", "t");
  }

  @on("willDestroyElement")
  _turnOffIfHidden() {
    if (this.session.get("hideSignupCta")) {
      this.session.set("showSignupCta", false);
    }
  }

  <template>
    <div
      class="signup-cta alert alert-info"
      role="region"
      aria-labelledby="signup-cta-heading"
      tabindex="0"
      ...attributes
    >
      {{#if this.session.hideSignupCta}}
        <h3 id="signup-cta-heading">{{i18n "signup_cta.hidden_for_session"}}</h3>
      {{else}}
        <h3 id="signup-cta-heading">{{replaceEmoji (trustHTML (i18n "signup_cta.intro"))}}</h3>
        <p>{{replaceEmoji (trustHTML (i18n "signup_cta.value_prop"))}}</p>

        <div class="buttons">
          <DButton
            @action={{routeAction "showCreateAccount"}}
            @label="signup_cta.sign_up"
            @icon="user"
            class="btn-primary"
          />
          <DButton
            @action={{this.hideForSession}}
            @label="signup_cta.hide_session"
            class="btn-default no-icon"
          />
          <DButton
            @action={{this.hideForever}}
            @label="signup_cta.hide_forever"
            class="no-icon btn-flat"
          />
        </div>
      {{/if}}
    </div>
  </template>
}
