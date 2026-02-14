import { scheduleOnce } from "@ember/runloop";

function _clean(transition) {
  if (window.MiniProfiler && transition.from) {
    window.MiniProfiler.pageTransition();
  }

  // Close some elements that may be open
  document.querySelectorAll("header ul.icons li").forEach((element) => {
    element.classList.remove("active");
  });

  document.querySelectorAll(`[data-toggle="dropdown"]`).forEach((element) => {
    element.parentElement.classList.remove("open");
  });

  // Close PhotoSwipe
  window.pswp?.close();

  // Remove any link focus
  const { activeElement } = document;
  if (activeElement && !activeElement.classList.contains("no-blur")) {
    activeElement.blur();
  }

  this.lookup("route:application").send("closeModal");

  this.lookup("service:app-events").trigger("dom:clean");
  this.lookup("service:document-title").updateContextCount(0);
}

/**
 * Strip tabindex="0" from all grid rows and set a teardown flag to prevent
 * the grid modifier from restoring tabindex="0" during Ember's re-render.
 *
 * Without this, when a focused row is removed during route teardown, the
 * browser auto-focuses the next element with tabindex="0", causing a brief
 * visual flash of focus outline on a random row.
 *
 * IMPORTANT: This must save focus state BEFORE blurring, because the
 * focus-history service needs to know what was focused to restore it later.
 */
function _prepareGridsForTeardown(focusHistory) {
  // Save focus state before we blur — focus-history needs the active element
  focusHistory.saveFocusState(location.href);

  document.querySelectorAll('[role="grid"]').forEach((grid) => {
    grid.dataset.tearingDown = "true";
    grid
      .querySelectorAll('[role="row"][tabindex="0"]')
      .forEach((row) => row.setAttribute("tabindex", "-1"));
  });
}

export default {
  after: "inject-objects",

  initialize(owner) {
    const router = owner.lookup("service:router");
    const focusHistory = owner.lookup("service:focus-history");

    router.on("routeWillChange", () =>
      _prepareGridsForTeardown(focusHistory)
    );

    router.on("routeDidChange", (transition) => {
      if (transition.isAborted) {
        return;
      }

      scheduleOnce("afterRender", owner, _clean, transition);
    });
  },
};
