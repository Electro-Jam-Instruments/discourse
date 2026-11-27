import type { TOC } from "@ember/component/template-only";
import { hash } from "@ember/helper";
import { on } from "@ember/modifier";

const ITEM_CONTROLS = ".dropdown-menu__item :is(button, a[href])";
const ITEM = ".dropdown-menu__item";
const OWN_ARROW_KEYS =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"]';
const NAVIGATION_KEYS = ["ArrowDown", "ArrowUp", "Home", "End"];

/**
 * Where focus lands for an entry. A disabled button cannot take focus, so the
 * entry that holds it does, which lets a keyboard user find it and hear that it
 * is unavailable.
 *
 * @param control - The button or link of an entry.
 * @returns The element that takes focus.
 */
function stopFor(control: HTMLElement): HTMLElement {
  if (!(control as HTMLButtonElement).disabled) {
    return control;
  }

  const entry = control.closest<HTMLElement>(ITEM)!;
  entry.setAttribute("aria-disabled", "true");
  entry.setAttribute("tabindex", "-1");
  return entry;
}

/**
 * Moves focus between the entries of a dropdown menu with the arrow keys, and
 * to the first and last entry with Home and End. Focus stops at the ends, and
 * it also stops on a disabled entry. A control that uses the arrow keys itself,
 * such as a text field, keeps them.
 *
 * @param event - The keydown event from the menu.
 */
function navigate(event: KeyboardEvent) {
  if (
    event.defaultPrevented ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    !NAVIGATION_KEYS.includes(event.key)
  ) {
    return;
  }

  const target = event.target as HTMLElement;
  if (target.closest(OWN_ARROW_KEYS)) {
    return;
  }

  const stops = [
    ...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(
      ITEM_CONTROLS
    ),
  ]
    .filter((control) => control.getClientRects().length > 0)
    .map(stopFor);
  const at = stops.findIndex(
    (stop) => stop === target || stop.contains(target)
  );
  if (at === -1) {
    return;
  }

  const next = {
    ArrowDown: stops[at + 1],
    ArrowUp: stops[at - 1],
    Home: stops[0],
    End: stops.at(-1),
  }[event.key as "ArrowDown" | "ArrowUp" | "Home" | "End"];

  event.preventDefault();
  next?.focus();
}

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
  <li class="dropdown-menu__item" ...attributes>{{yield}}</li>
</template>;

const DropdownDivider: TOC<DropdownDividerSignature> = <template>
  <li ...attributes><hr class="dropdown-menu__divider" /></li>
</template>;

const DropdownSubheader: TOC<DropdownSubheaderSignature> = <template>
  <li class="dropdown-menu__subheader" ...attributes>{{yield}}</li>
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
 * A list-shaped dropdown menu. It yields the parts its entries are built from,
 * so the markup a menu is made of stays consistent across consumers. The arrow
 * keys, Home and End move focus between the entries.
 */
const DDropdownMenu: TOC<DDropdownMenuSignature> = <template>
  {{! eslint-disable-next-line ember/template-no-invalid-interactive }}
  <ul class="dropdown-menu" ...attributes {{on "keydown" navigate}}>
    {{yield
      (hash
        item=DropdownItem divider=DropdownDivider subheader=DropdownSubheader
      )
    }}
  </ul>
</template>;

export default DDropdownMenu;
