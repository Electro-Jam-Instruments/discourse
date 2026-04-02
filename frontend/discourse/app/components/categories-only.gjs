/* eslint-disable ember/no-classic-components */
import Component from "@ember/component";
import { on } from "@ember/modifier";
import { action, computed } from "@ember/object";
import { tagName } from "@ember-decorators/component";
import ParentCategoryRow from "discourse/components/parent-category-row";
import PluginOutlet from "discourse/components/plugin-outlet";
import icon from "discourse/helpers/d-icon";
import lazyHash from "discourse/helpers/lazy-hash";
import gridNavigation from "discourse/modifiers/grid-navigation";
import { i18n } from "discourse-i18n";

@tagName("")
export default class CategoriesOnly extends Component {
  showMuted = false;

  /**
   * Total row count for aria-rowcount (categories + header, or header + empty row)
   */
  get categoryRowCount() {
    const categoryCount = this.filteredCategories?.length ?? 0;
    // If no categories, we show an empty state row
    return categoryCount === 0 ? 2 : categoryCount + 1;
  }

  /**
   * Whether to show empty state row
   */
  get showEmptyState() {
    return !this.filteredCategories || this.filteredCategories.length === 0;
  }

  /**
   * Empty state message for screen readers
   */
  get emptyMessage() {
    return i18n("categories.none");
  }

  /**
   * Column count for colspan on empty row
   */
  get columnCount() {
    return this.showTopics ? 3 : 2;
  }

  /**
   * Total row count for muted table aria-rowcount
   */
  get mutedCategoryRowCount() {
    return (this.mutedCategories?.length ?? 0) + 1;
  }

  /**
   * Accessible name for header row including column names
   */
  get categoryHeaderLabel() {
    const columns = [i18n("categories.category"), i18n("categories.topics")];
    if (this.showTopics) {
      columns.push(i18n("categories.latest"));
    }
    const instructions = i18n("sr_category_list_header");
    return `${columns.join(", ")}. ${instructions}`;
  }

  @computed("showMutedCategories", "filteredCategories.length")
  get mutedToggleIcon() {
    if (this.filteredCategories?.length === 0) {
      return;
    }

    if (this.showMutedCategories) {
      return "minus";
    }

    return "plus";
  }

  @computed("showMuted", "filteredCategories.length")
  get showMutedCategories() {
    return this.showMuted || this.filteredCategories?.length === 0;
  }

  @computed("categories", "categories.length")
  get filteredCategories() {
    if (!this.categories || this.categories?.length === 0) {
      return [];
    }

    return this.categories.filter((cat) => !cat.isHidden);
  }

  @computed("categories", "categories.length")
  get mutedCategories() {
    if (!this.categories || this.categories?.length === 0) {
      return [];
    }

    // hide in single category pages
    if (this.categories[0].parent_category_id) {
      return [];
    }

    return this.categories.filter((category) => category.hasMuted);
  }

  @action
  toggleShowMuted(event) {
    event?.preventDefault();
    this.toggleProperty("showMuted");
  }

  <template>
    <PluginOutlet
      @name="categories-only-wrapper"
      @outletArgs={{lazyHash categories=this.categories}}
    >
      {{#if this.site.mobileView}}
        {{#if this.filteredCategories}}
          <div class="category-list {{if this.showTopics 'with-topics'}}">
            <PluginOutlet
              @name="mobile-categories"
              @outletArgs={{lazyHash categories=this.filteredCategories}}
            >
              {{#each this.filteredCategories as |c|}}
                <ParentCategoryRow
                  @category={{c}}
                  @showTopics={{this.showTopics}}
                />
              {{/each}}
            </PluginOutlet>
          </div>
        {{/if}}
      {{else}}
        <table
          class="category-list {{if this.showTopics 'with-topics'}}"
          role="grid"
          aria-labelledby="categories-only-category"
          aria-rowcount={{this.categoryRowCount}}
          {{gridNavigation}}
        >
          <caption class="sr-only">{{i18n "sr_category_list_caption"}}</caption>
          <thead class="category-list-header" role="rowgroup">
            <tr
              role="row"
              tabindex="-1"
              aria-rowindex="1"
              aria-label={{this.categoryHeaderLabel}}
            >
              <th class="category" role="columnheader"><span
                  id="categories-only-category"
                >{{i18n "categories.category"}}</span></th>
              <th class="topics" role="columnheader">{{i18n "categories.topics"}}</th>
              {{#if this.showTopics}}
                <th class="latest" role="columnheader">{{i18n "categories.latest"}}</th>
              {{/if}}
            </tr>
          </thead>
          <tbody class="category-list-body" role="rowgroup">
            {{#each this.filteredCategories as |category index|}}
              <ParentCategoryRow
                @category={{category}}
                @showTopics={{this.showTopics}}
                @index={{index}}
              />
            {{/each}}

            {{! Empty state row - navigable row for screen readers when list is empty }}
            {{#if this.showEmptyState}}
              <tr
                role="row"
                tabindex="0"
                aria-rowindex="2"
                aria-label={{this.emptyMessage}}
                class="category-list-empty-row"
              >
                <td
                  role="gridcell"
                  colspan={{this.columnCount}}
                  class="category-list-empty-cell"
                >
                  {{this.emptyMessage}}
                </td>
              </tr>
            {{/if}}
          </tbody>
        </table>
      {{/if}}

        {{#if this.mutedCategories}}
          <div class="muted-categories">
            <a
              href
              class="muted-categories-link"
              {{on "click" this.toggleShowMuted}}
            >
              <h3 class="muted-categories-heading">{{i18n
                  "categories.muted"
                }}</h3>
              {{#if this.mutedToggleIcon}}
                {{icon this.mutedToggleIcon}}
              {{/if}}
            </a>
            {{#if this.site.mobileView}}
              <div
                class="category-list
                  {{if this.showTopics 'with-topics'}}
                  {{unless this.showMutedCategories 'hidden'}}"
              >
                {{#each this.mutedCategories as |c|}}
                  <ParentCategoryRow
                    @category={{c}}
                    @showTopics={{this.showTopics}}
                    @listType="muted"
                  />
                {{/each}}
              </div>
            {{else}}
              <table
                class="category-list
                  {{if this.showTopics 'with-topics'}}
                  {{unless this.showMutedCategories 'hidden'}}"
                role="grid"
                aria-labelledby="categories-only-category-muted"
                aria-rowcount={{this.mutedCategoryRowCount}}
                {{gridNavigation}}
              >
                <caption class="sr-only">{{i18n "sr_muted_category_list_caption"}}</caption>
                <thead class="category-list-header" role="rowgroup">
                  <tr
                    role="row"
                    tabindex="-1"
                    aria-rowindex="1"
                    aria-label={{this.categoryHeaderLabel}}
                  >
                    <th class="category" role="columnheader"><span
                        id="categories-only-category-muted"
                      >{{i18n "categories.category"}}</span></th>
                    <th class="topics" role="columnheader">{{i18n "categories.topics"}}</th>
                    {{#if this.showTopics}}
                      <th class="latest" role="columnheader">{{i18n "categories.latest"}}</th>
                    {{/if}}
                  </tr>
                </thead>
                <tbody class="category-list-body" role="rowgroup">
                  {{#each this.mutedCategories as |category index|}}
                    <ParentCategoryRow
                      @category={{category}}
                      @showTopics={{this.showTopics}}
                      @listType="muted"
                      @index={{index}}
                    />
                  {{/each}}
                </tbody>
              </table>
            {{/if}}
          </div>
        {{/if}}
    </PluginOutlet>

    <PluginOutlet
      @name="below-categories-only"
      @connectorTagName="div"
      @outletArgs={{lazyHash
        categories=this.categories
        showTopics=this.showTopics
      }}
    />
  </template>
}
