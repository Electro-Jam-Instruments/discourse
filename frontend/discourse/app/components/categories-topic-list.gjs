/* eslint-disable ember/no-classic-components */
import Component from "@ember/component";
import { concat } from "@ember/helper";
import PluginOutlet from "discourse/components/plugin-outlet";
import LatestTopicListItem from "discourse/components/topic-list/latest-topic-list-item";
import getUrl from "discourse/lib/get-url";
import gridNavigation from "discourse/modifiers/grid-navigation";
import { eq } from "discourse/truth-helpers";
import { i18n } from "discourse-i18n";

// Exists so plugins can use it
export default class CategoriesTopicList extends Component {
  /**
   * Total row count for aria-rowcount
   */
  get topicRowCount() {
    return this.topics?.length ?? 0;
  }

  <template>
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

    {{#if this.topics}}
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
        </div>
      </div>

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
    {{else}}
      <div class="no-topics">
        <h3>{{i18n (concat "topics.none." this.filter)}}</h3>
      </div>
    {{/if}}
  </template>
}
