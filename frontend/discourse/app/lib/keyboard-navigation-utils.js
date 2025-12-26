/**
 * Shared utilities for keyboard navigation patterns.
 *
 * These functions support the roving tabindex pattern and keyboard
 * navigation for toolbar and grid components. They are designed to
 * be pure functions (except updateRovingTabindex) with no side effects.
 *
 * @module keyboard-navigation-utils
 */

/**
 * Get next index in a collection with optional wrapping.
 *
 * Returns the next valid index in the collection. When wrapping is enabled
 * and the current position is at the end, returns index 0. When wrapping
 * is disabled, returns the last valid index.
 *
 * @param {Element[]} elements - Collection of elements
 * @param {number} currentIndex - Current focused index
 * @param {boolean} [wrap=true] - Whether to wrap around to the beginning
 * @returns {number} Next valid index
 */
export function getNextIndex(elements, currentIndex, wrap = true) {
  if (!elements || elements.length === 0) {
    return -1;
  }

  const nextIndex = currentIndex + 1;
  if (nextIndex >= elements.length) {
    return wrap ? 0 : elements.length - 1;
  }
  return nextIndex;
}

/**
 * Get previous index in a collection with optional wrapping.
 *
 * Returns the previous valid index in the collection. When wrapping is
 * enabled and the current position is at the beginning, returns the last
 * index. When wrapping is disabled, returns 0.
 *
 * @param {Element[]} elements - Collection of elements
 * @param {number} currentIndex - Current focused index
 * @param {boolean} [wrap=true] - Whether to wrap around to the end
 * @returns {number} Previous valid index
 */
export function getPreviousIndex(elements, currentIndex, wrap = true) {
  if (!elements || elements.length === 0) {
    return -1;
  }

  const prevIndex = currentIndex - 1;
  if (prevIndex < 0) {
    return wrap ? elements.length - 1 : 0;
  }
  return prevIndex;
}

/**
 * Check if an element should be included in keyboard navigation.
 *
 * An element is considered navigable if it:
 * - Exists and is not null/undefined
 * - Is not disabled
 * - Is visible (has layout via offsetParent)
 * - Does not have the "hidden" class
 * - Does not have aria-hidden="true"
 *
 * @param {Element} element - Element to check
 * @returns {boolean} True if element is navigable
 */
export function isNavigable(element) {
  return (
    element &&
    !element.disabled &&
    element.offsetParent !== null &&
    !element.classList.contains("hidden") &&
    !element.hasAttribute("aria-hidden")
  );
}

/**
 * Update tabindex values for roving tabindex pattern.
 *
 * Sets tabindex="0" on the active element and tabindex="-1" on all
 * other elements. This allows only the active element to receive
 * focus via Tab key while keeping other elements focusable via
 * programmatic focus() calls.
 *
 * Note: This function modifies DOM attributes and is the only
 * function in this module with side effects.
 *
 * @param {Element[]} elements - Collection of focusable elements
 * @param {number} activeIndex - Index of currently active element
 */
export function updateRovingTabindex(elements, activeIndex) {
  if (!elements || elements.length === 0) {
    return;
  }

  elements.forEach((el, index) => {
    el.setAttribute("tabindex", index === activeIndex ? "0" : "-1");
  });
}

/**
 * Find index of currently focused element in a collection.
 *
 * Searches the collection for the element that matches
 * document.activeElement and returns its index.
 *
 * @param {Element[]} elements - Collection to search
 * @returns {number} Index of focused element, or -1 if not found
 */
export function getFocusedIndex(elements) {
  if (!elements || elements.length === 0) {
    return -1;
  }

  const focused = document.activeElement;
  return elements.indexOf(focused);
}

/**
 * Calculate new index after jumping by offset (for PageUp/PageDown).
 *
 * Returns a new index that is offset from the current index, clamped
 * to the valid range [0, maxIndex]. Useful for implementing PageUp
 * and PageDown navigation that jumps multiple items.
 *
 * @param {number} currentIndex - Current index
 * @param {number} offset - Amount to jump (positive or negative)
 * @param {number} maxIndex - Maximum valid index
 * @returns {number} New index clamped to valid range
 */
export function getOffsetIndex(currentIndex, offset, maxIndex) {
  if (maxIndex < 0) {
    return -1;
  }

  return Math.max(0, Math.min(maxIndex, currentIndex + offset));
}
