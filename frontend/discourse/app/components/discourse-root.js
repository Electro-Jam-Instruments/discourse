/* eslint-disable ember/no-classic-components, ember/require-tagless-components */
import Component from "@ember/component";
import {
  attributeBindings,
  classNames,
  tagName,
} from "@ember-decorators/component";

@tagName("div")
@classNames("discourse-root")
@attributeBindings("role")
export default class DiscourseRoot extends Component {
  /**
   * Set role="application" to indicate to screen readers that this is
   * an interactive application requiring keyboard navigation, not a
   * static document. This helps screen readers use the correct interaction mode.
   */
  role = "application";
}
