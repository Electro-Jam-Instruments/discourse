import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { on } from "@ember/modifier";
import { action } from "@ember/object";
import didInsert from "@ember/render-modifiers/modifiers/did-insert";
import willDestroy from "@ember/render-modifiers/modifiers/will-destroy";
import dRovingFocus from "discourse/ui-kit/modifiers/d-roving-focus";
import { i18n } from "discourse-i18n";

const ITEM = '[role="treeitem"]';
const SECTION = ".sidebar-section";
const HEADER = ".sidebar-section-header";
const HEADER_ROW = ".sidebar-section-header-wrapper";
const HEADER_ACTIONS =
  ".sidebar-section-header-button, .sidebar-section-header-dropdown";
const HOVER_BUTTON = ".sidebar-section-hover-button";
const NESTED_ACTIONS = `${HOVER_BUTTON}, ${HEADER_ACTIONS}`;

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
  @tracked currentPage = null;

  #observer = null;
  #api = null;
  #element = null;
  #menuKeyDown = false;

  @action
  watch(element) {
    this.#element = element;
    this.#removeNestedTabStops();
    this.currentPage = this.#currentPageKey();

    this.#observer = new MutationObserver(() => {
      this.#removeNestedTabStops();
      this.revision++;
      this.currentPage = this.#currentPageKey();
    });
    this.#observer.observe(element, {
      attributeFilter: ["aria-current"],
      attributes: true,
      childList: true,
      subtree: true,
    });
  }

  @action
  unwatch() {
    this.#observer?.disconnect();
    this.#observer = null;
    this.#element = null;
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
        this.#toggle(item);
        return true;
      }

      if (isHeader) {
        const headerAction = item
          .closest(HEADER_ROW)
          ?.querySelector(HEADER_ACTIONS);
        if (headerAction) {
          headerAction.focus();
          return true;
        }

        return false;
      }

      const hoverButton = item.querySelector(HOVER_BUTTON);
      if (hoverButton) {
        hoverButton.focus();
        return true;
      }

      return false;
    }

    if (isHeader && expanded === "true") {
      this.#toggle(item);
      return true;
    }

    const parent = this.#parentHeader(item);
    return parent ? this.#api?.focusElement(parent) : false;
  }

  @action
  handleKey(event) {
    const target = event.target;
    const headerAction = target.closest(HEADER_ACTIONS);

    if (headerAction && !headerAction.closest(ITEM)) {
      this.#headerActionKey(headerAction, event);
      return;
    }

    if (event.key === " " && target.matches(`${HEADER}${ITEM}`)) {
      event.preventDefault();
      this.#toggle(target);
      return;
    }

    if (
      event.key === "ContextMenu" ||
      (event.shiftKey && event.key === "F10")
    ) {
      this.#openMenu(target, event);
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const items = this.#api?.items() ?? [];
      const item = target.closest(ITEM);
      const edge = event.key === "ArrowUp" ? items[0] : items.at(-1);
      if (item && item === edge) {
        event.preventDefault();
      }
    }
  }

  @action
  endKey() {
    this.#menuKeyDown = false;
  }

  @action
  suppressNativeMenu(event) {
    if (this.#menuKeyDown) {
      event.preventDefault();
    }
  }

  #openMenu(target, event) {
    const item = target.closest(ITEM);
    if (!item) {
      return;
    }

    const button = item.matches(HEADER)
      ? item
          .closest(HEADER_ROW)
          ?.querySelector(".sidebar-section-header-dropdown")
      : item.querySelector(HOVER_BUTTON);

    if (button) {
      event.preventDefault();
      this.#menuKeyDown = true;
      button.click();
    }
  }

  // A header's own buttons sit beside its tree item, so the engine does not
  // see keys pressed on them.
  #headerActionKey(button, event) {
    const row = button.closest(HEADER_ROW);
    const actions = [...row.querySelectorAll(HEADER_ACTIONS)];
    const header = row.querySelector(`${HEADER}${ITEM}`);
    const items = this.#api?.items() ?? [];
    const at = items.indexOf(header);
    const index = actions.indexOf(button);

    let destination;
    switch (event.key) {
      case "ArrowLeft":
        destination = index > 0 ? actions[index - 1] : header;
        break;
      case "ArrowRight":
        destination = actions[index + 1];
        break;
      case "ArrowDown":
        destination = items[at + 1];
        break;
      case "ArrowUp":
        destination = items[at - 1];
        break;
      case "Home":
        destination = items[0];
        break;
      case "End":
        destination = items.at(-1);
        break;
      default:
        return;
    }

    event.preventDefault();
    destination?.focus();
  }

  #parentHeader(item) {
    let section = item.closest(SECTION);
    if (item.matches(HEADER)) {
      section = section?.parentElement?.closest(SECTION);
    }

    while (section) {
      const header = section.querySelector(
        `:scope > ${HEADER_ROW} ${HEADER}${ITEM}`
      );
      if (header) {
        return header;
      }
      section = section.parentElement?.closest(SECTION);
    }

    return null;
  }

  #currentPageKey() {
    return (
      this.#element?.querySelector("[aria-current]")?.getAttribute("href") ??
      null
    );
  }

  // A click drops focus from the header; Enter on the button keeps it.
  #toggle(header) {
    header.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      })
    );
  }

  #removeNestedTabStops() {
    this.#element
      ?.querySelectorAll(NESTED_ACTIONS)
      .forEach((button) => button.setAttribute("tabindex", "-1"));
  }

  <template>
    <div
      aria-label={{i18n "sidebar.title"}}
      role="tree"
      ...attributes
      {{didInsert this.watch}}
      {{willDestroy this.unwatch}}
      {{on "keydown" this.handleKey}}
      {{on "keyup" this.endKey}}
      {{on "contextmenu" this.suppressNativeMenu}}
      {{dRovingFocus
        entryFocus="selected-or-first"
        itemSelector=ITEM
        itemsKey=this.revision
        onCrossAxis=this.crossAxis
        onRegisterApi=this.registerApi
        orientation="vertical"
        resetKey=this.currentPage
      }}
    >
      {{yield}}
    </div>
  </template>
}
