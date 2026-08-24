import type { SlotField, SlotHost } from "@cs/assembox-desktop-next";
import type { INestingRules } from "../../scenario/types";
import { isCategoryAllowed, lookupMeta, lookupSlotGate } from "@cs/assembox-desktop-next";
import { RENDER_TYPE_CATEGORIES } from "./nesting-categories";

/**
 * PC 场景嵌套校验
 * 包装 assembox-desktop-next 的 nesting.ts（SLOTS 静态表，加载即可用）
 * + component-catalog.ts 的运行时注册表（外部组件兜底）
 *
 * 与渲染器的嵌套规则对齐：
 * - 槽位门禁（SLOTS 白名单）：直接复用渲染库 lookupSlotGate —— 它是静态数据，
 *   host / iframe 副本行为一致
 * - 子组件 category：编辑器侧静态表（nesting-categories.ts，与渲染库 manifest
 *   COMPONENTS 对齐，由对齐守护测试防漂移）优先；渲染库运行时 lookupMeta 兜底
 *   （覆盖 registerExternal 注册的外部组件）。纯 lookupMeta 在 iframe 模式下
 *   host 侧副本未执行注册，恒 undefined → canNest 误判全拒绝，故需静态表。
 */
export class PcNestingRules implements INestingRules {
  canNest(parentRenderType: string, slotKey: string, childRenderType: string): boolean {
    const gate = lookupSlotGate(parentRenderType as SlotHost, slotKey as SlotField);
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
    const gate = lookupSlotGate(parentRenderType as SlotHost, slotKey as SlotField);
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
