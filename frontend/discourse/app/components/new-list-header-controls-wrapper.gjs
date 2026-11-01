import Component from "@glimmer/component";
import { action } from "@ember/object";
import NewListHeaderControls from "discourse/components/topic-list/new-list-header-controls";
import tablistNavigation from "discourse/modifiers/tablist-navigation";
import { i18n } from "discourse-i18n";

export default class NewListHeaderControlsWrapper extends Component {
  @action
  click(e) {
    const target = e.target;
    if (target.closest("button.topics-replies-toggle.--all")) {
      this.args.changeNewListSubset(null);
    } else if (target.closest("button.topics-replies-toggle.--topics")) {
      this.args.changeNewListSubset("topics");
    } else if (target.closest("button.topics-replies-toggle.--replies")) {
      this.args.changeNewListSubset("replies");
    }
  }

  <template>
    <div
      class="topic-replies-toggle-wrapper"
      role="tablist"
      aria-label={{i18n "filters.new.subset_label"}}
      {{tablistNavigation}}
    >
      <NewListHeaderControls
        @changeNewListSubset={{@changeNewListSubset}}
        @current={{@current}}
        @newRepliesCount={{@newRepliesCount}}
        @newTopicsCount={{@newTopicsCount}}
        @noStaticLabel={{true}}
      />
    </div>
  </template>
}
