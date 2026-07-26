import { defineComponent } from 'vue';
import { storeToRefs } from 'pinia';
import { ElTabs, ElTabPane } from 'element-plus';
import { useEditorStore } from '@/store/editor-store';
import PropertyPanel from './property-panel';
import EventsPanel from './events-panel';

export default defineComponent({
  name: 'RightPanel',
  setup() {
    const store = useEditorStore();
    const { activeRightTab } = storeToRefs(store);

    return () => (
      <div class="amis-right">
        <ElTabs
          v-model={activeRightTab.value}
          class="amis-right__tabs"
          type="border-card"
        >
          <ElTabPane label="属性" name="property" class="amis-right__pane">
            <PropertyPanel />
          </ElTabPane>
          <ElTabPane label="事件" name="events" class="amis-right__pane">
            <EventsPanel />
          </ElTabPane>
        </ElTabs>
      </div>
    );
  }
});
