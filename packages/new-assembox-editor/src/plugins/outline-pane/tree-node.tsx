import type { Editor } from "../../core/editor";
import type { OutlineNode } from "../../core/store";
/**
 * 大纲树单节点（自绘，参考 lc-engine tree-title.tsx）
 *
 * 职责：图标 + 标签（搜索高亮）+ 展开箭头 + 悬停删除按钮 + 拖拽事件上报
 * 递归渲染子节点（展开状态由父级共享 Set 控制）
 */
import { CaretRight, Delete } from "@element-plus/icons-vue";
import { computed, defineComponent, h, PropType } from "vue";
import { PC_RENDER_TYPE_ICONS } from "../../icons";
import { useAssemNamespace } from "../../hooks/use-assem-namespace";

const ns = useAssemNamespace("outline-pane");

/** 搜索高亮：关键词 <mark> 包裹 */
function highlightLabel(label: string, text: string): any {
  if (!text) return label;
  const idx = label.indexOf(text);
  if (idx < 0) return label;
  return [
    label.slice(0, idx),
    <mark>{label.slice(idx, idx + text.length)}</mark>,
    label.slice(idx + text.length),
  ];
}

export const TreeNode = defineComponent({
  name: "OutlineTreeNode",
  props: {
    editor: { type: Object as PropType<Editor>, required: true },
    node: { type: Object as PropType<OutlineNode>, required: true },
    depth: { type: Number, default: 0 },
    expandedIds: { type: Object as PropType<Set<string>>, required: true },
    filterText: { type: String, default: "" },
    isDragOver: { type: String as PropType<"" | "before" | "after" | "inner">, default: "" },
    draggingId: { type: String, default: "" },
    /** 搜索模式：忽略 expandedIds，始终展开（匹配节点的父链需要可见） */
    forceExpand: { type: Boolean, default: false },
  },
  emits: ["select", "toggle", "delete", "contextmenu", "dragstart", "dragover", "drop", "dragend"],
  setup(props, { emit }) {
    const hasChildren = computed(() => props.node.children.length > 0);
    const isExpanded = computed(() =>
      props.forceExpand || (hasChildren.value && props.expandedIds.has(props.node.id)));
    const isSelected = computed(() =>
      props.editor.store.state.activeId === props.node.id);
    const isScene = computed(() => props.node.id.startsWith("__scene__"));
    const isHovered = computed(() =>
      props.editor.store.state.hoverId === props.node.id);

    const isMatch = computed(() =>
      !!(props.filterText && (
        props.node.label.includes(props.filterText)
        || displayLabel.value.includes(props.filterText)
      )));

    /** 图标（P0）：PC_RENDER_TYPE_ICONS 57 个映射，未映射显示 ·。
     *  必须用 h() 渲染组件——直接放 JSX children 会 stringify 成 [object Object] */
    const renderIcon = () => {
      const comp = PC_RENDER_TYPE_ICONS[props.node.type];
      if (comp && typeof comp === "object") {
        return h(comp as any, { style: "width:14px;height:14px;" });
      }
      if (typeof comp === "string" && comp) {
        return h("img", { src: comp, style: "width:14px;height:14px;", alt: "" });
      }
      return h("span", "·");
    };

    /** 标签：优先组件显示名（catalog name），__nodeName 作副标签 */
    const displayLabel = computed(() => {
      const item = props.editor.catalog?.getComponents().find(
        (c: any) => c.renderType === props.node.type,
      );
      return item?.name ?? props.node.label;
    });

    return () => (
      <>
        <div
          class={[
            ns.e("node"),
            ns.is("selected", isSelected.value),
            ns.is("hovered", isHovered.value),
            ns.is("scene", isScene.value),
            ns.is("drag-over", props.isDragOver === "before" || props.isDragOver === "after"),
            ns.is("drag-inner", props.isDragOver === "inner"),
          ]}
          style={{ paddingLeft: `${props.depth * 14}px` }}
          draggable={!isScene.value}
          data-node-id={props.node.id}
          onClick={() => emit("select", props.node)}
          onMouseenter={() => {
            // 大纲树 hover → 画布 hover-box 联动（detecting 双向联动，对齐 lc-engine）
            if (!isScene.value) {
              props.editor.store.state.hoverId = props.node.id;
            }
          }}
          onMouseleave={() => {
            if (props.editor.store.state.hoverId === props.node.id) {
              props.editor.store.state.hoverId = null;
            }
          }}
          onContextmenu={(e: MouseEvent) => emit("contextmenu", e, props.node)}
          onDragstart={(e: DragEvent) => emit("dragstart", e, props.node)}
          onDragover={(e: DragEvent) => emit("dragover", e, props.node)}
          onDrop={(e: DragEvent) => emit("drop", e, props.node)}
          onDragend={() => emit("dragend")}
        >
          {/* 展开箭头 */}
          {hasChildren.value && (
            <span
              class={[ns.e("node-arrow"), ns.is("expanded", isExpanded.value)]}
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                emit("toggle", props.node.id);
              }}
            >
              <el-icon size={10}><CaretRight /></el-icon>
            </span>
          )}
          {!hasChildren.value && <span class={ns.e("node-arrow-spacer")} />}

          {/* 组件图标（h() 渲染，防 [object Object]） */}
          <span class={ns.e("node-icon")}>
            {renderIcon()}
          </span>

          {/* 标签（搜索高亮）：优先组件显示名，__nodeName 副标签 */}
          <span class={[ns.e("node-label"), ns.is("match", !!isMatch.value)]}>
            {highlightLabel(displayLabel.value, props.filterText)}
          </span>
          {props.node.label !== displayLabel.value && (
            <span class={ns.e("node-sub")}>{props.node.label}</span>
          )}

          {/* 删除按钮（P0）：hover 显示，场景分组不可删 */}
          {!isScene.value && (
            <span class={ns.e("node-actions")}>
              <el-popconfirm
                title="确定删除该节点吗？"
                width={180}
                onConfirm={() => emit("delete", props.node.id)}
              >
                {{
                  reference: () => (
                    <el-button link type="danger" size="small">
                      <el-icon size={12}><Delete /></el-icon>
                    </el-button>
                  ),
                }}
              </el-popconfirm>
            </span>
          )}
        </div>

        {/* 递归子节点 */}
        {hasChildren.value && isExpanded.value && (
          <div class={ns.e("children")}>
            {props.node.children.map(child => (
              <TreeNode
                key={child.id}
                editor={props.editor}
                node={child}
                depth={props.depth + 1}
                expandedIds={props.expandedIds}
                filterText={props.filterText}
                forceExpand={props.forceExpand}
                isDragOver={props.draggingId ? props.isDragOver : ""}
                draggingId={props.draggingId}
                onSelect={(n: OutlineNode) => emit("select", n)}
                onToggle={(id: string) => emit("toggle", id)}
                onDelete={(id: string) => emit("delete", id)}
                onContextmenu={(e: MouseEvent, n: OutlineNode) => emit("contextmenu", e, n)}
                onDragstart={(e: DragEvent, n: OutlineNode) => emit("dragstart", e, n)}
                onDragover={(e: DragEvent, n: OutlineNode) => emit("dragover", e, n)}
                onDrop={(e: DragEvent, n: OutlineNode) => emit("drop", e, n)}
                onDragend={() => emit("dragend")}
              />
            ))}
          </div>
        )}
      </>
    );
  },
});
