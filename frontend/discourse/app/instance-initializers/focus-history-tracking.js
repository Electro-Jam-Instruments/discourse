/**
 * Instance initializer that sets up global event listeners for focus history tracking.
 *
 * This enables focus restoration when users navigate with browser back/forward
 * (Alt+Left/Right arrows or browser buttons).
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
      window.navigation.addEventListener("navigate", () => {
        // Save focus before navigating away
        focusHistory.saveFocusState(location.href);
      });

      window.navigation.addEventListener("navigatesuccess", () => {
        // Restore focus after navigation completes
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          // Add a small delay to ensure Ember has finished rendering
          setTimeout(() => {
            focusHistory.restoreFocusState(location.href);
          }, 100);
        });
      });
    } else {
      // Popstate fallback (Firefox, Safari, older browsers)
      // Save focus state before any navigation
      let lastUrl = location.href;

      // Use a MutationObserver to detect URL changes in SPAs
      const checkUrlChange = () => {
        if (location.href !== lastUrl) {
          focusHistory.saveFocusState(lastUrl);
          lastUrl = location.href;
        }
      };

      // Check for URL changes periodically (for SPA navigation)
      document.addEventListener("click", () => {
        setTimeout(checkUrlChange, 100);
      });

      // Handle browser back/forward
      window.addEventListener("popstate", () => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            focusHistory.restoreFocusState(location.href);
            lastUrl = location.href;
          }, 100);
        });
      });
    }
  },
};
