import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { action } from "@ember/object";
import didInsert from "@ember/render-modifiers/modifiers/did-insert";
import willDestroy from "@ember/render-modifiers/modifiers/will-destroy";
import dRovingFocus from "discourse/ui-kit/modifiers/d-roving-focus";
import { i18n } from "discourse-i18n";

const ITEM = '[role="treeitem"]';
const HEADER = ".sidebar-section-header";
const NESTED_ACTIONS =
  ".sidebar-section-hover-button, .sidebar-section-header-button, .sidebar-section-header-dropdown";

/**
 * The sidebar as one tree: a single Tab stop, Up and Down between items, Right
 * and Left to open and close a section or reach an item's own button.
 *
 * Sections, links and plugin content are added from several places and change
 * while the page is open, so the tree watches its own contents instead of
 * keeping a list.
 *
 * @component SidebarTree
 */
export default class SidebarTree extends Component {
  @tracked revision = 0;

  #observer = null;
  #api = null;

  @action
  watch(element) {
    this.#removeNestedTabStops(element);
    this.#observer = new MutationObserver(() => {
      this.#removeNestedTabStops(element);
      this.revision++;
    });
    this.#observer.observe(element, { childList: true, subtree: true });
  }

  @action
  unwatch() {
    this.#observer?.disconnect();
    this.#observer = null;
  }

  @action
  registerApi(api) {
    this.#api = api;
  }

  @action
  crossAxis(direction, item, event) {
    if (event.target !== item && item.contains(event.target)) {
      if (direction === "backward") {
        return this.#api?.focusElement(item);
      }
      return false;
    }

    const isHeader = item.matches(HEADER);
    const expanded = item.getAttribute("aria-expanded");

    if (direction === "forward") {
      if (isHeader && expanded === "false") {
        item.click();
        return true;
      }

      if (isHeader) {
        const first = item
          .closest(".sidebar-section")
          ?.querySelector(`.sidebar-section-content ${ITEM}`);
        return first ? this.#api?.focusElement(first) : false;
      }

      const hoverButton = item.querySelector(".sidebar-section-hover-button");
      if (hoverButton) {
        hoverButton.focus();
        return true;
      }

      return false;
    }

    if (isHeader) {
      if (expanded === "true") {
        item.click();
        return true;
      }
      return false;
    }

    const header = item
      .closest(".sidebar-section")
      ?.querySelector(`${HEADER}${ITEM}`);
    return header ? this.#api?.focusElement(header) : false;
  }

  @action
  openMenu(event) {
    if (
      event.key !== "ContextMenu" &&
      !(event.shiftKey && event.key === "F10")
    ) {
      return;
    }

    const item = event.target.closest(ITEM);
    if (!item) {
      return;
    }

    const button = item.matches(HEADER)
      ? item
          .closest(".sidebar-section-header-wrapper")
          ?.querySelector(NESTED_ACTIONS)
      : item.querySelector(".sidebar-section-hover-button");

    if (button) {
      event.preventDefault();
      button.click();
    }
  }

  #removeNestedTabStops(element) {
    element
      .querySelectorAll(NESTED_ACTIONS)
      .forEach((button) => button.setAttribute("tabindex", "-1"));
  }

  <template>
    <div
      aria-label={{i18n "sidebar.aria_label"}}
      role="tree"
      ...attributes
      {{didInsert this.watch}}
      {{willDestroy this.unwatch}}
      {{on "keydown" this.openMenu}}
      {{dRovingFocus
        entryFocus="selected-or-first"
        itemSelector=ITEM
        itemsKey=this.revision
        onCrossAxis=this.crossAxis
        onRegisterApi=this.registerApi
        orientation="vertical"
        typeAhead=true
        wrap=true
      }}
    >
      {{yield}}
    </div>
  </template>
}
