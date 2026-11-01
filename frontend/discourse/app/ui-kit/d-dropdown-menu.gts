import Component from "@glimmer/component";
import type { TOC } from "@ember/component/template-only";
import { hash } from "@ember/helper";
import { on } from "@ember/modifier";
import { action } from "@ember/object";
import didInsert from "@ember/render-modifiers/modifiers/did-insert";

interface DropdownItemSignature {
  Element: HTMLLIElement;
  Blocks: {
    /** The item's content, usually a button or link. */
    default: [];
  };
}

interface DropdownDividerSignature {
  Element: HTMLLIElement;
}

interface DropdownSubheaderSignature {
  Element: HTMLLIElement;
  Blocks: {
    /** The heading text for the group of items that follows. */
    default: [];
  };
}

const DropdownItem: TOC<DropdownItemSignature> = <template>
  <li class="dropdown-menu__item" role="none" ...attributes>{{yield}}</li>
</template>;

const DropdownDivider: TOC<DropdownDividerSignature> = <template>
  <li role="separator" ...attributes><hr class="dropdown-menu__divider" /></li>
</template>;

const DropdownSubheader: TOC<DropdownSubheaderSignature> = <template>
  <li class="dropdown-menu__subheader" role="none" ...attributes>{{yield}}</li>
</template>;

interface DDropdownMenuSignature {
  Element: HTMLUListElement;
  Blocks: {
    /** The menu's entries, built from the yielded parts. */
    default: [
      /** The parts a menu is built from, each rendering one list item. */
      dropdown: {
        /** A list item holding one entry of the menu. */
        item: typeof DropdownItem;
        /** A list item holding a horizontal rule between groups of items. */
        divider: typeof DropdownDivider;
        /** A list item holding a heading for the items that follow it. */
        subheader: typeof DropdownSubheader;
      },
    ];
  };
}

/**
 * A list-shaped dropdown menu following the WAI-ARIA menu pattern. It yields
 * the parts its entries are built from, so the markup a menu is made of stays
 * consistent across consumers.
 *
 * - `role="menu"` on the container, `role="menuitem"` on each button or link
 * - Arrow Up/Down move between items, wrapping at the ends
 * - Home/End jump to the first/last item
 * - Roving tabindex, with focus moved to the first item when the menu opens
 * - Escape is handled by the parent DMenu
 *
 * @component DDropdownMenu
 */
export default class DDropdownMenu extends Component<DDropdownMenuSignature> {
  @action
  handleKeydown(event: KeyboardEvent) {
    const items = this.#getMenuItems(event.currentTarget as HTMLElement);
    if (items.length === 0) {
      return;
    }

    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    let newIndex: number;

    switch (event.key) {
      case "ArrowDown":
        newIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
        break;
      case "ArrowUp":
        newIndex =
          currentIndex < 0
            ? items.length - 1
            : (currentIndex - 1 + items.length) % items.length;
        break;
      case "Home":
        newIndex = 0;
        break;
      case "End":
        newIndex = items.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    event.stopPropagation();

    items.forEach((item, i) => {
      item.setAttribute("tabindex", i === newIndex ? "0" : "-1");
    });
    items[newIndex].focus();
  }

  @action
  setupMenu(element: HTMLElement) {
    const items = this.#getMenuItems(element);
    items.forEach((item, index) => {
      item.setAttribute("role", "menuitem");
      item.setAttribute("tabindex", index === 0 ? "0" : "-1");
    });

    items[0]?.focus();
  }

  /** All focusable menu items: enabled buttons and links with an href. */
  #getMenuItems(menu: HTMLElement): HTMLElement[] {
    return Array.from(
      menu.querySelectorAll<HTMLElement>(
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
      {{yield
        (hash
          item=DropdownItem divider=DropdownDivider subheader=DropdownSubheader
        )
      }}
    </ul>
  </template>
}
