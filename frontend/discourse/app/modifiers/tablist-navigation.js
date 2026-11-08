import RovingFocusAdapter from "discourse/lib/roving-focus-adapter";

/**
 * Tablist navigation for the WAI-ARIA tablist pattern: one Tab stop, arrow keys
 * to move between tabs, Home and End to reach the ends. The Tab stop starts on
 * the selected tab.
 *
 * The keyboard handling is Discourse's own `d-roving-focus` engine, applied
 * through `RovingFocusAdapter` with the tablist defaults, so every existing
 * `{{tablistNavigation}}` call keeps working unchanged.
 *
 * @component TablistNavigationModifier
 * @param {string} itemSelector - CSS selector for tab items (default: "[role='tab'], a, button")
 * @param {boolean} horizontal - Navigation direction, true for horizontal (default: true)
 * @param {boolean} wrap - Whether to wrap around at ends (default: true)
 *
 * @example
 * <ul role="tablist" {{tablistNavigation}}>
 *   <li role="tab"><a href="/latest">Latest</a></li>
 *   <li role="tab"><a href="/hot">Hot</a></li>
 * </ul>
 */
export default class TablistNavigationModifier extends RovingFocusAdapter {
  defaultItemSelector = "[role='tab'], a, button";
}
