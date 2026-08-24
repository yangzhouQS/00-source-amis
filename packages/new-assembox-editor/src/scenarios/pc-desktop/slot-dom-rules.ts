/**
 * 多槽位组件的槽位区域 DOM 识别规则（编辑器侧实现，渲染库零侵入）
 *
 * 借鉴旧版编辑器（assembox-editor plugin-vue-renderer-desktop 的
 * schemaBindSlot + bindSlotHandle 表）：按组件类型查表、按内部 DOM 类名定位
 * 槽位区域，拖拽悬停时即可识别「鼠标下方组件 + 具体插槽」。
 *
 * 与旧版的做法差异（升级点）：
 * - 旧版在组件 mounted/onUpdated 时给槽位 DOM 写 expando 标记，存在标记时机、
 *   re-render 丢失重打的问题
 * - 新版改为 **悬停时几何解析**：canvas-sensor 命中容器（data-editor-id）后，
 *   按本表 selector 找槽位区域元素，判断命中元素是否 contained 于某区域
 *   → 直接得出 slotKey。无 DOM 写入、无时机问题、天然跟随 re-render
 * - 插入索引仍由 canvas-sensor 的 schema 子节点 + DOM rect 几何计算，
 *   不依赖旧版的槽位子项标记
 *
 * 类名来源：@cs/element-plus-ui 组件源码
 * （flex-line.vue / panel.vue / tool-bar.vue）。
 * 升级 UI 库改类名时此处同步；匹配不到回退 defaultSlot（与无规则现状一致）。
 */

/** 一条槽位区域规则：容器内部 selector → 槽位键 */
export interface SlotDomRule {
  /** 槽位区域元素选择器（相对组件根，命中组件根下的槽位容器） */
  selector: string;
  /** 对应 schema 槽位键（slot-accessors DIRECT_SLOTS 键） */
  slotKey: string;
}

/** renderType → 槽位区域规则表（仅登记多槽位组件；单槽位组件命中根即 defaultSlot） */
export const SLOT_DOM_RULES: Record<string, SlotDomRule[]> = {
  // element-plus-ui flex-line.vue：
  // 根 .yq-flex-line，左区 .yq-flex_line_left（默认插槽），右区 .yq-flex_line_right（#right）
  YqFlexLine: [
    { selector: ".yq-flex_line_left", slotKey: "defaultSlot" },
    { selector: ".yq-flex_line_right", slotKey: "rightSlot" },
  ],
  // element-plus-ui panel.vue：.panel-content（内容区），.header-tool .tool-content（头部工具区）
  YqPanel: [
    { selector: ".panel-content", slotKey: "defaultSlot" },
    { selector: ".header-tool .tool-content", slotKey: "toolSlot" },
  ],
  // element-plus-ui tool-bar.vue：.yq-filter-content（筛选区），.yq-tool-slot（工具按钮区）
  YqToolBar: [
    { selector: ".yq-filter-content", slotKey: "filterSlot" },
    { selector: ".yq-tool-slot", slotKey: "toolSlot" },
  ],
};

/**
 * 悬停时几何解析：命中元素落在容器的哪个槽位区域
 *
 * @param renderType 容器组件 renderType
 * @param containerEl 容器根元素（带 data-editor-id 的组件根）
 * @param hitEl 命中元素（elementFromPoint 结果，是 containerEl 的后代或自身）
 * @returns 槽位键；未登记规则 / 命中区域外（间隙、padding）返回 null（调用方回退 defaultSlot）
 */
export function resolveSlotKeyFromDom(
  renderType: string | undefined,
  containerEl: Element,
  hitEl: Element | null,
): string | null {
  const rules = renderType ? SLOT_DOM_RULES[renderType] : undefined;
  if (!rules || !hitEl) {
    return null;
  }
  for (const { selector, slotKey } of rules) {
    let region: Element | null = null;
    try {
      region = containerEl.querySelector(selector);
      // 防御：容器根自身即槽位区域的选择器（当前表内无，表驱动容错）
      if (!region && containerEl.matches?.(selector)) {
        region = containerEl;
      }
    } catch {
      continue; // 非法选择器（表配置错误）跳过
    }
    if (region && (region === hitEl || region.contains(hitEl))) {
      return slotKey;
    }
  }
  return null;
}
