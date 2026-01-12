import Component from "@glimmer/component";
import { service } from "@ember/service";
import sidebarTreeNavigation from "discourse/modifiers/sidebar-tree-navigation";
import { i18n } from "discourse-i18n";
import CategoriesSection from "./categories-section";
import CustomSections from "./custom-sections";
import TagsSection from "./tags-section";

export default class SidebarAnonymousSections extends Component {
  @service siteSettings;

  <template>
    <nav
      role="tree"
      aria-label={{i18n "sidebar.aria_label"}}
      class="sidebar-sections sidebar-sections-anonymous"
      {{sidebarTreeNavigation}}
    >
      <CustomSections
        @collapsable={{@collapsableSections}}
        @toggleNavigationMenu={{@toggleNavigationMenu}}
      />
      <CategoriesSection @collapsable={{@collapsableSections}} />

      {{#if this.siteSettings.tagging_enabled}}
        <TagsSection @collapsable={{@collapsableSections}} />
      {{/if}}
    </nav>
  </template>
}
