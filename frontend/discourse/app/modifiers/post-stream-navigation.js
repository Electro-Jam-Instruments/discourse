import { registerDestructor } from "@ember/destroyable";
import { schedule } from "@ember/runloop";
import { service } from "@ember/service";
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
 * - Arrow Left/Right: Move between interactive elements within current row
 *   - Row -> Avatar -> Like -> Share -> Bookmark -> Reply -> etc.
 *   - Post content is NOT in arrow key flow (use Ctrl+Enter to read)
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
  @service focusHistory;

  element = null;
  activeRowIndex = 0;
  activeFocusableIndex = -1; // -1 means the row itself is focused (full highlight)
  inDocumentMode = false;
  initialFocusComplete = false; // Track if we've done the initial auto-focus
  options = {
    // Row selector includes topic header row and post rows
    rowSelector: '.topic-header-row[role="row"], .topic-post[role="row"]',
    focusableSelector:
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    toolbarSelector: '.actions[role="toolbar"]',
    // Selector for cooked content - does NOT require role="document" since that's added dynamically
    cookedSelector: '.cooked',
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
    let focusInCloakedPost = false;

    if (focusedElement && this.element.contains(focusedElement)) {
      // Check if focus is inside a cloaked (virtualized) post
      // Cloaked posts are filtered from rows, so we need to handle this separately
      const cloakedContainer = focusedElement.closest(".post-stream--cloaked");
      if (cloakedContainer) {
        // Focus is in a cloaked post - don't update activeRowIndex
        // This prevents focus jumping when posts get virtualized during scroll
        focusInCloakedPost = true;
      } else {
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
    }

    // Ensure activeRowIndex is valid, but only if focus is not in a cloaked post
    // If focus is in a cloaked post, we preserve the old activeRowIndex to avoid
    // focus jumping when the user presses arrow keys
    const rows = this.rows;
    if (
      !focusInCloakedPost &&
      rows.length > 0 &&
      (this.activeRowIndex < 0 || this.activeRowIndex >= rows.length)
    ) {
      this.activeRowIndex = 0;
    }

    this.updateTabindices();
    this.setInternalTabindices();

    // Auto-focus first unread post on initial load if user navigated via keyboard
    if (!this.initialFocusComplete && this.focusHistory.keyboardMode) {
      this.scheduleInitialFocus(named.lastReadPostNumber);
    }
  }

  /**
   * Schedule auto-focus on first unread post after rendering completes.
   * This is called once when the post stream first loads if user is in keyboard mode.
   *
   * @param {number|null} lastReadPostNumber - The last read post number from topic model
   */
  scheduleInitialFocus(lastReadPostNumber) {
    this.initialFocusComplete = true;

    schedule("afterRender", () => {
      // Use requestAnimationFrame to ensure DOM is fully painted
      requestAnimationFrame(() => {
        this.focusFirstUnreadPost(lastReadPostNumber);
      });
    });
  }

  /**
   * Focus the first unread post in the stream.
   * If all posts are read, focus the first content post (skipping header row).
   * If no posts available, does nothing.
   *
   * @param {number|null} lastReadPostNumber - The last read post number
   */
  focusFirstUnreadPost(lastReadPostNumber) {
    const rows = this.rows;
    if (rows.length === 0) {
      return;
    }

    // Find the first unread post: lastReadPostNumber + 1
    // If lastReadPostNumber is null/0, focus first post (skip header row at index 0)
    const targetPostNumber = (lastReadPostNumber || 0) + 1;

    // Find row with matching post number (data-post-number attribute)
    // Header row at index 0 doesn't have a post number
    let targetIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      const postNumber = parseInt(rows[i].dataset.postNumber, 10);
      if (postNumber === targetPostNumber) {
        targetIndex = i;
        break;
      }
    }

    // If target post not found (all read or post not loaded), focus first content row
    // First content row is at index 1 (index 0 is header row)
    if (targetIndex === -1) {
      targetIndex = rows.length > 1 ? 1 : 0;
    }

    // Focus the target row
    this.focusRow(targetIndex);
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
   * Includes the avatar cell and toolbar buttons only
   *
   * Note: Post content is NOT included in arrow key navigation.
   * Users can press Ctrl+Enter to enter document mode for reading content.
   * This avoids NVDA issues with aria-label on gridcells containing interactive elements.
   *
   * For small actions: the description cell is included since it has simple text content.
   */
  getFocusablesInRow(row) {
    if (!row) {
      return [];
    }

    const focusables = [];

    // Topic header row has category/tag links instead of avatar/toolbar
    const isHeaderRow = row.classList.contains("topic-header-row");
    if (isHeaderRow) {
      // Category link
      const categoryLink = row.querySelector(".badge-category__wrapper a[href]");
      if (categoryLink) {
        focusables.push(categoryLink);
      }

      // Tag links
      const tagLinks = row.querySelectorAll(".discourse-tags a.discourse-tag");
      focusables.push(...Array.from(tagLinks));

      return focusables;
    }

    // Avatar cell (simple gridcell - NVDA reads this fine)
    const avatarCell = row.querySelector(
      '.topic-avatar[role="gridcell"], .topic-avatar [role="gridcell"]'
    );
    if (avatarCell) {
      focusables.push(avatarCell);
    }

    // For small actions only: the description cell (simple text content)
    // Regular post content is accessed via Ctrl+Enter document mode instead
    const isSmallAction = row.classList.contains("small-action");
    if (isSmallAction) {
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
    const { key, ctrlKey, metaKey, altKey } = event;
    const modifier = ctrlKey || metaKey;

    // Allow Alt+Arrow for browser navigation (Alt+Left = back, Alt+Right = forward)
    if (altKey) {
      return;
    }

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

  /**
   * Normalize activeRowIndex if it's out of bounds.
   * This can happen when posts get cloaked/uncloaked due to virtualization.
   * Returns the normalized index.
   */
  normalizeActiveIndex() {
    const rows = this.rows;
    if (rows.length === 0) {
      return 0;
    }
    if (this.activeRowIndex < 0) {
      this.activeRowIndex = 0;
    } else if (this.activeRowIndex >= rows.length) {
      // Clamp to last visible row - better than jumping to 0
      this.activeRowIndex = rows.length - 1;
    }
    return this.activeRowIndex;
  }

  focusNextRow() {
    const rows = this.rows;
    // Normalize in case posts were cloaked and activeRowIndex is out of bounds
    this.normalizeActiveIndex();

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
    // Normalize in case posts were cloaked and activeRowIndex is out of bounds
    this.normalizeActiveIndex();

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
    // Normalize in case posts were cloaked and activeRowIndex is out of bounds
    this.normalizeActiveIndex();

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
    // Normalize in case posts were cloaked and activeRowIndex is out of bounds
    this.normalizeActiveIndex();

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
    // Normalize in case posts were cloaked and activeRowIndex is out of bounds
    this.normalizeActiveIndex();

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
      const rows = this.rows;
      if (rows.length > 0 && this.activeRowIndex < rows.length) {
        this.activeFocusableIndex = -1;
        rows[this.activeRowIndex].focus();
      }
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
    this.normalizeActiveIndex();
    const rows = this.rows;
    if (rows.length > 0 && this.activeRowIndex < rows.length) {
      this.activeFocusableIndex = -1;
      rows[this.activeRowIndex].focus();
    }
  }

  /**
   * Focus last focusable element in current row (last toolbar button)
   */
  focusLastFocusableInRow() {
    // Normalize in case posts were cloaked and activeRowIndex is out of bounds
    this.normalizeActiveIndex();

    const focusables = this.currentRowFocusables;
    if (focusables.length > 0) {
      this.activeFocusableIndex = focusables.length - 1;
      focusables[focusables.length - 1].focus();
    }
  }

  /**
   * Activate the currently focused element
   * If focus is on row itself (activeFocusableIndex === -1), enter document mode
   * If focus is on the post body gridcell, enter document mode
   * Otherwise click the focused element (toolbar buttons, avatar cell)
   */
  activateCurrentFocusable() {
    // Normalize in case posts were cloaked and activeRowIndex is out of bounds
    this.normalizeActiveIndex();

    const row = this.rows[this.activeRowIndex];
    if (!row) {
      return;
    }

    // If a specific focusable element is focused
    if (this.activeFocusableIndex >= 0) {
      const focusables = this.currentRowFocusables;
      if (this.activeFocusableIndex < focusables.length) {
        const element = focusables[this.activeFocusableIndex];
        // If it's the post body gridcell, enter document mode
        if (
          element.classList.contains("post__body") ||
          element.classList.contains("topic-body")
        ) {
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
    // Normalize in case posts were cloaked and activeRowIndex is out of bounds
    this.normalizeActiveIndex();

    const row = this.rows[this.activeRowIndex];
    if (row) {
      this.enterDocumentMode(row);
    }
  }

  /**
   * Enter document mode - focus moves to .cooked content
   * Adds role="document" to enable NVDA browse mode for reading post content
   * Allows screen reader virtual cursor navigation within post content
   */
  enterDocumentMode(row) {
    const cookedElement = row.querySelector(this.options.cookedSelector);
    if (cookedElement) {
      this.inDocumentMode = true;
      // Add role="document" to enable NVDA browse mode
      cookedElement.setAttribute("role", "document");
      cookedElement.setAttribute("tabindex", "0");
      cookedElement.focus();
    }
  }

  /**
   * Exit document mode - return focus to the row
   * Removes role="document" to return to normal grid navigation
   */
  exitDocumentMode() {
    // Normalize in case posts were cloaked and activeRowIndex is out of bounds
    this.normalizeActiveIndex();

    const row = this.rows[this.activeRowIndex];
    if (row) {
      this.inDocumentMode = false;
      const cookedElement = row.querySelector(this.options.cookedSelector);
      if (cookedElement) {
        // Remove role="document" to exit NVDA browse mode
        cookedElement.removeAttribute("role");
        cookedElement.setAttribute("tabindex", "-1");
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
