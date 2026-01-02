import Component from "@glimmer/component";
import { concat } from "@ember/helper";
import { on } from "@ember/modifier";
import { action } from "@ember/object";
import PluginOutlet from "discourse/components/plugin-outlet";
import ItemRepliesCell from "discourse/components/topic-list/item/replies-cell";
import TopicPostBadges from "discourse/components/topic-post-badges";
import TopicStatus from "discourse/components/topic-status";
import UserAvatarFlair from "discourse/components/user-avatar-flair";
import UserLink from "discourse/components/user-link";
import avatar from "discourse/helpers/avatar";
import categoryLink from "discourse/helpers/category-link";
import concatClass from "discourse/helpers/concat-class";
import discourseTags from "discourse/helpers/discourse-tags";
import formatDate from "discourse/helpers/format-date";
import { relativeAge } from "discourse/lib/formatter";
import lazyHash from "discourse/helpers/lazy-hash";
import topicFeaturedLink from "discourse/helpers/topic-featured-link";
import topicLink from "discourse/helpers/topic-link";
import { applyValueTransformer } from "discourse/lib/transformer";
import { i18n } from "discourse-i18n";

export default class LatestTopicListItem extends Component {
  get tagClassNames() {
    return this.args.topic.tags?.map((tagName) => `tag-${tagName}`);
  }

  get additionalClasses() {
    return applyValueTransformer("latest-topic-list-item-class", [], {
      topic: this.args.topic,
    });
  }

  /**
   * Tabindex for roving tabindex pattern
   */
  get tabindex() {
    return this.args.index === 0 ? "0" : "-1";
  }

  /**
   * ARIA row index (1-based)
   */
  get ariaRowIndex() {
    return (this.args.index ?? 0) + 1;
  }

  /**
   * Composite accessible name for screen readers
   * Format: "Title, in Category, N replies, time ago"
   */
  get accessibleName() {
    const topic = this.args.topic;
    const parts = [];

    // Topic title
    parts.push(topic.title);

    // Pinned status
    if (topic.pinned) {
      parts.push(i18n("topic_statuses.pinned.title"));
    }

    // Category
    if (topic.category?.name) {
      parts.push(i18n("sr_category", { categoryName: topic.category.name }));
    }

    // Reply count
    const replyCount = topic.replyCount ?? topic.reply_count ?? 0;
    parts.push(i18n("sr_replies", { count: replyCount }));

    // Age
    if (topic.bumpedAt) {
      const age = relativeAge(new Date(topic.bumpedAt), {
        format: "medium-with-ago",
        wrapInSpan: false,
      });
      parts.push(age);
    }

    return parts.join(", ");
  }

  /**
   * Handles focusin on the row - adds selected class when focus moves to internal elements
   * This provides the left-bar highlight for keyboard navigation
   */
  @action
  onRowFocusIn(event) {
    const row = event.currentTarget;
    // Only add selected class when focus is on an internal element, not the row itself
    // Row focus uses full rectangle outline, internal focus uses left-bar highlight
    if (event.target !== row) {
      row.classList.add("selected");
    }
  }

  /**
   * Handles focusout on the row - removes selected class when focus leaves internal elements
   */
  @action
  onRowFocusOut(event) {
    const row = event.currentTarget;
    // Only remove selected class if focus is leaving to outside the row
    // or returning to the row element itself
    if (!row.contains(event.relatedTarget) || event.relatedTarget === row) {
      row.classList.remove("selected");
    }
  }

  <template>
    <div
      role="row"
      tabindex={{this.tabindex}}
      aria-rowindex={{this.ariaRowIndex}}
      aria-label={{this.accessibleName}}
      data-topic-id={{@topic.id}}
      {{on "focusin" this.onRowFocusIn}}
      {{on "focusout" this.onRowFocusOut}}
      class={{concatClass
        "latest-topic-list-item"
        this.tagClassNames
        (if @topic.category (concat "category-" @topic.category.fullSlug))
        (if @topic.liked "liked")
        (if @topic.archived "archived")
        (if @topic.bookmarked "bookmarked")
        (if @topic.pinned "pinned")
        (if @topic.closed "closed")
        (if @topic.visited "visited")
        this.additionalClasses
      }}
    >
      <PluginOutlet
        @name="above-latest-topic-list-item"
        @connectorTagName="div"
        @outletArgs={{lazyHash topic=@topic}}
      />

      <PluginOutlet
        @name="latest-topic-list-item-topic-poster"
        @outletArgs={{lazyHash topic=@topic}}
      >
        <div role="gridcell" class="topic-poster">
          <UserLink @user={{@topic.lastPosterUser}}>
            {{avatar @topic.lastPosterUser imageSize="large"}}
          </UserLink>
          <UserAvatarFlair @user={{@topic.lastPosterUser}} />
        </div>
      </PluginOutlet>

      <div role="gridcell" class="main-link">
        <div class="top-row">
          <PluginOutlet
            @name="latest-topic-list-item-main-link-top-row"
            @outletArgs={{lazyHash topic=@topic}}
          >
            <TopicStatus @topic={{@topic}} @context="topic-list" />

            {{topicLink @topic}}
            {{~#if @topic.featured_link}}
              &nbsp;{{topicFeaturedLink @topic}}
            {{/if~}}
            <TopicPostBadges
              @unreadPosts={{@topic.unread_posts}}
              @unseen={{@topic.unseen}}
              @url={{@topic.lastUnreadUrl}}
            />
          </PluginOutlet>
        </div>

        <div class="bottom-row">
          <PluginOutlet
            @name="latest-topic-list-item-main-link-bottom-row"
            @outletArgs={{lazyHash topic=@topic}}
          >
            {{categoryLink @topic.category~}}
            {{~discourseTags @topic mode="list"}}
          </PluginOutlet>
          <PluginOutlet
            @name="below-latest-topic-list-item-bottom-row"
            @connectorTagName="span"
            @outletArgs={{lazyHash topic=@topic}}
          />
        </div>
      </div>

      <div role="gridcell" class="topic-stats">
        <PluginOutlet
          @name="above-latest-topic-list-item-post-count"
          @connectorTagName="div"
          @outletArgs={{lazyHash topic=@topic}}
        />
        <PluginOutlet
          @name="latest-topic-list-item-topic-stats"
          @outletArgs={{lazyHash topic=@topic}}
        >
          <ItemRepliesCell @topic={{@topic}} @tagName="div" />
          <div class="topic-last-activity">
            <a
              href={{@topic.lastPostUrl}}
              title={{@topic.bumpedAtTitle}}
            >{{formatDate @topic.bumpedAt format="tiny" noTitle="true"}}</a>
          </div>
        </PluginOutlet>
      </div>
    </div>
  </template>
}
