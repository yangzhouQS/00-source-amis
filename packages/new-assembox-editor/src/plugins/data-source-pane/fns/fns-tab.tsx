import type { Editor } from "../../../core/editor";
import type { DsDocHandle } from "../doc/use-data-source-doc";
import { Delete, Edit, More, VideoPlay } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
/**
 * 方法 Tab：共享函数列表（enabled 直切 / 编辑 / 删除 / 试运行）
 */
import { computed, defineComponent, PropType, ref, watch } from "vue";
import { useAssemNamespace } from "../../../hooks/use-assem-namespace";
import { filterByKeyword } from "../shared/use-grouping";
import { FnEditor } from "./fn-editor";
import "../data-source-pane-style.less";

const ns = useAssemNamespace("data-source-pane");

export const FnsTab = defineComponent({
  name: "FnsTab",
  props: {
    editor: { type: Object as PropType<Editor>, required: true },
    doc: { type: Object as PropType<DsDocHandle>, required: true },
    /** 所在 Tab 是否激活（失活自动关闭弹层） */
    active: { type: Boolean, default: true },
  },
  setup(props) {
    const keyword = ref("");
    /** 编辑态：null=关闭；{ mode, name } */
    const editing = ref<{ mode: "add" | "edit"; name: string } | null>(null);

    const items = computed(() => {
      const list = Object.entries(props.doc.state.sharedFns).map(([id, item]) => ({
        id,
        description: item.description ?? "",
      }));
      return filterByKeyword(list, keyword.value);
    });

    const openAdd = () => {
      editing.value = { mode: "add", name: "" };
    };

    const openEdit = (id: string) => {
      editing.value = { mode: "edit", name: id };
    };

    const removeFn = (id: string) => {
      ElMessageBox.confirm(`确认删除方法 "${id}"？`, "删除提示", { type: "warning" })
        .then(() => {
          props.doc.commit(`删除方法 ${id}`, (doc) => {
            delete doc.sharedFns[id];
          });
        })
        .catch(() => ElMessage.info("取消删除"));
    };

    const toggleEnabled = (id: string, enabled: boolean) => {
      props.doc.commit(`${enabled ? "启用" : "禁用"}方法 ${id}`, (doc) => {
        doc.sharedFns[id]!.enabled = enabled;
      });
    };

    // Tab 失活自动关闭弹层（Drawer v-model 由子组件持有，这里通过 v-if 卸载）
    watch(
      () => props.active,
      (v) => {
        if (!v) {
          editing.value = null;
        }
      },
    );

    const renderItem = (item: any) => {
      const fnItem = props.doc.state.sharedFns[item.id]!;
      return (
        <div class={ns.e("card")} key={item.id}>
          <div class={ns.e("card-main")}>
            <div class={ns.e("card-title")} title={item.id}>{item.id}</div>
            <div class={ns.e("card-desc")} title={fnItem.description}>{fnItem.description || "—"}</div>
          </div>
          <div class={ns.e("card-ops")}>
            {/* <el-switch
              modelValue={fnItem.enabled}
              onUpdate:modelValue={(v: boolean) => toggleEnabled(item.id, v)}
            /> */}
            <el-dropdown
              trigger="click"
              onCommand={(cmd: string) => {
                if (cmd === "edit") {
                  openEdit(item.id);
                }
                else if (cmd === "tryRun") {
                  editing.value = { mode: "edit", name: item.id };
                }
                else if (cmd === "delete") {
                  removeFn(item.id);
                }
              }}
            >
              {{
                default: () => (
                  <el-button icon={More} text />
                ),
                dropdown: () => (
                  <el-dropdown-menu>
                    <el-dropdown-item command="edit" icon={Edit}>编辑</el-dropdown-item>
                    <el-dropdown-item command="tryRun" icon={VideoPlay}>编辑并试运行</el-dropdown-item>
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
            placeholder="搜索函数名/描述"
            clearable
          />
          <el-button type="primary" onClick={openAdd}>
            + 新增方法
          </el-button>
        </div>
        <div class={ns.e("list")}>
          {items.value.length
            ? items.value.map(renderItem)
            : <el-empty description="暂无共享方法" imageSize={50} />}
        </div>
        {editing.value
          ? (
              <FnEditor
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
