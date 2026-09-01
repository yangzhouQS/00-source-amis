import type { Editor } from "../../../core/editor";
import type { DsDocHandle } from "../doc/use-data-source-doc";
import { Delete, Edit, More } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
/**
 * 模型 Tab：数据模型列表（新增/编辑/删除[带引用检查]）
 */
import { computed, defineComponent, PropType, ref, watch } from "vue";
import { useAssemNamespace } from "../../../hooks/use-assem-namespace";
import { filterByKeyword } from "../shared/use-grouping";
import { ModelEditor } from "./model-editor";
import { scanModelReferences } from "./reference-scan";
import "../data-source-pane-style.less";

const ns = useAssemNamespace("data-source-pane");

/** 模型统计徽标文案：2 表 · 10 字段 · 2 数组表 */
function modelBadge(model: any): string {
  const tables = Object.keys(model).filter(k => k !== "description");
  let fields = 0;
  let arrays = 0;
  for (const t of tables) {
    const v = model[t];
    if (Array.isArray(v)) {
      arrays += 1;
    }
    else if (v && typeof v === "object") {
      fields += Object.keys(v).length;
    }
  }
  return `${tables.length} 表 · ${fields} 字段${arrays ? ` · ${arrays} 数组表` : ""}`;
}

export const ModelsTab = defineComponent({
  name: "DsModelsTab",
  props: {
    editor: { type: Object as PropType<Editor>, required: true },
    doc: { type: Object as PropType<DsDocHandle>, required: true },
    active: { type: Boolean, default: true },
  },
  setup(props) {
    const keyword = ref("");
    const editing = ref<{ mode: "add" | "edit"; name: string } | null>(null);

    const items = computed(() => {
      const list = Object.entries(props.doc.state.dataModelConfig).map(([id, model]) => ({
        id,
        description: (model.description as string) ?? "",
        badge: modelBadge(model),
      }));
      return filterByKeyword(list, keyword.value);
    });

    const removeModel = (name: string) => {
      const refs = scanModelReferences(props.editor, name);
      const refLines = refs.length
        ? refs.slice(0, 8).map(r => `· ${r.type === "service" ? "服务" : "组件"} ${r.name}（${r.detail}）`).join("<br>")
          + (refs.length > 8 ? `<br>… 等共 ${refs.length} 处引用` : "")
        : "";
      ElMessageBox.confirm(
        refs.length
          ? `模型 "${name}" 正被以下位置引用，删除后相关功能将失效：<br>${refLines}`
          : `确认删除模型 "${name}"？`,
        "删除模型",
        { type: "warning", dangerouslyUseHTMLString: refs.length > 0 },
      )
        .then(() => {
          props.doc.commit(`删除模型 ${name}`, (doc) => {
            delete doc.dataModelConfig[name];
          });
        })
        .catch(() => ElMessage.info("取消删除"));
    };

    watch(
      () => props.active,
      (v) => {
        if (!v) {
          editing.value = null;
        }
      },
    );

    const renderItem = (item: any) => {
      const model = props.doc.state.dataModelConfig[item.id]!;
      return (
        <div class={ns.e("card")} key={item.id}>
          <div class={ns.e("card-main")}>
            <div class={ns.e("card-title")} title={item.id}>{item.id}</div>
            <div class={ns.e("card-desc")}>
              {model.description || "—"}
              <span class={ns.e("card-badge")}>{item.badge}</span>
            </div>
          </div>
          <div class={ns.e("card-ops")}>
            <el-dropdown
              trigger="click"
              onCommand={(cmd: string) => {
                if (cmd === "edit") {
                  editing.value = { mode: "edit", name: item.id };
                }
                else if (cmd === "delete") {
                  removeModel(item.id);
                }
              }}
            >
              {{
                default: () => (<el-button icon={More} text />),
                dropdown: () => (
                  <el-dropdown-menu>
                    <el-dropdown-item command="edit" icon={Edit}>编辑</el-dropdown-item>
                    <el-dropdown-item command="delete" icon={Delete} divided>删除</el-dropdown-item>
                  </el-dropdown-menu>
                ),
              }}
            </el-dropdown>
          </div>
        </div>
      );
    };

    return () => (
      <div class={ns.e("tab")}>
        <div class={ns.e("toolbar")}>
          <el-input
            class={ns.e("search")}
            modelValue={keyword.value}
            onUpdate:modelValue={(v: string) => (keyword.value = v)}
            placeholder="搜索模型名/描述"
            size="small"
            clearable
          />
          <el-button
            size="small"
            type="primary"
            onClick={() => (editing.value = { mode: "add", name: "" })}
          >
            + 新增模型
          </el-button>
        </div>
        <div class={ns.e("list")}>
          {items.value.length
            ? items.value.map(renderItem)
            : <el-empty description="暂无数据模型" imageSize={50} />}
        </div>
        {editing.value
          ? (
              <ModelEditor
                editor={props.editor}
                doc={props.doc}
                mode={editing.value.mode}
                name={editing.value.name}
                onClose={() => (editing.value = null)}
              />
            )
          : null}
      </div>
    );
  },
});
