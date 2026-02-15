/* eslint-disable ember/no-classic-components */
import Component from "@ember/component";
import { concat } from "@ember/helper";
import { tagName } from "@ember-decorators/component";
import PluginOutlet from "discourse/components/plugin-outlet";
import LatestTopicListItem from "discourse/components/topic-list/latest-topic-list-item";
import getUrl from "discourse/lib/get-url";
import gridNavigation from "discourse/modifiers/grid-navigation";
import { eq } from "discourse/truth-helpers";
import { i18n } from "discourse-i18n";

// Exists so plugins can use it
@tagName("")
export default class CategoriesTopicList extends Component {
  /**
   * Total row count for aria-rowcount (topics, or 1 for empty state)
   */
  get topicRowCount() {
    const count = this.topics?.length ?? 0;
    return count === 0 ? 1 : count;
  }

  /**
   * Whether to show empty state row
   */
  get showEmptyState() {
    return !this.topics || this.topics.length === 0;
  }

  /**
   * Empty state message for screen readers
   */
  get emptyMessage() {
    const filter = this.filter || "latest";
    return i18n(`topics.none.${filter}`);
  }

  <template>
    <div ...attributes>
      <div
        role="heading"
        aria-level="2"
        class="table-heading"
        id="latest-topics-heading"
      >
        {{i18n (concat "filters." this.filter ".title")}}
        <PluginOutlet
          @name="categories-topics-table-heading"
          @connectorTagName="div"
        />
      </div>

      <div
        role="grid"
        aria-labelledby="latest-topics-heading"
        aria-rowcount={{this.topicRowCount}}
        class="latest-topic-list-container"
        {{gridNavigation
          headerRowSelector=null
          dataRowSelector="[role='row']"
        }}
      >
        <div role="rowgroup" class="latest-topic-list-body">
          {{#each this.topics as |t index|}}
            <LatestTopicListItem @topic={{t}} @index={{index}} />
          {{/each}}

          {{! Empty state row - navigable row for screen readers when list is empty }}
          {{#if this.showEmptyState}}
            <div
              role="row"
              tabindex="0"
              aria-rowindex="1"
              aria-label={{this.emptyMessage}}
              class="latest-topic-list-empty-row"
            >
              <div role="gridcell" class="latest-topic-list-empty-cell">
                {{this.emptyMessage}}
              </div>
            </div>
          {{/if}}
        </div>
      </div>

      {{#if this.topics}}
        <div class="more-topics">
          {{#if
            (eq
              this.siteSettings.desktop_category_page_style
              "categories_and_latest_topics_created_date"
            )
          }}
            <a
              href={{getUrl (concat "/" this.filter "?order=created")}}
              class="btn btn-default pull-right"
            >{{i18n "more"}}</a>
          {{else}}
            <a
              href={{getUrl (concat "/" this.filter)}}
              class="btn btn-default pull-right"
            >{{i18n "more"}}</a>
          {{/if}}
        </div>
      {{/if}}
    </div>
  </template>
}
