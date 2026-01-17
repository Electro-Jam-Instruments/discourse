import BulkSelectCheckbox from "discourse/components/topic-list/bulk-select-checkbox";

const BulkSelectCell = <template>
  <td class="bulk-select topic-list-data" role="gridcell">
    <BulkSelectCheckbox
      @topic={{@topic}}
      @isSelected={{@isSelected}}
      @onToggle={{@onBulkSelectToggle}}
    />
  </td>
</template>;

export default BulkSelectCell;
