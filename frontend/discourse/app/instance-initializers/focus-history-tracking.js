/**
 * Instance initializer that sets up global event listeners for focus history tracking.
 *
 * This enables focus restoration when users navigate with browser back/forward
 * (Alt+Left/Right arrows or browser buttons).
 *
 * Coordination with navigation-focus-restoration.js:
 * - On back/forward navigation, markPendingRestore() is called synchronously
 *   so navigation-focus-restoration (which runs on routeDidChange) can yield
 * - restoreFocusState() is called after Ember renders to actually restore focus
 */
export default {
  name: "focus-history-tracking",

  initialize(owner) {
    // Only run in browser environment
    if (typeof document === "undefined") {
      return;
    }

    const focusHistory = owner.lookup("service:focus-history");

    // Track input mode globally
    // Keyboard navigation sets keyboardMode = true
    // Mouse clicks set keyboardMode = false
    document.addEventListener(
      "keydown",
      () => {
        focusHistory.keyboardMode = true;
      },
      { capture: true }
    );

    document.addEventListener(
      "mousedown",
      () => {
        focusHistory.keyboardMode = false;
      },
      { capture: true }
    );

    // Navigation API (modern browsers: Chrome 102+, Edge 102+)
    if ("navigation" in window) {
      window.navigation.addEventListener("navigate", (event) => {
        // Save focus before navigating away
        focusHistory.saveFocusState(location.href);

        // For back/forward navigation, mark pending restore synchronously
        // so navigation-focus-restoration.js can yield to us
        if (
          event.navigationType === "traverse" &&
          focusHistory.keyboardMode
        ) {
          // The destination URL isn't available yet during "navigate",
          // so we mark pending and resolve in "navigatesuccess"
          focusHistory.pendingRestore = true;
        }
      });

      window.navigation.addEventListener("navigatesuccess", () => {
        // Only attempt restore if we marked pending during navigate
        if (focusHistory.pendingRestore) {
          // Use double-rAF to ensure Ember has rendered the DOM.
          // A single rAF fires before Ember's render cycle completes,
          // causing focus to be set on elements that get replaced.
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              focusHistory.restoreFocusState(location.href);
            });
          });
        }
      });
    } else {
      // Popstate fallback (Firefox, Safari, older browsers)
      let lastUrl = location.href;

      const checkUrlChange = () => {
        if (location.href !== lastUrl) {
          focusHistory.saveFocusState(lastUrl);
          lastUrl = location.href;
        }
      };

      // Check for URL changes on clicks (for SPA navigation)
      document.addEventListener("click", () => {
        setTimeout(checkUrlChange, 0);
      });

      // Handle browser back/forward
      window.addEventListener("popstate", () => {
        // Mark pending synchronously so navigation-focus-restoration yields
        focusHistory.markPendingRestore(location.href);

        // Restore after Ember renders
        requestAnimationFrame(() => {
          focusHistory.restoreFocusState(location.href);
          lastUrl = location.href;
        });
      });
    }
  },
};
