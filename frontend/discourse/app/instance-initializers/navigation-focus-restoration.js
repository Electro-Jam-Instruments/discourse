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
 * 2. FIRST PAGE LOAD:
 *    - Focus moves to the first row of the list once it has rendered. The
 *      list can draw after the route has settled, so this waits for the row
 *      to appear instead of falling back to the nav bar.
 *
 * 3. MOUSE click on filter tab:
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
 * Get the first focusable category row in the list.
 * @returns {HTMLElement|null}
 */
function getFirstCategoryRow() {
  return document.querySelector('.category-list tbody tr[role="row"][tabindex]');
}

/**
 * Check if we're on a page with a category grid.
 * @returns {boolean}
 */
function hasCategoryGrid() {
  return document.querySelector(".category-list") !== null;
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
 * Check if we're on a topic page (viewing a single topic with posts).
 * @returns {boolean}
 */
function isTopicPage() {
  // Topic pages have a post-stream element with grid role
  return document.querySelector('.post-stream[role="grid"]') !== null;
}

/**
 * Whether the page has not been given a first route transition yet.
 * @type {boolean}
 */
let isInitialLoad = true;

/**
 * Stops watching for the list to render, when a watch is under way.
 * @type {(() => void)|null}
 */
let cancelListWatch = null;

/**
 * Whether focus is somewhere this code may take it from: nowhere in particular,
 * or the nav tab that was just used. Anything else means the user has moved on.
 * @returns {boolean}
 */
function canTakeFocus() {
  const active = document.activeElement;
  return (
    !active ||
    active === document.body ||
    active === document.documentElement ||
    active === getActiveTab()
  );
}

/**
 * Get the first row of whichever list the page shows.
 * @returns {HTMLElement|null}
 */
function getFirstListRow() {
  return (
    (hasCategoryGrid() ? getFirstCategoryRow() : null) || getFirstTopicRow()
  );
}

/**
 * Give the first row of the list focus, as soon as it exists.
 *
 * The row may already be there, or may draw a moment after the route settles,
 * especially on the first load. Watching the page for it, and stopping when the
 * route changes or the user acts, avoids both guessing a delay and falling back
 * to the nav bar. An empty list is announced and focus stays on the tab.
 *
 * @param {Object} a11y - The a11y service for announcements
 */
function focusFirstRowWhenReady(a11y) {
  cancelListWatch?.();

  const outlet = document.getElementById("main-outlet") || document.body;

  const stop = () => {
    observer.disconnect();
    document.removeEventListener("keydown", stop, true);
    document.removeEventListener("mousedown", stop, true);
    if (cancelListWatch === stop) {
      cancelListWatch = null;
    }
  };

  const check = () => {
    const firstRow = getFirstListRow();
    if (firstRow) {
      stop();
      if (canTakeFocus()) {
        firstRow.focus();
      }
      return true;
    }

    // A list container with no rows is an empty list.
    if (hasTopicList() && !hasCategoryGrid()) {
      stop();
      a11y.announce(i18n("topics.none.filter"), "polite");
      getActiveTab()?.focus();
      return true;
    }

    return false;
  };

  const observer = new MutationObserver(check);

  // The first key press or click after this means the user is steering.
  document.addEventListener("keydown", stop, true);
  document.addEventListener("mousedown", stop, true);
  cancelListWatch = stop;

  if (!check()) {
    observer.observe(outlet, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["tabindex"],
    });
  }
}

/**
 * Handle focus restoration after route transition.
 * @param {Object} filterFocus - The filterFocus service
 * @param {Object} a11y - The a11y service for announcements
 * @param {Object} focusHistory - The focusHistory service for keyboard mode tracking
 */
function handleFocusRestoration(filterFocus, a11y, focusHistory) {
  const wasKeyboardActivation = filterFocus.consumeKeyboardActivation();
  const firstLoad = isInitialLoad;
  isInitialLoad = false;

  // If focus-history-tracking has a pending restore (browser back/forward),
  // yield entirely - let it handle focus restoration to the user's previous position
  if (focusHistory.pendingRestore) {
    return;
  }

  // If navigating to a topic page via keyboard, let post-stream-navigation handle focus
  // The modifier checks focusHistory.keyboardMode and focuses first post
  if (focusHistory.keyboardMode && isTopicPage()) {
    return;
  }

  // The nav bar is on every list page, so seeing it means a list is on its way
  // even when it has not drawn yet.
  const onListPage = getActiveTab() !== null;

  // Keyboard mode or a first load: focus the first content row, once it exists.
  if (
    onListPage &&
    (wasKeyboardActivation || focusHistory.keyboardMode || firstLoad)
  ) {
    focusFirstRowWhenReady(a11y);
    return;
  }

  // Mouse click or page without list - restore focus to active tab
  const activeTab = getActiveTab();
  if (activeTab) {
    activeTab.focus();
  }
}

export default {
  after: "clean-dom-on-route-change",

  initialize(owner) {
    const router = owner.lookup("service:router");
    const filterFocus = owner.lookup("service:filter-focus");
    const a11y = owner.lookup("service:a11y");
    const focusHistory = owner.lookup("service:focus-history");

    router.on("routeWillChange", () => cancelListWatch?.());

    router.on("routeDidChange", (transition) => {
      if (transition.isAborted) {
        return;
      }

      // Use next() to ensure we run after clean-dom-on-route-change
      // which uses scheduleOnce("afterRender") and blurs active element
      next(null, () => handleFocusRestoration(filterFocus, a11y, focusHistory));
    });
  },
};
