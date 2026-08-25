import type { SlotField, SlotHost } from "@cs/assembox-desktop-next";
import type { INestingRules } from "../../scenario/types";
import { RENDER_TYPE_CATEGORIES } from "./nesting-categories";
import { isCategoryAllowed, lookupMeta, lookupSlotGate } from "@cs/assembox-desktop-next";

/**
 * 编辑器侧槽位门禁覆盖表（渲染库未登记、仅编辑器拖拽校验需要的槽位）
 *
 * 渲染库 nesting.ts 的 SLOTS 表保持零编辑器特化；下列槽位只在编辑器侧生效：
 * - YqToolBar.defaultSlot：wrapper（assem-yq-tool-bar.vue）硬编码以单个
 *   AssemYqFlexLine 渲染 defaultSlot（不经 NodeRenderer，渲染期校验不查此门禁），
 *   编辑器需收紧为 layout 类——否则任意组件拖入会被错误地当 FlexLine 渲染。
 *   该槽同时是单节点语义（slot-accessors SINGLE_NODE_SLOTS）。
 */
const SLOT_GATE_OVERRIDES: Record<string, Record<string, string[]>> = {
  YqToolBar: { defaultSlot: ["layout"] },
};

/** 取槽位门禁：编辑器覆盖表优先，渲染库 SLOTS 表兜底 */
function slotGate(parentRenderType: string, slotKey: string): string[] | "any" | undefined {
  const override = SLOT_GATE_OVERRIDES[parentRenderType]?.[slotKey];
  if (override) {
    return override;
  }
  return lookupSlotGate(parentRenderType as SlotHost, slotKey as SlotField);
}

/**
 * PC 场景嵌套校验
 * 包装 assembox-desktop-next 的 nesting.ts（SLOTS 静态表，加载即可用）
 * + component-catalog.ts 的运行时注册表（外部组件兜底）
 *
 * 与渲染器的嵌套规则对齐：
 * - 槽位门禁：编辑器覆盖表（SLOT_GATE_OVERRIDES，渲染库未登记的槽位）优先；
 *   其余复用渲染库 lookupSlotGate 静态表（host / iframe 副本行为一致）
 * - 子组件 category：编辑器侧静态表（nesting-categories.ts，与渲染库 manifest
 *   COMPONENTS 对齐，由对齐守护测试防漂移）优先；渲染库运行时 lookupMeta 兜底
 *   （覆盖 registerExternal 注册的外部组件）。纯 lookupMeta 在 iframe 模式下
 *   host 侧副本未执行注册，恒 undefined → canNest 误判全拒绝，故需静态表。
 */
export class PcNestingRules implements INestingRules {
  canNest(parentRenderType: string, slotKey: string, childRenderType: string): boolean {
    const gate = slotGate(parentRenderType, slotKey);
    if (!gate) {
      return true;
    }
    if (gate === "any") {
      return true;
    }
    const childCategory = this.getCategory(childRenderType);
    if (!childCategory) {
      return false;
    }
    return isCategoryAllowed(childCategory as any, gate);
  }

  getAllowedCategories(parentRenderType: string, slotKey: string): string[] | undefined {
    const gate = slotGate(parentRenderType, slotKey);
    if (!gate || gate === "any") {
      return undefined;
    }
    return gate;
  }

  getCategory(renderType: string): string | undefined {
    // 静态对齐表优先（模块加载即可用）；外部组件走渲染库运行时注册表兜底
    return RENDER_TYPE_CATEGORIES[renderType] ?? lookupMeta(renderType)?.category;
  }
}
