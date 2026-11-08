import { registerDestructor } from "@ember/destroyable";
import { service } from "@ember/service";
import DRovingFocus from "discourse/ui-kit/modifiers/d-roving-focus";

/**
 * Base for the toolbar and tablist modifiers: Discourse's `d-roving-focus`
 * engine with the defaults those patterns need.
 *
 * Two behaviours are kept from the modifiers this replaced:
 *
 * - The "enhanced keyboard navigation" setting is the switch. When it is off
 *   the engine is never started.
 * - A key the group handles does not reach handlers further up. A toolbar
 *   inside the post grid would otherwise move the grid as well as itself.
 *
 * Subclasses set `defaultItemSelector`.
 *
 * @class RovingFocusAdapter
 */
export default class RovingFocusAdapter extends DRovingFocus {
  @service keyboardNavigation;

  /** @type {string} CSS selector used when the call site gives none. */
  defaultItemSelector = "a, button";

  #stopHandledElement = null;

  #stopHandled = (event) => {
    if (event.defaultPrevented) {
      event.stopPropagation();
    }
  };

  constructor(owner, args) {
    super(owner, args);
    registerDestructor(this, () => this.#unbindStopHandled());
  }

  modify(element, positional, named) {
    if (!this.keyboardNavigation.isEnabled) {
      return;
    }

    const {
      horizontal = true,
      wrap = true,
      itemSelector = this.defaultItemSelector,
      ...rest
    } = named;

    super.modify(element, positional, {
      orientation: horizontal ? "horizontal" : "vertical",
      wrap,
      itemSelector,
      ...rest,
    });

    // Bound after the engine's own keydown listener, so the engine has already
    // marked the event as handled by the time this runs.
    if (this.#stopHandledElement !== element) {
      this.#unbindStopHandled();
      element.addEventListener("keydown", this.#stopHandled);
      this.#stopHandledElement = element;
    }
  }

  #unbindStopHandled() {
    this.#stopHandledElement?.removeEventListener("keydown", this.#stopHandled);
    this.#stopHandledElement = null;
  }
}
