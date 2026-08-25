/**
 * 槽位语义编译器与注册点（设计文档：docs/19-插槽语义声明式配置设计方案.md）
 *
 * 依赖方向约束：slot-accessors.ts 是纯函数模块（不可反向依赖场景层/catalog），
 * 故采用「启动时编译 + 模块级注册点」：
 *
 *   component-metadata-config（slots 声明，唯一真相源）
 *     → buildSlotSemantics(components)     纯函数，一次编译
 *     → setSlotSemantics(semantics)        注入本模块级注册点
 *     → slot-accessors.isSingleNodeSlot / nesting-rules 白名单查询（调用时读取）
 *
 * 注入时机：pc-desktop/index.ts 模块加载时（PC_COMPONENTS_ALL 静态可得，
 * 早于任何 schemaOps/nestingRules 调用）。单测显式注入构造数据，不依赖时序。
 *
 * 渐进迁移：未注入时消费端回落各自的历史兼容表（slot-accessors 的
 * SINGLE_NODE_SLOTS / nesting-rules 的渲染库 SLOTS 链），已声明组件走新路径。
 */
import type { ComponentCatalogItem } from "../../scenario/types";

/** 编译产物：槽位语义索引 */
export interface SlotSemantics {
  /** "宿主renderType::槽位name" → true（所有显式声明的槽位，含仅声明 slotType 的） */
  declaredSlots: Record<string, true>;
  /** 宿主 renderType → 单节点槽位 name 列表（slotType: "object"） */
  singleNodeSlots: Record<string, string[]>;
  /** "宿主renderType::槽位name" → 组件级白名单（slotRender） */
  slotWhitelists: Record<string, string[]>;
  /** "宿主renderType::槽位name" → 显示名（description） */
  slotDescriptions: Record<string, string>;
}

/** 空语义（未注入时的初始态） */
const EMPTY: SlotSemantics = { declaredSlots: {}, singleNodeSlots: {}, slotWhitelists: {}, slotDescriptions: {} };

let semantics: SlotSemantics = EMPTY;

/** 复合键："宿主::槽位" */
function key(renderType: string, slotName: string): string {
  return `${renderType}::${slotName}`;
}

/**
 * 从组件元数据编译槽位语义索引（纯函数）。
 * 仅编译显式声明 slots 的组件；未声明组件不在索引内（消费端走回落路径）。
 */
export function buildSlotSemantics(components: ComponentCatalogItem[]): SlotSemantics {
  const result: SlotSemantics = { declaredSlots: {}, singleNodeSlots: {}, slotWhitelists: {}, slotDescriptions: {} };
  for (const item of components) {
    if (!item.slots) {
      continue;
    }
    for (const slot of item.slots) {
      if (!slot?.name) {
        continue;
      }
      result.declaredSlots[key(item.renderType, slot.name)] = true;
      if (slot.slotType === "object") {
        (result.singleNodeSlots[item.renderType] ??= []).push(slot.name);
      }
      if (slot.slotRender?.length) {
        result.slotWhitelists[key(item.renderType, slot.name)] = [...slot.slotRender];
      }
      if (slot.description) {
        result.slotDescriptions[key(item.renderType, slot.name)] = slot.description;
      }
    }
  }
  return result;
}

/** 注入槽位语义（重复调用以后者覆盖；传空对象可清空用于测试） */
export function setSlotSemantics(next: SlotSemantics): void {
  semantics = next ?? EMPTY;
}

/** 读取当前语义（消费端调用时读取，保证注入后立即生效） */
export function getSlotSemantics(): SlotSemantics {
  return semantics;
}

/** 指定宿主槽位是否为单节点语义（未声明返回 undefined，由调用方回落历史表） */
export function findSingleNodeSlot(renderType: string | undefined, slotName: string): boolean | undefined {
  if (!renderType) {
    return undefined;
  }
  const list = semantics.singleNodeSlots[renderType];
  return list ? list.includes(slotName) : undefined;
}

/** 指定宿主槽位的组件级白名单（未声明返回 undefined，由调用方回落 category 门禁） */
export function findSlotWhitelist(renderType: string, slotName: string): string[] | undefined {
  return semantics.slotWhitelists[key(renderType, slotName)];
}

/** 指定宿主槽位是否已声明（isContainer 兜底判定用：声明的槽位即容器能力） */
export function hasDeclaredSlot(renderType: string, slotName: string): boolean {
  return key(renderType, slotName) in semantics.declaredSlots;
}
