import type { ComponentCatalogItem, ComponentSlotConfig } from "../../scenario/types";
import { ElMessageBox } from "element-plus";
/**
 * SlotToggleSetter —— 插槽启停切换 setter（声明式，任意组件可复用）
 *
 * 背景（借鉴旧版 component-property 的插槽 checkbox 交互，升级为 setter 化）：
 * 多插槽宿主（如 YqToolBar 三槽）需要按需启用/关闭插槽——关闭置 null（渲染层
 * 出厂态，wrapper useNodeOptions 默认即 null，v-if/Array.isArray 全兼容），
 * 启用给对应槽位类型的默认值（array → []；object → 白名单首项 scaffold 节点）。
 *
 * 数据源（docs/19 单一真相源原则）：
 * - 优先从 catalog 的 slots 声明反查（按 fieldName 匹配宿主 renderType 的槽位），
 *   slotType/slotRender 不在 props 元数据中重复声明，避免同文件两处漂移
 * - setterProps 显式传入 slotType/defaultRenderType 时覆盖（供 registerExternal
 *   外部组件等无 slots 声明者使用）
 *
 * 接入方式（组件元数据一行）：
 *   { name: "filterSlot", title: "过滤器插槽", propType: "json", setter: "SlotToggleSetter" }
 *
 * 关闭已有内容的插槽 = 删数据：ElMessageBox 二次确认（编辑器有 undo，风险兜底）。
 */
import { computed } from "vue";
import { defineSetter, useSetterCtx } from "../base";

/** 槽位启停的下一个值（纯函数，单测友好）
 *  enable=false → null（渲染层未启用态）
 *  enable=true + array → []（启用・空，画布出占位）
 *  enable=true + object → 白名单首项 scaffold 节点（如 YqToolBar.defaultSlot → YqFlexLine） */
export function nextSlotValue(
  enable: boolean,
  slot: Pick<ComponentSlotConfig, "slotType" | "slotRender"> | undefined,
  deps: {
    /** 造默认节点：对齐 editor.onDrop 的 createNode(renderType, name, cloneSchema(scaffold)) */
    createScaffoldNode?: (renderType: string) => any;
  } = {},
): any {
  if (!enable) {
    return null;
  }
  if (slot?.slotType === "array") {
    return [];
  }
  // object 槽：白名单首项（无 slotRender 则无法造默认节点，退化为空数组占位由调用方文案提示）
  const target = slot?.slotRender?.[0];
  if (slot?.slotType === "object" && target && deps.createScaffoldNode) {
    return deps.createScaffoldNode(target);
  }
  return null;
}

/** 值的槽位子项计数（状态文案用；object 槽恒 1，array 槽取长度，null 为 0） */
export function countSlotChildren(value: any): number {
  if (Array.isArray(value)) {
    return value.length;
  }
  return value != null ? 1 : 0;
}

/** 从 catalog slots 声明反查当前字段的槽位语义（setterProps 覆盖优先） */
function resolveSlotSemantics(
  ctxField: string | undefined,
  setterProps: Record<string, any>,
  hostRenderType: string | undefined,
  catalog: { getComponents: () => ComponentCatalogItem[] } | undefined,
): Pick<ComponentSlotConfig, "slotType" | "slotRender"> | undefined {
  // 显式 setterProps 覆盖（外部组件通道）
  if (setterProps.slotType) {
    return {
      slotType: setterProps.slotType,
      slotRender: setterProps.defaultRenderType ? [setterProps.defaultRenderType] : undefined,
    };
  }
  if (!ctxField || !hostRenderType || !catalog) {
    return undefined;
  }
  const host = catalog.getComponents().find(c => c.renderType === hostRenderType);
  return host?.slots?.find(s => s.name === ctxField);
}

export const SlotToggleSetter = defineSetter<any>(
  "SlotToggleSetter",
  (props, ctx) => {
    const enabled = computed(() => props.value != null);
    const childCount = computed(() => countSlotChildren(props.value));

    /** 宿主 renderType（从当前节点取，经 ctx.nodeId 定位） */
    const hostRenderType = computed(() => {
      const nodeId = ctx?.nodeId;
      if (!nodeId || !ctx?.editor) {
        return undefined;
      }
      return ctx.editor.schemaOps.getNodeById(
        ctx.editor.store.schema,
        nodeId,
      )?.__nodeOptions?.renderType;
    });

    const slot = computed(() =>
      resolveSlotSemantics(props.fieldName, props, hostRenderType.value, ctx?.editor?.catalog));

    const toggle = (enable: boolean) => {
      if (!enable && childCount.value > 0) {
        // 关闭 = 删数据：二次确认（undo 可撤销，但明确告知）
        ElMessageBox.confirm(
          `该插槽下有 ${childCount.value} 个子节点，关闭将删除这些配置（可通过撤销恢复）。`,
          "关闭插槽",
          { type: "warning", confirmButtonText: "关闭", cancelButtonText: "取消" },
        )
          .then(() => props.onChange(nextSlotValue(false, slot.value)))
          .catch(() => {/* 取消：开关由受控值自然回弹 */});
        return;
      }
      props.onChange(
        nextSlotValue(enable, slot.value, {
          createScaffoldNode: (renderType) => {
            const ed = ctx?.editor;
            if (!ed) {
              return null;
            }
            const item = ed.catalog.getComponents().find(c => c.renderType === renderType);
            return ed.schemaOps.createNode(
              renderType,
              item?.name ?? renderType,
              item ? ed.schemaOps.cloneSchema(item.scaffold) : undefined,
            );
          },
        }),
      );
    };

    const statusText = computed(() => {
      if (!enabled.value) {
        return "未启用";
      }
      return childCount.value > 0 ? `已启用 · ${childCount.value} 项` : "已启用 · 空";
    });

    return (
      <div class="assem-slot-toggle">
        <el-switch
          modelValue={enabled.value}
          disabled={props.disabled}
          onUpdate:modelValue={(v: any) => toggle(!!v)}
        />
        <span class="assem-slot-toggle__status">{statusText.value}</span>
      </div>
    );
  },
);
