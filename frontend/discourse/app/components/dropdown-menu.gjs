import Component from "@glimmer/component";
import { hash } from "@ember/helper";
import { on } from "@ember/modifier";
import { action } from "@ember/object";
import didInsert from "@ember/render-modifiers/modifiers/did-insert";

/**
 * Dropdown menu item component
 * Renders as role="menuitem" for accessibility
 */
const DropdownItem = <template>
  <li class="dropdown-menu__item" role="none" ...attributes>{{yield}}</li>
</template>;

/**
 * Dropdown divider component
 * Uses role="separator" for accessibility
 */
const DropdownDivider = <template>
  <li role="separator" ...attributes><hr class="dropdown-menu__divider" /></li>
</template>;

/**
 * Accessible dropdown menu component following WAI-ARIA menu pattern
 *
 * Features:
 * - role="menu" on container
 * - Arrow Up/Down navigation between items
 * - Home/End jump to first/last item
 * - Escape closes menu (handled by parent DMenu)
 * - Roving tabindex pattern
 *
 * @component DropdownMenu
 */
export default class DropdownMenu extends Component {
  @action
  handleKeydown(event) {
    const menu = event.currentTarget;
    const items = this._getMenuItems(menu);

    if (items.length === 0) {
      return;
    }

    const currentIndex = items.indexOf(document.activeElement);
    let newIndex = -1;
    let handled = false;

    switch (event.key) {
      case "ArrowDown":
        if (currentIndex < 0) {
          newIndex = 0;
        } else {
          newIndex = (currentIndex + 1) % items.length;
        }
        handled = true;
        break;

      case "ArrowUp":
        if (currentIndex < 0) {
          newIndex = items.length - 1;
        } else {
          newIndex = (currentIndex - 1 + items.length) % items.length;
        }
        handled = true;
        break;

      case "Home":
        newIndex = 0;
        handled = true;
        break;

      case "End":
        newIndex = items.length - 1;
        handled = true;
        break;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();

      if (newIndex >= 0 && newIndex < items.length) {
        // Update tabindex for roving tabindex pattern
        items.forEach((item, i) => {
          item.setAttribute("tabindex", i === newIndex ? "0" : "-1");
        });
        items[newIndex].focus();
      }
    }
  }

  @action
  setupMenu(element) {
    // Set up initial tabindex on menu items
    const items = this._getMenuItems(element);
    items.forEach((item, index) => {
      item.setAttribute("role", "menuitem");
      item.setAttribute("tabindex", index === 0 ? "0" : "-1");
    });

    // Focus first item when menu opens
    if (items.length > 0) {
      items[0].focus();
    }
  }

  /**
   * Get all focusable menu items (buttons and links)
   */
  _getMenuItems(menu) {
    return Array.from(
      menu.querySelectorAll(
        ".dropdown-menu__item button:not([disabled]), .dropdown-menu__item a[href]"
      )
    );
  }

  <template>
    <ul
      class="dropdown-menu"
      role="menu"
      {{didInsert this.setupMenu}}
      {{on "keydown" this.handleKeydown}}
      ...attributes
    >
      {{yield (hash item=DropdownItem divider=DropdownDivider)}}
    </ul>
  </template>
}
