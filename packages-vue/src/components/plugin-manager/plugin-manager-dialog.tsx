import { defineComponent, ref } from 'vue';
import { ElDialog, ElTable, ElTableColumn, ElSwitch, ElButton, ElInput, ElTag, ElMessage } from 'element-plus';
import { usePluginStore } from '@/store/plugin-store';
import type { PluginManifest } from '@/types/plugin';

export default defineComponent({
  name: 'PluginManagerDialog',
  props: {
    modelValue: { type: Boolean, default: false }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const pluginStore = usePluginStore();
    const url = ref('');

    const install = async () => {
      if (!url.value.trim()) return;
      try {
        const id = await pluginStore.installFromUrl(url.value.trim());
        ElMessage.success('插件已安装：' + id);
        url.value = '';
      } catch (e: any) {
        ElMessage.error(e?.message || '安装失败');
      }
    };

    return () => (
      <ElDialog
        modelValue={props.modelValue}
        onUpdate:modelValue={(v: boolean) => emit('update:modelValue', v)}
        title="插件管理"
        width="700px"
        top="8vh"
      >
        <div class="amis-pluginmgr">
          <div class="amis-pluginmgr__install">
            <ElInput
              modelValue={url.value}
              onUpdate:modelValue={(v: string) => (url.value = v)}
              placeholder="插件脚本 URL（UMD，脚本内需将插件对象赋值给 window.__amisPlugin__）"
            />
            <ElButton
              type="primary"
              loading={pluginStore.installing}
              onClick={install}
            >
              安装
            </ElButton>
          </div>
          <p class="amis-pluginmgr__tip">
            示例插件脚本约定：<code>window.__amisPlugin__ = {'{ id, name, components, ... }'}</code>
          </p>
          <ElTable data={pluginStore.manifests} size="small" border>
            <ElTableColumn label="名称" prop="name" min-width="120" />
            <ElTableColumn label="版本" prop="version" width="80" />
            <ElTableColumn label="来源" width="90">
              {{
                default: ({ row }: { row: PluginManifest }) =>
                  row.builtin ? (
                    <ElTag size="small">内置</ElTag>
                  ) : (
                    <ElTag size="small" type="warning">URL</ElTag>
                  )
              }}
            </ElTableColumn>
            <ElTableColumn label="启用" width="80">
              {{
                default: ({ row }: { row: PluginManifest }) => (
                  <ElSwitch
                    modelValue={row.enabled}
                    onUpdate:modelValue={(v: boolean) =>
                      pluginStore.setEnabled(row.id, v)
                    }
                  />
                )
              }}
            </ElTableColumn>
            <ElTableColumn label="操作" width="90">
              {{
                default: ({ row }: { row: PluginManifest }) =>
                  !row.builtin ? (
                    <ElButton
                      size="small"
                      type="danger"
                      link
                      onClick={() => pluginStore.uninstall(row.id)}
                    >
                      卸载
                    </ElButton>
                  ) : (
                    <span class="amis-pluginmgr__muted">—</span>
                  )
              }}
            </ElTableColumn>
          </ElTable>
        </div>
      </ElDialog>
    );
  }
});
