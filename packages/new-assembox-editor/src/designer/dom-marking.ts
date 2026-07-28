/**
 * DOM 标记标准化
 * 取代旧版 Symbol 属性：改用 data-* 属性，可 querySelector、可 DevTools 检视
 */
import type {NodeId} from '../schema/types';

/** 节点 id 属性 */
export const ATTR_EDITOR_ID = 'data-editor-id';
/** 容器标记 */
export const ATTR_CONTAINER = 'data-container';
/** 区域 key */
export const ATTR_REGION = 'data-region';
/** 区域宿主节点 id */
export const ATTR_REGION_HOST = 'data-region-host';

/** 标记 DOM 为节点根 */
export function markNode(
  el: HTMLElement,
  nodeId: NodeId,
  isContainer = false
): void {
  if (!el) return;
  el.setAttribute(ATTR_EDITOR_ID, nodeId);
  if (isContainer) el.setAttribute(ATTR_CONTAINER, '');
}

/** 标记 DOM 为区域 */
export function markRegion(
  el: HTMLElement,
  regionKey: string,
  hostId: NodeId
): void {
  if (!el) return;
  el.setAttribute(ATTR_REGION, regionKey);
  el.setAttribute(ATTR_REGION_HOST, hostId);
}

/** 从 DOM 向上查找最近的节点根 */
export function closestNodeId(el: HTMLElement | null): NodeId | null {
  if (!el) return null;
  const found = el.closest(`[${ATTR_EDITOR_ID}]`);
  return found ? found.getAttribute(ATTR_EDITOR_ID) : null;
}

/** 判断 DOM 是否容器 */
export function isContainerEl(el: HTMLElement | null): boolean {
  if (!el) return false;
  const found = el.closest(`[${ATTR_CONTAINER}]`);
  return !!found;
}

/** 查找最近的区域信息 */
export function closestRegion(
  el: HTMLElement | null
): {region: string; host: NodeId} | null {
  if (!el) return null;
  const found = el.closest(`[${ATTR_REGION}]`) as HTMLElement | null;
  if (!found) return null;
  return {
    region: found.getAttribute(ATTR_REGION) || 'body',
    host: found.getAttribute(ATTR_REGION_HOST) || ''
  };
}
