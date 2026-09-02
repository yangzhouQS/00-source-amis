import type { Editor } from "../../core/editor";
import type { OutlineNode } from "../../core/store";
import type { ContextMenuAction } from "../../designer/context-menu-manager";
/**
 * 大纲树面板（自绘，参考 lc-engine plugin-outline-pane）
 *
 * 完全抛弃 el-tree，TreeNode 递归渲染。
 * - 搜索过滤 + 关键词高亮（P0）
 * - 组件图标（P0，PC_RENDER_TYPE_ICONS 57 个映射）
 * - 悬停删除按钮 + popconfirm（P0）
 * - 自绘拖拽（before/after/inner 三种落点 + dwell 悬停展开）
 * - 右键菜单（复用 ContextMenuManager）
 * - 场景分组（多场景时点击分组头切换）
 */
import { Search } from "@element-plus/icons-vue";
import { computed, defineComponent, onBeforeUnmount, onMounted, PropType, ref } from "vue";
import { buildOutlineFromSchemaOps, buildOutlineGroupedByScene } from "../../core/store";
import { useAssemNamespace } from "../../hooks/use-assem-namespace";
import { TreeNode } from "./tree-node";
import { canDrop, computeDropMode, DwellExpander, executeDrop, type DropMode } from "./tree-drag";
import "./outline-pane-style.less";

const ns = useAssemNamespace("outline-pane");

/** 递归过滤：按 label 或组件显示名匹配，保留自身或后代匹配的节点 */
function filterTree(nodes: OutlineNode[], text: string, editor: Editor): OutlineNode[] {
  if (!text) return nodes;
  const getDisplayName = (node: OutlineNode): string => {
    const item = editor.catalog?.getComponents().find((c: any) => c.renderType === node.type);
    return item?.name ?? node.label;
  };
  const result: OutlineNode[] = [];
  for (const n of nodes) {
    const children = filterTree(n.children, text, editor);
    if (n.label.includes(text) || getDisplayName(n).includes(text) || children.length > 0) {
      result.push({ ...n, children });
    }
  }
  return result;
}

export const OutlinePane = defineComponent({
  name: "OutlinePane",
  props: {
    editor: { type: Object as PropType<Editor>, required: true },
  },
  setup(props) {
    // ── 搜索（P0）──
    const filterText = ref("");

    /** 响应式大纲（依赖 store.schemaRef） */
    const outlineData = computed<OutlineNode[]>(() => {
      void props.editor.store.schemaRef.value;
      void props.editor.store.state.activeScene;
      const schema = props.editor.store.schema;
      const sceneKeys = schema && typeof schema === "object" ? Object.keys(schema) : [];
      if (sceneKeys.length <= 1) {
        return buildOutlineFromSchemaOps(schema, props.editor.schemaOps);
      }
      return buildOutlineGroupedByScene(schema, props.editor.schemaOps);
    });

    /** 过滤后的大纲（搜索时自动展开全部） */
    const filteredData = computed(() =>
      filterTree(outlineData.value, filterText.value, props.editor));

    // ── 展开状态 ──
    const expandedIds = ref(new Set<string>());

    /** 搜索时全部展开（哨兵 Set，不可变引用） */
    const expandedAllSet = new Set<string>(); // 占位空 Set，搜索时 TreeNode 始终展开

    /** 初始化全部展开（schema 变化时保持已展开的 + 新增节点父级自动展开） */
    const initExpanded = () => {
      const all = new Set<string>();
      const walk = (nodes: OutlineNode[]) => {
        for (const n of nodes) {
          if (n.children.length > 0) all.add(n.id);
          walk(n.children);
        }
      };
      walk(outlineData.value);
      expandedIds.value = all;
    };
    initExpanded();

    const toggleExpand = (id: string) => {
      const next = new Set(expandedIds.value);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      expandedIds.value = next;
    };

    // ── 选中 ──
    const handleSelect = (node: OutlineNode) => {
      if (node.id.startsWith("__scene__")) {
        props.editor.setScene(node.id.replace("__scene__", ""));
        return;
      }
      props.editor.select(node.id);
    };

    // ── 删除（P0，悬停按钮）──
    const handleDelete = (id: string) => {
      props.editor.remove(id);
    };

    // ── 右键菜单（复用 ContextMenuManager）──
    const menuVisible = ref(false);
    const menuX = ref(0);
    const menuY = ref(0);
    const menuNodeId = ref<string | null>(null);

    const menuContext = computed(() => ({
      nodeId: menuNodeId.value,
      editor: props.editor,
    }));

    const menuActions = computed(() => {
      if (!menuVisible.value) return [];
      return props.editor.contextMenu.getAvailableActions(menuContext.value);
    });

    const showMenu = (e: MouseEvent, id: string | null) => {
      menuX.value = e.clientX;
      menuY.value = e.clientY;
      menuNodeId.value = id;
      menuVisible.value = true;
    };

    const hideMenu = () => {
      menuVisible.value = false;
      menuNodeId.value = null;
    };

    const clickAway = () => hideMenu();

    onMounted(() => document.addEventListener("click", clickAway, true));
    onBeforeUnmount(() => document.removeEventListener("click", clickAway, true));

    const handleContextMenu = (e: MouseEvent, node: OutlineNode) => {
      if (node.id.startsWith("__scene__")) return;
      e.preventDefault();
      props.editor.select(node.id);
      showMenu(e, node.id);
    };

    const handleMenuAction = (action: ContextMenuAction, disabled: boolean) => {
      if (disabled) return;
      const captured = menuContext.value;
      hideMenu();
      action.action?.(captured);
    };

    // ── 拖拽（自绘）──
    const draggingId = ref("");
    const dragOverId = ref("");
    const dragOverMode = ref<DropMode>("inner");
    const dwell = new DwellExpander();

    const handleDragStart = (e: DragEvent, node: OutlineNode) => {
      draggingId.value = node.id;
      e.dataTransfer?.setData("text/plain", node.id);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: DragEvent, node: OutlineNode) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      if (!draggingId.value || node.id.startsWith("__scene__")) return;

      // 落点计算 + 校验
      const el = (e.currentTarget as HTMLElement);
      const mode = computeDropMode(el, e.clientY);
      const ok = canDrop(props.editor, draggingId.value, node.id, mode, outlineData.value);

      dragOverId.value = ok ? node.id : "";
      dragOverMode.value = ok ? mode : "inner";

      // dwell 悬停展开
      const isCollapsed = node.children.length > 0 && !expandedIds.value.has(node.id);
      dwell.hover(node.id, isCollapsed, (id) => {
        const next = new Set(expandedIds.value);
        next.add(id);
        expandedIds.value = next;
      });
    };

    const handleDrop = (e: DragEvent, node: OutlineNode) => {
      e.preventDefault();
      dwell.reset();
      const dragId = draggingId.value || e.dataTransfer?.getData("text/plain") || "";
      if (!dragId) return;
      if (dragOverId.value === node.id) {
        executeDrop(props.editor, dragId, node.id, dragOverMode.value);
      }
      clearDragState();
    };

    const handleDragEnd = () => {
      dwell.reset();
      clearDragState();
    };

    const clearDragState = () => {
      draggingId.value = "";
      dragOverId.value = "";
      dragOverMode.value = "inner";
    };

    onBeforeUnmount(() => dwell.destroy());

    return () => {
      const data = filteredData.value;
      return (
        <div class={ns.b()}>
          {/* 搜索栏（P0） */}
          <el-input
            class={ns.e("search")}
            modelValue={filterText.value}
            onUpdate:modelValue={(v: string) => (filterText.value = v)}
            placeholder="搜索节点"
            clearable
            size="small"
            prefixIcon={Search}
          />

          {/* 树 */}
          <div class={ns.e("tree")}>
            {data.length === 0
              ? <el-empty
                  description={filterText.value ? "无匹配节点" : "暂无节点"}
                  imageSize={50}
                />
              : data.map(node => (
                  <TreeNode
                    key={node.id}
                    editor={props.editor}
                    node={node}
                    depth={0}
                    expandedIds={expandedIds.value}
                    filterText={filterText.value}
                    forceExpand={!!filterText.value}
                    isDragOver={dragOverId.value === node.id ? dragOverMode.value : ""}
                    draggingId={draggingId.value}
                    onSelect={handleSelect}
                    onToggle={toggleExpand}
                    onDelete={handleDelete}
                    onContextmenu={handleContextMenu}
                    onDragstart={handleDragStart}
                    onDragover={handleDragOver}
                    onDrop={handleDrop}
                    onDragend={handleDragEnd}
                  />
                ))}
          </div>

          {/* 右键菜单 */}
          {menuVisible.value && (
            <div
              class={ns.e("context-menu")}
              style={{
                position: "fixed",
                left: `${menuX.value}px`,
                top: `${menuY.value}px`,
                zIndex: 99999,
              }}
            >
              {menuActions.value.length === 0
                ? <div class={ns.e("context-menu-empty")}>无可用操作</div>
                : menuActions.value.map((action) => {
                    if (action.separator) {
                      return <div class={ns.e("context-menu-separator")} key={action.name} />;
                    }
                    const disabled = props.editor.contextMenu.isDisabled(action, menuContext.value);
                    return (
                      <div
                        key={action.name}
                        class={[
                          ns.e("context-menu-item"),
                          action.danger ? ns.is("danger") : "",
                          disabled ? ns.is("disabled") : "",
                        ]}
                        onClick={() => handleMenuAction(action, disabled)}
                      >
                        <span>{action.title}</span>
                      </div>
                    );
                  })}
            </div>
          )}
        </div>
      );
    };
  },
});
