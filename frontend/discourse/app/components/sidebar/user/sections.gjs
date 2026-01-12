import Component from "@glimmer/component";
import { service } from "@ember/service";
import sidebarTreeNavigation from "discourse/modifiers/sidebar-tree-navigation";
import { i18n } from "discourse-i18n";
import ApiSections from "../api-sections";
import CategoriesSection from "./categories-section";
import CustomSections from "./custom-sections";
import TagsSection from "./tags-section";

export default class SidebarUserSections extends Component {
  @service currentUser;

  <template>
    <nav
      role="tree"
      aria-label={{i18n "sidebar.aria_label"}}
      class="sidebar-sections"
      {{sidebarTreeNavigation}}
    >
      <CustomSections
        @collapsable={{@collapsableSections}}
        @toggleNavigationMenu={{@toggleNavigationMenu}}
      />

      <CategoriesSection @collapsable={{@collapsableSections}} />

      {{#if this.currentUser.display_sidebar_tags}}
        <TagsSection @collapsable={{@collapsableSections}} />
      {{/if}}

      {{#unless @hideApiSections}}
        <ApiSections @collapsable={{@collapsableSections}} />
      {{/unless}}
    </nav>
  </template>
}
