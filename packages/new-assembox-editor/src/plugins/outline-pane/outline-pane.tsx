import type { Editor } from "../../core/editor";
import type { OutlineNode } from "../../core/store";
import type { ContextMenuAction } from "../../designer/context-menu-manager";
/**
 * 大纲树面板
 * 基于 schemaOps.walk 构建大纲树（格式无关），响应式渲染
 * - 点击节点选中
 * - 拖拽排序（el-tree draggable → editor.move）
 * - 右键菜单（复用 editor.contextMenu 注册的动作）
 */
import { computed, defineComponent, onBeforeUnmount, onMounted, PropType, ref } from "vue";
import { buildOutlineFromSchemaOps } from "../../core/store";
import { useAssemNamespace } from "../../hooks/use-assem-namespace";
import "./outline-pane-style.less";

const ns = useAssemNamespace("outline-pane");

/** 判断 descendantId 是否为 ancestorId 的后代（防拖拽成环） */
function isDescendant(nodes: OutlineNode[], ancestorId: string, targetId: string): boolean {
  for (const n of nodes) {
    if (n.id === ancestorId) {
      return n.children.some(c => c.id === targetId || isDescendant([c], ancestorId, targetId));
    }
    if (isDescendant(n.children, ancestorId, targetId)) {
      return true;
    }
  }
  return false;
}

/** 收集整棵树的顶层根节点 id 集合（用于禁止移动根节点） */
function collectRootIds(nodes: OutlineNode[]): Set<string> {
  return new Set(nodes.map(n => n.id));
}

/** 校验：将 dragNode 放入 parentId 的 slotKey 槽位是否被嵌套规则允许 */
function canNestInto(
  editor: Editor,
  dragId: string,
  parentId: string,
  slotKey: string,
): boolean {
  const schema = editor.store.schema;
  const dragNode = editor.schemaOps.getNodeById(schema, dragId);
  const parentNode = editor.schemaOps.getNodeById(schema, parentId);
  const childRenderType = dragNode?.__nodeOptions?.renderType;
  const parentRenderType = parentNode?.__nodeOptions?.renderType;
  if (!childRenderType || !parentRenderType) {
    return false;
  }
  return editor.nestingRules.canNest(parentRenderType, slotKey, childRenderType);
}

export const OutlinePane = defineComponent({
  name: "OutlinePane",
  props: {
    editor: { type: Object as PropType<Editor>, required: true },
  },
  setup(props) {
    /** 树节点 props 配置 */
    const treeProps = {
      label: "label",
      children: "children",
    };

    /** 响应式大纲：依赖 store.schemaRef */
    const outlineData = computed<OutlineNode[]>(() => {
      void props.editor.store.schemaRef.value;
      const schema = props.editor.store.schema;
      return buildOutlineFromSchemaOps(schema, props.editor.schemaOps);
    });

    // ── 右键菜单状态 ──
    const menuVisible = ref(false);
    const menuX = ref(0);
    const menuY = ref(0);
    const menuNodeId = ref<string | null>(null);

    /** 当前菜单上下文 */
    const menuContext = computed(() => ({
      nodeId: menuNodeId.value,
      editor: props.editor,
    }));

    /** 可用菜单动作（过滤 condition） */
    const menuActions = computed<ContextMenuAction[]>(() => {
      if (!menuVisible.value) {
        return [];
      }
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

    /** 关闭菜单（点击外部） */
    const clickAway = () => hideMenu();

    onMounted(() => document.addEventListener("click", clickAway, true));
    onBeforeUnmount(() => document.removeEventListener("click", clickAway, true));

    const handleMenuAction = (action: ContextMenuAction, disabled: boolean) => {
      if (disabled) {
        return;
      }
      const captured = menuContext.value;
      hideMenu();
      action.action?.(captured);
    };

    // ── 节点交互 ──
    const handleNodeClick = (data: OutlineNode) => {
      props.editor.select(data.id);
    };

    /** 右键节点：选中并弹出菜单 */
    const handleNodeContextMenu = (e: Event, data: OutlineNode) => {
      const me = e as MouseEvent;
      me.preventDefault();
      props.editor.select(data.id);
      showMenu(me, data.id);
    };

    // ── 拖拽排序 ──
    /** 拖拽校验：禁止环 + 禁止根节点平级移动 */
    const handleAllowDrop = (
      draggingNode: any,
      dropNode: any,
      type: "before" | "after" | "inner",
    ): boolean => {
      const dragId = draggingNode?.data?.id as string | undefined;
      const dropId = dropNode?.data?.id as string | undefined;
      if (!dragId || !dropId || dragId === dropId) {
        return false;
      }
      // 禁止拖入自身后代（成环）
      if (type === "inner" && isDescendant(outlineData.value, dragId, dropId)) {
        return false;
      }
      // 嵌套规则校验（与画布拖拽一致）
      if (type === "inner" && !canNestInto(props.editor, dragId, dropId, "defaultSlot")) {
        return false;
      }
      // 禁止在根节点之间平级拖拽（根节点顺序由 schema 场景决定）
      if (type !== "inner") {
        const roots = collectRootIds(outlineData.value);
        if (roots.has(dropId)) {
          return false;
        }
      }
      return true;
    };

    /** 拖放完成：映射到 editor.move */
    const handleNodeDrop = (
      draggingNode: any,
      dropNode: any,
      dropType: "before" | "after" | "inner",
    ) => {
      const dragId = draggingNode?.data?.id as string | undefined;
      const dropId = dropNode?.data?.id as string | undefined;
      if (!dragId || !dropId || dragId === dropId) {
        return;
      }

      if (dropType === "inner") {
        // 拖入目标节点默认槽位（最终校验：嵌套规则）
        if (!canNestInto(props.editor, dragId, dropId, "defaultSlot")) {
          return;
        }
        props.editor.move(dragId, dropId, "defaultSlot");
        return;
      }

      // 平级拖拽：目标 = dropNode 的父槽位 + 索引
      const loc = props.editor.schemaOps.findSlotOf?.(props.editor.store.schema, dropId);
      if (!loc) {
        return;
      }
      // 平级拖拽也校验目标父槽位
      if (!canNestInto(props.editor, dragId, loc.parentId, loc.slotKey)) {
        return;
      }
      const index = dropType === "after" ? loc.index + 1 : loc.index;
      props.editor.move(dragId, loc.parentId, loc.slotKey, index);
    };

    return () => {
      const data = outlineData.value;
      return (
        <div class={ns.b()}>
          {data.length === 0
            ? <el-empty description="暂无节点" imageSize={50} />
            : (
                <el-tree
                  data={data}
                  props={treeProps}
                  nodeKey="id"
                  defaultExpandAll
                  highlightCurrent
                  draggable
                  allowDrop={handleAllowDrop}
                  currentNodeKey={props.editor.store.state.activeId ?? undefined}
                  onNode-click={handleNodeClick}
                  onNodeDrop={handleNodeDrop}
                  onNodeContextMenu={handleNodeContextMenu}
                />
              )}

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
                ? <div class={ns.e("context-menu__empty")}>无可用操作</div>
                : menuActions.value.map((action) => {
                    if (action.separator) {
                      return <div class={ns.e("context-menu__separator")} key={action.name} />;
                    }
                    const disabled = props.editor.contextMenu.isDisabled(action, menuContext.value);
                    return (
                      <div
                        key={action.name}
                        class={[
                          ns.e("context-menu__item"),
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
