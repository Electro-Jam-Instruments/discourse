import Component from "@glimmer/component";
import { concat } from "@ember/helper";
import { service } from "@ember/service";
import PluginOutlet from "discourse/components/plugin-outlet";
import LatestTopicListItem from "discourse/components/topic-list/latest-topic-list-item";
import getUrl from "discourse/lib/get-url";
import gridNavigation from "discourse/modifiers/grid-navigation";
import { i18n } from "discourse-i18n";

// Exists so plugins can use it
export default class CategoriesTopicList extends Component {
  @service siteSettings;

  /**
   * Total row count for aria-rowcount (topics, or 1 for empty state)
   */
  get topicRowCount() {
    const count = this.args.topics?.length ?? 0;
    return count === 0 ? 1 : count;
  }

  /**
   * Whether to show empty state row
   */
  get showEmptyState() {
    return !this.args.topics || this.args.topics.length === 0;
  }

  /**
   * Empty state message for screen readers
   */
  get emptyMessage() {
    const filter = this.args.filter || "latest";
    return i18n(`topics.none.${filter}`);
  }

  <template>
    <div ...attributes>
      <div
        aria-level="2"
        class="table-heading"
        id="latest-topics-heading"
        role="heading"
      >
        {{i18n (concat "filters." @filter ".title")}}
        <PluginOutlet
          @connectorTagName="div"
          @name="categories-topics-table-heading"
        />
      </div>

      <div
        class="latest-topic-list-container"
        aria-labelledby="latest-topics-heading"
        aria-rowcount={{this.topicRowCount}}
        role="grid"
        {{gridNavigation
          headerRowSelector=null
          dataRowSelector="[role='row']"
        }}
      >
        <div class="latest-topic-list-body" role="rowgroup">
          {{#each @topics as |t index|}}
            <LatestTopicListItem @index={{index}} @topic={{t}} />
          {{/each}}

          {{! Empty state row - navigable row for screen readers when list is empty }}
          {{#if this.showEmptyState}}
            <div
              class="latest-topic-list-empty-row"
              aria-label={{this.emptyMessage}}
              aria-rowindex="1"
              role="row"
              tabindex="0"
            >
              <div class="latest-topic-list-empty-cell" role="gridcell">
                {{this.emptyMessage}}
              </div>
            </div>
          {{/if}}
        </div>
      </div>

      {{#if @topics}}
        <div class="more-topics">
          {{#if
            (eq
              this.siteSettings.desktop_category_page_style
              "categories_and_latest_topics_created_date"
            )
          }}
            <a
              class="btn btn-default pull-right"
              href={{getUrl (concat "/" @filter "?order=created")}}
            >{{i18n "more"}}</a>
          {{else}}
            <a
              class="btn btn-default pull-right"
              href={{getUrl (concat "/" @filter)}}
            >{{i18n "more"}}</a>
          {{/if}}
        </div>
      {{/if}}
    </div>
  </template>
}
