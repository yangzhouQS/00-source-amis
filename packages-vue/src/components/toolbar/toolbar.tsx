import { defineComponent, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { ElButton, ElButtonGroup, ElTooltip, ElIcon } from 'element-plus';
import {
  RefreshLeft,
  RefreshRight,
  Download,
  Document as DocIcon,
  Box
} from '@element-plus/icons-vue';
import { useEditorStore } from '@/store/editor-store';
import PluginManagerDialog from '@/components/plugin-manager/plugin-manager-dialog';

export default defineComponent({
  name: 'Toolbar',
  setup() {
    const store = useEditorStore();
    const { canUndo, canRedo } = storeToRefs(store);
    const pluginMgrVisible = ref(false);

    const handleUndo = () => store.undo();
    const handleRedo = () => store.redo();
    const handleFocusSource = () => {
      store.activeLeftTab = 'source';
    };
    const handleExport = () => {
      const data = JSON.stringify(store.exportSchema(), null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'amis-schema.json';
      a.click();
      URL.revokeObjectURL(url);
    };

    return () => (
      <div class="amis-toolbar">
        <div class="amis-toolbar__brand">
          amis 编辑器
          <span class="amis-toolbar__sub">Vue · Element Plus · rsbuild</span>
        </div>
        <div class="amis-toolbar__actions">
          <ElButtonGroup>
            <ElTooltip content="撤销" placement="bottom">
              {{
                default: () => (
                  <ElButton
                    disabled={!canUndo.value}
                    onClick={handleUndo}
                    size="small"
                  >
                    <ElIcon>
                      <RefreshLeft />
                    </ElIcon>
                  </ElButton>
                )
              }}
            </ElTooltip>
            <ElTooltip content="重做" placement="bottom">
              {{
                default: () => (
                  <ElButton
                    disabled={!canRedo.value}
                    onClick={handleRedo}
                    size="small"
                  >
                    <ElIcon>
                      <RefreshRight />
                    </ElIcon>
                  </ElButton>
                )
              }}
            </ElTooltip>
          </ElButtonGroup>
          <ElButton
            size="small"
            onClick={handleFocusSource}
          >
            <ElIcon>
              <DocIcon />
            </ElIcon>
            <span style="margin-left: 4px">源码</span>
          </ElButton>
          <ElButton size="small" onClick={handleExport}>
            <ElIcon>
              <Download />
            </ElIcon>
            <span style="margin-left: 4px">导出</span>
          </ElButton>
          <ElButton size="small" onClick={() => (pluginMgrVisible.value = true)}>
            <ElIcon>
              <Box />
            </ElIcon>
            <span style="margin-left: 4px">插件管理</span>
          </ElButton>
        </div>
        <PluginManagerDialog v-model={pluginMgrVisible.value} />
      </div>
    );
  }
});
