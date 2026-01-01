import { scheduleOnce } from "@ember/runloop";

/**
 * Restores focus to the active navigation tab after route transitions.
 * This ensures screen reader users maintain their place in the navigation
 * after selecting a tab (Latest, Hot, Categories, etc.).
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

      // Restore focus to active tab if navigation bar exists on the page
      scheduleOnce("afterRender", null, restoreFocusToActiveTab);
    });
  },
};
