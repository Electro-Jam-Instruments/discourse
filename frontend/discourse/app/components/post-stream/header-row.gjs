import Component from "@glimmer/component";
import { service } from "@ember/service";
import boundCategoryLink from "discourse/helpers/bound-category-link";
import discourseTags from "discourse/helpers/discourse-tags";
import { i18n } from "discourse-i18n";

/**
 * Topic header row component for the post stream grid.
 *
 * Renders the topic title, category, and tags as the first row in the post grid,
 * enabling keyboard users to navigate to it with Arrow Up from the first post.
 *
 * @component PostStreamHeaderRow
 *
 * WAI-ARIA Grid Row:
 * - role="row" with aria-rowindex="1" (first row in grid)
 * - aria-label announces: "Topic header: [title], Category: [category], [tag count] tags"
 * - tabindex for roving tabindex pattern (managed by post-stream-navigation modifier)
 */
export default class PostStreamHeaderRow extends Component {
  @service siteSettings;

  /**
   * Composite aria-label for the topic header row
   * Announces title, category, and tag count for screen readers
   */
  get headerRowAriaLabel() {
    const topic = this.args.topic;
    const parts = [];

    // Topic title
    const title = topic.title || topic.fancyTitle;
    if (title) {
      parts.push(i18n("post_stream.header_row.title", { title }));
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

    return parts.join(", ");
  }

  <template>
    <div
      class="post-stream__header-row topic-header-row"
      role="row"
      tabindex="-1"
      aria-rowindex="1"
      aria-label={{this.headerRowAriaLabel}}
    >
      <div class="topic-header-row__content" role="gridcell">
        <h2 class="topic-header-row__title">
          {{@topic.fancyTitle}}
        </h2>
        <div class="topic-header-row__meta">
          {{#unless @topic.isPrivateMessage}}
            {{boundCategoryLink
              @topic.category
              ancestors=@topic.category.predecessors
              hideParent=true
            }}
          {{/unless}}
          {{#if this.siteSettings.tagging_enabled}}
            {{#if @topic.tags.length}}
              <div class="topic-header-row__tags">
                {{discourseTags @topic mode="list" tags=@topic.tags}}
              </div>
            {{/if}}
          {{/if}}
        </div>
      </div>
    </div>
  </template>
}
