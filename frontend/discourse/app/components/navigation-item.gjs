/* eslint-disable ember/no-classic-components */
import { tracked } from "@glimmer/tracking";
import Component from "@ember/component";
import { on } from "@ember/modifier";
import { action } from "@ember/object";
import { dependentKeyCompat } from "@ember/object/compat";
import { service } from "@ember/service";
import { tagName } from "@ember-decorators/component";
import concatClass from "discourse/helpers/concat-class";
import discourseComputed from "discourse/lib/decorators";
import { filterTypeForMode } from "discourse/lib/filter-mode";

@tagName("")
export default class NavigationItem extends Component {
  @service filterFocus;

  role = "presentation";
  @tracked filterMode;

  hidden = false;
  activeClass = "";
  hrefLink = null;

  @dependentKeyCompat
  get filterType() {
    return filterTypeForMode(this.filterMode);
  }

  @discourseComputed("content.filterType", "filterType", "content.active")
  active(contentFilterType, filterType, active) {
    if (active !== undefined) {
      return active;
    }
    return contentFilterType === filterType;
  }

  @discourseComputed("content.count", "content.name")
  isHidden(count, name) {
    return (
      !this.active &&
      this.currentUser &&
      !this.currentUser.new_new_view_enabled &&
      this.currentUser.trust_level > 0 &&
      (name === "new" || name === "unread") &&
      count < 1
    );
  }

  didReceiveAttrs() {
    super.didReceiveAttrs(...arguments);
    const content = this.content;

    let [href, searchParams] = content.get("href")?.split("?") || [];

    let urlSearchParams = new URLSearchParams(searchParams);
    let addParamsEvenIfEmpty = false;

    // Include the category id if the option is present
    if (content.get("includeCategoryId")) {
      let categoryId = this.get("content.category.id");
      if (categoryId) {
        urlSearchParams.set("category_id", categoryId);
      }
    }

    // To reset the "filter" sticky param, at least one query param is needed.
    // If no query param is present, add an empty one to ensure a ? is
    // appended to the URL.
    if (content.currentRouteQueryParams) {
      if (content.currentRouteQueryParams.filter) {
        addParamsEvenIfEmpty = true;
      }

      if (content.currentRouteQueryParams.f) {
        urlSearchParams.set("f", content.currentRouteQueryParams.f);
      }
    }

    if (
      this.siteSettings.desktop_category_page_style ===
        "categories_and_latest_topics_created_date" &&
      urlSearchParams.get("order") == null
    ) {
      urlSearchParams.set("order", "created");
    }

    const queryString = urlSearchParams.toString();
    if (addParamsEvenIfEmpty || (queryString && href)) {
      href = (href || "") + `?${queryString}`;
    }
    this.set("hrefLink", href);

    this.set("activeClass", this.active ? "active" : "");
  }

  /**
   * Handle keyboard activation (Enter/Space on link).
   * Marks the activation as keyboard-triggered so focus can move to topic list.
   * Click events with detail=0 are from keyboard activation (Enter/Space).
   */
  @action
  handleClick(event) {
    // event.detail === 0 means click was triggered by keyboard (Enter/Space)
    // event.detail > 0 means it was a real mouse click
    if (event.detail === 0) {
      this.filterFocus.markKeyboardActivation();
    }
  }

  <template>
    <li
      title={{this.content.title}}
      class={{concatClass
        (if this.active "active")
        (if this.content.hasIcon "has-icon")
        this.content.classNames
        (if this.isHidden "hidden")
        this.content.name
      }}
      role="presentation"
      ...attributes
    >
      <a
        href={{this.hrefLink}}
        class={{this.activeClass}}
        role="tab"
        aria-selected={{if this.active "true" "false"}}
        aria-current={{if this.activeClass "page"}}
        {{on "click" this.handleClick}}
      >
        {{#if this.hasIcon}}
          <span class={{this.content.name}}></span>
        {{/if}}
        {{this.content.displayName}}
      </a>
    </li>
  </template>
}
