import { defineComponent } from 'vue';
import { storeToRefs } from 'pinia';
import { ElTabs, ElTabPane } from 'element-plus';
import { useEditorStore } from '@/store/editor-store';
import ComponentLibrary from './component-library';
import OutlinePanel from './outline-panel';

export default defineComponent({
  name: 'LeftPanel',
  setup() {
    const store = useEditorStore();
    const { activeLeftTab } = storeToRefs(store);

    return () => (
      <div class="amis-left">
        <ElTabs
          v-model={activeLeftTab.value}
          class="amis-left__tabs"
          type="border-card"
        >
          <ElTabPane label="组件库" name="components" class="amis-left__pane">
            <ComponentLibrary />
          </ElTabPane>
          <ElTabPane label="大纲" name="outline" class="amis-left__pane">
            <OutlinePanel />
          </ElTabPane>
        </ElTabs>
      </div>
    );
  }
});
