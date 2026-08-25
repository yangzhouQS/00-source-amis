import type { SlotField, SlotHost } from "@cs/assembox-desktop-next";
import type { INestingRules } from "../../scenario/types";
import { RENDER_TYPE_CATEGORIES } from "./nesting-categories";
import { findSlotWhitelist } from "./slot-semantics";
import { isCategoryAllowed, lookupMeta, lookupSlotGate } from "@cs/assembox-desktop-next";

/**
 * PC 场景嵌套校验
 * 包装 assembox-desktop-next 的 nesting.ts（SLOTS 静态表，加载即可用）
 * + component-catalog.ts 的运行时注册表（外部组件兜底）
 *
 * 与渲染器的嵌套规则对齐（三级优先）：
 * 1. 组件级白名单（component-metadata-config slots.slotRender，经 slot-semantics
 *    注入）：精确 renderType 匹配——如 YqToolBar.defaultSlot 只认 YqFlexLine
 *    （wrapper 硬编码直渲），category 门禁会误放行 GridBox/FlexBox
 * 2. 槽位门禁（渲染库 SLOTS 静态表，host/iframe 副本行为一致）
 * 3. 子组件 category：编辑器侧静态表（nesting-categories.ts，与渲染库 manifest
 *    COMPONENTS 对齐，由对齐守护测试防漂移）优先；渲染库运行时 lookupMeta 兜底
 *    （覆盖 registerExternal 注册的外部组件）。纯 lookupMeta 在 iframe 模式下
 *    host 侧副本未执行注册，恒 undefined → canNest 误判全拒绝，故需静态表。
 */
export class PcNestingRules implements INestingRules {
  canNest(parentRenderType: string, slotKey: string, childRenderType: string): boolean {
    // 1. 组件级白名单优先（声明即精确匹配，白名单外全拒）
    const whitelist = findSlotWhitelist(parentRenderType, slotKey);
    if (whitelist) {
      return whitelist.includes(childRenderType);
    }
    // 2. category 门禁
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
    // 白名单语义下无 category 可报（组件级），返回 undefined（当前无消费方依赖）
    if (findSlotWhitelist(parentRenderType, slotKey)) {
      return undefined;
    }
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

/**
 * 取槽位门禁（category 级）：白名单声明优先，渲染库 SLOTS 表兜底。
 * 导出供 schema-ops.isContainer 共用（判定容器必须与 canNest 同源，
 * 否则槽位宿主会因表内无此槽而不被判为容器，拖拽命中穿透到根节点）。
 *
 * 注意：白名单条目是 renderType（非 category）——canNest 在调用 slotGate 前
 * 已先行精确匹配白名单并提前返回，不会把 renderType 当 category 比较；
 * slotGate 返回白名单仅服务于 isContainer 的「有门禁即容器」判定。
 */
export function slotGate(parentRenderType: string, slotKey: string): string[] | "any" | undefined {
  const whitelist = findSlotWhitelist(parentRenderType, slotKey);
  if (whitelist) {
    return whitelist;
  }
  return lookupSlotGate(parentRenderType as SlotHost, slotKey as SlotField);
}
