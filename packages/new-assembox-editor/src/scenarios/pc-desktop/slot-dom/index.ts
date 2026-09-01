import type { SlotRegionResolver } from "./types";
import { resolveFlexLineSlot } from "./flex-line";
import { resolvePanelSlot } from "./panel";
import { resolveTabPanelSlot } from "./tab-panel";
import { resolveToolBarSlot } from "./tool-bar";

/**
 * 多槽位组件的槽位区域解析（编辑器侧实现，渲染库零侵入）
 *
 * 借鉴旧版编辑器（plugin-vue-renderer-desktop 的 schemaBindSlot + bindSlotHandle
 * 表驱动）：按组件类型分派处理器，悬停时识别「鼠标下方组件 + 具体插槽」。
 *
 * 与旧版差异（升级点）：
 * - 旧版 mounted/onUpdated 给槽位 DOM 写 expando 标记，有标记时机与 re-render
 *   丢失重打问题；新版**悬停时几何解析**（contains 判定），零 DOM 写入、
 *   天然跟随 re-render
 * - 插入索引由 canvas-sensor 的 schema 子节点 + DOM rect 几何计算，
 *   不依赖旧版槽位子项标记
 *
 * 组件处理器按文件拆分（逻辑差异大：类名 contains / 动态页签 / 几何计算），
 * 新增多槽位组件 = 新建一个文件实现 SlotRegionResolver + 下方注册表加一行。
 * 匹配不到 / 区域外返回 null → 传感器回退 defaultSlot（与无规则现状一致）。
 */

/** renderType → 槽位解析器注册表 */
const SLOT_DOM_RESOLVERS: Record<string, SlotRegionResolver> = {
  YqFlexLine: resolveFlexLineSlot,
  YqPanel: resolvePanelSlot,
  YqToolBar: resolveToolBarSlot,
  TabPanel: resolveTabPanelSlot,
};

/**
 * 悬停时几何解析：命中元素落在容器的哪个槽位区域
 *
 * @param renderType 容器组件 renderType
 * @param containerEl 容器根元素（带 data-editor-id 的组件根）
 * @param hitEl 命中元素（elementFromPoint 结果，是 containerEl 的后代或自身）
 * @returns 槽位键；未登记组件 / 区域外（间隙、padding）返回 null（调用方回退 defaultSlot）
 */
export function resolveSlotKeyFromDom(
  renderType: string | undefined,
  containerEl: Element,
  hitEl: Element | null,
): string | null {
  const resolver = renderType ? SLOT_DOM_RESOLVERS[renderType] : undefined;
  if (!resolver) {
    return null;
  }
  return resolver(containerEl, hitEl);
}

export type { SlotRegionResolver } from "./types";
