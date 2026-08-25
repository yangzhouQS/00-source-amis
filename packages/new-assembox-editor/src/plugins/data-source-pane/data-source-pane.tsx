import type { Editor } from "../../core/editor";
import { RefreshLeft, RefreshRight } from "@element-plus/icons-vue";
/**
 * 数据源面板根组件：3 Tab（服务/模型/方法）+ 面板级撤销/重做
 * Tab 失活自动关闭各 Tab 内弹层（active prop 驱动）
 */
import { computed, defineComponent, onBeforeUnmount, onMounted, PropType, ref } from "vue";
import { useAssemNamespace } from "../../hooks/use-assem-namespace";
import { useDataSourceDoc } from "./doc/use-data-source-doc";
import { ServicesTab } from "./services/services-tab";
import { ModelsTab } from "./models/models-tab";
import { FnsTab } from "./fns/fns-tab";
import "./data-source-pane-style.less";

const ns = useAssemNamespace("data-source-pane");

export const DataSourcePane = defineComponent({
  name: "DataSourcePane",
  props: {
    editor: { type: Object as PropType<Editor>, required: true },
  },
  setup(props) {
    const doc = useDataSourceDoc(props.editor);
    const activeTab = ref("services");
    const activeName = computed({
      get: () => activeTab.value,
      set: (v: string) => (activeTab.value = v),
    });

    /** 面板聚焦时 Ctrl+Z / Ctrl+Shift+Z 走数据源独立历史（与 schema 撤销隔离） */
    const onKeydown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const inEditable = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z" || inEditable) {
        return;
      }
      e.preventDefault();
      if (e.shiftKey) {
        doc.redo();
      }
      else {
        doc.undo();
      }
    };

    onMounted(() => {
      window.addEventListener("keydown", onKeydown);
    });
    onBeforeUnmount(() => {
      window.removeEventListener("keydown", onKeydown);
    });

    return () => (
      <div class={ns.b()}>
        <div class={ns.e("header")}>
          <span class={ns.e("header-title")}>数据源</span>
          <el-button-group>
            <el-tooltip content="撤销数据源变更（Ctrl+Z）" placement="top">
              <el-button size="small" disabled={!doc.canUndo.value} onClick={() => doc.undo()}>
                <RefreshLeft />
              </el-button>
            </el-tooltip>
            <el-tooltip content="重做数据源变更（Ctrl+Shift+Z）" placement="top">
              <el-button size="small" disabled={!doc.canRedo.value} onClick={() => doc.redo()}>
                <RefreshRight />
              </el-button>
            </el-tooltip>
          </el-button-group>
        </div>
        <el-tabs v-model={activeName.value} class={ns.e("tabs")}>
          <el-tab-pane label="服务" name="services" lazy>
            <ServicesTab editor={props.editor} doc={doc} active={activeTab.value === "services"} />
          </el-tab-pane>
          <el-tab-pane label="模型" name="models" lazy>
            <ModelsTab editor={props.editor} doc={doc} active={activeTab.value === "models"} />
          </el-tab-pane>
          <el-tab-pane label="方法" name="fns" lazy>
            <FnsTab editor={props.editor} doc={doc} active={activeTab.value === "fns"} />
          </el-tab-pane>
        </el-tabs>
      </div>
    );
  },
});
