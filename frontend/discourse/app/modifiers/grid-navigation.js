import { registerDestructor } from "@ember/destroyable";
import { service } from "@ember/service";
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
 * - Arrow Up/Down: Move between rows (includes header row)
 * - Arrow Left/Right: Move between focusable elements within current row
 *   - When at leftmost position, focuses entire row (highlights full rectangle)
 * - Enter: Activate current focused element
 * - Home: First row (Ctrl+Home: first focusable in row)
 * - End: Last row (Ctrl+End: last focusable in row)
 * - Page Up/Down: Jump multiple rows
 *
 * Tab Behavior:
 * - Single tab stop for entire grid (roving tabindex)
 * - Tab enters grid at first data row
 * - Internal focusable elements have tabindex="-1"
 *
 * Auto-Focus:
 * - On initial page load, if user navigated via keyboard, auto-focuses first data row
 * - Uses focusHistory service to detect keyboard mode
 */
export default class GridNavigationModifier extends Modifier {
  @service focusHistory;

  element = null;
  activeRowIndex = 0;
  activeFocusableIndex = -1; // -1 means the row itself is focused (full highlight)
  initialFocusComplete = false; // Track if we've done the initial auto-focus
  options = {
    headerRowSelector: 'thead tr[role="row"]',
    dataRowSelector: 'tbody tr[role="row"]',
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
    // Only set up listeners once per element
    if (this.element !== element) {
      this.cleanup();
      this.element = element;

      this.handleKeydown = this.handleKeydown.bind(this);
      this.handleFocusIn = this.handleFocusIn.bind(this);

      this.element.addEventListener("keydown", this.handleKeydown);
      this.element.addEventListener("focusin", this.handleFocusIn);

      // Start with first data row (not header) as active
      // Header is index 0, first data row is index 1
      const hasHeader = this.element.querySelector(this.options.headerRowSelector);
      this.activeRowIndex = hasHeader ? 1 : 0;
      this.activeFocusableIndex = -1; // Start with row focus, not internal element
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

    // Skip tabindex updates if the grid is being torn down during a route transition.
    // clean-dom-on-route-change sets data-tearing-down on routeWillChange to prevent
    // the browser from auto-focusing a random row when the focused row is removed.
    if (this.element.dataset.tearingDown) {
      return;
    }

    // Ensure activeRowIndex is valid (rows might have changed)
    const rows = this.rows;
    if (rows.length > 0 && (this.activeRowIndex < 0 || this.activeRowIndex >= rows.length)) {
      const hasHeader = this.element.querySelector(this.options.headerRowSelector);
      this.activeRowIndex = hasHeader ? 1 : 0;
    }

    this.updateTabindices();
    this.setInternalTabindices();

    // Auto-focus first data row on initial page load if user navigated via keyboard
    // Skip if focus-history has a pending restore (browser back/forward)
    if (!this.initialFocusComplete && this.focusHistory.keyboardMode && !this.focusHistory.pendingRestore) {
      this.scheduleInitialFocus();
    }
  }

  /**
   * Schedule initial focus to first data row.
   * Uses requestAnimationFrame to ensure DOM is ready after render.
   */
  scheduleInitialFocus() {
    this.initialFocusComplete = true;

    requestAnimationFrame(() => {
      const rows = this.rows;
      if (rows.length === 0) {
        return;
      }

      // CRITICAL: Don't steal focus from other navigation regions
      // If focus is already in a grid, post-stream, or other navigation region, skip auto-focus
      const activeElement = document.activeElement;
      if (activeElement && activeElement !== document.body) {
        const inOtherGrid = activeElement.closest('[role="grid"]');
        const inPostStream = activeElement.closest('.post-stream');
        const inToolbar = activeElement.closest('[role="toolbar"]');
        const inTree = activeElement.closest('[role="tree"]');

        // Only skip if focus is in ANOTHER grid (not this one)
        if ((inOtherGrid && inOtherGrid !== this.element) || inPostStream || inToolbar || inTree) {
          return;
        }
      }

      // Focus first data row (index 1 if header exists, index 0 otherwise)
      const hasHeader = this.element.querySelector(this.options.headerRowSelector);
      const targetIndex = hasHeader && rows.length > 1 ? 1 : 0;

      this.focusRow(targetIndex);
    });
  }

  /**
   * Set tabindex="-1" on all internal focusable elements within rows
   * This ensures single tab stop for the entire grid
   * Excludes row elements themselves - they are managed by updateTabindices()
   */
  setInternalTabindices() {
    const allFocusables = this.element.querySelectorAll(this.options.focusableSelector);
    const rows = this.rows;
    allFocusables.forEach((el) => {
      // Don't modify tabindex on row elements - they're managed by updateTabindices()
      if (!rows.includes(el)) {
        el.setAttribute("tabindex", "-1");
      }
    });
  }

  /**
   * Get all rows including header row
   * Header row is index 0, data rows start at index 1
   */
  get rows() {
    const headerRow = this.element.querySelector(this.options.headerRowSelector);
    const dataRows = Array.from(this.element.querySelectorAll(this.options.dataRowSelector));
    return headerRow ? [headerRow, ...dataRows] : dataRows;
  }

  /**
   * Get only data rows (excludes header)
   */
  get dataRows() {
    return Array.from(this.element.querySelectorAll(this.options.dataRowSelector));
  }

  /**
   * Check if current row is the header row
   */
  get isHeaderRow() {
    return this.activeRowIndex === 0 && this.element.querySelector(this.options.headerRowSelector);
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
    const { key, ctrlKey, metaKey, altKey } = event;
    const modifier = ctrlKey || metaKey;

    // Allow Alt+Arrow for browser navigation (Alt+Left = back, Alt+Right = forward)
    if (altKey) {
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
    // Check if focus is on a row (header or data row)
    const headerRow = event.target.closest(this.options.headerRowSelector);
    const dataRow = event.target.closest(this.options.dataRowSelector);
    const row = headerRow || dataRow;

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
      this.activeFocusableIndex = -1; // Row itself is focused (full highlight)
      this.updateTabindices();

      // Focus the row itself - announces the row's aria-label
      // Shows full rectangle highlight
      // User can then use Right arrow to navigate to internal elements
      rows[index].focus();
    }
  }

  /**
   * Focus next focusable element within current row
   * If currently at row focus (-1), moves to first focusable element
   */
  focusNextFocusableInRow() {
    const focusables = this.currentRowFocusables;
    if (focusables.length === 0) {
      return;
    }

    let newIndex;
    if (this.activeFocusableIndex === -1) {
      // Currently at row focus, move to first focusable
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
   * Focus first focusable element in current row (Ctrl+Home within row)
   * Moves to row focus (-1) for full row highlight
   */
  focusFirstFocusableInRow() {
    this.activeFocusableIndex = -1;
    this.rows[this.activeRowIndex].focus();
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
   * If focus is on row itself (activeFocusableIndex === -1), activate primary action
   */
  activateCurrentFocusable() {
    const row = this.rows[this.activeRowIndex];
    if (!row) {
      return;
    }

    // If a specific focusable element is focused, click it
    if (this.activeFocusableIndex >= 0) {
      const focusables = this.currentRowFocusables;
      if (this.activeFocusableIndex < focusables.length) {
        focusables[this.activeFocusableIndex].click();
        return;
      }
    }

    // Row is focused (activeFocusableIndex === -1) or no focusable found
    // Activate primary action: navigate for data rows, do nothing for header
    if (this.isHeaderRow) {
      // For header row, move focus to first column header
      this.focusNextFocusableInRow();
    } else {
      // For data rows, try to find and click the primary link
      // Topic list uses .raw-topic-link, category list uses .category-title-link
      // Latest sidebar uses a.title
      const primaryLink = row.querySelector(".raw-topic-link, .category-title-link, a.title");
      if (primaryLink) {
        primaryLink.click();
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

      // Blur any focused element within the grid and remove all tabindex="0"
      // This prevents the browser from auto-focusing another row when Ember
      // removes the currently focused row during route transition teardown,
      // which causes a brief visual flash on a random row.
      const focused = this.element.querySelector(":focus");
      if (focused) {
        focused.blur();
      }
      this.rows.forEach((row) => row.setAttribute("tabindex", "-1"));
    }
  }
}
