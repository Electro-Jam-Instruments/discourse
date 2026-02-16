import { registerDestructor } from "@ember/destroyable";
import { service } from "@ember/service";
import Modifier from "ember-modifier";
import {
  getNextIndex,
  getPreviousIndex,
  updateRovingTabindex,
} from "discourse/lib/keyboard-navigation-utils";

/**
 * Sidebar tree navigation modifier implementing WAI-ARIA tree pattern
 * for keyboard navigation within the sidebar.
 *
 * @component SidebarTreeNavigationModifier
 *
 * Keyboard Support:
 * - Arrow Up/Down: Move between visible tree items (with wrapping)
 * - Arrow Right: Expand collapsed section (when not in nested toolbar)
 * - Arrow Left: Collapse expanded section, or move to parent section header (when not in nested toolbar)
 * - Enter/Space: Activate link, toggle section expand/collapse, or open popup
 * - Home: First visible tree item
 * - End: Last visible tree item
 * - Escape: Close popup menu (when open)
 *
 * Tab Behavior:
 * - Single tab stop for entire tree (roving tabindex)
 * - Tab enters tree at selected item (aria-selected="true") or first item
 * - Internal focusable elements have tabindex="-1"
 *
 * Nested Toolbar Support:
 * - Section headers may contain a nested toolbar (collapse button + edit button)
 * - When focus is inside a toolbar, left/right arrows are passed through
 *   to allow the toolbar navigation to handle them
 * - This enables keyboard users to navigate between the collapse and edit buttons
 */
export default class SidebarTreeNavigationModifier extends Modifier {
  @service keyboardNavigation;

  element = null;
  activeItemIndex = 0;
  options = {
    treeitemSelector: '[role="treeitem"]',
    groupSelector: '[role="group"]',
    wrap: true,
  };

  constructor(owner, args) {
    super(owner, args);
    registerDestructor(this, (instance) => instance.cleanup());
  }

  modify(element, positional, named) {
    if (!this.keyboardNavigation.isEnabled) {
      this.cleanup();
      return;
    }

    if (this.element !== element) {
      this.cleanup();
      this.element = element;

      this.handleKeydown = this.handleKeydown.bind(this);
      this.handleFocusIn = this.handleFocusIn.bind(this);

      this.element.addEventListener("keydown", this.handleKeydown);
      this.element.addEventListener("focusin", this.handleFocusIn);

      // Find initially selected item or default to first
      const selectedItem = this.element.querySelector(
        '[role="treeitem"][aria-selected="true"]'
      );
      if (selectedItem) {
        const items = this.visibleTreeItems;
        const selectedIndex = items.indexOf(selectedItem);
        if (selectedIndex !== -1) {
          this.activeItemIndex = selectedIndex;
        }
      }
    }

    this.options = { ...this.options, ...named };

    // Preserve focus if currently focused element is in the tree
    const focusedElement = document.activeElement;
    if (focusedElement && this.element.contains(focusedElement)) {
      const items = this.visibleTreeItems;
      const focusedIndex = items.indexOf(focusedElement);
      if (focusedIndex !== -1) {
        this.activeItemIndex = focusedIndex;
      }
    }

    // Ensure activeItemIndex is valid
    const items = this.visibleTreeItems;
    if (
      items.length > 0 &&
      (this.activeItemIndex < 0 || this.activeItemIndex >= items.length)
    ) {
      this.activeItemIndex = 0;
    }

    this.updateTabindices();
    this.setInternalTabindices();
  }

  /**
   * Set tabindex="-1" on all internal focusable elements
   * Ensures single tab stop for the entire tree
   */
  setInternalTabindices() {
    const focusableSelector =
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const allFocusables = this.element.querySelectorAll(focusableSelector);
    const treeItems = this.visibleTreeItems;

    allFocusables.forEach((el) => {
      // Don't modify tabindex on treeitem elements
      if (!treeItems.includes(el)) {
        // Don't manage if inside a toolbar (has parent with role="toolbar")
        // These have their own keyboard navigation via toolbarNavigation modifier
        if (el.closest('[role="toolbar"]')) {
          return;
        }
        // Don't manage if in panel header (outside the tree structure)
        if (el.closest('.sidebar-panel-header')) {
          return;
        }
        el.setAttribute("tabindex", "-1");
      }
    });
  }

  /**
   * Get all visible tree items (not inside collapsed sections)
   * Items inside collapsed sections (aria-expanded="false") are excluded
   */
  get visibleTreeItems() {
    const allItems = Array.from(
      this.element.querySelectorAll(this.options.treeitemSelector)
    );

    return allItems.filter((item) => {
      // Check if item is inside a collapsed group
      let parent = item.parentElement;
      while (parent && parent !== this.element) {
        if (parent.getAttribute("role") === "group") {
          // Find the parent treeitem that controls this group
          const controllingItem = parent.previousElementSibling;
          if (
            controllingItem &&
            controllingItem.getAttribute("aria-expanded") === "false"
          ) {
            return false;
          }
        }
        parent = parent.parentElement;
      }
      return true;
    });
  }

  /**
   * Check if an item is a section header (has aria-expanded)
   */
  isSectionHeader(item) {
    return item.hasAttribute("aria-expanded");
  }

  /**
   * Check if an item is expanded
   */
  isExpanded(item) {
    return item.getAttribute("aria-expanded") === "true";
  }

  /**
   * Check if an item has a popup (aria-haspopup)
   */
  hasPopup(item) {
    return item.hasAttribute("aria-haspopup");
  }

  /**
   * Get the parent section header for a given item
   */
  getParentSectionHeader(item) {
    let parent = item.parentElement;
    while (parent && parent !== this.element) {
      if (parent.getAttribute("role") === "group") {
        const controllingItem = parent.previousElementSibling;
        if (
          controllingItem &&
          controllingItem.getAttribute("role") === "treeitem"
        ) {
          return controllingItem;
        }
      }
      parent = parent.parentElement;
    }
    return null;
  }

  handleKeydown(event) {
    const { key } = event;
    let handled = false;

    // Check if focus is inside a nested toolbar (section header with edit button)
    // If so, let the toolbar handle left/right arrows to navigate between buttons
    const inToolbar = event.target.closest('[role="toolbar"]');

    switch (key) {
      case "ArrowDown":
        this.focusNextItem();
        handled = true;
        break;

      case "ArrowUp":
        this.focusPreviousItem();
        handled = true;
        break;

      case "ArrowRight":
        // If in a toolbar, let the toolbar handle left/right navigation
        // between buttons (e.g., collapse button and edit button)
        if (!inToolbar) {
          this.expandOrDoNothing();
          handled = true;
        }
        break;

      case "ArrowLeft":
        // If in a toolbar, let the toolbar handle left/right navigation
        if (!inToolbar) {
          this.collapseOrMoveToParent();
          handled = true;
        }
        break;

      case "Home":
        this.focusFirstItem();
        handled = true;
        break;

      case "End":
        this.focusLastItem();
        handled = true;
        break;

      case "Enter":
      case " ":
        this.activateCurrentItem();
        handled = true;
        break;

      case "Escape":
        this.closePopup();
        handled = true;
        break;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  handleFocusIn(event) {
    const item = event.target.closest(this.options.treeitemSelector);
    if (item) {
      const items = this.visibleTreeItems;
      const itemIndex = items.indexOf(item);
      if (itemIndex !== -1 && itemIndex !== this.activeItemIndex) {
        this.activeItemIndex = itemIndex;
        this.updateTabindices();
      }
    }
  }

  focusNextItem() {
    const items = this.visibleTreeItems;
    const newIndex = getNextIndex(
      items,
      this.activeItemIndex,
      this.options.wrap
    );
    if (newIndex !== this.activeItemIndex) {
      this.focusItem(newIndex);
    }
  }

  focusPreviousItem() {
    const items = this.visibleTreeItems;
    const newIndex = getPreviousIndex(
      items,
      this.activeItemIndex,
      this.options.wrap
    );
    if (newIndex !== this.activeItemIndex) {
      this.focusItem(newIndex);
    }
  }

  focusFirstItem() {
    this.focusItem(0);
  }

  focusLastItem() {
    const items = this.visibleTreeItems;
    this.focusItem(items.length - 1);
  }

  focusItem(index) {
    const items = this.visibleTreeItems;
    if (index >= 0 && index < items.length) {
      this.activeItemIndex = index;
      this.updateTabindices();
      items[index].focus();
    }
  }

  /**
   * Arrow Right: Expand collapsed section
   * If on collapsed section header, expand it
   * If already expanded or not a section header, do nothing
   */
  expandOrDoNothing() {
    const items = this.visibleTreeItems;
    const currentItem = items[this.activeItemIndex];
    if (!currentItem) {
      return;
    }

    if (this.isSectionHeader(currentItem) && !this.isExpanded(currentItem)) {
      // Trigger expand action
      currentItem.click();
    }
    // If expanded or not a section header, do nothing
  }

  /**
   * Arrow Left: Collapse expanded section or move to parent
   * If on expanded section header, collapse it
   * If on child item, move focus to parent section header
   * If on collapsed section header, do nothing
   */
  collapseOrMoveToParent() {
    const items = this.visibleTreeItems;
    const currentItem = items[this.activeItemIndex];
    if (!currentItem) {
      return;
    }

    if (this.isSectionHeader(currentItem)) {
      if (this.isExpanded(currentItem)) {
        // Collapse the section
        currentItem.click();
      }
      // If collapsed, do nothing
    } else {
      // Move to parent section header
      const parentHeader = this.getParentSectionHeader(currentItem);
      if (parentHeader) {
        const parentIndex = items.indexOf(parentHeader);
        if (parentIndex !== -1) {
          this.focusItem(parentIndex);
        }
      }
    }
  }

  /**
   * Enter/Space: Activate current item
   * - For links: navigate to the destination
   * - For section headers: toggle expand/collapse
   * - For popup triggers: open the popup
   */
  activateCurrentItem() {
    const items = this.visibleTreeItems;
    const currentItem = items[this.activeItemIndex];
    if (!currentItem) {
      return;
    }

    // Click the item to activate it
    // This works for links, section toggles, and popup triggers
    currentItem.click();
  }

  /**
   * Escape: Close popup (handled by FloatKit/DMenu, but we ensure focus returns)
   */
  closePopup() {
    // FloatKit handles popup closing, but we can ensure focus returns
    // to the trigger element if a popup is open
    const items = this.visibleTreeItems;
    const currentItem = items[this.activeItemIndex];
    if (currentItem && this.hasPopup(currentItem)) {
      // The popup's escape handler should close it
      // We just ensure focus is on the trigger
      currentItem.focus();
    }
  }

  updateTabindices() {
    const items = this.visibleTreeItems;
    updateRovingTabindex(items, this.activeItemIndex);
  }

  cleanup() {
    if (this.element) {
      this.element.removeEventListener("keydown", this.handleKeydown);
      this.element.removeEventListener("focusin", this.handleFocusIn);
    }
  }
}
