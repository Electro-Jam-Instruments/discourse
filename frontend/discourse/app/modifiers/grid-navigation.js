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
 * - Enter: Activate current row (navigate to topic)
 * - Home: First row
 * - End: Last row
 * - Page Up/Down: Jump multiple rows
 */
export default class GridNavigationModifier extends Modifier {
  element = null;
  activeRowIndex = 0;
  options = {
    rowSelector: 'tbody tr[role="row"]',
    pageSize: 10,
    wrap: false,
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

      case "Home":
        this.focusFirstRow();
        handled = true;
        break;

      case "End":
        this.focusLastRow();
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
        this.activateCurrentRow();
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
      const index = this.rows.indexOf(row);
      if (index !== -1 && index !== this.activeRowIndex) {
        this.activeRowIndex = index;
        this.updateTabindices();
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
    if (newIndex !== this.activeRowIndex) {
      this.focusRow(newIndex);
    } else if (this.options.onLoadMore) {
      // At boundary - try to load more
      this.options.onLoadMore();
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
      rows[index].focus();
    }
  }

  activateCurrentRow() {
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
