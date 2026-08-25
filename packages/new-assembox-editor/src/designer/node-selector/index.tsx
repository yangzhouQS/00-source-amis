import type { Editor } from "../../core/editor";
import type { EditorStore } from "../../core/store";
import type { ComponentCatalogItem } from '../../scenario';
/**
 * 选中节点信息选择器（BemTools 工具栏最左侧的节点信息胶囊）
 *
 * 借鉴 lowcode-engine builtin-simulator/node-selector（React 版）：
 * - 触发器：当前选中节点 图标 + 名称（catalog 元数据）+ ▾ 展开指示
 * - hover 展开父级链（向上 getParentById 最多 5 层，到根节点停）
 * - 点击父级项 → 选中该父节点（面包屑向上选容器，解决深层嵌套容器
 *   "点不到/被遮挡"的选中痛点）
 * - hover 父级项 → 联动高亮该节点（写 store.state.hoverId，BemTools hover 框响应）
 *
 * 弹层用 el-popover（trigger=hover）：悬停展开、移入弹层持续显示
 * （enterable 桥接 + hideAfter 延时由组件自理）。
 * 历史坑（已修）：hoverId 变化使 BemTools 的 boxes 数组（无 key）按位置
 * patch，select-box 子树被重挂载 → 弹层替换为关闭态新实例，表现为
 * "鼠标移向选项弹层就收起"。修复：bem-tools.tsx boxes 元素补稳定 key。
 */

import { computed, defineComponent, h, PropType } from "vue";
import { useAssemNamespace } from "../../hooks/use-assem-namespace";
import "./node-selector-style.less";

const ns = useAssemNamespace("bem-tools");
/** 父级链最大层数（对齐 lowcode getParentNodes 的 5 层上限） */
const MAX_ANCESTORS = 5;

/** 单个节点条目元信息（图标 + 标题） */
interface NodeEntry {
  id: string;
  title: string;
  icon: ComponentCatalogItem["icon"];
}

export const NodeSelector = defineComponent({
  name: "NodeSelector",
  props: {
    store: { type: Object as PropType<EditorStore>, required: true },
    editor: { type: Object as PropType<Editor>, default: null },
  },
  setup(props) {
    const catalogItem = (renderType: string): ComponentCatalogItem | undefined =>
      props.editor?.catalog?.getComponents().find(c => c.renderType === renderType);

    /** schema 节点 → 展示条目（catalog 名称/图标优先，__nodeName 兜底） */
    const toEntry = (node: any): NodeEntry | null => {
      if (!node) {
        return null;
      }
      const renderType: string = node.__nodeOptions?.renderType ?? "";
      const meta = renderType ? catalogItem(renderType) : undefined;
      return {
        id: node.__nodeId,
        title: meta?.name ?? node.__nodeName ?? renderType,
        icon: meta?.icon,
      };
    };

    /** 当前选中节点条目 */
    const current = computed<NodeEntry | null>(() => {
      const id = props.store.state.activeId;
      if (!id || !props.editor) {
        return null;
      }
      return toEntry(props.editor.schemaOps.getNodeById(props.store.state.schema, id));
    });

    /** 父级链（自当前节点向上，最多 5 层；到根/找不到停） */
    const ancestors = computed<NodeEntry[]>(() => {
      const id = props.store.state.activeId;
      if (!id || !props.editor) {
        return [];
      }
      const list: NodeEntry[] = [];
      let cur: any = props.editor.schemaOps.getNodeById(props.store.state.schema, id);
      while (cur && list.length < MAX_ANCESTORS) {
        cur = props.editor.schemaOps.getParentById(props.store.state.schema, cur.__nodeId);
        if (!cur) {
          break;
        }
        const entry = toEntry(cur);
        if (entry) {
          list.push(entry);
        }
      }
      return list;
    });

    /** 渲染图标（catalog.icon：组件直接 h 渲染） */
    const renderIcon = (icon: NodeEntry["icon"]) => {
      if (icon && typeof icon === "object") {
        return h(icon as any, { style: "width:12px;height:12px;" });
      }
      return null;
    };

    /** 父级项交互：hover 联动高亮，点击选中（对齐 lowcode onSelect/onMouseOver） */
    const handleItemEnter = (entry: NodeEntry) => {
      props.store.state.hoverId = entry.id;
    };
    const handleItemClick = (entry: NodeEntry) => {
      props.store.state.hoverId = null;
      props.editor?.select(entry.id);
    };

    return () => {
      const cur = current.value;
      if (!cur) {
        return null;
      }

      /** 触发器胶囊（无父级链时单独渲染，不包 popover） */
      const capsule = (
        <div class={ns.e("node-selector-current")}>
          {renderIcon(cur.icon)}
          <span class={ns.e("node-selector-title")}>{cur.title}</span>
          {ancestors.value.length > 0 && <span class={ns.e("node-selector-caret")}>▾</span>}
        </div>
      );

      return (
        <div class={ns.e("node-selector")}>
          {ancestors.value.length > 0
            ? (
              <el-popover
                trigger="hover"
                placement="bottom-start"
                width="auto"
                offset={4}
                showArrow={false}
                popperClass={ns.e("node-selector-popper")}
                onAfterLeave={() => {
                  // 弹层收起后清联动高亮
                  props.store.state.hoverId = null;
                }}
              >
                  {{
                    reference: () => capsule,
                    default: () => (
                      <div class={ns.e("node-selector-list")}>
                        {ancestors.value.map(entry => (
                          <div
                            key={entry.id}
                            class={ns.e("node-selector-item")}
                            onMouseenter={() => handleItemEnter(entry)}
                            onClick={() => handleItemClick(entry)}
                          >
                            {renderIcon(entry.icon)}
                            <span class={ns.e("node-selector-title")}>{entry.title}</span>
                          </div>
                        ))}
                      </div>
                    ),
                  }}
                </el-popover>
              )
            : capsule}
        </div>
      );
    };
  },
});
