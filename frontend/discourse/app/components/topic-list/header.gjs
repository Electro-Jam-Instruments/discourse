import Component from "@glimmer/component";
import { hash } from "@ember/helper";
import { applyValueTransformer } from "discourse/lib/transformer";
import { i18n } from "discourse-i18n";

export default class Header extends Component {
  /**
   * Build accessible name for the header row.
   * Includes column names followed by navigation instructions.
   */
  get accessibleName() {
    const columnNames = [];

    // Get column names from the columns data
    for (const entry of this.args.columns) {
      // Each column entry has a key (column name) and value (component)
      const name = entry.key;
      if (name) {
        // Translate the column name if it's an i18n key
        const translatedName = this.getColumnDisplayName(name);
        if (translatedName) {
          columnNames.push(translatedName);
        }
      }
    }

    const columnList = columnNames.join(", ");
    const instructions = i18n("sr_topic_list_header");

    return columnList ? `${columnList}. ${instructions}` : instructions;
  }

  /**
   * Get the display name for a column
   */
  getColumnDisplayName(name) {
    // Map column keys to their display names
    const columnNameMap = {
      "bulk-select": null, // Don't announce bulk select
      topic: i18n("topic.title"),
      posters: i18n("topic_list.header.posters"),
      replies: i18n("replies"),
      views: i18n("views"),
      activity: i18n("activity"),
      likes: i18n("likes"),
      "op-likes": i18n("likes"),
    };

    if (name in columnNameMap) {
      return columnNameMap[name];
    }

    // Fallback: try to translate the name directly
    try {
      return i18n(name);
    } catch {
      return name;
    }
  }

  <template>
    <tr
      role="row"
      tabindex="-1"
      aria-rowindex="1"
      aria-label={{this.accessibleName}}
    >
      {{#each @columns as |entry|}}
        <entry.value.header
          @sortable={{applyValueTransformer
            "topic-list-header-sortable-column"
            @sortable
            (hash category=@category name=@name)
          }}
          @activeOrder={{@order}}
          @changeSort={{@changeSort}}
          @ascending={{@ascending}}
          @category={{@category}}
          @name={{@listTitle}}
          @bulkSelectEnabled={{@bulkSelectEnabled}}
          @showBulkToggle={{@toggleInTitle}}
          @canBulkSelect={{@canBulkSelect}}
          @canDoBulkActions={{@canDoBulkActions}}
          @bulkSelectHelper={{@bulkSelectHelper}}
        />
      {{/each}}
    </tr>
  </template>
}
