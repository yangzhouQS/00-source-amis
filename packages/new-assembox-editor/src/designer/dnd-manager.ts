/**
 * DnD 管理器（HTML5 拖放）
 * - 从组件面板拖入 → 插入到指定容器指定位置（按光标计算 index）
 * - 在画布内拖动节点 → 移动到指定位置
 *
 * 跨 iframe 支持：
 *  - 拖拽状态（pendingType/pendingMoveId）存在 DndManager 内存中，不依赖跨帧 dataTransfer
 *  - iframe 模式下绑定到 iframe.contentDocument，落点在 iframe DOM 内解析
 *  - 容器与子节点几何通过 nodeTree（iframe 实例同步）测量
 */
import type {ComponentRegistry} from '../registry/component-registry';
import type {EditorStore} from '../core/store';
import type {NodeTree} from '../simulator/node-tree';
import type {SimulatorBridge} from '../simulator/bridge';
import type {Editor} from '../core/editor';
import {ATTR_EDITOR_ID} from './dom-marking';
import type {NodeId} from '../schema/types';

/** 拖拽数据 MIME 类型（仅用于 dataTransfer 视觉，跨帧不可靠） */
const DND_TYPE = 'application/x-assem-component';
const DND_MOVE_TYPE = 'application/x-assem-move';

export interface DropTarget {
  parentId: NodeId;
  region: string;
  index: number;
}

export class DndManager {
  private dragging = false;
  private cleanupFns: Array<() => void> = [];
  /** 当前拖拽的组件类型（新增用，内存态，跨帧可靠） */
  private pendingType: string | null = null;
  /** 当前拖拽的节点 id（移动用） */
  private pendingMoveId: NodeId | null = null;
  /** 拖拽指示器清理 */
  private indicatorEl: HTMLElement | null = null;

  constructor(
    private readonly store: EditorStore,
    private readonly registry: ComponentRegistry,
    private readonly tree: NodeTree,
    private readonly bridge: SimulatorBridge,
    private readonly editor: Editor
  ) {}

  /** 同 DOM 模式：绑定到宿主画布容器 */
  attach(container: HTMLElement): void {
    this.bindDropTarget(container);
  }

  /** iframe 模式：绑定到 iframe 的 contentDocument */
  attachDocument(doc: Document): void {
    this.bindDropTarget(doc);
  }

  /** 绑定 dragover/drop 到目标（HTMLElement 或 Document） */
  private bindDropTarget(target: HTMLElement | Document): void {
    const onDragOver = (e: DragEvent) => {
      if (!this.dragging) return;
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = this.pendingMoveId ? 'move' : 'copy';
      }
      // 实时更新插入指示线
      this.updateIndicator(e);
    };

    const onDragLeave = (e: DragEvent) => {
      // 离开文档时清除指示
      if (e.target === (target as any).body || e.target === target) {
        this.clearIndicator();
      }
    };

    const onDrop = (e: DragEvent) => {
      if (!this.dragging) return;
      e.preventDefault();
      e.stopPropagation();
      this.clearIndicator();

      const target_ = this.resolveDropTarget(e.target as HTMLElement | null, e);
      if (!target_) {
        this.setDragging(false);
        return;
      }

      if (this.pendingMoveId) {
        // 移动现有节点（避免拖入自身后代），经 editor 更新 store（源真值）+ 触发画布同步
        if (!this.isDescendant(this.pendingMoveId, target_.parentId)) {
          this.editor.move(
            this.pendingMoveId,
            target_.parentId,
            target_.region,
            target_.index
          );
        }
      } else if (this.pendingType) {
        // 新增组件，经 editor 更新 store
        const node = this.registry.createNode(this.pendingType);
        if (node) {
          this.editor.insert(
            target_.parentId,
            target_.region,
            node,
            target_.index
          );
        }
      }
      this.setDragging(false);
    };

    target.addEventListener('dragover', onDragOver as EventListener);
    target.addEventListener('dragleave', onDragLeave as EventListener);
    target.addEventListener('drop', onDrop as EventListener);

    this.cleanupFns.push(() => {
      target.removeEventListener('dragover', onDragOver as EventListener);
      target.removeEventListener('dragleave', onDragLeave as EventListener);
      target.removeEventListener('drop', onDrop as EventListener);
    });
  }

  /** 开始拖拽组件面板项（拖源，宿主侧调用） */
  startDragComponent(e: DragEvent, componentType: string): void {
    this.pendingType = componentType;
    this.pendingMoveId = null;
    this.setDragging(true);
    if (e.dataTransfer) {
      e.dataTransfer.setData(DND_TYPE, componentType);
      e.dataTransfer.effectAllowed = 'copy';
      // 自定义拖拽影像（透明，避免浏览器默认）
      try {
        const img = new Image();
        img.src =
          'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        e.dataTransfer.setDragImage(img, 0, 0);
      } catch {
        /* ignore */
      }
    }
  }

  /** 开始拖拽画布内节点（移动） */
  startDragNode(e: DragEvent, nodeId: NodeId): void {
    this.pendingMoveId = nodeId;
    this.pendingType = null;
    this.setDragging(true);
    if (e.dataTransfer) {
      e.dataTransfer.setData(DND_MOVE_TYPE, nodeId);
      e.dataTransfer.effectAllowed = 'move';
    }
  }

  /**
   * 解析落点容器并计算插入位置
   * @param el 鼠标下的元素
   * @param e 拖拽事件（取坐标）
   */
  private resolveDropTarget(
    el: HTMLElement | null,
    e: DragEvent
  ): DropTarget | null {
    const containerId = this.findContainerId(el);
    if (!containerId) {
      return {
        parentId: this.store.schema.$$id,
        region: 'body',
        index: this.computeInsertIndex(this.store.schema.$$id, e)
      };
    }
    return {
      parentId: containerId,
      region: 'body',
      index: this.computeInsertIndex(containerId, e)
    };
  }

  /** 向上查找最近的容器节点 id（tree 中 isContainer=true） */
  private findContainerId(el: HTMLElement | null): NodeId | null {
    let cur: HTMLElement | null = el;
    while (cur) {
      const id = cur.getAttribute(ATTR_EDITOR_ID);
      if (id) {
        const inst = this.tree.get(id);
        if (inst?.isContainer) return id;
      }
      cur = cur.parentElement;
    }
    return null;
  }

  /**
   * 计算插入索引：根据光标位置在容器子节点中的相对位置
   * 比较主轴（取子节点跨度更大的轴）：垂直布局比 Y，水平布局比 X
   */
  private computeInsertIndex(containerId: NodeId, e: DragEvent): number {
    const children = this.tree
      .all()
      .filter(
        inst => inst.parentId === containerId && inst.parentRegion === 'body'
      );

    if (!children.length) return 0;

    // 测量子节点几何
    const measured = children
      .map(c => ({id: c.$$id, rect: c.el?.getBoundingClientRect()}))
      .filter((m): m is {id: NodeId; rect: DOMRect} => !!m.rect);

    if (!measured.length) return 0;

    // 按当前 DOM 顺序排序（top 升序，相同则 left 升序）
    measured.sort(
      (a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left
    );

    // 判断主轴：子节点垂直跨度 vs 水平跨度
    const vRange =
      measured[measured.length - 1].rect.bottom - measured[0].rect.top;
    const hRange =
      Math.max(...measured.map(m => m.rect.right)) -
      Math.min(...measured.map(m => m.rect.left));
    const horizontal = hRange > vRange * 1.2;

    const cursor = horizontal ? e.clientX : e.clientY;

    // 找到第一个中点大于光标的子节点 → 插在其前
    for (let i = 0; i < measured.length; i++) {
      const mid = horizontal
        ? measured[i].rect.left + measured[i].rect.width / 2
        : measured[i].rect.top + measured[i].rect.height / 2;
      if (cursor < mid) return i;
    }
    return measured.length;
  }

  /** 判断 descendant 是否为 ancestor 的后代（防止拖入自身） */
  private isDescendant(descendantId: NodeId, ancestorId: NodeId): boolean {
    if (descendantId === ancestorId) return true;
    let cur = this.tree.getParent(ancestorId);
    while (cur) {
      if (cur === descendantId) return true;
      cur = this.tree.getParent(cur);
    }
    return false;
  }

  /** 更新插入指示线 */
  private updateIndicator(e: DragEvent): void {
    const containerId =
      this.findContainerId(e.target as HTMLElement | null) ??
      this.store.schema.$$id;
    const index = this.computeInsertIndex(containerId, e);
    this.renderIndicator(containerId, index, e);
  }

  /** 渲染插入指示线（在容器内对应位置画一条线） */
  private renderIndicator(
    containerId: NodeId,
    index: number,
    e: DragEvent
  ): void {
    const containerEl = this.tree.getEl(containerId);
    if (!containerEl) return;
    const ownerDoc = containerEl.ownerDocument;
    const containerRect = containerEl.getBoundingClientRect();

    // 找到插入位置对应的兄弟元素
    const children = this.tree
      .all()
      .filter(
        inst => inst.parentId === containerId && inst.parentRegion === 'body'
      )
      .sort((a, b) => {
        const ra = a.el?.getBoundingClientRect();
        const rb = b.el?.getBoundingClientRect();
        if (!ra || !rb) return 0;
        return ra.top - rb.top || ra.left - rb.left;
      });

    let lineTop: number;
    let lineLeft = containerRect.left;
    let lineWidth = containerRect.width;
    const horizontal = false; // 简化为水平指示线

    if (index >= children.length) {
      // 末尾：用最后一个子节点的 bottom
      const last = children[children.length - 1]?.el?.getBoundingClientRect();
      lineTop = last ? last.bottom : containerRect.top;
    } else {
      const ref = children[index]?.el?.getBoundingClientRect();
      lineTop = ref ? ref.top : containerRect.top;
    }

    // 清除旧指示
    if (this.indicatorEl && this.indicatorEl.ownerDocument !== ownerDoc) {
      this.clearIndicator();
    }
    if (!this.indicatorEl) {
      this.indicatorEl = ownerDoc.createElement('div');
      this.indicatorEl.className = 'assem-dnd-indicator';
      this.indicatorEl.style.cssText =
        'position:absolute;height:2px;background:#0079f2;z-index:99999;pointer-events:none;box-shadow:0 0 0 1px rgba(0,121,242,0.4);';
    }
    if (!this.indicatorEl.parentElement) {
      ownerDoc.body.appendChild(this.indicatorEl);
    }
    this.indicatorEl.style.top = `${
      lineTop + (ownerDoc.defaultView?.scrollY ?? 0)
    }px`;
    this.indicatorEl.style.left = `${
      lineLeft + (ownerDoc.defaultView?.scrollX ?? 0)
    }px`;
    this.indicatorEl.style.width = `${lineWidth}px`;
    this.indicatorEl.style.display = horizontal ? 'none' : 'block';
    void e;
  }

  private clearIndicator(): void {
    if (this.indicatorEl?.parentElement) {
      this.indicatorEl.parentElement.removeChild(this.indicatorEl);
    }
    this.indicatorEl = null;
  }

  private setDragging(active: boolean): void {
    this.dragging = active;
    this.bridge.setDraggingState(active);
    if (!active) {
      this.pendingType = null;
      this.pendingMoveId = null;
      this.clearIndicator();
    }
  }

  /** 解析节点 id（供外部用） */
  nodeIdFromEvent(e: MouseEvent): NodeId | null {
    let cur = e.target as HTMLElement | null;
    while (cur) {
      const id = cur.getAttribute && cur.getAttribute(ATTR_EDITOR_ID);
      if (id) return id;
      cur = cur.parentElement;
    }
    return null;
  }

  /** 销毁 */
  destroy(): void {
    this.cleanupFns.forEach(fn => fn());
    this.cleanupFns = [];
    this.clearIndicator();
  }
}
