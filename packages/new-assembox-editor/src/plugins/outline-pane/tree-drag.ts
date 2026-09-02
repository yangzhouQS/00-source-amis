import type { Editor } from "../../core/editor";
import type { OutlineNode } from "../../core/store";

/**
 * 拖拽纯函数（参考 lc-engine indent-track + dwell-timer）
 * 落点计算 / 校验 / 执行，不含 DOM 操作
 */

export type DropMode = "before" | "after" | "inner";

/** dragover 时计算落点模式：上 25% before / 下 25% after / 中间 50% inner */
export function computeDropMode(targetEl: HTMLElement, clientY: number): DropMode {
  const rect = targetEl.getBoundingClientRect();
  const ratio = (clientY - rect.top) / rect.height;
  if (ratio < 0.25) return "before";
  if (ratio > 0.75) return "after";
  return "inner";
}

/** 判断 descendantId 是否为 ancestorId 的后代（防拖拽成环） */
export function isDescendant(nodes: OutlineNode[], ancestorId: string, targetId: string): boolean {
  for (const n of nodes) {
    if (n.id === ancestorId) {
      return n.children.some(c => c.id === targetId || isDescendant([c], ancestorId, targetId));
    }
    if (isDescendant(n.children, ancestorId, targetId)) {
      return true;
    }
  }
  return false;
}

/** 收集顶层根节点 id 集合 */
export function collectRootIds(nodes: OutlineNode[]): Set<string> {
  return new Set(nodes.map(n => n.id));
}

/** 嵌套规则校验（与画布拖拽一致） */
export function canNestInto(
  editor: Editor,
  dragId: string,
  parentId: string,
  slotKey: string,
): boolean {
  const schema = editor.store.schema;
  const dragNode = editor.schemaOps.getNodeById(schema, dragId);
  const parentNode = editor.schemaOps.getNodeById(schema, parentId);
  const childRenderType = dragNode?.__nodeOptions?.renderType;
  const parentRenderType = parentNode?.__nodeOptions?.renderType;
  if (!childRenderType || !parentRenderType) return false;
  return editor.nestingRules.canNest(parentRenderType, slotKey, childRenderType);
}

/** 校验落点合法性 */
export function canDrop(
  editor: Editor,
  dragId: string,
  targetId: string,
  mode: DropMode,
  allNodes: OutlineNode[],
): boolean {
  if (!dragId || !targetId || dragId === targetId) return false;
  if (targetId.startsWith("__scene__") || dragId.startsWith("__scene__")) return false;

  if (mode === "inner") {
    if (isDescendant(allNodes, dragId, targetId)) return false;
    if (!canNestInto(editor, dragId, targetId, "defaultSlot")) return false;
    return true;
  }

  // 平级：目标不能是根节点
  const roots = collectRootIds(allNodes);
  if (roots.has(targetId)) return false;
  return true;
}

/** drop 后执行 editor.move */
export function executeDrop(
  editor: Editor,
  dragId: string,
  targetId: string,
  mode: DropMode,
): void {
  if (mode === "inner") {
    if (canNestInto(editor, dragId, targetId, "defaultSlot")) {
      editor.move(dragId, targetId, "defaultSlot");
    }
    return;
  }

  const loc = editor.schemaOps.findSlotOf?.(editor.store.schema, targetId);
  if (!loc) return;
  if (!canNestInto(editor, dragId, loc.parentId, loc.slotKey)) return;
  const index = mode === "after" ? loc.index + 1 : loc.index;
  editor.move(dragId, loc.parentId, loc.slotKey, index);
}

/** 拖拽悬停自动展开（800ms dwell） */
export class DwellExpander {
  private timer: number | null = null;

  hover(nodeId: string, isCollapsed: boolean, onExpand: (id: string) => void): void {
    this.reset();
    if (!isCollapsed) return;
    this.timer = window.setTimeout(() => {
      onExpand(nodeId);
      this.reset();
    }, 800);
  }

  reset(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  destroy(): void {
    this.reset();
  }
}
