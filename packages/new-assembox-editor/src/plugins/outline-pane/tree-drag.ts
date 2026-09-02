import type { Editor } from "../../core/editor";
import type { DragObject } from "../../designer/drag/types";
import type { OutlineNode } from "../../core/store";
import { buildOutlineGroupedByScene } from "../../core/store";
import { isIndirectChildSlot } from "../../scenarios/pc-desktop/slot-accessors";

/**
 * 拖拽纯函数（参考 lc-engine indent-track + dwell-timer）
 * 落点计算 / 校验 / 快照，不含 DOM 操作
 *
 * 三期统一到 Dragon 后：
 * - 校验入口统一为 canDropFor（node / nodeData 两型）
 * - executeDrop 退役（落地统一走 editor.wireDragon.onDrop 管线）
 * - DragSnapshot 在 dragstart 一次性构建（Q5：拖拽中 schema 不变，快照安全）
 */

export type DropMode = "before" | "after" | "inner";

/** 拖拽快照（dragstart 构建，onDragend 失效） */
export interface DragSnapshot {
  /** 全量大纲树（含 __scene__ 分组头） */
  nodes: OutlineNode[];
  /** nodeId → 场景名（Q3 跨场景守卫用） */
  sceneOf: Map<string, string>;
  /** 各场景根节点 id 集合（before/after 禁止作用于根） */
  rootIds: Set<string>;
}

/** dragover 时计算落点模式：上 25% before / 下 25% after / 中间 50% inner */
export function computeDropMode(targetEl: HTMLElement, clientY: number): DropMode {
  const rect = targetEl.getBoundingClientRect();
  const ratio = (clientY - rect.top) / rect.height;
  if (ratio < 0.25) return "before";
  if (ratio > 0.75) return "after";
  return "inner";
}

/** 子树内是否含指定 id（深度任意） */
function containsId(nodes: OutlineNode[], id: string): boolean {
  return nodes.some(n => n.id === id || containsId(n.children, id));
}

/** 判断 targetId 是否为 ancestorId 的后代（防拖拽成环，深度任意）
 *  修复注记：旧实现只查二层（n.children.some + 错误的 [c] 重入），
 *  深层后代漏检——原生 DnD 时代靠 wireDragon.onDrop 的 isDescendantNode 兜底掩盖 */
export function isDescendant(nodes: OutlineNode[], ancestorId: string, targetId: string): boolean {
  for (const n of nodes) {
    if (n.id === ancestorId) {
      return containsId(n.children, targetId);
    }
    if (isDescendant(n.children, ancestorId, targetId)) {
      return true;
    }
  }
  return false;
}

/** 构建拖拽快照：复用 store 的分组构建，回填场景映射与根集合 */
export function buildDragSnapshot(editor: Editor): DragSnapshot {
  const grouped = buildOutlineGroupedByScene(
    editor.store.schema,
    editor.schemaOps,
  );
  const sceneOf = new Map<string, string>();
  const rootIds = new Set<string>();
  for (const scene of grouped) {
    const sceneName = scene.id.replace("__scene__", "");
    const mark = (nodes: OutlineNode[]) => {
      for (const n of nodes) {
        sceneOf.set(n.id, sceneName);
        mark(n.children);
      }
    };
    mark(scene.children);
    scene.children.forEach(c => rootIds.add(c.id));
  }
  return { nodes: grouped, sceneOf, rootIds };
}

/** 取拖拽对象的子组件 renderType（node 查 schema；nodeData 取面板数据） */
function childRenderTypeOf(editor: Editor, drag: DragObject): string | undefined {
  if (drag.type === "nodeData") {
    return drag.data?.renderType ?? drag.data?.type;
  }
  if (drag.type === "node" && drag.nodeId) {
    return editor.schemaOps.getNodeById(editor.store.schema, drag.nodeId)
      ?.__nodeOptions?.renderType;
  }
  return undefined;
}

/** 单节点槽占用守卫（Q2）：目标槽为单节点语义且已占用 → 拒绝
 *  （占用者即拖动者自身时放行——原地松手语义） */
function singleNodeSlotVacant(
  editor: Editor,
  hostId: string,
  slotKey: string,
  dragNodeId?: string,
): boolean {
  const host = editor.schemaOps.getNodeById(editor.store.schema, hostId);
  if (!host) {
    return false;
  }
  const renderType = host.__nodeOptions?.renderType;
  // 可选方法语义：schemaOps 未实现该能力时按"非单节点槽"放行（宽松兜底）
  if (editor.schemaOps.isSingleNodeSlot?.(renderType, slotKey) !== true) {
    return true;
  }
  const children = editor.schemaOps.getSlotChildren(host, slotKey);
  if (children.length === 0) {
    return true;
  }
  return children.length === 1 && children[0]?.__nodeId === dragNodeId;
}

/**
 * 统一落点校验（OutlineSensor.locate 调用；wireDragon.onDrop 的 canNest 兜底保留）
 *
 * 守卫链：
 * 1. 场景分组头不可作为目标
 * 2. node 型：自身/后代拦截（inner 成环）+ Q3 同场景（跨场景 move = 源不可见丢失）
 * 3. inner：嵌套校验（defaultSlot 语义）+ Q2 单节点槽占用
 * 4. before/after：根节点拦截 + Q1 间接容器子槽拒绝（按位插入不生效）+
 *    父槽嵌套校验 + 父槽单节点占用
 */
export function canDropFor(
  editor: Editor,
  drag: DragObject,
  targetId: string,
  mode: DropMode,
  snap: DragSnapshot | null,
): boolean {
  if (!targetId || targetId.startsWith("__scene__")) return false;

  const dragNodeId = drag.type === "node" ? drag.nodeId : undefined;
  if (drag.type === "node") {
    if (!dragNodeId || dragNodeId === targetId) return false;
    if (mode === "inner" && snap && isDescendant(snap.nodes, dragNodeId, targetId)) {
      return false;
    }
    // Q3：node 型禁止跨场景（nodeData 新建无源可失，放行）
    if (snap) {
      const from = snap.sceneOf.get(dragNodeId);
      const to = snap.sceneOf.get(targetId);
      if (from !== undefined && to !== undefined && from !== to) return false;
    }
  }

  const schema = editor.store.schema;
  const childRT = childRenderTypeOf(editor, drag);
  if (!childRT) return false;

  if (mode === "inner") {
    const target = editor.schemaOps.getNodeById(schema, targetId);
    const targetRT = target?.__nodeOptions?.renderType;
    if (!targetRT) return false;
    // inner 目标必须是容器（叶子无门禁时 canNest 宽松放行，canvas 侧靠
    // findContainerEl 爬容器天然规避，树侧需显式校验）
    if (editor.schemaOps.isContainer?.(target) !== true) return false;
    if (!editor.nestingRules.canNest(targetRT, "defaultSlot", childRT)) return false;
    return singleNodeSlotVacant(editor, targetId, "defaultSlot", dragNodeId);
  }

  // before / after
  if (snap?.rootIds.has(targetId)) return false;
  const loc = editor.schemaOps.findSlotOf?.(schema, targetId);
  if (!loc) return false;
  const parent = editor.schemaOps.getNodeById(schema, loc.parentId);
  const parentOpts = parent?.__nodeOptions;
  if (!parentOpts) return false;
  // Q1：间接容器内子节点禁用平级插入（首个空格子策略下按位不生效）
  if (isIndirectChildSlot(parentOpts, loc.slotKey)) return false;
  if (!editor.nestingRules.canNest(parentOpts.renderType, loc.slotKey, childRT)) return false;
  return singleNodeSlotVacant(editor, loc.parentId, loc.slotKey, dragNodeId);
}

/** 拖拽悬停自动展开（800ms dwell）
 *  内聚于 OutlineSensor（Q6）：隐藏面板 rect 全零 → isEnter 永不命中 → locate/dwell 天然不跑 */
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
