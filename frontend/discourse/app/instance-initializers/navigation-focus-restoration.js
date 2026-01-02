import { next } from "@ember/runloop";

/**
 * Restores focus to the active navigation tab after route transitions.
 * This ensures screen reader users maintain their place in the navigation
 * after selecting a tab (Latest, Hot, Categories, etc.).
 *
 * Uses next() instead of scheduleOnce("afterRender") to ensure this runs
 * AFTER clean-dom-on-route-change blurs the active element.
 */
function restoreFocusToActiveTab() {
  const activeTab = document.querySelector(
    '#navigation-bar [role="tab"][aria-selected="true"]'
  );
  if (activeTab) {
    activeTab.focus();
  }
}

export default {
  after: "clean-dom-on-route-change",

  initialize(owner) {
    const router = owner.lookup("service:router");

    router.on("routeDidChange", (transition) => {
      if (transition.isAborted) {
        return;
      }

      // Use next() to ensure we run after clean-dom-on-route-change
      // which uses scheduleOnce("afterRender") and blurs active element
      next(null, restoreFocusToActiveTab);
    });
  },
};
