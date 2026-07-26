import { defineComponent } from 'vue';
import { storeToRefs } from 'pinia';
import {
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElSelect,
  ElOption,
  ElTag,
  ElEmpty,
  ElDivider
} from 'element-plus';
import { useEditorStore } from '@/store/editor-store';
import { getFields, groupFields, type FieldDef } from '@/core/property-fields';
import { getPluginPropertyEditors } from '@/core/plugin-host';
import { createEditorContext } from '@/core/editor-context';
import type { VNode } from 'vue';

export default defineComponent({
  name: 'PropertyPanel',
  setup() {
    const store = useEditorStore();
    const { selectedNode, selectedPath } = storeToRefs(store);
    const editorCtx = createEditorContext(store);

    const update = (key: string, value: any) => {
      if (selectedPath.value == null) return;
      store.updateNode(selectedPath.value, { [key]: value });
    };

    const renderField = (node: any, field: FieldDef): VNode => {
      if (field.key === '$$eid') {
        return (
          <ElFormItem label={field.label}>
            <span class="amis-prop__eid">{node.$$eid ?? '-'}</span>
          </ElFormItem>
        );
      }
      const val = node[field.key];

      if (field.type === 'select') {
        return (
          <ElFormItem label={field.label}>
            <ElSelect
              modelValue={val ?? ''}
              placeholder={field.placeholder ?? '请选择'}
              clearable
              onUpdate:modelValue={(v: any) => update(field.key, v)}
              style="width:100%"
            >
              {(field.options ?? []).map(opt => (
                <ElOption label={opt.label} value={opt.value} />
              ))}
            </ElSelect>
          </ElFormItem>
        );
      }

      if (field.type === 'number') {
        return (
          <ElFormItem label={field.label}>
            <ElInputNumber
              modelValue={val}
              controlsPosition="right"
              onUpdate:modelValue={(v: any) => update(field.key, v)}
              style="width:100%"
            />
          </ElFormItem>
        );
      }

      return (
        <ElFormItem label={field.label}>
          <ElInput
            modelValue={val == null ? '' : String(val)}
            type={field.type === 'textarea' ? 'textarea' : 'text'}
            autosize={
              field.type === 'textarea'
                ? { minRows: 2, maxRows: 6 }
                : undefined
            }
            placeholder={field.placeholder ?? `请输入${field.label}`}
            onUpdate:modelValue={(v: string) => update(field.key, v)}
          />
        </ElFormItem>
      );
    };

    return () => {
      const node = selectedNode.value as any;
      if (!node) {
        return (
          <div class="amis-prop__empty">
            <ElEmpty description="请在「大纲」中选择一个节点" imageSize={60} />
          </div>
        );
      }
      const path = selectedPath.value;
      const groups = groupFields(getFields(node.type));
      const pluginEditors = getPluginPropertyEditors(node.type);

      return (
        <div class="amis-prop">
          <div class="amis-prop__head">
            <ElTag type="success">{node.type}</ElTag>
            <span class="amis-prop__path">{path === '' ? '根节点' : path}</span>
          </div>
          <ElForm labelWidth="72px" size="small" labelPosition="left">
            {groups.map((g, gi) => (
              <>
                {gi > 0 && <ElDivider contentPosition="left">{g.group}</ElDivider>}
                {g.fields.map(f => renderField(node, f))}
              </>
            ))}
            {pluginEditors.length > 0 && (
              <>
                <ElDivider contentPosition="left">插件扩展</ElDivider>
                {pluginEditors.map(ed => ed.render(node, editorCtx))}
              </>
            )}
          </ElForm>
        </div>
      );
    };
  }
});
