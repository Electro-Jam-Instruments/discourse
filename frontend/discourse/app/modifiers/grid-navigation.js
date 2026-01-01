import { registerDestructor } from "@ember/destroyable";
import Modifier from "ember-modifier";
import {
  getNextIndex,
  getPreviousIndex,
  updateRovingTabindex,
} from "discourse/lib/keyboard-navigation-utils";

/**
 * Grid navigation modifier implementing WAI-ARIA grid pattern
 * for keyboard navigation within topic lists.
 *
 * @component GridNavigationModifier
 *
 * Keyboard Support:
 * - Arrow Up/Down: Move between rows
 * - Arrow Left/Right: Move between focusable elements within current row
 * - Enter: Activate current focused element
 * - Home: First row (Ctrl+Home: first focusable in row)
 * - End: Last row (Ctrl+End: last focusable in row)
 * - Page Up/Down: Jump multiple rows
 */
export default class GridNavigationModifier extends Modifier {
  element = null;
  activeRowIndex = 0;
  activeFocusableIndex = 0;
  options = {
    rowSelector: 'tbody tr[role="row"]',
    focusableSelector: 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    pageSize: 10,
    wrap: false,
    loadMoreThreshold: 3,
  };

  constructor(owner, args) {
    super(owner, args);
    registerDestructor(this, (instance) => instance.cleanup());
  }

  modify(element, positional, named) {
    if (this.element) {
      this.cleanup();
    }

    this.element = element;
    this.options = { ...this.options, ...named };

    this.handleKeydown = this.handleKeydown.bind(this);
    this.handleFocusIn = this.handleFocusIn.bind(this);

    this.element.addEventListener("keydown", this.handleKeydown);
    this.element.addEventListener("focusin", this.handleFocusIn);

    this.updateTabindices();
  }

  get rows() {
    return Array.from(this.element.querySelectorAll(this.options.rowSelector));
  }

  /**
   * Get all focusable elements within a specific row
   */
  getFocusablesInRow(row) {
    if (!row) {
      return [];
    }
    return Array.from(row.querySelectorAll(this.options.focusableSelector));
  }

  /**
   * Get focusable elements in the current active row
   */
  get currentRowFocusables() {
    const row = this.rows[this.activeRowIndex];
    return this.getFocusablesInRow(row);
  }

  handleKeydown(event) {
    const { key, ctrlKey, metaKey } = event;
    const modifier = ctrlKey || metaKey;

    let handled = false;

    switch (key) {
      case "ArrowDown":
        if (modifier) {
          this.focusLastRow();
        } else {
          this.focusNextRow();
        }
        handled = true;
        break;

      case "ArrowUp":
        if (modifier) {
          this.focusFirstRow();
        } else {
          this.focusPreviousRow();
        }
        handled = true;
        break;

      case "ArrowRight":
        if (modifier) {
          this.focusLastFocusableInRow();
        } else {
          this.focusNextFocusableInRow();
        }
        handled = true;
        break;

      case "ArrowLeft":
        if (modifier) {
          this.focusFirstFocusableInRow();
        } else {
          this.focusPreviousFocusableInRow();
        }
        handled = true;
        break;

      case "Home":
        if (modifier) {
          this.focusFirstFocusableInRow();
        } else {
          this.focusFirstRow();
        }
        handled = true;
        break;

      case "End":
        if (modifier) {
          this.focusLastFocusableInRow();
        } else {
          this.focusLastRow();
        }
        handled = true;
        break;

      case "PageDown":
        this.focusRowByOffset(this.options.pageSize);
        handled = true;
        break;

      case "PageUp":
        this.focusRowByOffset(-this.options.pageSize);
        handled = true;
        break;

      case "Enter":
        this.activateCurrentFocusable();
        handled = true;
        break;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  handleFocusIn(event) {
    const row = event.target.closest(this.options.rowSelector);
    if (row) {
      const rowIndex = this.rows.indexOf(row);
      if (rowIndex !== -1) {
        if (rowIndex !== this.activeRowIndex) {
          this.activeRowIndex = rowIndex;
          this.updateTabindices();
        }

        // Track which focusable element has focus within the row
        const focusables = this.getFocusablesInRow(row);
        const focusableIndex = focusables.indexOf(event.target);
        if (focusableIndex !== -1) {
          this.activeFocusableIndex = focusableIndex;
        }
      }
    }
  }

  focusNextRow() {
    const rows = this.rows;
    const newIndex = getNextIndex(
      rows.length,
      this.activeRowIndex,
      this.options.wrap
    );

    // Check if we should trigger load-more (approaching end of list)
    const threshold = this.options.loadMoreThreshold;
    if (this.options.onLoadMore && rows.length - newIndex <= threshold) {
      this.options.onLoadMore();
    }

    if (newIndex !== this.activeRowIndex) {
      this.focusRow(newIndex);
    }
  }

  focusPreviousRow() {
    const rows = this.rows;
    const newIndex = getPreviousIndex(
      rows.length,
      this.activeRowIndex,
      this.options.wrap
    );
    if (newIndex !== this.activeRowIndex) {
      this.focusRow(newIndex);
    }
  }

  focusFirstRow() {
    this.focusRow(0);
  }

  focusLastRow() {
    this.focusRow(this.rows.length - 1);
  }

  focusRowByOffset(offset) {
    const newIndex = Math.max(
      0,
      Math.min(this.rows.length - 1, this.activeRowIndex + offset)
    );
    this.focusRow(newIndex);
  }

  focusRow(index) {
    const rows = this.rows;
    if (index >= 0 && index < rows.length) {
      this.activeRowIndex = index;
      this.updateTabindices();

      // Try to focus the same position in the new row, or first focusable
      const focusables = this.getFocusablesInRow(rows[index]);
      if (focusables.length > 0) {
        // Clamp to available focusables in new row
        const targetIndex = Math.min(this.activeFocusableIndex, focusables.length - 1);
        this.activeFocusableIndex = targetIndex;
        focusables[targetIndex].focus();
      } else {
        // No focusables, focus the row itself
        rows[index].focus();
      }
    }
  }

  /**
   * Focus next focusable element within current row
   */
  focusNextFocusableInRow() {
    const focusables = this.currentRowFocusables;
    if (focusables.length === 0) {
      return;
    }

    const newIndex = getNextIndex(
      focusables.length,
      this.activeFocusableIndex,
      this.options.wrap
    );

    if (newIndex !== this.activeFocusableIndex) {
      this.activeFocusableIndex = newIndex;
      focusables[newIndex].focus();
    }
  }

  /**
   * Focus previous focusable element within current row
   */
  focusPreviousFocusableInRow() {
    const focusables = this.currentRowFocusables;
    if (focusables.length === 0) {
      return;
    }

    const newIndex = getPreviousIndex(
      focusables.length,
      this.activeFocusableIndex,
      this.options.wrap
    );

    if (newIndex !== this.activeFocusableIndex) {
      this.activeFocusableIndex = newIndex;
      focusables[newIndex].focus();
    }
  }

  /**
   * Focus first focusable element in current row
   */
  focusFirstFocusableInRow() {
    const focusables = this.currentRowFocusables;
    if (focusables.length > 0) {
      this.activeFocusableIndex = 0;
      focusables[0].focus();
    }
  }

  /**
   * Focus last focusable element in current row
   */
  focusLastFocusableInRow() {
    const focusables = this.currentRowFocusables;
    if (focusables.length > 0) {
      this.activeFocusableIndex = focusables.length - 1;
      focusables[focusables.length - 1].focus();
    }
  }

  /**
   * Activate (click) the currently focused element
   */
  activateCurrentFocusable() {
    const focusables = this.currentRowFocusables;
    if (focusables.length > 0 && this.activeFocusableIndex < focusables.length) {
      focusables[this.activeFocusableIndex].click();
    } else {
      // Fallback: try to find the topic link
      const row = this.rows[this.activeRowIndex];
      if (row) {
        const topicLink = row.querySelector(".raw-topic-link");
        if (topicLink) {
          topicLink.click();
        } else if (this.options.onRowActivate) {
          const topicId = row.dataset.topicId;
          this.options.onRowActivate(topicId);
        }
      }
    }
  }

  updateTabindices() {
    const rows = this.rows;
    updateRovingTabindex(rows, this.activeRowIndex);
  }

  cleanup() {
    if (this.element) {
      this.element.removeEventListener("keydown", this.handleKeydown);
      this.element.removeEventListener("focusin", this.handleFocusIn);
    }
  }
}
