import DButton from "discourse/ui-kit/d-button";

const SidebarSectionHeader = <template>
  {{#if @collapsable}}
    <DButton
      role="treeitem"
      aria-controls={{@sidebarSectionContentId}}
      aria-expanded={{if @isExpanded "true" "false"}}
      aria-selected="false"
      class="sidebar-section-header sidebar-section-header-collapsable btn-transparent"
      @action={{@toggleSectionDisplay}}
      @forwardEvent={{true}}
      @title="sidebar.toggle_section"
    >
      {{yield}}
    </DButton>
  {{else}}
    <span class="sidebar-section-header" role="treeitem" aria-selected="false">
      {{yield}}
    </span>
  {{/if}}
</template>;

export default SidebarSectionHeader;
