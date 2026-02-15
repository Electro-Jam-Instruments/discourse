import Component from "@glimmer/component";
import { cached } from "@glimmer/tracking";
import { service } from "@ember/service";
import PluginOutlet from "discourse/components/plugin-outlet";
import Header from "discourse/components/topic-list/header";
import Item from "discourse/components/topic-list/item";
import concatClass from "discourse/helpers/concat-class";
import lazyHash from "discourse/helpers/lazy-hash";
import DAG from "discourse/lib/dag";
import {
  applyMutableValueTransformer,
  applyValueTransformer,
} from "discourse/lib/transformer";
import gridNavigation from "discourse/modifiers/grid-navigation";
import { eq, or } from "discourse/truth-helpers";
import { i18n } from "discourse-i18n";
import HeaderActivityCell from "./header/activity-cell";
import HeaderBulkSelectCell from "./header/bulk-select-cell";
import HeaderLikesCell from "./header/likes-cell";
import HeaderOpLikesCell from "./header/op-likes-cell";
import HeaderPostersCell from "./header/posters-cell";
import HeaderRepliesCell from "./header/replies-cell";
import HeaderTopicCell from "./header/topic-cell";
import HeaderViewsCell from "./header/views-cell";
import ItemActivityCell from "./item/activity-cell";
import ItemBulkSelectCell from "./item/bulk-select-cell";
import ItemLikesCell from "./item/likes-cell";
import ItemOpLikesCell from "./item/op-likes-cell";
import ItemPostersCell from "./item/posters-cell";
import ItemRepliesCell from "./item/replies-cell";
import ItemTopicCell from "./item/topic-cell";
import ItemViewsCell from "./item/views-cell";

export default class TopicList extends Component {
  @service currentUser;
  // eslint-disable-next-line discourse/no-unused-services
  @service topicTrackingState; // accessed via `self` variable

  @cached
  get columns() {
    const defaultColumns = new DAG({
      // Allow customizations to replace just a header cell or just an item cell
      onReplaceItem(_, newValue, oldValue) {
        newValue.header ??= oldValue.header;
        newValue.item ??= oldValue.item;
      },
    });

    if (this.bulkSelectEnabled) {
      defaultColumns.add("bulk-select", {
        header: HeaderBulkSelectCell,
        item: ItemBulkSelectCell,
      });
    }

    defaultColumns.add("topic", {
      header: HeaderTopicCell,
      item: ItemTopicCell,
    });

    if (this.args.showPosters) {
      defaultColumns.add("posters", {
        header: HeaderPostersCell,
        item: ItemPostersCell,
      });
    }

    defaultColumns.add("replies", {
      header: HeaderRepliesCell,
      item: ItemRepliesCell,
    });

    if (this.args.order === "likes") {
      defaultColumns.add("likes", {
        header: HeaderLikesCell,
        item: ItemLikesCell,
      });
    } else if (this.args.order === "op_likes") {
      defaultColumns.add("op-likes", {
        header: HeaderOpLikesCell,
        item: ItemOpLikesCell,
      });
    }

    defaultColumns.add("views", {
      header: HeaderViewsCell,
      item: ItemViewsCell,
    });

    defaultColumns.add("activity", {
      header: HeaderActivityCell,
      item: ItemActivityCell,
    });

    const self = this;
    const context = {
      get listContext() {
        return self.args.listContext;
      },

      get category() {
        return self.topicTrackingState.get("filterCategory");
      },

      get filter() {
        return self.topicTrackingState.get("filter");
      },
    };

    return applyMutableValueTransformer(
      "topic-list-columns",
      defaultColumns,
      context
    ).resolve();
  }

  get selected() {
    return this.args.bulkSelectHelper?.selected;
  }

  get bulkSelectEnabled() {
    return (
      this.args.bulkSelectHelper?.bulkSelectEnabled && this.args.canBulkSelect
    );
  }

  get canDoBulkActions() {
    return this.currentUser?.canManageTopic && this.selected?.length;
  }

  get toggleInTitle() {
    return !this.bulkSelectEnabled && this.args.canBulkSelect;
  }

  get showTopicPostBadges() {
    return this.args.showTopicPostBadges ?? true;
  }

  get lastVisitedTopic() {
    const { topics, order, ascending, top, hot } = this.args;

    if (
      !this.args.highlightLastVisited ||
      top ||
      hot ||
      ascending ||
      !topics ||
      topics.length === 1 ||
      (order && order !== "activity") ||
      !this.currentUser?.get("previous_visit_at")
    ) {
      return;
    }

    // work backwards
    // this is more efficient cause we keep appending to list
    const start = Math.max(
      topics.findIndex((topic) => !topic.get("pinned")),
      0
    );
    let lastVisitedTopic, topic;

    for (let i = topics.length - 1; i >= start; i--) {
      if (topics[i].get("bumpedAt") > this.currentUser.get("previousVisitAt")) {
        lastVisitedTopic = topics[i];
        break;
      }
      topic = topics[i];
    }

    if (!lastVisitedTopic || !topic) {
      return;
    }

    // end of list that was scanned
    if (topic.get("bumpedAt") > this.currentUser.get("previousVisitAt")) {
      return;
    }

    return lastVisitedTopic;
  }

  get additionalClasses() {
    return applyValueTransformer("topic-list-class", [], {
      topics: this.args.topics,
      listContext: this.args.listContext,
    });
  }

  /**
   * Total row count for aria-rowcount
   * Uses totalRowCount arg if available (for pagination), otherwise topics.length + 1 for header
   * Add 1 more if we have a footer message row or empty state row
   */
  get ariaRowCount() {
    const topicsLength = this.args.topics?.length ?? 0;
    const baseCount = (this.args.totalRowCount ?? topicsLength) + 1;

    // Add 1 for footer message row (when topics exist and all loaded)
    if (this.args.footerMessage) {
      return baseCount + 1;
    }
    // Add 1 for empty state row (when no topics)
    if (topicsLength === 0 && this.args.emptyMessage) {
      return baseCount + 1;
    }
    return baseCount;
  }

  /**
   * Whether to show empty state row
   */
  get showEmptyState() {
    return (this.args.topics?.length ?? 0) === 0 && this.args.emptyMessage;
  }

  /**
   * Row index for the footer message row
   * Header is 1, topics are 2+, footer is last
   */
  get footerRowIndex() {
    return (this.args.topics?.length ?? 0) + 2;
  }

  /**
   * Column count for colspan on footer/empty row
   */
  get columnCount() {
    return this.columns.length;
  }

  <template>
    {{! template-lint-disable table-groups }}
    <table
      class={{concatClass
        "topic-list"
        (if this.bulkSelectEnabled "sticky-header bulk-select-enabled")
        this.additionalClasses
      }}
      role="grid"
      aria-labelledby={{@ariaLabelledby}}
      aria-rowcount={{this.ariaRowCount}}
      {{gridNavigation onLoadMore=@onLoadMore}}
      ...attributes
    >
      <caption class="sr-only">{{i18n "sr_topic_list_caption"}}</caption>
      <thead class="topic-list-header" role="rowgroup">
        <Header
          @columns={{this.columns}}
          @canBulkSelect={{@canBulkSelect}}
          @toggleInTitle={{this.toggleInTitle}}
          @category={{@category}}
          @hideCategory={{@hideCategory}}
          @order={{@order}}
          @changeSort={{@changeSort}}
          @ascending={{@ascending}}
          @sortable={{@changeSort}}
          @listTitle={{or @listTitle "topic.title"}}
          @bulkSelectHelper={{@bulkSelectHelper}}
          @bulkSelectEnabled={{this.bulkSelectEnabled}}
          @canDoBulkActions={{this.canDoBulkActions}}
        />
      </thead>

      <PluginOutlet
        @name="before-topic-list-body"
        @outletArgs={{lazyHash
          topics=@topics
          selected=this.selected
          bulkSelectEnabled=this.bulkSelectEnabled
          lastVisitedTopic=this.lastVisitedTopic
          discoveryList=@discoveryList
          hideCategory=@hideCategory
        }}
      />

      <tbody class="topic-list-body" role="rowgroup">
        {{#each @topics as |topic index|}}
          <Item
            @columns={{this.columns}}
            @topic={{topic}}
            @bulkSelectHelper={{@bulkSelectHelper}}
            @bulkSelectEnabled={{this.bulkSelectEnabled}}
            @showTopicPostBadges={{this.showTopicPostBadges}}
            @hideCategory={{@hideCategory}}
            @expandGloballyPinned={{@expandGloballyPinned}}
            @expandAllPinned={{@expandAllPinned}}
            @lastVisitedTopic={{this.lastVisitedTopic}}
            @selected={{this.selected}}
            @tagsForUser={{@tagsForUser}}
            @focusLastVisitedTopic={{@focusLastVisitedTopic}}
            @index={{index}}
            @listContext={{@listContext}}
          />

          {{#if (eq topic this.lastVisitedTopic)}}
            <tr class="topic-list-item-separator">
              <td class="topic-list-data" colspan="6">
                <span>
                  {{i18n "topics.new_messages_marker"}}
                </span>
              </td>
            </tr>
          {{/if}}

          <PluginOutlet
            @name="after-topic-list-item"
            @outletArgs={{lazyHash topic=topic index=index}}
            @connectorTagName="tr"
          />
        {{/each}}

        {{! Empty state row - navigable row for screen readers when list is empty }}
        {{#if this.showEmptyState}}
          <tr
            role="row"
            tabindex="0"
            aria-rowindex="2"
            aria-label={{@emptyMessage}}
            class="topic-list-empty-row"
          >
            <td
              role="gridcell"
              colspan={{this.columnCount}}
              class="topic-list-empty-cell"
            >
              {{@emptyMessage}}
            </td>
          </tr>
        {{/if}}

        {{! Footer message row - navigable end-of-list indicator for screen readers }}
        {{#if @footerMessage}}
          <tr
            role="row"
            tabindex="-1"
            aria-rowindex={{this.footerRowIndex}}
            aria-label={{@footerMessage}}
            class="topic-list-footer-row"
          >
            <td
              role="gridcell"
              colspan={{this.columnCount}}
              class="topic-list-footer-cell"
            >
              {{@footerMessage}}
            </td>
          </tr>
        {{/if}}
      </tbody>

      <PluginOutlet
        @name="after-topic-list-body"
        @outletArgs={{lazyHash
          topics=@topics
          selected=this.selected
          bulkSelectEnabled=this.bulkSelectEnabled
          lastVisitedTopic=this.lastVisitedTopic
          discoveryList=@discoveryList
          hideCategory=@hideCategory
        }}
      />
    </table>
  </template>
}
