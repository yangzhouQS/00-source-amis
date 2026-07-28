/**
 * DnD 管理器（HTML5 拖放）
 * 借鉴 amis 的策略模式思想，但 demo 简化为统一 default 模式
 * - 从组件面板拖入 → 在目标容器末尾插入
 * - 在画布内拖动节点 → 移动到目标容器
 */
import type {ComponentRegistry} from '../registry/component-registry';
import type {EditorStore} from '../core/store';
import type {NodeTree} from '../simulator/node-tree';
import type {SimulatorBridge} from '../simulator/bridge';
import {closestNodeId, isContainerEl, ATTR_EDITOR_ID} from './dom-marking';
import type {NodeId} from '../schema/types';

/** 拖拽数据 MIME 类型 */
const DND_TYPE = 'application/x-assem-component';
const DND_MOVE_TYPE = 'application/x-assem-move';

export class DndManager {
  private dragging = false;
  private cleanupFns: Array<() => void> = [];

  constructor(
    private readonly store: EditorStore,
    private readonly registry: ComponentRegistry,
    private readonly tree: NodeTree,
    private readonly bridge: SimulatorBridge
  ) {}

  /** 在画布容器上启用拖放 */
  attach(container: HTMLElement): void {
    const onDragOver = (e: DragEvent) => {
      if (!this.dragging) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };

    const onDrop = (e: DragEvent) => {
      if (!this.dragging) return;
      e.preventDefault();
      e.stopPropagation();
      const data = e.dataTransfer?.getData(DND_TYPE);
      const moveId = e.dataTransfer?.getData(DND_MOVE_TYPE);
      if (!data && !moveId) return;

      // 解析落点容器
      const target = this.resolveDropTarget(e.target as HTMLElement | null);
      if (!target) return;

      if (moveId) {
        // 移动现有节点
        this.bridge.moveNode(
          moveId as NodeId,
          target.parentId,
          target.region,
          target.index
        );
      } else if (data) {
        // 新增组件
        const node = this.registry.createNode(data);
        if (node) {
          this.bridge.insertNode(
            target.parentId,
            target.region,
            node,
            target.index
          );
        }
      }
      this.setDragging(false);
    };

    container.addEventListener('dragover', onDragOver);
    container.addEventListener('drop', onDrop);

    this.cleanupFns.push(() => {
      container.removeEventListener('dragover', onDragOver);
      container.removeEventListener('drop', onDrop);
    });
  }

  /** 开始拖拽组件面板项（拖源） */
  startDragComponent(e: DragEvent, componentType: string): void {
    this.setDragging(true);
    if (e.dataTransfer) {
      e.dataTransfer.setData(DND_TYPE, componentType);
      e.dataTransfer.effectAllowed = 'copy';
    }
  }

  /** 开始拖拽画布内节点（移动） */
  startDragNode(e: DragEvent, nodeId: NodeId): void {
    this.setDragging(true);
    if (e.dataTransfer) {
      e.dataTransfer.setData(DND_MOVE_TYPE, nodeId);
      e.dataTransfer.effectAllowed = 'move';
    }
  }

  /** 解析落点：向上找最近的容器节点 */
  private resolveDropTarget(
    el: HTMLElement | null
  ): {parentId: NodeId; region: string; index?: number} | null {
    if (!el) return null;
    // 优先找带 data-editor-id 的元素
    let cur: HTMLElement | null = el;
    while (cur) {
      const id = cur.getAttribute(ATTR_EDITOR_ID);
      if (id) {
        const inst = this.tree.get(id);
        if (inst?.isContainer) {
          return {parentId: id, region: 'body', index: undefined};
        }
      }
      cur = cur.parentElement;
    }
    // 兜底：落到根
    return {parentId: this.store.schema.$$id, region: 'body', index: undefined};
  }

  private setDragging(active: boolean): void {
    this.dragging = active;
    this.bridge.setDraggingState(active);
  }

  /** 解析节点 id（供外部用） */
  nodeIdFromEvent(e: MouseEvent): NodeId | null {
    return closestNodeId(e.target as HTMLElement | null);
  }

  isContainerEl(el: HTMLElement | null): boolean {
    return isContainerEl(el);
  }

  /** 销毁 */
  destroy(): void {
    this.cleanupFns.forEach(fn => fn());
    this.cleanupFns = [];
  }
}
