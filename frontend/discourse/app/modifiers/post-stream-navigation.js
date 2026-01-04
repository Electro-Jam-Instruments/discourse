import { registerDestructor } from "@ember/destroyable";
import Modifier from "ember-modifier";
import {
  getNextIndex,
  getPreviousIndex,
  updateRovingTabindex,
} from "discourse/lib/keyboard-navigation-utils";

/**
 * Post stream navigation modifier implementing WAI-ARIA grid pattern
 * for keyboard navigation within topic post lists.
 *
 * @component PostStreamNavigationModifier
 *
 * Keyboard Support:
 * - Arrow Up/Down: Move between posts
 * - Arrow Left/Right: Move between focusable elements within current row
 *   - When at leftmost position, focuses entire row (highlights full rectangle)
 *   - Continues into toolbar buttons when reaching actions area
 * - Ctrl+Enter: Enter document mode for reading post content
 * - Enter: Activate current focused element (clicks buttons)
 * - Home: First post (Ctrl+Home: first focusable in row)
 * - End: Last post (Ctrl+End: last focusable in row)
 * - Page Up/Down: Jump multiple posts
 * - Escape: Exit document mode or return to row focus
 *
 * Tab Behavior:
 * - Single tab stop for entire grid (roving tabindex)
 * - Tab enters grid at first post
 * - Internal focusable elements have tabindex="-1"
 */
export default class PostStreamNavigationModifier extends Modifier {
  element = null;
  activeRowIndex = 0;
  activeFocusableIndex = -1; // -1 means the row itself is focused (full highlight)
  inDocumentMode = false;
  options = {
    rowSelector: '.topic-post[role="row"]',
    focusableSelector:
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    toolbarSelector: '.actions[role="toolbar"]',
    documentSelector: '.cooked[role="document"]',
    pageSize: 5,
    wrap: false,
  };

  constructor(owner, args) {
    super(owner, args);
    registerDestructor(this, (instance) => instance.cleanup());
  }

  modify(element, positional, named) {
    // Only set up listeners once per element
    if (this.element !== element) {
      this.cleanup();
      this.element = element;

      this.handleKeydown = this.handleKeydown.bind(this);
      this.handleFocusIn = this.handleFocusIn.bind(this);

      this.element.addEventListener("keydown", this.handleKeydown);
      this.element.addEventListener("focusin", this.handleFocusIn);

      this.activeRowIndex = 0;
      this.activeFocusableIndex = -1;
    }

    this.options = { ...this.options, ...named };

    // Preserve focus if currently focused element is in the grid
    const focusedElement = document.activeElement;
    if (focusedElement && this.element.contains(focusedElement)) {
      const rows = this.rows;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i] === focusedElement || rows[i].contains(focusedElement)) {
          this.activeRowIndex = i;
          if (rows[i] === focusedElement) {
            this.activeFocusableIndex = -1;
          } else {
            const focusables = this.getFocusablesInRow(rows[i]);
            const idx = focusables.indexOf(focusedElement);
            if (idx !== -1) {
              this.activeFocusableIndex = idx;
            }
          }
          break;
        }
      }
    }

    // Ensure activeRowIndex is valid
    const rows = this.rows;
    if (
      rows.length > 0 &&
      (this.activeRowIndex < 0 || this.activeRowIndex >= rows.length)
    ) {
      this.activeRowIndex = 0;
    }

    this.updateTabindices();
    this.setInternalTabindices();
  }

  /**
   * Set tabindex="-1" on all internal focusable elements within rows
   * This ensures single tab stop for the entire grid
   */
  setInternalTabindices() {
    const allFocusables = this.element.querySelectorAll(
      this.options.focusableSelector
    );
    const rows = this.rows;
    allFocusables.forEach((el) => {
      // Don't modify tabindex on row elements
      if (!rows.includes(el)) {
        el.setAttribute("tabindex", "-1");
      }
    });
  }

  /**
   * Get all post rows (excludes cloaked/virtualized posts)
   */
  get rows() {
    return Array.from(
      this.element.querySelectorAll(this.options.rowSelector)
    ).filter((row) => !row.closest(".post-stream--cloaked"));
  }

  /**
   * Get all focusable elements within a specific row
   * Includes the avatar cell, content area, and toolbar buttons
   *
   * For regular posts: focuses on .cooked[role="document"] instead of the body gridcell
   * because NVDA has known issues reading aria-label on gridcell elements.
   *
   * For small actions: focuses on the .small-action-desc gridcell since it has simple
   * text content that NVDA can read.
   */
  getFocusablesInRow(row) {
    if (!row) {
      return [];
    }

    const focusables = [];

    // Avatar cell (simple gridcell - NVDA reads this fine)
    const avatarCell = row.querySelector(
      '.topic-avatar[role="gridcell"], .topic-avatar [role="gridcell"]'
    );
    if (avatarCell) {
      focusables.push(avatarCell);
    }

    // For regular posts: cooked content with document role
    // This is where the post content lives - NVDA will read it properly
    const cookedContent = row.querySelector('.cooked[role="document"]');
    if (cookedContent) {
      focusables.push(cookedContent);
    } else {
      // For small actions: the description cell (simple text content)
      const smallActionDesc = row.querySelector(
        '.small-action-desc[role="gridcell"]'
      );
      if (smallActionDesc) {
        focusables.push(smallActionDesc);
      }
    }

    // Toolbar buttons (regular posts have these in .actions toolbar)
    const toolbar = row.querySelector(this.options.toolbarSelector);
    const toolbarButtons = toolbar
      ? Array.from(
          toolbar.querySelectorAll("button:not([disabled]), a[href]")
        )
      : [];

    // Small action buttons (edit, delete, recover)
    const smallActionButtons = row.querySelectorAll(
      ".small-action-buttons button:not([disabled])"
    );

    return [...focusables, ...toolbarButtons, ...Array.from(smallActionButtons)];
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

    // Handle Escape to exit document mode
    if (key === "Escape" && this.inDocumentMode) {
      this.exitDocumentMode();
      event.preventDefault();
      event.stopPropagation();
      return;
    }

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
        // Ctrl+Enter enters document mode for reading post content
        // Plain Enter activates focused element (clicks buttons)
        if (modifier) {
          this.enterDocumentModeForCurrentRow();
          handled = true;
        } else if (this.activeFocusableIndex >= 0) {
          // Only handle plain Enter if on a focusable element (not row)
          this.activateCurrentFocusable();
          handled = true;
        }
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

        // If focus is on the row itself, set focusableIndex to -1 (row focus)
        if (event.target === row) {
          this.activeFocusableIndex = -1;
        } else {
          // Track which focusable element has focus within the row
          const focusables = this.getFocusablesInRow(row);
          const focusableIndex = focusables.indexOf(event.target);
          if (focusableIndex !== -1) {
            this.activeFocusableIndex = focusableIndex;
          }
        }
      }
    }
  }

  focusNextRow() {
    const rows = this.rows;
    const newIndex = getNextIndex(
      rows,
      this.activeRowIndex,
      this.options.wrap
    );

    if (newIndex !== this.activeRowIndex) {
      this.focusRow(newIndex);
    }
  }

  focusPreviousRow() {
    const rows = this.rows;
    const newIndex = getPreviousIndex(
      rows,
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
      this.activeFocusableIndex = -1; // Row itself is focused
      this.inDocumentMode = false;
      this.updateTabindices();

      rows[index].focus();
    }
  }

  /**
   * Focus next focusable element within current row
   * If currently at row focus (-1), moves to first cell (avatar)
   * Continues through cells and toolbar buttons
   */
  focusNextFocusableInRow() {
    const focusables = this.currentRowFocusables;
    if (focusables.length === 0) {
      return;
    }

    let newIndex;
    if (this.activeFocusableIndex === -1) {
      // Currently at row focus, move to first focusable (avatar cell)
      newIndex = 0;
    } else {
      newIndex = getNextIndex(
        focusables,
        this.activeFocusableIndex,
        this.options.wrap
      );
      // If we've wrapped and we're not wrapping, stay at last
      if (!this.options.wrap && newIndex === this.activeFocusableIndex) {
        return;
      }
    }

    if (newIndex !== this.activeFocusableIndex) {
      this.activeFocusableIndex = newIndex;
      focusables[newIndex].focus();
    }
  }

  /**
   * Focus previous focusable element within current row
   * If at first focusable (index 0), moves back to row focus (-1)
   */
  focusPreviousFocusableInRow() {
    const focusables = this.currentRowFocusables;
    if (focusables.length === 0) {
      return;
    }

    // If already at row focus, do nothing
    if (this.activeFocusableIndex === -1) {
      return;
    }

    // If at first focusable, go back to row focus
    if (this.activeFocusableIndex === 0) {
      this.activeFocusableIndex = -1;
      this.rows[this.activeRowIndex].focus();
      return;
    }

    const newIndex = getPreviousIndex(
      focusables,
      this.activeFocusableIndex,
      this.options.wrap
    );

    if (newIndex !== this.activeFocusableIndex) {
      this.activeFocusableIndex = newIndex;
      focusables[newIndex].focus();
    }
  }

  /**
   * Focus first focusable element in current row (row focus for full highlight)
   */
  focusFirstFocusableInRow() {
    this.activeFocusableIndex = -1;
    this.rows[this.activeRowIndex].focus();
  }

  /**
   * Focus last focusable element in current row (last toolbar button)
   */
  focusLastFocusableInRow() {
    const focusables = this.currentRowFocusables;
    if (focusables.length > 0) {
      this.activeFocusableIndex = focusables.length - 1;
      focusables[focusables.length - 1].focus();
    }
  }

  /**
   * Activate the currently focused element
   * If focus is on row itself (activeFocusableIndex === -1), enter document mode
   * If focus is on the document element, enter document mode
   * Otherwise click the focused element (toolbar buttons, avatar cell)
   */
  activateCurrentFocusable() {
    const row = this.rows[this.activeRowIndex];
    if (!row) {
      return;
    }

    // If a specific focusable element is focused
    if (this.activeFocusableIndex >= 0) {
      const focusables = this.currentRowFocusables;
      if (this.activeFocusableIndex < focusables.length) {
        const element = focusables[this.activeFocusableIndex];
        // If it's the document element (cooked content), enter document mode
        if (element.getAttribute("role") === "document") {
          this.enterDocumentMode(row);
          return;
        }
        // Otherwise click the element (toolbar buttons, avatar cell)
        element.click();
        return;
      }
    }

    // Row is focused - enter document mode for reading post content
    this.enterDocumentMode(row);
  }

  /**
   * Enter document mode for the current active row
   * Called by Ctrl+Enter keyboard shortcut
   */
  enterDocumentModeForCurrentRow() {
    const row = this.rows[this.activeRowIndex];
    if (row) {
      this.enterDocumentMode(row);
    }
  }

  /**
   * Enter document mode - focus moves to .cooked content
   * Allows screen reader virtual cursor navigation within post content
   */
  enterDocumentMode(row) {
    const documentElement = row.querySelector(this.options.documentSelector);
    if (documentElement) {
      this.inDocumentMode = true;
      documentElement.setAttribute("tabindex", "0");
      documentElement.focus();
    }
  }

  /**
   * Exit document mode - return focus to the row
   */
  exitDocumentMode() {
    const row = this.rows[this.activeRowIndex];
    if (row) {
      this.inDocumentMode = false;
      const documentElement = row.querySelector(this.options.documentSelector);
      if (documentElement) {
        documentElement.setAttribute("tabindex", "-1");
      }
      this.activeFocusableIndex = -1;
      row.focus();
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
