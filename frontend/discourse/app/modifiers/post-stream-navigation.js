import { registerDestructor } from "@ember/destroyable";
import { schedule } from "@ember/runloop";
import { service } from "@ember/service";
import Modifier from "ember-modifier";
import {
  getNextIndex,
  getPreviousIndex,
  updateRovingTabindex,
} from "discourse/lib/keyboard-navigation-utils";
import { preventCloaking } from "discourse/modifiers/post-stream-viewport-tracker";

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
  // Track active row by post number (stable across cloaking) rather than array index
  // Uses "header" for the topic header row, or a post number for post rows
  activeRowId = "header";
  activeFocusableIndex = -1; // -1 means the row itself is focused (full highlight)
  inDocumentMode = false;
  initialFocusComplete = false; // Track if we've done the initial auto-focus
  // Track the post ID that has cloaking prevented (to allow cloaking when focus moves)
  _preventedCloakingPostId = null;
  // Track last navigation direction for directional fallback when target row is cloaked
  // -1 = navigating up/backward, 1 = navigating down/forward, 0 = no direction preference
  _lastNavigationDirection = 0;
  // Navigation direction for directional proxy finding when target is cloaked
  // No timeout needed - post-number navigation is immune to race conditions
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
      this.handleFocusOut = this.handleFocusOut.bind(this);

      this.element.addEventListener("keydown", this.handleKeydown);
      this.element.addEventListener("focusin", this.handleFocusIn);
      this.element.addEventListener("focusout", this.handleFocusOut);

      this.activeRowId = "header";
      this.activeFocusableIndex = -1;

      // CRITICAL FIX: Only set up tabindices ONCE during initial setup
      // Do NOT update tabindices on every re-render - this was the root cause
      // of focus jumping. Tabindices are now only updated by:
      // 1. focusRowWithArray() - keyboard navigation
      // 2. handleFocusIn() - user clicks/tabs into grid
      console.log(`[A11Y-NAV] modify(): SETUP - running initial tabindex setup`);
      this.updateTabindices();
      this.setInternalTabindices();
    }

    this.options = { ...this.options, ...named };

    // IMPORTANT: We intentionally do NOT update tabindices on re-renders.
    // This method runs on EVERY Ember re-render (including cloaking boundary changes).
    // Updating tabindices during re-renders creates race conditions with:
    // - IntersectionObserver callbacks (macrotasks after microtask clears flag)
    // - Scroll animation (~300ms window after navigation)
    // - Ember render cycles from tracked property changes
    //
    // Tabindices are now managed exclusively by:
    // 1. focusRowWithArray() - keyboard navigation (sets state BEFORE calling focus())
    // 2. handleFocusIn() - user clicks/tabs into grid (event-driven, reliable)
    // 3. Initial setup (above) - first time modifier is attached

    // Auto-focus first unread post on initial load if user navigated via keyboard
    if (!this.initialFocusComplete && this.focusHistory.keyboardMode) {
      console.log(`[A11Y-NAV] modify(): SCHEDULING INITIAL FOCUS`);
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
    // GUARD: Don't auto-focus if user has already started navigating
    // This prevents the scheduled callback from stealing focus mid-navigation
    if (this.activeRowId !== "header") {
      console.log(`[A11Y-NAV] focusFirstUnreadPost: ABORTED - user already navigated to ${this.activeRowId}`);
      return;
    }

    const rows = this.rows;
    if (rows.length === 0) {
      console.log(`[A11Y-NAV] focusFirstUnreadPost: NO ROWS, aborting`);
      return;
    }

    // Find the first unread post: lastReadPostNumber + 1
    // If lastReadPostNumber is null/0, focus first post (skip header row at index 0)
    const targetPostNumber = (lastReadPostNumber || 0) + 1;

    // Try to find row by post number directly using activeRowId
    const targetRowId = String(targetPostNumber);
    const targetIndex = this.findRowIndexById(targetRowId);

    console.log(`[A11Y-NAV] focusFirstUnreadPost: lastRead=${lastReadPostNumber}, targetPost=${targetPostNumber}, targetIndex=${targetIndex}, rows.length=${rows.length}`);

    if (targetIndex !== -1) {
      // Found the target post
      this.focusRow(targetIndex);
    } else {
      // Target post not found (all read or post not loaded), focus first content row
      // First content row is at index 1 (index 0 is header row)
      const fallbackIndex = rows.length > 1 ? 1 : 0;
      console.log(`[A11Y-NAV] focusFirstUnreadPost: target not found, using fallbackIndex=${fallbackIndex}`);
      this.focusRow(fallbackIndex);
    }
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
   * Get the row ID for a given row element.
   * Returns "header" for the topic header row, or the post number as string for post rows.
   */
  getRowId(row) {
    if (!row) {
      return null;
    }
    if (row.classList.contains("topic-header-row")) {
      return "header";
    }
    // Post rows have data-post-number attribute
    const postNumber = row.dataset.postNumber;
    return postNumber || null;
  }

  /**
   * Find the index of a row by its ID in a given rows array.
   * Returns -1 if not found (e.g., row is cloaked).
   * @param {HTMLElement[]} rows - The rows array to search
   * @param {string} rowId - The row ID to find
   */
  findRowIndexByIdWithArray(rows, rowId) {
    if (!rowId) {
      return -1;
    }
    for (let i = 0; i < rows.length; i++) {
      if (this.getRowId(rows[i]) === rowId) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Find the index of a row by its ID in the current rows array.
   * Returns -1 if not found (e.g., row is cloaked).
   * @deprecated Use findRowIndexByIdWithArray with pre-captured rows array
   */
  findRowIndexById(rowId) {
    return this.findRowIndexByIdWithArray(this.rows, rowId);
  }

  /**
   * Find a row element by post number in the given rows array.
   * Returns the row element or null if not found (cloaked).
   * This is the preferred method for post-number based navigation.
   * @param {HTMLElement[]} rows - Pre-captured rows array
   * @param {string} postNumber - Post number as string, or "header"
   * @returns {HTMLElement|null}
   */
  findRowByPostNumber(rows, postNumber) {
    if (postNumber === "header") {
      return rows.find(r => r.classList.contains('topic-header-row')) || null;
    }
    return rows.find(r => r.dataset.postNumber === postNumber) || null;
  }

  /**
   * Find the best proxy row when target post is cloaked.
   * Returns the first visible row in the navigation direction.
   * @param {HTMLElement[]} rows - Pre-captured rows array
   * @param {string} targetPostNumber - Target post number as string
   * @param {number} direction - 1 for down/forward, -1 for up/backward
   * @returns {HTMLElement|null}
   */
  findProxyRow(rows, targetPostNumber, direction) {
    if (targetPostNumber === "header") {
      // Header cloaked is unusual, return first row
      return rows[0] || null;
    }

    const target = parseInt(targetPostNumber, 10);
    if (isNaN(target)) {
      return rows[0] || null;
    }

    let best = null;
    let bestDistance = Infinity;

    for (const row of rows) {
      const pn = parseInt(row.dataset.postNumber, 10);
      if (isNaN(pn)) continue;

      if (direction > 0 && pn >= target) {
        // Going DOWN - find first post >= target
        const dist = pn - target;
        if (dist < bestDistance) {
          bestDistance = dist;
          best = row;
        }
      } else if (direction < 0 && pn <= target) {
        // Going UP - find first post <= target
        const dist = target - pn;
        if (dist < bestDistance) {
          bestDistance = dist;
          best = row;
        }
      }
    }

    // If no row found in direction, return first/last based on direction
    if (!best && rows.length > 0) {
      best = direction > 0 ? rows[rows.length - 1] : rows[0];
    }

    return best;
  }

  /**
   * Focus a row element directly (post-number based navigation).
   * This is the core focus method - all navigation should use this.
   * @param {HTMLElement} row - The row element to focus
   */
  focusRowByElement(row) {
    if (!row) return;

    const newRowId = this.getRowId(row);
    console.log(`[A11Y-NAV] focusRowByElement: newRowId=${newRowId}, prevActiveRowId=${this.activeRowId}`);

    this.activeRowId = newRowId;
    this.activeFocusableIndex = -1;
    this.inDocumentMode = false;
    this.updateTabindices();
    this.updateCloakingPrevention(row);

    row.focus();
    this.scrollRowIntoView(row);
  }

  /**
   * Get the current active row index based on activeRowId.
   * If the row is not visible (cloaked), uses directional fallback based on
   * the last navigation direction to find the appropriate visible row.
   *
   * This prevents focus jumping issues when cloaking changes during delays
   * between keystrokes - e.g., if navigating UP and target post is cloaked,
   * we find the first visible post BEFORE the target (not "closest" which
   * might be a post after the target).
   *
   * @param {HTMLElement[]} [rows] - Optional pre-captured rows array. If not provided, queries DOM.
   * @returns {number} The active row index
   */
  getActiveRowIndex(rows = null) {
    // Use provided rows array or query DOM (for backward compatibility)
    const rowsArray = rows || this.rows;

    const index = this.findRowIndexByIdWithArray(rowsArray, this.activeRowId);
    if (index !== -1) {
      return index;
    }
    // Row not found (cloaked) - use directional fallback
    // Parse the row ID to get post number
    if (this.activeRowId === "header") {
      // Header should always be visible, but fallback to 0
      console.log(`[A11Y-NAV] getActiveRowIndex: header cloaked? returning 0`);
      return 0;
    }
    const targetPostNumber = parseInt(this.activeRowId, 10);
    if (isNaN(targetPostNumber)) {
      console.log(`[A11Y-NAV] getActiveRowIndex: invalid activeRowId=${this.activeRowId}, returning 0`);
      return 0;
    }

    const direction = this._lastNavigationDirection;

    // DEBUG: Log visible row IDs
    const rowIds = rowsArray.map((r) => this.getRowId(r));
    console.log(`[A11Y-NAV] getActiveRowIndex: FALLBACK target=${targetPostNumber}, direction=${direction}, visibleRows=[${rowIds.join(",")}]`);

    // Directional fallback: find the first visible row in the navigation direction
    // This prevents focus jumping when cloaking changes during keystroke delays
    if (direction < 0) {
      // Navigating UP - find the first visible post BEFORE or AT the target
      // (with lower or equal post number)
      let bestIndex = 0;
      let bestPostNumber = -Infinity;
      for (let i = 0; i < rowsArray.length; i++) {
        const rowId = this.getRowId(rowsArray[i]);
        if (rowId === "header") {
          continue;
        }
        const postNumber = parseInt(rowId, 10);
        if (!isNaN(postNumber) && postNumber <= targetPostNumber && postNumber > bestPostNumber) {
          bestPostNumber = postNumber;
          bestIndex = i;
        }
      }
      // If no post found before target, use first visible post
      const result = bestPostNumber > -Infinity ? bestIndex : 0;
      console.log(`[A11Y-NAV] getActiveRowIndex: UP fallback -> index ${result} (post ${bestPostNumber})`);
      return result;
    } else if (direction > 0) {
      // Navigating DOWN - find the first visible post AFTER or AT the target
      // (with higher or equal post number)
      let bestIndex = rowsArray.length - 1;
      let bestPostNumber = Infinity;
      for (let i = 0; i < rowsArray.length; i++) {
        const rowId = this.getRowId(rowsArray[i]);
        if (rowId === "header") {
          continue;
        }
        const postNumber = parseInt(rowId, 10);
        if (!isNaN(postNumber) && postNumber >= targetPostNumber && postNumber < bestPostNumber) {
          bestPostNumber = postNumber;
          bestIndex = i;
        }
      }
      // If no post found after target, use last visible post
      const result = bestPostNumber < Infinity ? bestIndex : rowsArray.length - 1;
      console.log(`[A11Y-NAV] getActiveRowIndex: DOWN fallback -> index ${result} (post ${bestPostNumber})`);
      return result;
    }

    // No direction preference (e.g., initial load, mouse click) - use closest
    let closestIndex = 0;
    let closestDistance = Infinity;
    for (let i = 0; i < rowsArray.length; i++) {
      const rowId = this.getRowId(rowsArray[i]);
      if (rowId === "header") {
        continue;
      }
      const postNumber = parseInt(rowId, 10);
      if (!isNaN(postNumber)) {
        const distance = Math.abs(postNumber - targetPostNumber);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = i;
        }
      }
    }
    console.log(`[A11Y-NAV] getActiveRowIndex: CLOSEST fallback -> index ${closestIndex}`);
    return closestIndex;
  }

  /**
   * @deprecated Use getActiveRowIndex(rows) with pre-captured rows array
   */
  get activeRowIndex() {
    return this.getActiveRowIndex();
  }

  /**
   * Set the active row by index, updating activeRowId.
   */
  setActiveRowByIndex(index) {
    const rows = this.rows;
    if (index >= 0 && index < rows.length) {
      this.activeRowId = this.getRowId(rows[index]);
    }
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
      // Track by row ID (post number) not index
      const newRowId = this.getRowId(row);
      if (newRowId && newRowId !== this.activeRowId) {
        // DEBUG: Log when handleFocusIn changes state (potential bug source)
        console.log(`[A11Y-NAV] handleFocusIn: ${this.activeRowId} → ${newRowId}, direction was ${this._lastNavigationDirection}, resetting to 0`);
        this.activeRowId = newRowId;
        // Reset navigation direction when focus comes from mouse/Tab (not arrow keys)
        // This prevents stale direction from affecting fallback logic during re-renders
        this._lastNavigationDirection = 0;
        this.updateTabindices();
        // Update cloaking prevention when focus moves to a new row
        // (e.g., via mouse click or Tab key)
        this.updateCloakingPrevention(row);
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

  /**
   * Handle focus leaving the grid entirely.
   * This can happen when a focused element is removed from DOM (cloaked)
   * and browser moves focus to <body>.
   *
   * We do NOT auto-recover focus because:
   * 1. The user may have scrolled away intentionally
   * 2. Auto-recovery creates a focus jumping loop
   * 3. Focus will be properly set when user navigates with arrow keys
   * 4. User can Tab back into the grid at any time
   */
  handleFocusOut(event) {
    // Just log for debugging - don't auto-recover
    if (!event.relatedTarget || !this.element.contains(event.relatedTarget)) {
      console.log(`[A11Y-NAV] handleFocusOut: Focus left grid, activeRowId=${this.activeRowId}`);
    }
  }

  focusNextRow() {
    // PURE POST-NUMBER NAVIGATION - no index conversion, immune to race conditions
    const rows = this.rows;
    if (rows.length === 0) return;

    this._lastNavigationDirection = 1; // Down/forward

    // Find current row BY POST NUMBER directly
    const currentRow = this.findRowByPostNumber(rows, this.activeRowId);

    if (currentRow) {
      // Current row is visible - get next in array
      const currentIndex = rows.indexOf(currentRow);
      const nextIndex = currentIndex + 1;
      console.log(`[A11Y-NAV] focusNextRow: VISIBLE - index ${currentIndex} → ${nextIndex}`);
      if (nextIndex < rows.length) {
        this.focusRowByElement(rows[nextIndex]);
      }
      // else: at end, don't wrap
    } else {
      // Current row is cloaked - find proxy in navigation direction
      console.log(`[A11Y-NAV] focusNextRow: CLOAKED - finding proxy for ${this.activeRowId}`);
      const proxy = this.findProxyRow(rows, this.activeRowId, 1);
      if (proxy) {
        this.focusRowByElement(proxy);
      }
    }
  }

  focusPreviousRow() {
    // PURE POST-NUMBER NAVIGATION - no index conversion, immune to race conditions
    const rows = this.rows;
    if (rows.length === 0) return;

    this._lastNavigationDirection = -1; // Up/backward

    // Find current row BY POST NUMBER directly
    const currentRow = this.findRowByPostNumber(rows, this.activeRowId);

    if (currentRow) {
      // Current row is visible - get previous in array
      const currentIndex = rows.indexOf(currentRow);
      const prevIndex = currentIndex - 1;
      console.log(`[A11Y-NAV] focusPreviousRow: VISIBLE - index ${currentIndex} → ${prevIndex}`);
      if (prevIndex >= 0) {
        this.focusRowByElement(rows[prevIndex]);
      }
      // else: at start, don't wrap
    } else {
      // Current row is cloaked - find proxy in navigation direction
      console.log(`[A11Y-NAV] focusPreviousRow: CLOAKED - finding proxy for ${this.activeRowId}`);
      const proxy = this.findProxyRow(rows, this.activeRowId, -1);
      if (proxy) {
        this.focusRowByElement(proxy);
      }
    }
  }

  focusFirstRow() {
    // Focus first visible row (header or first post)
    const rows = this.rows;
    if (rows.length > 0) {
      this._lastNavigationDirection = 0;
      this.focusRowByElement(rows[0]);
    }
  }

  focusLastRow() {
    // Focus last visible row
    const rows = this.rows;
    if (rows.length > 0) {
      this._lastNavigationDirection = 0;
      this.focusRowByElement(rows[rows.length - 1]);
    }
  }

  focusRowByOffset(offset) {
    // PURE POST-NUMBER NAVIGATION for Page Up/Down
    const rows = this.rows;
    if (rows.length === 0) return;

    this._lastNavigationDirection = offset > 0 ? 1 : offset < 0 ? -1 : 0;

    // Find current row BY POST NUMBER directly
    const currentRow = this.findRowByPostNumber(rows, this.activeRowId);

    if (currentRow) {
      // Current row is visible - apply offset
      const currentIndex = rows.indexOf(currentRow);
      const newIndex = Math.max(0, Math.min(rows.length - 1, currentIndex + offset));
      this.focusRowByElement(rows[newIndex]);
    } else {
      // Current row is cloaked - find proxy first
      const proxy = this.findProxyRow(rows, this.activeRowId, offset > 0 ? 1 : -1);
      if (proxy) {
        this.focusRowByElement(proxy);
      }
    }
  }

  /**
   * Focus a row by index, using a pre-captured rows array.
   * This prevents cloaking changes from causing index mismatches.
   * @param {HTMLElement[]} rows - The rows array captured at navigation start
   * @param {number} index - The index to focus
   */
  focusRowWithArray(rows, index) {
    if (index >= 0 && index < rows.length) {
      const row = rows[index];
      // Track by row ID (post number) not index
      const newRowId = this.getRowId(row);
      // DEBUG: Log focusRow
      console.log(`[A11Y-NAV] focusRowWithArray: index=${index}, newRowId=${newRowId}, prevActiveRowId=${this.activeRowId}`);
      this.activeRowId = newRowId;
      this.activeFocusableIndex = -1; // Row itself is focused
      this.inDocumentMode = false;
      this.updateTabindices();

      // Manage cloaking prevention - prevent cloaking on the new row,
      // allow cloaking on the previous row. This prevents focus loss
      // during rapid arrow key navigation.
      this.updateCloakingPrevention(row);

      row.focus();

      // Custom scroll logic to respect sticky header
      // scrollIntoView with block: "nearest" doesn't reliably honor scroll-margin-top
      this.scrollRowIntoView(row);
    } else {
      console.log(`[A11Y-NAV] focusRowWithArray: INVALID index=${index}, rows.length=${rows.length}`);
    }
  }

  /**
   * Focus a row by index (re-queries rows from DOM).
   * Use focusRowWithArray when you already have a rows array to avoid race conditions.
   */
  focusRow(index) {
    this.focusRowWithArray(this.rows, index);
  }

  /**
   * Update cloaking prevention for keyboard navigation.
   * Prevents cloaking on the currently focused post to avoid focus loss
   * during rapid arrow key navigation.
   * @param {HTMLElement} row - The row element being focused
   */
  updateCloakingPrevention(row) {
    // Get the post ID from the row element (posts have data-post-id attribute)
    const newPostId = row.dataset?.postId;

    // Clear previous prevention if we're moving to a different post
    if (this._preventedCloakingPostId && this._preventedCloakingPostId !== newPostId) {
      preventCloaking(parseInt(this._preventedCloakingPostId, 10), false);
      this._preventedCloakingPostId = null;
    }

    // Prevent cloaking on the new post (if it's a post row, not header row)
    if (newPostId && newPostId !== this._preventedCloakingPostId) {
      preventCloaking(parseInt(newPostId, 10), true);
      this._preventedCloakingPostId = newPostId;
    }
  }

  /**
   * Clear all cloaking prevention set by this modifier.
   * Called during cleanup.
   */
  clearCloakingPrevention() {
    if (this._preventedCloakingPostId) {
      preventCloaking(parseInt(this._preventedCloakingPostId, 10), false);
      this._preventedCloakingPostId = null;
    }
  }

  /**
   * Scroll a row into view, accounting for the sticky header.
   * Uses scroll-margin-top CSS value to determine header clearance.
   *
   * IMPORTANT: Uses instant scroll (not smooth) to prevent race conditions.
   * Smooth scroll (~300ms) triggers IntersectionObserver callbacks during animation,
   * which causes cloaking boundary changes and Ember re-renders while navigation
   * state is being set. This was the root cause of focus jumping issues.
   *
   * @param {HTMLElement} row - The row element to scroll into view
   */
  scrollRowIntoView(row) {
    const rowRect = row.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // Get the scroll-margin-top from CSS (includes header offset)
    const computedStyle = window.getComputedStyle(row);
    const scrollMarginTop = parseFloat(computedStyle.scrollMarginTop) || 0;

    // Check if row is above the visible area (accounting for sticky header)
    if (rowRect.top < scrollMarginTop) {
      // Scroll up so row is just below the sticky header
      const scrollY = window.scrollY + rowRect.top - scrollMarginTop;
      // CRITICAL: Use instant scroll to avoid race conditions with IntersectionObserver
      window.scrollTo({ top: scrollY, behavior: "instant" });
    } else if (rowRect.bottom > viewportHeight) {
      // Row is below visible area - scroll down to show it
      const scrollY = window.scrollY + rowRect.bottom - viewportHeight + 20;
      // CRITICAL: Use instant scroll to avoid race conditions with IntersectionObserver
      window.scrollTo({ top: scrollY, behavior: "instant" });
    }
    // Otherwise row is already fully visible - no scroll needed
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
      const rows = this.rows;
      const currentIndex = this.activeRowIndex;
      if (rows.length > 0 && currentIndex < rows.length) {
        this.activeFocusableIndex = -1;
        rows[currentIndex].focus();
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
    const rows = this.rows;
    const currentIndex = this.activeRowIndex;
    if (rows.length > 0 && currentIndex < rows.length) {
      this.activeFocusableIndex = -1;
      rows[currentIndex].focus();
    }
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
   * If focus is on the post body gridcell, enter document mode
   * Otherwise click the focused element (toolbar buttons, avatar cell)
   */
  activateCurrentFocusable() {
    const rows = this.rows;
    const currentIndex = this.activeRowIndex;
    const row = rows[currentIndex];
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
    const rows = this.rows;
    const currentIndex = this.activeRowIndex;
    const row = rows[currentIndex];
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
    const rows = this.rows;
    const currentIndex = this.activeRowIndex;
    const row = rows[currentIndex];
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
      this.element.removeEventListener("focusout", this.handleFocusOut);
    }
    // Clear any cloaking prevention when navigating away
    this.clearCloakingPrevention();
  }
}
