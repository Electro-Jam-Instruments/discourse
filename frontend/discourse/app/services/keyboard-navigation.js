import Service, { service } from "@ember/service";

/**
 * Service to determine if enhanced keyboard navigation is enabled.
 *
 * Combines site setting with user preference:
 * - If site setting disabled -> return false (master switch)
 * - If user has explicit preference (not null) -> use it
 * - Otherwise -> use site default
 * - Anonymous users always use site setting default
 */
export default class KeyboardNavigationService extends Service {
  @service currentUser;
  @service siteSettings;

  /**
   * Returns true if enhanced keyboard navigation should be enabled.
   * @returns {boolean}
   */
  get isEnabled() {
    // Master switch - if admin disables, no one gets enhanced navigation
    if (!this.siteSettings.enable_enhanced_keyboard_navigation) {
      return false;
    }

    // For logged-in users, check their preference (null = use default)
    const userPref =
      this.currentUser?.user_option?.enable_enhanced_keyboard_navigation;
    if (userPref !== null && userPref !== undefined) {
      return userPref;
    }

    // Fall back to site default
    return this.siteSettings.default_other_enable_enhanced_keyboard_navigation;
  }
}
