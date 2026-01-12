import { next } from "@ember/runloop";
import { i18n } from "discourse-i18n";

/**
 * Restores focus after route transitions for accessibility.
 *
 * Behavior depends on how the navigation was triggered:
 *
 * 1. KEYBOARD activation (Enter/Space on filter tab):
 *    - Focus moves to the first topic row in the list
 *    - If list is empty, announce via live region and stay on tab
 *    - This optimizes keyboard workflow - users typically want to browse
 *      topics after selecting a filter
 *
 * 2. MOUSE click on filter tab:
 *    - Focus stays on the active tab (preserves mouse user expectations)
 *
 * Uses next() instead of scheduleOnce("afterRender") to ensure this runs
 * AFTER clean-dom-on-route-change blurs the active element.
 */

/**
 * Get the first focusable topic row in the list (not the header).
 * @returns {HTMLElement|null}
 */
function getFirstTopicRow() {
  // Find first data row (tr with role="row" that isn't in thead)
  return document.querySelector('.topic-list tbody tr[role="row"][tabindex]');
}

/**
 * Get the active navigation tab.
 * @returns {HTMLElement|null}
 */
function getActiveTab() {
  return document.querySelector(
    '#navigation-bar [role="tab"][aria-selected="true"]'
  );
}

/**
 * Check if we're on a page with a topic list.
 * @returns {boolean}
 */
function hasTopicList() {
  return document.querySelector(".topic-list") !== null;
}

/**
 * Handle focus restoration after route transition.
 * @param {Object} filterFocus - The filterFocus service
 * @param {Object} a11y - The a11y service for announcements
 */
function handleFocusRestoration(filterFocus, a11y) {
  const wasKeyboardActivation = filterFocus.consumeKeyboardActivation();

  if (wasKeyboardActivation && hasTopicList()) {
    const firstRow = getFirstTopicRow();

    if (firstRow) {
      // Focus the first topic row for optimal keyboard workflow
      firstRow.focus();
    } else {
      // Empty list - announce and keep focus on tab
      a11y.announce(i18n("topics.none.filter"), "polite");
      const activeTab = getActiveTab();
      if (activeTab) {
        activeTab.focus();
      }
    }
  } else {
    // Mouse click or non-topic-list page - restore focus to active tab
    const activeTab = getActiveTab();
    if (activeTab) {
      activeTab.focus();
    }
  }
}

export default {
  after: "clean-dom-on-route-change",

  initialize(owner) {
    const router = owner.lookup("service:router");
    const filterFocus = owner.lookup("service:filter-focus");
    const a11y = owner.lookup("service:a11y");

    router.on("routeDidChange", (transition) => {
      if (transition.isAborted) {
        return;
      }

      // Use next() to ensure we run after clean-dom-on-route-change
      // which uses scheduleOnce("afterRender") and blurs active element
      next(null, () => handleFocusRestoration(filterFocus, a11y));
    });
  },
};
