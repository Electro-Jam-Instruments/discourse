import Component from "@glimmer/component";
import { service } from "@ember/service";
import sidebarTreeNavigation from "discourse/modifiers/sidebar-tree-navigation";
import { i18n } from "discourse-i18n";
import ApiSections from "./api-sections";

export default class SidebarApiPanels extends Component {
  @service sidebarState;

  get panelCssClass() {
    return `${this.sidebarState.currentPanel.key}-panel`;
  }

  <template>
    <nav
      role="tree"
      aria-label={{i18n "sidebar.aria_label"}}
      class="sidebar-sections {{this.panelCssClass}}"
      {{sidebarTreeNavigation}}
    >
      <ApiSections
        @collapsable={{@collapsableSections}}
        @expandActiveSection={{this.sidebarState.currentPanel.expandActiveSection}}
        @scrollActiveLinkIntoView={{this.sidebarState.currentPanel.scrollActiveLinkIntoView}}
      />
    </nav>
  </template>
}
