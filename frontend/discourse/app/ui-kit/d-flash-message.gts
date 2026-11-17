import Component from "@glimmer/component";
import type { TrustedHTML } from "@ember/template";
import dConcatClass from "discourse/ui-kit/helpers/d-concat-class";

const FLASH_TYPES = ["success", "error", "warning", "info"] as const;

export type FlashType = (typeof FLASH_TYPES)[number];

/** How a screen reader announces a message when it appears. */
export type FlashAnnounce = "alert" | "status" | false;

interface DFlashMessageSignature {
  Args: {
    /** The message to display. Accepts a plain string or trusted HTML. */
    flash?: string | TrustedHTML;

    /** The severity of the message. */
    type?: FlashType;

    /**
     * How a screen reader announces the message when it appears: `"alert"`
     * interrupts, `"status"` waits for a pause, and `false` stays silent.
     * Errors default to `"alert"` and everything else to `"status"`.
     */
    announce?: FlashAnnounce;
  };

  Element: HTMLDivElement;
}

export default class DFlashMessage extends Component<DFlashMessageSignature> {
  get flashClass() {
    if (this.args.type && !FLASH_TYPES.includes(this.args.type)) {
      throw `@type must be one of ${FLASH_TYPES.join(", ")}`;
    }
    return this.args.type ? `alert-${this.args.type}` : null;
  }

  get liveRole() {
    const { announce, type } = this.args;
    if (announce === false) {
      return;
    }
    return announce ?? (type === "error" ? "alert" : "status");
  }

  <template>
    {{#if @flash}}
      <div
        class={{dConcatClass "alert" this.flashClass}}
        role={{this.liveRole}}
        ...attributes
      >
        {{~@flash~}}
      </div>
    {{/if}}
  </template>
}
