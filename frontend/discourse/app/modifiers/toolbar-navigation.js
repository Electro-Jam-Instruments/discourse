import RovingFocusAdapter from "discourse/lib/roving-focus-adapter";

/**
 * Toolbar navigation for the WAI-ARIA toolbar pattern: one Tab stop, arrow keys
 * to move between items, Home and End to reach the ends.
 *
 * The keyboard handling is Discourse's own `d-roving-focus` engine, applied
 * through `RovingFocusAdapter` with the toolbar defaults, so every existing
 * `{{toolbarNavigation}}` call keeps working unchanged.
 *
 * @component ToolbarNavigationModifier
 * @param {string} itemSelector - CSS selector for toolbar items (default: "a, button, summary")
 * @param {boolean} horizontal - Navigation direction, true for horizontal (default: true)
 * @param {boolean} wrap - Whether to wrap around at ends (default: true)
 *
 * @example
 * <ul role="toolbar" {{toolbarNavigation}}>
 *   <li><a href="/latest">Latest</a></li>
 *   <li><button>Action</button></li>
 * </ul>
 */
export default class ToolbarNavigationModifier extends RovingFocusAdapter {
  defaultItemSelector = "a, button, summary";
}
