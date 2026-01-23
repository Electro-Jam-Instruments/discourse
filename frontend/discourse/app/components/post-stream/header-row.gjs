import Component from "@glimmer/component";
import { on } from "@ember/modifier";
import { action } from "@ember/object";
import { service } from "@ember/service";
import { htmlSafe } from "@ember/template";
import PluginOutlet from "discourse/components/plugin-outlet";
import PrivateMessageGlyph from "discourse/components/private-message-glyph";
import TopicCategory from "discourse/components/topic-category";
import TopicStatus from "discourse/components/topic-status";
import icon from "discourse/helpers/d-icon";
import lazyHash from "discourse/helpers/lazy-hash";
import { i18n } from "discourse-i18n";

/**
 * Topic header row component for the post stream grid.
 *
 * This is the unified topic header that replaces the static header in topic.gjs.
 * It renders as the first row in the post grid, enabling keyboard users to
 * navigate to it with Arrow Up from the first post.
 *
 * @component PostStreamHeaderRow
 *
 * Features:
 * - Topic status icons (pinned, closed, archived, etc.)
 * - PM glyph for private messages
 * - Clickable title with edit functionality
 * - Edit button (when user can edit)
 * - Category and tags
 * - Plugin outlets for extensibility
 *
 * WAI-ARIA Grid Row:
 * - role="row" with aria-rowindex="1" (first row in grid)
 * - aria-label announces topic info for screen readers
 * - tabindex for roving tabindex pattern (managed by post-stream-navigation modifier)
 *
 * Keyboard behavior:
 * - Enter on row: triggers edit if user can edit, otherwise navigates to topic
 * - Arrow Right: navigate to internal focusable elements (title link, edit button)
 */
export default class PostStreamHeaderRow extends Component {
  @service currentUser;
  @service siteSettings;

  /**
   * Whether the current user can send private messages
   */
  get canSendPms() {
    return this.currentUser?.can_send_private_messages;
  }

  /**
   * Path to the user's PM inbox for this topic
   */
  get pmPath() {
    const topic = this.args.topic;
    return this.currentUser && this.currentUser.pmPath(topic);
  }

  /**
   * Whether the user can edit this topic
   */
  get canEdit() {
    return this.args.topic?.details?.can_edit;
  }

  /**
   * Composite aria-label for the topic header row
   * Announces title, status, category, and tag count for screen readers
   */
  get headerRowAriaLabel() {
    const topic = this.args.topic;
    const parts = [];

    // Topic title
    const title = topic.title || topic.fancyTitle;
    if (title) {
      parts.push(i18n("post_stream.header_row.title", { title }));
    }

    // Status indicators
    if (topic.pinned) {
      parts.push(i18n("topic_statuses.pinned.title"));
    }
    if (topic.closed) {
      parts.push(i18n("topic_statuses.locked.title"));
    }
    if (topic.archived) {
      parts.push(i18n("topic_statuses.archived.title"));
    }

    // Category
    if (topic.category && !topic.isPrivateMessage) {
      parts.push(
        i18n("post_stream.header_row.category", {
          category: topic.category.name,
        })
      );
    }

    // Tags count
    if (this.siteSettings.tagging_enabled && topic.tags?.length > 0) {
      parts.push(
        i18n("post_stream.header_row.tags", { count: topic.tags.length })
      );
    }

    // Edit hint
    if (this.canEdit) {
      parts.push(i18n("post_stream.header_row.can_edit"));
    }

    return parts.join(", ");
  }

  /**
   * Handle click on the title - triggers edit mode
   */
  @action
  handleTitleClick(event) {
    if (this.args.onTitleClick) {
      this.args.onTitleClick(event);
    }
  }

  /**
   * Handle click on the edit button
   */
  @action
  handleEditClick(event) {
    event.preventDefault();
    if (this.args.editFirstPost) {
      this.args.editFirstPost();
    }
  }

  <template>
    <div
      class="post-stream__header-row topic-header-row"
      role="row"
      tabindex="-1"
      aria-rowindex="1"
      aria-label={{this.headerRowAriaLabel}}
      data-topic-id={{@topic.id}}
    >
      <div class="topic-header-row__content" role="gridcell">
        <h1 class="topic-header-row__title">
          {{#unless @topic.is_warning}}
            {{#if this.canSendPms}}
              <PrivateMessageGlyph
                @shouldShow={{@topic.isPrivateMessage}}
                @href={{this.pmPath}}
                @title="topic_statuses.personal_message.title"
                @ariaLabel="user.messages.inbox"
              />
            {{else}}
              <PrivateMessageGlyph @shouldShow={{@topic.isPrivateMessage}} />
            {{/if}}
          {{/unless}}

          <TopicStatus @topic={{@topic}} @disableActions={{true}} />

          <a
            href={{@topic.url}}
            {{on "click" this.handleTitleClick}}
            class="fancy-title"
            tabindex="-1"
          >
            {{htmlSafe @topic.fancyTitle}}
          </a>

          {{#if this.canEdit}}
            <button
              type="button"
              {{on "click" this.handleEditClick}}
              class="btn-flat edit-topic-button"
              title={{i18n "topic.edit_title"}}
              aria-label={{i18n "topic.edit_title"}}
              tabindex="-1"
            >
              {{icon "pencil"}}
            </button>
          {{/if}}

          <PluginOutlet
            @name="topic-title-suffix"
            @outletArgs={{lazyHash model=@topic}}
          />
        </h1>

        <div class="topic-header-row__meta">
          <PluginOutlet
            @name="topic-category-wrapper"
            @outletArgs={{lazyHash topic=@topic}}
          >
            <TopicCategory @topic={{@topic}} class="topic-category" />
          </PluginOutlet>
        </div>
      </div>
    </div>
  </template>
}
