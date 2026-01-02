/* eslint-disable ember/no-classic-components */
import Component from "@ember/component";
import { on } from "@ember/modifier";
import { action } from "@ember/object";
import { tagName } from "@ember-decorators/component";
import ParentCategoryRow from "discourse/components/parent-category-row";
import PluginOutlet from "discourse/components/plugin-outlet";
import icon from "discourse/helpers/d-icon";
import lazyHash from "discourse/helpers/lazy-hash";
import discourseComputed from "discourse/lib/decorators";
import gridNavigation from "discourse/modifiers/grid-navigation";
import { i18n } from "discourse-i18n";

@tagName("")
export default class CategoriesOnly extends Component {
  showMuted = false;

  /**
   * Total row count for aria-rowcount (categories + header)
   */
  get categoryRowCount() {
    return (this.categories?.length ?? 0) + 1;
  }

  /**
   * Total row count for muted table aria-rowcount
   */
  get mutedCategoryRowCount() {
    return (this.mutedCategories?.length ?? 0) + 1;
  }

  @discourseComputed("showMutedCategories", "filteredCategories.length")
  mutedToggleIcon(showMutedCategories, filteredCategoriesLength) {
    if (filteredCategoriesLength === 0) {
      return;
    }

    if (showMutedCategories) {
      return "minus";
    }

    return "plus";
  }

  @discourseComputed("showMuted", "filteredCategories.length")
  showMutedCategories(showMuted, filteredCategoriesLength) {
    return showMuted || filteredCategoriesLength === 0;
  }

  @discourseComputed("categories", "categories.length")
  filteredCategories(categories, categoriesLength) {
    if (!categories || categoriesLength === 0) {
      return [];
    }

    return categories.filter((cat) => !cat.isHidden);
  }

  @discourseComputed("categories", "categories.length")
  mutedCategories(categories, categoriesLength) {
    if (!categories || categoriesLength === 0) {
      return [];
    }

    // hide in single category pages
    if (categories[0].parent_category_id) {
      return [];
    }

    return categories.filter((category) => category.hasMuted);
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
      {{#if this.categories}}
        {{#if this.filteredCategories}}
          {{#if this.site.mobileView}}
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
                  aria-label={{i18n "sr_category_list_header"}}
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
                {{#each this.categories as |category index|}}
                  <ParentCategoryRow
                    @category={{category}}
                    @showTopics={{this.showTopics}}
                    @index={{index}}
                  />
                {{/each}}
              </tbody>
            </table>
          {{/if}}
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
                    aria-label={{i18n "sr_category_list_header"}}
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
