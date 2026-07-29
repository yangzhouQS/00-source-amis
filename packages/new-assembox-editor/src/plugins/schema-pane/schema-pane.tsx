/**
 * Schema 源码面板（Monaco JSON 编辑器）
 * 查看/编辑当前 schema，编辑后应用回画布
 * 使用 @guolao/vue-monaco-editor（CDN loader，免本地 worker 配置）
 */
import {defineComponent, PropType, ref, watch} from 'vue';
import {ElButton, ElMessage} from 'element-plus';
import {VueMonacoEditor} from '@guolao/vue-monaco-editor';
import type {Editor} from '../../core/editor';
import {useAssemNamespace} from '../../hooks/use-assem-namespace';
import './../pane.less';

const ns = useAssemNamespace('schema-pane');

export const SchemaPane = defineComponent({
  name: 'SchemaPane',
  props: {
    editor: {type: Object as PropType<Editor>, required: true}
  },
  setup(props) {
    const text = ref(JSON.stringify(props.editor.store.schema, null, 2));

    // store.schema 变化 → 同步编辑器（避免覆盖用户正在编辑的内容）
    watch(
      () => props.editor.store.schema,
      schema => {
        const fresh = JSON.stringify(schema, null, 2);
        if (fresh !== text.value) text.value = fresh;
      },
      {deep: false}
    );

    const apply = () => {
      try {
        props.editor.loadSchema(JSON.parse(text.value));
        ElMessage.success('Schema 已应用');
      } catch {
        ElMessage.error('Schema 解析失败：JSON 格式错误');
      }
    };

    return () => (
      <div class={ns.b()}>
        <div class={ns.e('toolbar')}>
          <ElButton size="small" type="primary" onClick={apply}>
            应用
          </ElButton>
          <ElButton
            size="small"
            onClick={() => navigator.clipboard?.writeText(text.value)}
          >
            复制
          </ElButton>
        </div>
        <div class={ns.e('editor')} style={{height: 'calc(100% - 40px)'}}>
          <VueMonacoEditor
            value={text.value}
            onUpdate:value={(v: string) => (text.value = v)}
            language="json"
            theme="vs"
            options={{
              minimap: {enabled: false},
              fontSize: 12,
              automaticLayout: true,
              scrollBeyondLastLine: false
            }}
          />
        </div>
      </div>
    );
  }
});
