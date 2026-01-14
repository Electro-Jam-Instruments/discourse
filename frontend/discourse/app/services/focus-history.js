import Service from "@ember/service";
import { tracked } from "@glimmer/tracking";

/**
 * Service to track and restore focus across browser navigation.
 *
 * @component
 *
 * Responsibilities:
 * - Track keyboard vs mouse input mode
 * - Save focused element info before navigation
 * - Restore focus after back/forward navigation
 */
export default class FocusHistoryService extends Service {
  @tracked keyboardMode = false;

  // Map of URL -> focus info
  focusStack = new Map();

  /**
   * Build a selector that can find this element after page reload.
   * Tries multiple strategies in priority order.
   *
   * @param {HTMLElement} element - The element to build a selector for
   * @returns {string|null} - CSS selector string or null if none found
   */
  buildElementSelector(element) {
    if (!element) {
      return null;
    }

    // 1. ID
    if (element.id) {
      return `#${CSS.escape(element.id)}`;
    }

    // 2. Data attributes (topic-id, post-id, etc.)
    if (element.dataset.topicId) {
      return `[data-topic-id="${element.dataset.topicId}"]`;
    }
    if (element.dataset.postId) {
      return `[data-post-id="${element.dataset.postId}"]`;
    }

    // 3. Role + aria-rowindex for grid rows
    const role = element.getAttribute("role");
    const rowIndex = element.getAttribute("aria-rowindex");
    if (role === "row" && rowIndex) {
      return `[role="row"][aria-rowindex="${rowIndex}"]`;
    }

    // 4. Role + aria-selected for tabs
    if (role === "tab" && element.getAttribute("aria-selected") === "true") {
      const tablist = element.closest('[role="tablist"]');
      if (tablist?.id) {
        return `#${CSS.escape(tablist.id)} [role="tab"][aria-selected="true"]`;
      }
    }

    // 5. Treeitem with specific text content
    if (role === "treeitem") {
      const text = element.textContent?.trim();
      if (text) {
        // Use a partial match for treeitem text
        return `[role="treeitem"]`;
      }
    }

    // 6. Fallback: try to build unique path
    return this.buildSelectorPath(element);
  }

  /**
   * Build a CSS selector path as a last resort.
   *
   * @param {HTMLElement} element - The element to build a path for
   * @returns {string|null} - CSS selector path or null
   */
  buildSelectorPath(element) {
    if (!element || element === document.body) {
      return null;
    }

    const path = [];
    let current = element;

    while (current && current !== document.body && path.length < 5) {
      let selector = current.tagName.toLowerCase();

      // Add class if present (first class only for simplicity)
      if (current.classList.length > 0) {
        selector += `.${CSS.escape(current.classList[0])}`;
      }

      // Add nth-child if needed for uniqueness
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          (child) => child.tagName === current.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-child(${index})`;
        }
      }

      path.unshift(selector);
      current = parent;
    }

    return path.length > 0 ? path.join(" > ") : null;
  }

  /**
   * Save current focus state for this URL.
   *
   * @param {string} url - The URL to save focus state for
   */
  saveFocusState(url) {
    const activeElement = document.activeElement;
    if (!activeElement || activeElement === document.body) {
      return;
    }

    const selector = this.buildElementSelector(activeElement);
    if (!selector) {
      return;
    }

    this.focusStack.set(url, {
      selector,
      keyboardMode: this.keyboardMode,
      timestamp: Date.now(),
    });
  }

  /**
   * Restore focus for this URL if we have saved state.
   *
   * @param {string} url - The URL to restore focus for
   * @returns {boolean} - True if focus was restored, false otherwise
   */
  restoreFocusState(url) {
    const state = this.focusStack.get(url);
    if (!state || !state.keyboardMode) {
      return false;
    }

    try {
      const element = document.querySelector(state.selector);
      if (element) {
        element.focus();
        return true;
      }
    } catch (e) {
      // Invalid selector, ignore
      console.warn("Focus restoration failed for selector:", state.selector, e);
    }

    return false;
  }

  /**
   * Clear all saved focus states.
   */
  clearHistory() {
    this.focusStack.clear();
  }
}
