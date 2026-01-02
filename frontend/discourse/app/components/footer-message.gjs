/* eslint-disable ember/no-classic-components */
import Component from "@ember/component";
import { classNames } from "@ember-decorators/component";
import { or } from "discourse/truth-helpers";

@classNames("footer-message")
export default class FooterMessage extends Component {
  <template>
    {{#if (or this.message (has-block "messageDetails"))}}
      <h3>
        {{#if this.message}}
          {{this.message}}
        {{/if}}
        {{yield to="messageDetails"}}
      </h3>
    {{/if}}

    {{yield to="afterMessage"}}
  </template>
}
