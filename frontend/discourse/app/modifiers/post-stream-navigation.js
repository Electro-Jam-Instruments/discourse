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
  // Track post IDs that have cloaking prevented (to allow cloaking when focus moves)
  // Uses a Set to manage a "protection window" of adjacent posts for navigation
  // This prevents focus loss when navigating to a post that would otherwise be cloaked
  _preventedCloakingPostIds = new Set();
  // Track last navigation direction for directional fallback when target row is cloaked
  // -1 = navigating up/backward, 1 = navigating down/forward, 0 = no direction preference
  _lastNavigationDirection = 0;
  // Navigation guard flag - prevents handleFocusIn from resetting state during keyboard navigation
  // Set true at start of navigation, cleared via microtask after focus() completes
  _isNavigating = false;
  // Cloaking cycle guard - replaces the old NAVIGATION_GUARD_MS timing hack.
  // Tracks cloaking update cycles to detect when IO/Ember re-render focus events
  // are caused by navigation-triggered scrolls rather than user actions.
  // _currentCloakCycle: latest cloakCycle value from post-stream.gjs (updated via modify())
  // _navigationCloakCycle: snapshot taken at navigation start (-1 = no active guard)
  // _settlementScheduled: prevents duplicate settlement rAFs
  _currentCloakCycle = 0;
  _navigationCloakCycle = -1;
  _settlementScheduled = false;
  // Track if user has interacted with the post stream at all (any navigation, click, Tab focus)
  // Once set, never cleared for this page load - prevents focusFirstUnreadPost from stealing focus
  _userHasInteractedWithStream = false;
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
      this.handleGlobalFocusIn = this.handleGlobalFocusIn.bind(this);

      this.element.addEventListener("keydown", this.handleKeydown);
      this.element.addEventListener("focusin", this.handleFocusIn);
      this.element.addEventListener("focusout", this.handleFocusOut);

      // DEBUG: Global focus listener to catch ALL focus events with call stacks
      // This runs in CAPTURE phase so we see it before any other handler
      document.addEventListener("focusin", this.handleGlobalFocusIn, true);

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

    // Track cloaking cycle from post-stream.gjs.
    // modify() runs on every Ember re-render, so we observe cycle changes here.
    const newCloakCycle = named.cloakCycle || 0;

    // Settlement logic: detect when navigation-triggered cloaking has finished.
    // If the cycle advanced past our snapshot + 2, the cloaking update(s) from
    // our scroll have been fully processed — clear the guard.
    if (
      this._navigationCloakCycle >= 0 &&
      newCloakCycle > this._navigationCloakCycle + 2
    ) {
      console.log(
        `[A11Y-NAV] modify(): cloaking settled - cycle ${newCloakCycle} > nav ${this._navigationCloakCycle} + 2, clearing guard`
      );
      this._navigationCloakCycle = -1;
    }

    // No-scroll settlement: if the cycle hasn't changed after navigation and the
    // boolean guard has cleared, schedule a double-rAF to confirm no IO is coming.
    // This handles the case where scrollRowIntoView didn't scroll (row was visible).
    if (
      this._navigationCloakCycle >= 0 &&
      newCloakCycle === this._navigationCloakCycle &&
      !this._isNavigating &&
      !this._settlementScheduled
    ) {
      this._settlementScheduled = true;
      // Double-rAF gives IO callbacks time to fire (~32ms).
      // If cycle still hasn't changed, no cloaking happened.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (this._currentCloakCycle === this._navigationCloakCycle) {
            console.log(
              `[A11Y-NAV] modify(): no-scroll settlement - no cloaking after double-rAF, clearing guard`
            );
            this._navigationCloakCycle = -1;
          }
          this._settlementScheduled = false;
        });
      });
    }

    this._currentCloakCycle = newCloakCycle;

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
    // GUARD 0 (NEW): Don't auto-focus if user has already interacted with the stream at all
    // This handles the case where user navigated TO the header (not away from it)
    if (this._userHasInteractedWithStream) {
      console.log(`[A11Y-NAV] focusFirstUnreadPost: ABORTED - user already interacted with stream`);
      return;
    }

    // GUARD 1: Don't auto-focus if user has already started navigating away from header
    if (this.activeRowId !== "header") {
      console.log(`[A11Y-NAV] focusFirstUnreadPost: ABORTED - user already navigated to ${this.activeRowId}`);
      return;
    }

    // GUARD 2: Don't auto-focus if cloaking is still settling from a recent navigation
    // This handles the case: user navigates down, then up to header, then this callback fires
    if (
      this._navigationCloakCycle >= 0 &&
      this._currentCloakCycle <= this._navigationCloakCycle + 2
    ) {
      console.log(`[A11Y-NAV] focusFirstUnreadPost: ABORTED - cloaking still settling (cycle ${this._currentCloakCycle} <= nav ${this._navigationCloakCycle} + 2)`);
      return;
    }

    // GUARD 3: Don't auto-focus if focus is already somewhere useful in the post stream
    const activeElement = document.activeElement;
    if (activeElement && this.element.contains(activeElement)) {
      console.log(`[A11Y-NAV] focusFirstUnreadPost: ABORTED - focus already in post stream`);
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
   * Uses _isNavigating flag to prevent handleFocusIn from resetting state.
   * @param {HTMLElement} row - The row element to focus
   */
  focusRowByElement(row) {
    if (!row) return;

    const newRowId = this.getRowId(row);
    console.log(`[A11Y-NAV] focusRowByElement: newRowId=${newRowId}, prevActiveRowId=${this.activeRowId}`);

    // CRITICAL: Mark that user has interacted with the stream
    // This prevents focusFirstUnreadPost from stealing focus later
    this._userHasInteractedWithStream = true;

    // Set DUAL navigation guards BEFORE any state changes:
    // 1. Boolean flag for synchronous focus events (cleared via microtask)
    // 2. Cloaking cycle snapshot for async IO/Ember re-render focus events
    this._isNavigating = true;
    this._navigationCloakCycle = this._currentCloakCycle;
    this._settlementScheduled = false; // Cancel any pending settlement from previous nav

    this.activeRowId = newRowId;
    this.activeFocusableIndex = -1;
    this.inDocumentMode = false;
    this.updateTabindices();
    this.updateCloakingPrevention(row);

    row.focus();
    this.scrollRowIntoView(row);

    // Clear boolean guard via microtask - ensures handleFocusIn sees the flag
    // during any synchronously-triggered focus events.
    // NOTE: Cloaking cycle guard remains active to handle IntersectionObserver
    // macrotasks that fire AFTER this microtask clears the boolean.
    queueMicrotask(() => {
      this._isNavigating = false;
    });
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

    // Topic header row has title link, edit button, category/tag links
    const isHeaderRow = row.classList.contains("topic-header-row");
    if (isHeaderRow) {
      // PM link (if present)
      const pmLink = row.querySelector(".private-message-glyph-wrapper a[href]");
      if (pmLink) {
        focusables.push(pmLink);
      }

      // Title link
      const titleLink = row.querySelector("a.fancy-title");
      if (titleLink) {
        focusables.push(titleLink);
      }

      // Edit button (if user can edit)
      const editButton = row.querySelector(".edit-topic-button");
      if (editButton) {
        focusables.push(editButton);
      }

      // Category link (the wrapper IS the <a> element, not a container)
      const categoryLink = row.querySelector("a.badge-category__wrapper[href]");
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
          // Focus is on a focusable element inside the row - activate it
          this.activateCurrentFocusable();
          handled = true;
        } else if (this.activeRowId === "header") {
          // Focus is on the header row itself - try to activate edit or title link
          this.activateHeaderRow();
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
        // DUAL GUARD: Skip state update during keyboard navigation
        // Guard 1: Boolean flag (handles synchronous focus events)
        if (this._isNavigating) {
          console.log(`[A11Y-NAV] handleFocusIn: BLOCKED ${this.activeRowId} → ${newRowId} (boolean guard)`);
          return;
        }

        // Guard 2: Cloaking cycle check (handles async IO/Ember re-render focus events)
        // After navigation, scrollRowIntoView triggers IntersectionObserver which triggers
        // cloaking boundary updates (incrementing cloakCycle). Those updates cause Ember
        // re-renders that add/remove DOM nodes, which can fire spurious focus events.
        // We block focus changes until the cloaking cycle has settled past the navigation.
        if (
          this._navigationCloakCycle >= 0 &&
          this._currentCloakCycle <= this._navigationCloakCycle + 2
        ) {
          console.log(
            `[A11Y-NAV] handleFocusIn: BLOCKED ${this.activeRowId} → ${newRowId} (cloaking guard: cycle ${this._currentCloakCycle} <= nav ${this._navigationCloakCycle} + 2)`
          );
          return;
        }

        // DEBUG: Log when handleFocusIn changes state
        console.log(`[A11Y-NAV] handleFocusIn: STATE CHANGE ${this.activeRowId} → ${newRowId}`);
        console.log(`[A11Y-NAV]   - cloakCycle: ${this._currentCloakCycle}, navCycle: ${this._navigationCloakCycle}`);
        console.log(`[A11Y-NAV]   - event.target:`, event.target);
        console.log(`[A11Y-NAV]   - event.relatedTarget (where focus came FROM):`, event.relatedTarget);
        console.log(`[A11Y-NAV]   - CALL STACK:`, new Error().stack);

        // CRITICAL: Mark that user has interacted with the stream
        // This prevents focusFirstUnreadPost from stealing focus later
        this._userHasInteractedWithStream = true;

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

  /**
   * DEBUG: Global focus listener to catch ALL focus events with call stacks.
   * This runs in CAPTURE phase on document, so we see every focus change
   * before any other handler processes it.
   *
   * When focus jumping happens, this will show us:
   * 1. WHAT element received focus
   * 2. WHERE it came from (relatedTarget)
   * 3. The CALL STACK showing exactly what code triggered the focus
   */
  handleGlobalFocusIn(event) {
    // Only log when cloaking is still settling from navigation to reduce noise
    if (
      this._navigationCloakCycle < 0 ||
      this._currentCloakCycle > this._navigationCloakCycle + 2
    ) {
      return; // Well past navigation, probably legitimate user action
    }

    // Check if this is within our post stream
    const isInPostStream = this.element && this.element.contains(event.target);
    const postNumber = event.target.closest('[data-post-number]')?.dataset?.postNumber || 'N/A';

    console.log(`[A11Y-GLOBAL-FOCUS] Focus event (cloakCycle=${this._currentCloakCycle}, navCycle=${this._navigationCloakCycle})`);
    console.log(`[A11Y-GLOBAL-FOCUS]   target:`, event.target);
    console.log(`[A11Y-GLOBAL-FOCUS]   postNumber: ${postNumber}`);
    console.log(`[A11Y-GLOBAL-FOCUS]   isInPostStream: ${isInPostStream}`);
    console.log(`[A11Y-GLOBAL-FOCUS]   relatedTarget (from):`, event.relatedTarget);
    console.log(`[A11Y-GLOBAL-FOCUS]   CALL STACK:`, new Error().stack);
  }

  focusNextRow() {
    // PURE POST-NUMBER NAVIGATION - no index conversion, immune to race conditions
    const rows = this.rows;
    if (rows.length === 0) return;

    this._lastNavigationDirection = 1; // Down/forward

    // DEBUG: Log all rows when navigating to see what's available
    const rowIds = rows.map(r => this.getRowId(r));
    console.log(`[A11Y-NAV] focusNextRow: activeRowId=${this.activeRowId}, rows=[${rowIds.join(',')}]`);

    // DEBUG: Special logging when on header row
    if (this.activeRowId === "header") {
      console.log(`[A11Y-NAV] focusNextRow: ON HEADER ROW - about to navigate DOWN from header`);
      console.log(`[A11Y-NAV]   - header is at index 0? ${rowIds[0] === 'header'}`);
      console.log(`[A11Y-NAV]   - next row should be: ${rowIds[1] || 'NONE'}`);
      console.log(`[A11Y-NAV]   - total rows: ${rows.length}`);
    }

    // Find current row BY POST NUMBER directly
    const currentRow = this.findRowByPostNumber(rows, this.activeRowId);

    if (currentRow) {
      // Current row is visible - get next in array
      const currentIndex = rows.indexOf(currentRow);
      const nextIndex = currentIndex + 1;
      console.log(`[A11Y-NAV] focusNextRow: VISIBLE - currentRow found at index ${currentIndex}, targeting index ${nextIndex}`);

      // DEBUG: Extra logging when leaving header
      if (this.activeRowId === "header") {
        console.log(`[A11Y-NAV] focusNextRow: LEAVING HEADER - will focus rows[${nextIndex}] which is rowId=${rowIds[nextIndex]}`);
      }
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

    // DEBUG: Log all rows when navigating to see what's available
    const rowIds = rows.map(r => this.getRowId(r));
    console.log(`[A11Y-NAV] focusPreviousRow: activeRowId=${this.activeRowId}, rows=[${rowIds.join(',')}]`);

    // Find current row BY POST NUMBER directly
    const currentRow = this.findRowByPostNumber(rows, this.activeRowId);

    if (currentRow) {
      // Current row is visible - get previous in array
      const currentIndex = rows.indexOf(currentRow);
      const prevIndex = currentIndex - 1;
      console.log(`[A11Y-NAV] focusPreviousRow: VISIBLE - currentRow found at index ${currentIndex}, targeting index ${prevIndex}`);

      // DEBUG: Extra logging when about to arrive at header
      if (prevIndex === 0 && rowIds[0] === 'header') {
        console.log(`[A11Y-NAV] focusPreviousRow: ARRIVING AT HEADER - will focus the header row`);
      }
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
   * Get the post ID from a row element.
   * Post rows have data-post-id on the article element inside.
   * Header row has no post ID.
   * @param {HTMLElement} row - The row element
   * @returns {string|null} The post ID or null
   */
  getPostIdFromRow(row) {
    if (!row) return null;
    // Header row has no post ID
    if (row.classList.contains("topic-header-row")) return null;
    // Post ID is on the article element inside the row, or directly on the row
    const article = row.querySelector("article[data-post-id]");
    if (article) return article.dataset.postId;
    // Fallback: check if it's directly on the row
    return row.dataset?.postId || null;
  }

  /**
   * Update cloaking prevention for keyboard navigation.
   *
   * Prevents cloaking on a "protection window" of adjacent posts:
   * - Current post (where focus is)
   * - Previous post (where focus might go with Arrow Up)
   * - Next post (where focus might go with Arrow Down)
   *
   * This 3-post buffer ensures navigation targets are never cloaked before
   * focus can land on them, preventing focus jumping issues.
   *
   * @param {HTMLElement} row - The row element being focused
   */
  updateCloakingPrevention(row) {
    const rows = this.rows;
    const currentIndex = rows.indexOf(row);

    if (currentIndex === -1) {
      // Row not found in current rows array (shouldn't happen, but be safe)
      console.log(`[A11Y-NAV] updateCloakingPrevention: row not found in rows array`);
      return;
    }

    // Collect post IDs for the protection window (prev, current, next)
    const newProtectedIds = new Set();

    // Previous row (if exists and is a post row)
    if (currentIndex > 0) {
      const prevPostId = this.getPostIdFromRow(rows[currentIndex - 1]);
      if (prevPostId) {
        newProtectedIds.add(prevPostId);
      }
    }

    // Current row
    const currentPostId = this.getPostIdFromRow(row);
    if (currentPostId) {
      newProtectedIds.add(currentPostId);
    }

    // Next row (if exists and is a post row)
    if (currentIndex < rows.length - 1) {
      const nextPostId = this.getPostIdFromRow(rows[currentIndex + 1]);
      if (nextPostId) {
        newProtectedIds.add(nextPostId);
      }
    }

    // Clear cloaking prevention for posts that are no longer in the protection window
    for (const oldId of this._preventedCloakingPostIds) {
      if (!newProtectedIds.has(oldId)) {
        preventCloaking(parseInt(oldId, 10), false);
        console.log(`[A11Y-NAV] updateCloakingPrevention: UNPROTECTED post ${oldId}`);
      }
    }

    // Add cloaking prevention for new posts in the protection window
    for (const newId of newProtectedIds) {
      if (!this._preventedCloakingPostIds.has(newId)) {
        preventCloaking(parseInt(newId, 10), true);
        console.log(`[A11Y-NAV] updateCloakingPrevention: PROTECTED post ${newId}`);
      }
    }

    // Update the tracked set
    this._preventedCloakingPostIds = newProtectedIds;

    console.log(`[A11Y-NAV] updateCloakingPrevention: window=[${Array.from(newProtectedIds).join(",")}]`);
  }

  /**
   * Clear all cloaking prevention set by this modifier.
   * Called during cleanup.
   */
  clearCloakingPrevention() {
    for (const postId of this._preventedCloakingPostIds) {
      preventCloaking(parseInt(postId, 10), false);
    }
    this._preventedCloakingPostIds.clear();
    console.log(`[A11Y-NAV] clearCloakingPrevention: cleared all`);
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
   * Activate the header row when Enter is pressed on it
   * Clicks the title link to trigger inline title edit (same as mouse click)
   * The edit button opens the full post editor, which is not what we want here
   */
  activateHeaderRow() {
    const row = this.rows.find((r) =>
      r.classList.contains("topic-header-row")
    );
    if (!row) {
      return;
    }

    // Click title link to trigger inline title edit (matches mouse behavior)
    // Note: The edit button opens the full post editor which is different behavior
    const titleLink = row.querySelector("a.fancy-title");
    if (titleLink) {
      titleLink.click();
    }
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
    // Remove global debug listener
    document.removeEventListener("focusin", this.handleGlobalFocusIn, true);
    // Clear any cloaking prevention when navigating away
    this.clearCloakingPrevention();
  }
}
