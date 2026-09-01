import type { Editor } from "../../../core/editor";
import type { DsDocHandle } from "../doc/use-data-source-doc";
import { CopyDocument, Delete, Edit, More, Top } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
/**
 * 服务 Tab（接口+服务合一）
 * 列表：全局配置入口 + 分组卡片（置顶/编辑/复制/删除/拦截器快捷入口）
 */
import { computed, defineComponent, PropType, ref, watch } from "vue";
import { useAssemNamespace } from "../../../hooks/use-assem-namespace";
import { DsGroupList } from "../shared/group-list";
import { DsMethodBadge } from "../shared/method-badge";
import { filterByKeyword, transformGroups, uniqueCopyId } from "../shared/use-grouping";
import { GlobalConfigEditor } from "./global-config-editor";
import { ServiceEditor } from "./service-editor";
import "../data-source-pane-style.less";

const ns = useAssemNamespace("data-source-pane");

export const ServicesTab = defineComponent({
  name: "DsServicesTab",
  props: {
    editor: { type: Object as PropType<Editor>, required: true },
    doc: { type: Object as PropType<DsDocHandle>, required: true },
    active: { type: Boolean, default: true },
  },
  setup(props) {
    const keyword = ref("");
    /** 编辑态：{ mode: add|edit|copy, name } */
    const editing = ref<{ mode: "add" | "edit" | "copy"; name: string } | null>(null);

    const items = computed(() => {
      const list = Object.entries(props.doc.state.requestConfig).map(([id, item]) => ({
        id,
        description: item.description ?? "",
        url: item.url,
        method: item.method,
        groupName: item.groupName,
        isTopUp: item.isTopUp,
        sort: item.sort,
      }));
      return filterByKeyword(list, keyword.value);
    });
    const groups = computed(() => transformGroups(items.value as any[], "groupName"));

    const removeService = (id: string) => {
      ElMessageBox.confirm(`确认删除服务 "${id}"？`, "删除提示", { type: "warning" })
        .then(() => {
          props.doc.commit(`删除服务 ${id}`, (doc) => {
            delete doc.requestConfig[id];
          });
        })
        .catch(() => ElMessage.info("取消删除"));
    };

    const copyService = (id: string) => {
      const source = props.doc.state.requestConfig[id];
      if (!source) {
        return;
      }
      const newId = uniqueCopyId(new Set(Object.keys(props.doc.state.requestConfig)), id);
      props.doc.commit(`复制服务 ${id} → ${newId}`, (doc) => {
        doc.requestConfig[newId] = JSON.parse(JSON.stringify(source));
      });
      ElMessage.success(`已复制为 "${newId}"`);
    };

    const toggleTopUp = (id: string) => {
      props.doc.commit(`置顶切换 ${id}`, (doc) => {
        const item = doc.requestConfig[id]!;
        item.isTopUp = !item.isTopUp;
      });
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
      const service = props.doc.state.requestConfig[item.id]!;
      return (
        <div class={ns.e("card")} key={item.id}>
          <div class={ns.e("card-main")}>
            <div class={ns.e("card-title")}>
              <DsMethodBadge method={item.method} />
              <span class={ns.e("card-name")} title={item.id}>{item.id}</span>
              {item.isTopUp
                ? (
                    <el-tooltip content="已置顶">
                      <el-icon class={ns.e("card-top-icon")}><Top /></el-icon>
                    </el-tooltip>
                  )
                : null}
            </div>
            <div class={ns.e("card-desc")} title={item.url}>
              <span class={ns.e("card-url")}>{item.url || "—"}</span>
            </div>
            <div class={ns.e("card-desc")}>{service.description || "—"}</div>
          </div>
          <div class={ns.e("card-ops")}>
            <el-dropdown
              trigger="click"
              onCommand={(cmd: string) => {
                if (cmd === "edit") {
                  editing.value = { mode: "edit", name: item.id };
                } else if (cmd === "copy") {
                  copyService(item.id);
                } else if (cmd === "topUp") {
                  toggleTopUp(item.id);
                } else if (cmd === "delete") {
                  removeService(item.id);
                }
              }}
            >
              {{
                default: () => (
                  <el-button text icon={More}>
                  </el-button>
                ),
                dropdown: () => (
                  <el-dropdown-menu>
                    <el-dropdown-item command="edit" icon={Edit}>编辑</el-dropdown-item>
                    <el-dropdown-item command="copy" icon={CopyDocument}>复制</el-dropdown-item>
                    <el-dropdown-item command="topUp" icon={Top}>
                      {item.isTopUp ? "取消置顶" : "置顶"}
                    </el-dropdown-item>
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
            placeholder="搜索编码/描述/url"
            clearable
          />
          <GlobalConfigEditor doc={props.doc} />
          <el-button
            type="primary"
            onClick={() => (editing.value = { mode: "add", name: "" })}
          >
            + 新增服务
          </el-button>
        </div>
        <div class={ns.e("list")}>
          <DsGroupList groups={groups.value} renderItem={renderItem} emptyText="暂无服务配置" />
        </div>
        {editing.value
          ? (
              <ServiceEditor
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
