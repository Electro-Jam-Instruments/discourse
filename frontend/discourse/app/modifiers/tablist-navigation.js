import { registerDestructor } from "@ember/destroyable";
import Modifier from "ember-modifier";
import { bind } from "discourse/lib/decorators";

/**
 * Tablist navigation modifier implementing WAI-ARIA tablist pattern
 * with roving tabindex for single-tab-stop keyboard navigation.
 *
 * This modifier enables arrow key navigation between tab items,
 * making the tablist a single tab stop while allowing internal navigation
 * with arrow keys, Home, and End.
 *
 * Based on WAI-ARIA tablist pattern:
 * - Left/Right arrows move between tabs (horizontal)
 * - Up/Down arrows move between tabs (vertical)
 * - Home moves to first tab
 * - End moves to last tab
 * - Tab exits the tablist (single tab stop)
 *
 * @component TablistNavigationModifier
 * @param {string} itemSelector - CSS selector for tab items (default: "[role='tab'], a, button")
 * @param {boolean} horizontal - Navigation direction, true for horizontal (default: true)
 * @param {boolean} wrap - Whether to wrap around at ends (default: true)
 *
 * @example
 * // Basic usage on a tablist
 * <ul role="tablist" {{tablistNavigation}}>
 *   <li role="tab"><a href="/latest">Latest</a></li>
 *   <li role="tab"><a href="/hot">Hot</a></li>
 * </ul>
 *
 * @example
 * // Vertical tablist
 * <div role="tablist" aria-orientation="vertical" {{tablistNavigation horizontal=false}}>
 *   <button role="tab">Tab 1</button>
 *   <button role="tab">Tab 2</button>
 * </div>
 */
export default class TablistNavigationModifier extends Modifier {
  /**
   * The DOM element the modifier is attached to
   * @type {HTMLElement|null}
   */
  element = null;

  /**
   * The index of the currently active (focusable) tab
   * @type {number}
   */
  activeIndex = 0;

  /**
   * Configuration options for the tablist navigation
   * @type {{itemSelector: string, horizontal: boolean, wrap: boolean}}
   */
  options = {
    itemSelector: "[role='tab'], a, button",
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
    // Only set up listeners once
    if (this.element !== element) {
      this.cleanup();
      this.element = element;
      this.element.addEventListener("keydown", this.handleKeydown);
      this.element.addEventListener("focusin", this.handleFocusIn);
    }

    this.options = { ...this.options, ...named };

    // Try to preserve focus on the currently focused item if it's in the tablist
    const focusedElement = document.activeElement;
    const items = this.items;
    const focusedIndex = items.indexOf(focusedElement);
    if (focusedIndex !== -1) {
      this.activeIndex = focusedIndex;
    } else {
      // If no item is focused, find the active/selected tab and set activeIndex to it
      // This ensures the roving tabindex starts at the currently selected tab
      const activeTabIndex = items.findIndex(
        (item) =>
          item.getAttribute("aria-selected") === "true" ||
          item.classList.contains("active")
      );
      if (activeTabIndex !== -1) {
        this.activeIndex = activeTabIndex;
      }
    }

    this.updateTabindices();
  }

  /**
   * Returns all focusable tab items that are not disabled
   * and are currently visible (have a rendered parent)
   * @returns {HTMLElement[]}
   */
  get items() {
    return Array.from(
      this.element.querySelectorAll(this.options.itemSelector)
    ).filter((item) => !item.disabled && item.offsetParent !== null);
  }

  /**
   * Handles keydown events to manage arrow key navigation within the tablist
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
   * Moves focus to the next item in the tablist.
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
   * Moves focus to the previous item in the tablist.
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
   * Moves focus to the first item in the tablist
   */
  focusFirstItem() {
    this.focusItem(0);
  }

  /**
   * Moves focus to the last item in the tablist
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
   * Also ensures activeIndex is within valid bounds if items have changed.
   */
  updateTabindices() {
    const items = this.items;
    if (items.length === 0) {
      return;
    }

    // Ensure activeIndex is valid (items might have changed)
    if (this.activeIndex < 0 || this.activeIndex >= items.length) {
      this.activeIndex = 0;
    }

    items.forEach((item, index) => {
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
