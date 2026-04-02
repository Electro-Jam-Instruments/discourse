import Component from "@glimmer/component";
import { concat } from "@ember/helper";
import { on } from "@ember/modifier";
import { action } from "@ember/object";
import { next } from "@ember/runloop";
import { service } from "@ember/service";
import { isHTMLSafe, trustHTML } from "@ember/template";
import { modifier } from "ember-modifier";
import PluginOutlet from "discourse/components/plugin-outlet";
import BulkSelectCheckbox from "discourse/components/topic-list/bulk-select-checkbox";
import PostCountOrBadges from "discourse/components/topic-list/post-count-or-badges";
import TopicExcerpt from "discourse/components/topic-list/topic-excerpt";
import TopicLink from "discourse/components/topic-list/topic-link";
import TopicStatus from "discourse/components/topic-status";
import UserLink from "discourse/components/user-link";
import avatar from "discourse/helpers/avatar";
import categoryLink from "discourse/helpers/category-link";
import concatClass from "discourse/helpers/concat-class";
import discourseTags from "discourse/helpers/discourse-tags";
import formatDate from "discourse/helpers/format-date";
import lazyHash from "discourse/helpers/lazy-hash";
import topicFeaturedLink from "discourse/helpers/topic-featured-link";
import {
  addUniqueValueToArray,
  removeValueFromArray,
} from "discourse/lib/array-tools";
import { wantsNewWindow } from "discourse/lib/intercept-click";
import {
  applyBehaviorTransformer,
  applyValueTransformer,
} from "discourse/lib/transformer";
import DiscourseURL from "discourse/lib/url";
import { and, eq } from "discourse/truth-helpers";
import { i18n } from "discourse-i18n";

export default class Item extends Component {
  @service focusHistory;
  @service historyStore;
  @service site;
  @service siteSettings;

  highlightIfNeeded = modifier((element) => {
    if (this.args.topic.id === this.historyStore.get("lastTopicIdViewed")) {
      element.dataset.isLastViewedTopic = true;

      this.highlightRow(element);
      next(() => this.historyStore.delete("lastTopicIdViewed"));

      if (this.shouldFocusLastVisited) {
        // When focus-history is handling a back/forward restore, focus the row
        // instead of the link so our grid outline renders correctly.
        // Otherwise use Discourse's default behavior (focus the title link).
        if (this.focusHistory.keyboardMode) {
          next(() => element.focus());
        } else {
          // Using next() so it always runs after clean-dom
          next(() => element.querySelector(".main-link .title")?.focus());
        }
      }
    } else if (this.args.topic.get("highlight")) {
      // highlight new topics that have been loaded from the server or the one we just created
      this.highlightRow(element);
      next(() => this.args.topic.set("highlight", false));
    }
  });

  get isSelected() {
    return this.args.selected?.includes(this.args.topic);
  }

  get tagClassNames() {
    return this.args.topic.tags?.map((tag) => {
      const tagName = typeof tag === "string" ? tag : tag.name;
      return `tag-${tagName}`;
    });
  }

  get expandPinned() {
    let expandPinned;
    if (
      !this.args.topic.pinned ||
      (this.useMobileLayout && !this.siteSettings.show_pinned_excerpt_mobile) ||
      (this.site.desktopView && !this.siteSettings.show_pinned_excerpt_desktop)
    ) {
      expandPinned = false;
    } else {
      expandPinned =
        (this.args.expandGloballyPinned && this.args.topic.pinned_globally) ||
        this.args.expandAllPinned;
    }

    return applyValueTransformer(
      "topic-list-item-expand-pinned",
      expandPinned,
      { topic: this.args.topic, mobileView: this.useMobileLayout }
    );
  }

  get shouldFocusLastVisited() {
    return this.site.desktopView && this.args.focusLastVisitedTopic;
  }

  /**
   * ARIA role for the row - always "row" for grid pattern
   */
  get role() {
    return "row";
  }

  /**
   * Tabindex for roving tabindex pattern
   * Grid modifier manages this via roving tabindex, but we need a default
   * First data row starts with tabindex="0", others get "-1"
   * Modifier will update these based on keyboard navigation
   */
  get tabindex() {
    return this.args.index === 0 ? "0" : "-1";
  }

  /**
   * ARIA row index (1-based, accounting for header row)
   * Header row is index 1, first data row is index 2
   */
  get ariaRowIndex() {
    return this.args.index + 2;
  }

  /**
   * Composite accessible name for screen readers
   * Provides full context when navigating rows
   */
  get accessibleName() {
    const topic = this.args.topic;
    const parts = [];

    // New/unread status FIRST so screen reader users know immediately
    if (topic.unseen) {
      parts.push(i18n("filters.new.lower_title"));
    }
    if (topic.unread_posts > 0) {
      parts.push(i18n("sr_unread_posts", { count: topic.unread_posts }));
    }

    // Topic title (required)
    parts.push(topic.title);

    // Status indicators (matching icons shown in topic-status.gjs)
    if (topic.bookmarked) {
      parts.push(i18n("topic_statuses.bookmarked.title"));
    }
    if (topic.closed && topic.archived) {
      parts.push(i18n("topic_statuses.locked_and_archived.title"));
    } else if (topic.closed) {
      parts.push(i18n("topic_statuses.locked.title"));
    } else if (topic.archived) {
      parts.push(i18n("topic_statuses.archived.title"));
    }
    if (topic.is_warning) {
      parts.push(i18n("topic_statuses.warning.title"));
    }
    if (topic.pinned) {
      parts.push(i18n("topic_statuses.pinned.title"));
    }
    if (topic.invisible) {
      parts.push(i18n("topic_statuses.unlisted.title"));
    }

    // Category
    if (topic.category?.name) {
      parts.push(i18n("sr_category", { categoryName: topic.category.name }));
    }

    // Tags
    if (topic.tags?.length > 0) {
      parts.push(i18n("sr_tags", { tags: topic.tags.join(", ") }));
    }

    // Topic excerpt (for pinned topics or when available)
    if (topic.excerpt) {
      // Strip HTML tags and decode entities for clean text
      const div = document.createElement("div");
      div.innerHTML = topic.excerpt;
      const excerptText = div.textContent?.trim();
      if (excerptText) {
        parts.push(excerptText);
      }
    }

    // Posters (featured users)
    if (topic.featuredUsers?.length > 0) {
      const usernames = topic.featuredUsers
        .filter((poster) => poster.user?.username)
        .map((poster) => poster.user.username);
      if (usernames.length > 0) {
        parts.push(i18n("sr_posters", { posters: usernames.join(", ") }));
      }
    }

    // Reply count
    const replyCount = topic.replyCount ?? topic.reply_count ?? 0;
    parts.push(i18n("sr_replies", { count: replyCount }));

    // View count
    const views = topic.views ?? 0;
    parts.push(i18n("sr_views", { count: views }));

    // Last activity (use relative time)
    if (topic.bumpedAt) {
      parts.push(i18n("sr_activity", { time: topic.bumpedAtTitle }));
    }

    return parts.join(", ");
  }

  @action
  navigateToTopic(topic, href) {
    this.historyStore.set("lastTopicIdViewed", topic.id);
    DiscourseURL.routeTo(href || topic.url);
  }

  highlightRow(element) {
    element.dataset.testWasHighlighted = true;

    // Remove any existing highlighted class
    element.addEventListener(
      "animationend",
      () => element.classList.remove("highlighted"),
      { once: true }
    );

    element.classList.add("highlighted");
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

  @action
  onBulkSelectToggle(e) {
    e.stopImmediatePropagation();

    const topicNode = e.target.closest(".topic-list-item");

    if (e.target.checked) {
      this.selectTopic(topicNode, e.shiftKey);
    } else {
      this.unselectTopic(topicNode);
    }
  }

  unselectTopic(topicNode) {
    removeValueFromArray(this.args.selected, this.args.topic);
    this.args.bulkSelectHelper.lastCheckedElementId = null;
    topicNode.classList.remove("bulk-selected");
  }

  selectTopic(topicNode, shiftKey) {
    addUniqueValueToArray(this.args.selected, this.args.topic);

    if (this.args.bulkSelectHelper.lastCheckedElementId && shiftKey) {
      const topics = Array.from(topicNode.parentNode.children);
      const from = topics.indexOf(topicNode);
      const to = topics.findIndex(
        (el) =>
          el.dataset.topicId === this.args.bulkSelectHelper.lastCheckedElementId
      );
      const start = Math.min(from, to);
      const end = Math.max(from, to);
      const bulkSelects = [...document.querySelectorAll("input.bulk-select")];
      bulkSelects
        .slice(start, end)
        .filter((el) => !el.checked)
        .forEach((checkbox) => checkbox.click());
    }

    this.args.bulkSelectHelper.lastCheckedElementId = topicNode.dataset.topicId;
    topicNode.classList.add("bulk-selected");
  }

  @action
  click(event) {
    // when in bulk select mode, select/unselect the row (except when ctrl/meta+clicking)
    if (this.args.bulkSelectEnabled && !wantsNewWindow(event)) {
      event.preventDefault();

      const topicNode = event.target.closest(".topic-list-item");
      const selected = this.args.selected.includes(this.args.topic);
      if (selected) {
        this.unselectTopic(topicNode);
      } else {
        this.selectTopic(topicNode, event.shiftKey);
      }

      return;
    }

    applyBehaviorTransformer(
      "topic-list-item-click",
      () => {
        if (
          event.target.classList.contains("raw-topic-link") ||
          event.target.classList.contains("post-activity") ||
          event.target.classList.contains("badge-posts")
        ) {
          if (wantsNewWindow(event)) {
            return;
          }

          event.preventDefault();
          this.navigateToTopic(this.args.topic, event.target.href);
          return;
        }

        // make full row click target on mobile, due to size constraints
        if (
          this.site.mobileView &&
          event.target.matches(
            ".topic-list-data, .main-link, .right, .topic-item-stats, .topic-item-stats__category-tags, .discourse-tags"
          )
        ) {
          if (wantsNewWindow(event)) {
            return;
          }

          event.preventDefault();
          this.navigateToTopic(this.args.topic, this.args.topic.lastUnreadUrl);
          return;
        }
      },
      {
        event,
        topic: this.args.topic,
        listContext: this.args.listContext,
        navigateToTopic: this.navigateToTopic,
      }
    );
  }

  @action
  keyDown(event) {
    // We only handle cmd/meta+Enter to open topic in a new window here
    // Simple Enter event for topic list is handled in keyboard-shortcuts (which triggers click() event)
    if (event.key === "Enter" && wantsNewWindow(event)) {
      event.preventDefault();
      window.open(this.args.topic.lastUnreadUrl, "_blank");
    }
  }

  get useMobileLayout() {
    return applyValueTransformer(
      "topic-list-item-mobile-layout",
      this.site.mobileView,
      { topic: this.args.topic, listContext: this.args.listContext }
    );
  }

  get additionalClasses() {
    return applyValueTransformer("topic-list-item-class", [], {
      topic: this.args.topic,
      index: this.args.index,
      listContext: this.args.listContext,
    });
  }

  get style() {
    const parts = applyValueTransformer("topic-list-item-style", [], {
      topic: this.args.topic,
      index: this.args.index,
      listContext: this.args.listContext,
    });

    const safeParts = parts.filter(Boolean).filter((part) => {
      if (isHTMLSafe(part)) {
        return true;
      }
      // eslint-disable-next-line no-console
      console.error(
        "topic-list-item-style must be formed of htmlSafe strings. Skipped unsafe value:",
        part
      );
    });

    if (safeParts.length) {
      return trustHTML(safeParts.join("\n"));
    }
  }

  <template>
    <tr
      {{! template-lint-disable no-invalid-interactive }}
      {{this.highlightIfNeeded}}
      {{on "keydown" this.keyDown}}
      {{on "click" this.click}}
      {{on "auxclick" this.click}}
      {{on "focusin" this.onRowFocusIn}}
      {{on "focusout" this.onRowFocusOut}}
      data-topic-id={{@topic.id}}
      role={{this.role}}
      tabindex={{this.tabindex}}
      aria-rowindex={{this.ariaRowIndex}}
      aria-label={{this.accessibleName}}
      class={{concatClass
        "topic-list-item"
        (if @topic.category (concat "category-" @topic.category.fullSlug))
        (if (eq @topic @lastVisitedTopic) "last-visit")
        (if @topic.visited "visited")
        (if @topic.hasExcerpt "has-excerpt")
        (if (and this.expandPinned @topic.hasExcerpt) "excerpt-expanded")
        (if @topic.unseen "unseen-topic")
        (if @topic.unread_posts "unread-posts")
        (if @topic.liked "liked")
        (if @topic.archived "archived")
        (if @topic.bookmarked "bookmarked")
        (if @topic.pinned "pinned")
        (if @topic.closed "closed")
        (if @bulkSelectEnabled "bulk-selecting")
        this.tagClassNames
        this.additionalClasses
      }}
      style={{this.style}}
    >
      <PluginOutlet
        @name="above-topic-list-item"
        @outletArgs={{lazyHash topic=@topic}}
      />
      {{! Do not include @columns as argument to the wrapper outlet below ~}}
      {{! We don't want it to be able to override core behavior just copy/pasting the code ~}}
      <PluginOutlet
        @name="topic-list-item"
        @outletArgs={{lazyHash
          topic=@topic
          bulkSelectEnabled=@bulkSelectEnabled
          onBulkSelectToggle=this.onBulkSelectToggle
          isSelected=this.isSelected
          hideCategory=@hideCategory
          tagsForUser=@tagsForUser
          showTopicPostBadges=@showTopicPostBadges
          navigateToTopic=this.navigateToTopic
        }}
      >
        {{#if this.useMobileLayout}}
          <td
            class={{concatClass
              "topic-list-data"
              (if @bulkSelectEnabled "bulk-select-enabled")
            }}
          >
            <div class="pull-left">
              {{#if @bulkSelectEnabled}}
                <BulkSelectCheckbox
                  @topic={{@topic}}
                  @isSelected={{this.isSelected}}
                  @onToggle={{this.onBulkSelectToggle}}
                />
              {{else}}
                <PluginOutlet
                  @name="topic-list-item-mobile-avatar"
                  @outletArgs={{lazyHash topic=@topic}}
                >
                  <UserLink
                    @ariaLabel={{i18n
                      "latest_poster_link"
                      username=@topic.lastPosterUser.username
                    }}
                    @username={{@topic.lastPosterUser.username}}
                  >
                    {{avatar
                      @topic.lastPosterUser
                      imageSize="large"
                    }}</UserLink>
                </PluginOutlet>
              {{/if}}
            </div>

            <div class="topic-item-metadata right">
              {{~! no whitespace ~}}
              <PluginOutlet
                @name="topic-list-before-link"
                @outletArgs={{lazyHash topic=@topic}}
              />

              <div class="main-link">
                {{~! no whitespace ~}}
                <PluginOutlet
                  @name="topic-list-before-status"
                  @outletArgs={{lazyHash topic=@topic}}
                />
                {{~! no whitespace ~}}
                <TopicStatus @topic={{@topic}} @context="topic-list" />
                {{~! no whitespace ~}}
                <TopicLink @topic={{@topic}} class="raw-link raw-topic-link" />
                {{~#if @topic.featured_link~}}
                  &nbsp;
                  {{~topicFeaturedLink @topic}}
                {{~/if~}}
                <PluginOutlet
                  @name="topic-list-after-title"
                  @outletArgs={{lazyHash topic=@topic}}
                />
                {{~#if @topic.unseen~}}
                  <span class="topic-post-badges">&nbsp;<span
                      class="badge-notification new-topic"
                    ></span></span>
                {{~/if~}}
                <PluginOutlet
                  @name="topic-list-after-badges"
                  @outletArgs={{lazyHash topic=@topic}}
                />
                {{~#if this.expandPinned~}}
                  <TopicExcerpt @topic={{@topic}} />
                {{~/if~}}
                <PluginOutlet
                  @name="topic-list-main-link-bottom"
                  @outletArgs={{lazyHash
                    topic=@topic
                    expandPinned=this.expandPinned
                  }}
                />
              </div>
              {{~! no whitespace ~}}
              <PluginOutlet
                @name="topic-list-after-main-link"
                @outletArgs={{lazyHash topic=@topic}}
              />

              <div class="pull-right">
                <PostCountOrBadges
                  @topic={{@topic}}
                  @postBadgesEnabled={{@showTopicPostBadges}}
                />
              </div>

              <div class="topic-item-stats clearfix">
                <span class="topic-item-stats__category-tags">
                  {{#unless @hideCategory}}
                    <PluginOutlet
                      @name="topic-list-before-category"
                      @outletArgs={{lazyHash topic=@topic}}
                    />
                    {{categoryLink @topic.category}}
                    {{~! no whitespace ~}}
                    <PluginOutlet
                      @name="topic-list-after-category"
                      @outletArgs={{lazyHash topic=@topic}}
                    />{{~! no whitespace ~}}
                  {{/unless}}
                  {{~! no whitespace ~}}
                  {{discourseTags @topic mode="list"}}
                </span>

                <div class="num activity last">
                  <PluginOutlet
                    @name="topic-list-item-mobile-bumped-at"
                    @outletArgs={{lazyHash topic=@topic}}
                  >
                    <span title={{@topic.bumpedAtTitle}} class="age activity">
                      <a href={{@topic.lastPostUrl}}>{{formatDate
                          @topic.bumpedAt
                          format="tiny"
                          noTitle="true"
                        }}</a>
                    </span>
                  </PluginOutlet>
                </div>
              </div>
            </div>
          </td>
        {{else}}
          {{#each @columns as |entry|}}
            <entry.value.item
              @topic={{@topic}}
              @bulkSelectEnabled={{@bulkSelectEnabled}}
              @onBulkSelectToggle={{this.onBulkSelectToggle}}
              @isSelected={{this.isSelected}}
              @showTopicPostBadges={{@showTopicPostBadges}}
              @hideCategory={{@hideCategory}}
              @tagsForUser={{@tagsForUser}}
              @expandPinned={{this.expandPinned}}
            />
          {{/each}}
        {{/if}}
      </PluginOutlet>
    </tr>
  </template>
}
