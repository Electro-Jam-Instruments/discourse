/* eslint-disable ember/no-classic-components */
import Component from "@ember/component";
import { tagName } from "@ember-decorators/component";
import tablistNavigation from "discourse/modifiers/tablist-navigation";

@tagName("")
export default class AdminNav extends Component {
  <template>
    <div class="admin-controls">
      <nav>
        <ul class="nav nav-pills" role="tablist" {{tablistNavigation}}>
          {{yield}}
        </ul>
      </nav>
    </div>
  </template>
}
