import tablistNavigation from "discourse/modifiers/tablist-navigation";

const AdminNav = <template>
  <div class="admin-controls">
    <nav>
      <ul class="nav nav-pills" role="tablist" {{tablistNavigation}}>
        {{yield}}
      </ul>
    </nav>
  </div>
</template>;

export default AdminNav;
