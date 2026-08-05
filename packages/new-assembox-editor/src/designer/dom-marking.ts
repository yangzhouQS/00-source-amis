/**
 * DOM 标记标准化
 * 取代旧版 Symbol 属性：改用 data-* 属性，可 querySelector、可 DevTools 检视
 */

/** 节点 id 属性 */
export const ATTR_EDITOR_ID = "data-editor-id";

/** 从 DOM 向上查找最近的节点根 */
export function closestNodeId(el: HTMLElement | null): string | null {
  if (!el) {
    return null;
  }
  const found = el.closest(`[${ATTR_EDITOR_ID}]`);
  return found ? found.getAttribute(ATTR_EDITOR_ID) : null;
}
