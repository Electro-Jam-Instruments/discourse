import { tracked } from "@glimmer/tracking";
import Service from "@ember/service";

/**
 * Service to track keyboard-triggered filter activations for accessibility.
 *
 * When a user activates a filter tab (Latest, New, Hot, etc.) via keyboard,
 * we want focus to move to the first topic in the list rather than staying
 * on the filter tab. This service tracks whether the last filter activation
 * was via keyboard so the focus restoration logic can behave appropriately.
 *
 * Mouse clicks do not set this flag, preserving mouse user expectations.
 */
export default class FilterFocusService extends Service {
  /**
   * Whether the last filter activation was via keyboard
   * @type {boolean}
   */
  @tracked keyboardActivation = false;

  /**
   * Mark that a filter was activated via keyboard.
   * Called from NavigationItem when user presses Enter/Space.
   */
  markKeyboardActivation() {
    this.keyboardActivation = true;
  }

  /**
   * Clear the keyboard activation flag.
   * Called after focus has been moved (or not) by the restoration logic.
   */
  clearKeyboardActivation() {
    this.keyboardActivation = false;
  }

  /**
   * Check if keyboard activation is pending and clear it.
   * @returns {boolean} True if keyboard activation was pending
   */
  consumeKeyboardActivation() {
    const wasKeyboard = this.keyboardActivation;
    this.keyboardActivation = false;
    return wasKeyboard;
  }
}
