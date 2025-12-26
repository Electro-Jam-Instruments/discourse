import { registerDestructor } from "@ember/destroyable";
import Modifier from "ember-modifier";
import { bind } from "discourse/lib/decorators";

/**
 * Toolbar navigation modifier implementing WAI-ARIA toolbar pattern
 * with roving tabindex for single-tab-stop keyboard navigation.
 *
 * This modifier enables arrow key navigation between toolbar items,
 * making the toolbar a single tab stop while allowing internal navigation
 * with arrow keys, Home, and End.
 *
 * @component ToolbarNavigationModifier
 * @param {string} itemSelector - CSS selector for toolbar items (default: "a, button, summary")
 * @param {boolean} horizontal - Navigation direction, true for horizontal (default: true)
 * @param {boolean} wrap - Whether to wrap around at ends (default: true)
 *
 * @example
 * // Basic usage on a navigation toolbar
 * <ul role="toolbar" {{toolbarNavigation}}>
 *   <li><a href="/latest">Latest</a></li>
 *   <li><a href="/hot">Hot</a></li>
 *   <li><button>Action</button></li>
 * </ul>
 *
 * @example
 * // With custom options
 * <div role="toolbar" {{toolbarNavigation
 *   itemSelector="button, [role='menuitem']"
 *   horizontal=true
 *   wrap=false
 * }}>
 *   ...
 * </div>
 */
export default class ToolbarNavigationModifier extends Modifier {
  /**
   * The DOM element the modifier is attached to
   * @type {HTMLElement|null}
   */
  element = null;

  /**
   * The index of the currently active (focusable) item
   * @type {number}
   */
  activeIndex = 0;

  /**
   * Configuration options for the toolbar navigation
   * @type {{itemSelector: string, horizontal: boolean, wrap: boolean}}
   */
  options = {
    itemSelector: "a, button, summary",
    horizontal: true,
    wrap: true,
  };

  /**
   * @param {object} owner - The owner object
   * @param {object} args - Arguments passed to the modifier
   */
  constructor(owner, args) {
    super(owner, args);
    registerDestructor(this, (instance) => instance.cleanup());
  }

  /**
   * Applies the modifier to the element and sets up event listeners
   * @param {HTMLElement} element - The DOM element to apply the modifier to
   * @param {Array} positional - Positional arguments (unused)
   * @param {object} named - Named arguments for configuration options
   */
  modify(element, positional, named) {
    this.element = element;
    this.options = { ...this.options, ...named };

    this.element.addEventListener("keydown", this.handleKeydown);
    this.element.addEventListener("focusin", this.handleFocusIn);

    this.updateTabindices();
  }

  /**
   * Returns all focusable items within the toolbar that are not disabled
   * and are currently visible (have a rendered parent)
   * @returns {HTMLElement[]}
   */
  get items() {
    return Array.from(
      this.element.querySelectorAll(this.options.itemSelector)
    ).filter((item) => !item.disabled && item.offsetParent !== null);
  }

  /**
   * Handles keydown events to manage arrow key navigation within the toolbar
   * @param {KeyboardEvent} event - The keyboard event
   */
  @bind
  handleKeydown(event) {
    const { key } = event;
    const isHorizontal = this.options.horizontal;

    let handled = false;

    switch (key) {
      case isHorizontal ? "ArrowRight" : "ArrowDown":
        this.focusNextItem();
        handled = true;
        break;
      case isHorizontal ? "ArrowLeft" : "ArrowUp":
        this.focusPreviousItem();
        handled = true;
        break;
      case "Home":
        this.focusFirstItem();
        handled = true;
        break;
      case "End":
        this.focusLastItem();
        handled = true;
        break;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  /**
   * Handles focusin events to track which item received focus
   * and update tabindices accordingly
   * @param {FocusEvent} event - The focus event
   */
  @bind
  handleFocusIn(event) {
    const index = this.items.indexOf(event.target);
    if (index !== -1) {
      this.activeIndex = index;
      this.updateTabindices();
    }
  }

  /**
   * Moves focus to the next item in the toolbar.
   * Wraps to the first item if at the end and wrap option is enabled.
   */
  focusNextItem() {
    const items = this.items;
    let nextIndex = this.activeIndex + 1;

    if (nextIndex >= items.length) {
      nextIndex = this.options.wrap ? 0 : items.length - 1;
    }

    this.focusItem(nextIndex);
  }

  /**
   * Moves focus to the previous item in the toolbar.
   * Wraps to the last item if at the beginning and wrap option is enabled.
   */
  focusPreviousItem() {
    const items = this.items;
    let prevIndex = this.activeIndex - 1;

    if (prevIndex < 0) {
      prevIndex = this.options.wrap ? items.length - 1 : 0;
    }

    this.focusItem(prevIndex);
  }

  /**
   * Moves focus to the first item in the toolbar
   */
  focusFirstItem() {
    this.focusItem(0);
  }

  /**
   * Moves focus to the last item in the toolbar
   */
  focusLastItem() {
    this.focusItem(this.items.length - 1);
  }

  /**
   * Focuses the item at the specified index and updates tabindices
   * @param {number} index - The index of the item to focus
   */
  focusItem(index) {
    const items = this.items;
    if (index >= 0 && index < items.length) {
      this.activeIndex = index;
      this.updateTabindices();
      items[index].focus();
    }
  }

  /**
   * Updates tabindex attributes on all items to implement roving tabindex.
   * Only the active item has tabindex="0", all others have tabindex="-1".
   */
  updateTabindices() {
    this.items.forEach((item, index) => {
      item.setAttribute("tabindex", index === this.activeIndex ? "0" : "-1");
    });
  }

  /**
   * Cleanup method called when the modifier is destroyed.
   * Removes all event listeners from the element.
   */
  cleanup() {
    this.element?.removeEventListener("keydown", this.handleKeydown);
    this.element?.removeEventListener("focusin", this.handleFocusIn);
  }
}
