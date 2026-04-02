import Component from "@glimmer/component";
import PluginOutlet from "discourse/components/plugin-outlet";
import ActionList from "discourse/components/topic-list/action-list";
import ParticipantGroups from "discourse/components/topic-list/participant-groups";
import TopicExcerpt from "discourse/components/topic-list/topic-excerpt";
import TopicLink from "discourse/components/topic-list/topic-link";
import UnreadIndicator from "discourse/components/topic-list/unread-indicator";
import TopicPostBadges from "discourse/components/topic-post-badges";
import TopicStatus from "discourse/components/topic-status";
import categoryLink from "discourse/helpers/category-link";
import discourseTags from "discourse/helpers/discourse-tags";
import lazyHash from "discourse/helpers/lazy-hash";
import topicFeaturedLink from "discourse/helpers/topic-featured-link";
import { groupPath } from "discourse/lib/url";

export default class TopicCell extends Component {
  get participantGroups() {
    if (!this.args.topic.get("participant_groups")) {
      return [];
    }

    return this.args.topic.get("participant_groups").map((name) => ({
      name,
      url: groupPath(name),
    }));
  }

  <template>
    <td class="main-link topic-list-data" colspan="1" role="gridcell">
      <PluginOutlet
        @name="topic-list-before-link"
        @outletArgs={{lazyHash topic=@topic}}
      />

      <span class="link-top-line">
        {{~! no whitespace ~}}
        <PluginOutlet
          @name="topic-list-before-status"
          @outletArgs={{lazyHash topic=@topic}}
        />
        {{~! no whitespace ~}}
        <PluginOutlet
          @name="topic-list-topic-cell-link-top-line"
          @outletArgs={{lazyHash topic=@topic tagsForUser=@tagsForUser}}
        >
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
          {{~! no whitespace ~}}
          <UnreadIndicator @topic={{@topic}} />
          {{~#if @showTopicPostBadges~}}
            <TopicPostBadges
              @unreadPosts={{@topic.unread_posts}}
              @unseen={{@topic.unseen}}
              @url={{@topic.lastUnreadUrl}}
            />
          {{~/if~}}
          <PluginOutlet
            @name="topic-list-after-badges"
            @outletArgs={{lazyHash topic=@topic}}
          />
        </PluginOutlet>
      </span>

      <div class="link-bottom-line">
        <PluginOutlet
          @name="topic-list-topic-cell-link-bottom-line"
          @outletArgs={{lazyHash topic=@topic tagsForUser=@tagsForUser}}
        >
          <PluginOutlet
            @name="topic-list-before-category"
            @outletArgs={{lazyHash topic=@topic}}
          />
          {{#unless @hideCategory}}
            {{#unless @topic.isPinnedUncategorized}}
              {{categoryLink @topic.category}}
            {{/unless}}
          {{/unless}}
          <PluginOutlet
            @name="topic-list-after-category"
            @outletArgs={{lazyHash topic=@topic}}
          />

          {{discourseTags @topic mode="list" tagsForUser=@tagsForUser}}

          {{#if this.participantGroups}}
            <ParticipantGroups @groups={{this.participantGroups}} />
          {{/if}}

          <ActionList
            @topic={{@topic}}
            @postNumbers={{@topic.liked_post_numbers}}
            @icon="heart"
            class="likes"
          />
        </PluginOutlet>
      </div>

      {{#if @expandPinned}}
        <TopicExcerpt @topic={{@topic}} />
      {{/if}}

      <PluginOutlet
        @name="topic-list-main-link-bottom"
        @outletArgs={{lazyHash topic=@topic expandPinned=@expandPinned}}
      />
    </td>
  </template>
}
