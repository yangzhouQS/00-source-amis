import type { SlotRegionResolver } from "./types";

/**
 * 「静态类名区域 contains」型解析器工厂
 *
 * 适用于槽位区域在组件模板中固定、有稳定类名的组件
 * （element-plus-ui 各组件根下固定结构）。命中元素 contained 于
 * 某区域（或即区域本身）→ 返回对应 slotKey；全不中 → null（回退 defaultSlot）。
 *
 * @param regions 区域规则（相对组件根的 selector → schema 槽位键）
 */
export function byRegionSelectors(
  regions: Array<{ selector: string; slotKey: string }>,
): SlotRegionResolver {
  return (containerEl, hitEl) => {
    if (!hitEl) {
      return null;
    }
    for (const { selector, slotKey } of regions) {
      let region: Element | null = null;
      try {
        region = containerEl.querySelector(selector);
        // 防御：容器根自身即槽位区域的选择器
        if (!region && containerEl.matches?.(selector)) {
          region = containerEl;
        }
      } catch {
        continue; // 非法选择器（配置错误）跳过该区域
      }
      if (region && (region === hitEl || region.contains(hitEl))) {
        return slotKey;
      }
    }
    return null;
  };
}
