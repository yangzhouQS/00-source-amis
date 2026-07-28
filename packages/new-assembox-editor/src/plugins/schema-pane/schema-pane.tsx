/**
 * Schema 源码面板
 * 查看/编辑当前 schema（JSON）
 * 编辑后加载回画布
 */
import {defineComponent, PropType, computed} from 'vue';
import {ElInput, ElButton, ElMessage} from 'element-plus';
import type {Editor} from '../../core/editor';

export const SchemaPane = defineComponent({
  name: 'SchemaPane',
  props: {
    editor: {type: Object as PropType<Editor>, required: true}
  },
  setup(props) {
    const schemaText = computed(() =>
      JSON.stringify(props.editor.store.schema, null, 2)
    );

    const applySchema = (text: string) => {
      try {
        const schema = JSON.parse(text);
        props.editor.loadSchema(schema);
        ElMessage.success('Schema 已应用');
      } catch (err) {
        ElMessage.error('Schema 解析失败');
      }
    };

    return () => (
      <div class="assem-schema-pane">
        <div class="assem-schema-toolbar">
          <ElButton
            size="small"
            type="primary"
            onClick={() => applySchema(schemaText.value)}
          >
            应用
          </ElButton>
          <ElButton
            size="small"
            onClick={() => navigator.clipboard?.writeText(schemaText.value)}
          >
            复制
          </ElButton>
        </div>
        <ElInput
          type="textarea"
          rows={24}
          modelValue={schemaText.value}
          readonly
          class="assem-schema-textarea"
        />
      </div>
    );
  }
});
