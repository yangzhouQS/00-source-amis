import type { Editor } from "../../core/editor";
import { ElMessage } from "element-plus";
/**
 * Schema 源码面板（Monaco JSON 编辑器 + 全屏放大）
 * 查看/编辑当前 schema，编辑后应用回画布
 * Monaco 走共享 CodeEditor（CDN loader，免本地 worker 配置；
 * 面板空间有限，右上角可全屏铺满视口编辑，ESC 退出）
 */
import { defineComponent, PropType, ref, watch } from "vue";
import { useAssemNamespace } from "../../hooks/use-assem-namespace";
import { CodeEditor } from "../../components/code-editor";
import "./schema-pane-style.less";

const ns = useAssemNamespace("schema-pane");

export const SchemaPane = defineComponent({
  name: "SchemaPane",
  props: {
    editor: { type: Object as PropType<Editor>, required: true },
  },
  setup(props) {
    const text = ref(JSON.stringify(props.editor.store.schema, null, 2));

    // store.schema 变化 → 同步编辑器（避免覆盖用户正在编辑的内容）
    watch(
      () => props.editor.store.schema,
      (schema) => {
        const fresh = JSON.stringify(schema, null, 2);
        if (fresh !== text.value) {
          text.value = fresh;
        }
      },
      { deep: false },
    );

    const apply = () => {
      try {
        props.editor.loadSchema(JSON.parse(text.value));
        ElMessage.success("Schema 已应用");
      } catch {
        ElMessage.error("Schema 解析失败：JSON 格式错误");
      }
    };

    return () => (
      <div class={ns.b()}>
        <div class={ns.e("toolbar")}>
          <el-button size="small" type="primary" onClick={apply}>
            应用
          </el-button>
          <el-button
            size="small"
            onClick={() => navigator.clipboard?.writeText(text.value)}
          >
            复制
          </el-button>
        </div>
        <div class={ns.e("editor")}>
          <CodeEditor
            value={text.value}
            onUpdate:value={(v: string) => (text.value = v)}
            language="json"
            height="100%"
          />
        </div>
      </div>
    );
  },
});
