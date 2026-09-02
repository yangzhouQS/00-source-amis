import type { Editor } from "../../core/editor";
import type { DragSensor, DropLocation } from "./types";
/**
 * OutlineSensor —— 大纲树投放感应区（DragSensor 实现，宿主文档坐标系）
 *
 * 设计要点（new-docs/outline-drag-unification-design.md §12 决策记录）：
 * - Q5：dragstart 一次性构建 DragSnapshot（树 + 场景映射 + 根集合），
 *   拖拽全程复用，杜绝 mousemove 级全树遍历
 * - Q6：DwellExpander 内聚于 sensor（对齐 lc-engine PaneController 模式）——
 *   隐藏面板 rect 全零 → dragon.chooseSensor 永不选中 → locate/dwell 天然不跑，
 *   无需可见性守卫；deactiveSensor 统一 reset（dragon 在 sensor 切换时调用）
 * - 校验走 canDropFor（Q1 间接容器 before/after 拒绝 / Q2 单节点槽占用 /
 *   Q3 node 型跨场景拒绝），wireDragon.onDrop 的 canNest 兜底保留（双保险）
 * - 落点产出与 CanvasSensor 同契约（containerId/region/index），
 *   另带 source/dropMode/targetNodeId 供树视图驱动 drag-over/drag-inner 高亮
 */
import {
  canDropFor,
  computeDropMode,
  DwellExpander,
  buildDragSnapshot,
  type DragSnapshot,
  type DropMode,
} from "../../plugins/outline-pane/tree-drag";

let sensorSeq = 0;

/** 视图侧注入（per 实例）：面板根元素 / dwell 展开回调 / 折叠态查询 */
export interface OutlineSensorOptions {
  /** 面板根元素（rect 命中判定；display:none 时 rect 全零 → 永不命中） */
  shell: () => HTMLElement | null;
  /** dwell 展开回调（写入视图实例的 expandedIds） */
  onDwellExpand: (nodeId: string) => void;
  /** 节点当前是否折叠（dwell 仅对折叠节点计时） */
  isCollapsed: (nodeId: string) => boolean;
}

export class OutlineSensor implements DragSensor {
  readonly id: string;
  readonly contentDocument: Document | null = document;
  sensorAvailable = true;

  private snapshot: DragSnapshot | null = null;
  private readonly dwell = new DwellExpander();
  private readonly off: () => void;

  constructor(
    private readonly editor: Editor,
    private readonly opts: OutlineSensorOptions,
  ) {
    this.id = `outline-sensor-${++sensorSeq}`;
    this.editor.dragon.addSensor(this);
    this.off = this.editor.dragon.on({
      onDragstart: () => {
        this.snapshot = buildDragSnapshot(this.editor);
      },
      onDragend: () => {
        this.snapshot = null;
        this.dwell.reset();
      },
    });
  }

  isEnter(globalX: number, globalY: number): boolean {
    const shell = this.opts.shell();
    if (!shell) {
      return false;
    }
    const rect = shell.getBoundingClientRect();
    // display:none → rect 全零 → 除 (0,0) 理论边界外永不命中
    return (
      globalX >= rect.left
      && globalX <= rect.right
      && globalY >= rect.top
      && globalY <= rect.bottom
    );
  }

  toGlobal(localX: number, localY: number): { x: number; y: number } {
    return { x: localX, y: localY };
  }

  elementFromPoint(localX: number, localY: number): Element | null {
    return document.elementFromPoint(localX, localY);
  }

  locate(target: Element | null, x: number, y: number): DropLocation | null {
    const row = (target as HTMLElement | null)?.closest<HTMLElement>("[data-node-id]");
    if (!row) {
      this.dwell.reset();
      return null;
    }
    const targetId = row.getAttribute("data-node-id")!;
    const dragObject = this.editor.dragon.dragObject;
    if (!dragObject) {
      return null;
    }

    const mode = computeDropMode(row, y);
    if (!canDropFor(this.editor, dragObject, targetId, mode, this.snapshot)) {
      this.dwell.reset();
      return null;
    }

    // dwell 悬停展开（仅折叠节点计时；展开后落点刷新到下次 mousemove，Q7 决策）
    this.dwell.hover(targetId, this.opts.isCollapsed(targetId), this.opts.onDwellExpand);

    const loc = this.buildLocation(targetId, mode);
    return loc;
  }

  /** 三段命中 → DropLocation（与画布 sensor 同契约，落地走 wireDragon.onDrop） */
  private buildLocation(targetId: string, mode: DropMode): DropLocation | null {
    if (mode === "inner") {
      // inner：目标即容器，defaultSlot 语义（单节点槽/间接容器由 onDrop 落地兜底）
      const host = this.editor.schemaOps.getNodeById(
        this.editor.store.schema,
        targetId,
      );
      const children = host
        ? this.editor.schemaOps.getSlotChildren(host, "defaultSlot")
        : [];
      return {
        containerId: targetId,
        region: "defaultSlot",
        index: children.length,
        source: "outline",
        dropMode: "inner",
        targetNodeId: targetId,
      };
    }

    // before / after：定位到目标的父槽位（Q1 已保证非间接容器子槽）
    const loc = this.editor.schemaOps.findSlotOf?.(
      this.editor.store.schema,
      targetId,
    );
    if (!loc) {
      return null;
    }
    return {
      containerId: loc.parentId,
      region: loc.slotKey,
      index: mode === "after" ? loc.index + 1 : loc.index,
      source: "outline",
      dropMode: mode,
      targetNodeId: targetId,
    };
  }

  deactiveSensor(): void {
    this.dwell.reset();
  }

  destroy(): void {
    this.off();
    this.dwell.destroy();
    this.editor.dragon.removeSensor(this.id);
  }
}
