import type { Editor } from "../../core/editor";
/**
 * 高级 Tab
 * 节点 id 展示 / 删除节点
 */
import { defineComponent, PropType } from "vue";
import { useAssemNamespace } from "../../hooks/use-assem-namespace";

const ns = useAssemNamespace("setting-pane");

export const AdvancedTab = defineComponent({
  name: "SettingsPaneAdvancedTab",
  props: {
    editor: { type: Object as PropType<Editor>, required: true },
    nodeId: { type: String, required: true },
  },
  setup(props) {
    return () => (
      <el-form labelWidth="80px" size="small">
        <el-form-item label="节点ID">
          <code class={ns.e("node-id")}>{props.nodeId}</code>
        </el-form-item>
        <el-form-item label="操作">
          <el-button
            type="danger"
            size="small"
            onClick={() => props.editor.remove(props.nodeId)}
          >
            删除节点
          </el-button>
        </el-form-item>
      </el-form>
    );
  },
});
