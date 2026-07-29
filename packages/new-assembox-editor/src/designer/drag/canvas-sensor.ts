/**
 * CanvasSensor —— 画布感应区（同 DOM / iframe 共用）
 * 负责：命中测试、坐标换算、投放位置计算、插入指示线渲染
 *
 * 通过注入的 getters 适配两种画布：
 *  - inline：contentDocument=document，bounds=容器 rect，toGlobal=恒等
 *  - iframe：contentDocument=iframe.contentDocument，bounds=iframe rect，toGlobal=偏移
 */
import type {DragSensor, DropLocation} from './types';
import type {NodeTree} from '../../simulator/node-tree';
import type {EditorStore} from '../../core/store';
import {ATTR_EDITOR_ID} from '../dom-marking';
import type {NodeId} from '../../schema/types';

export interface CanvasSensorOptions {
  id: string;
  /** 感应区文档 */
  getContentDocument: () => Document | null;
  /** 感应区边界（host 视口坐标，用于命中） */
  getBounds: () => DOMRect | null;
  /** 局部坐标 → 全局坐标（host 视口） */
  toGlobal: (localX: number, localY: number) => {x: number; y: number};
  /** 局部坐标下取元素 */
  elementFromPoint: (localX: number, localY: number) => Element | null;
}

export class CanvasSensor implements DragSensor {
  readonly id: string;
  sensorAvailable = true;
  private indicatorEl: HTMLElement | null = null;

  constructor(
    private readonly opts: CanvasSensorOptions,
    private readonly tree: NodeTree,
    private readonly store: EditorStore
  ) {
    this.id = opts.id;
  }

  get contentDocument(): Document | null {
    return this.opts.getContentDocument();
  }

  isEnter(globalX: number, globalY: number): boolean {
    const b = this.opts.getBounds();
    if (!b) return false;
    return (
      globalX >= b.left &&
      globalX <= b.right &&
      globalY >= b.top &&
      globalY <= b.bottom
    );
  }

  toGlobal(localX: number, localY: number): {x: number; y: number} {
    return this.opts.toGlobal(localX, localY);
  }

  elementFromPoint(localX: number, localY: number): Element | null {
    return this.opts.elementFromPoint(localX, localY);
  }

  /**
   * 计算投放位置并渲染指示线
   */
  locate(
    target: Element | null,
    canvasX: number,
    canvasY: number
  ): DropLocation | null {
    const doc = this.contentDocument;
    if (!doc) return null;

    // 1. 找落点容器（向上找最近容器节点）
    const containerId = this.findContainerId(target);
    const finalContainerId = containerId ?? this.store.schema.$$id;

    // 2. 计算插入索引
    const index = this.computeInsertIndex(finalContainerId, canvasX, canvasY);

    // 3. 计算指示线位置
    const indicator = this.computeIndicator(finalContainerId, index);

    // 4. 渲染指示线
    this.renderIndicator(doc, indicator);

    return {
      containerId: finalContainerId,
      region: 'body',
      index,
      indicator
    };
  }

  /** 向上找最近的容器节点 id */
  private findContainerId(el: Element | null): NodeId | null {
    let cur: Element | null = el;
    while (cur) {
      const id = cur.getAttribute && cur.getAttribute(ATTR_EDITOR_ID);
      if (id) {
        const inst = this.tree.get(id);
        if (inst?.isContainer) return id;
      }
      cur = cur.parentElement;
    }
    return null;
  }

  /** 计算插入索引：按光标位置在子节点序列中的相对位置 */
  private computeInsertIndex(
    containerId: NodeId,
    canvasX: number,
    canvasY: number
  ): number {
    const children = this.tree
      .getChildren(containerId)
      .filter(inst => inst.parentRegion === 'body');
    if (!children.length) return 0;

    const measured = children
      .map(c => ({id: c.$$id, rect: c.el?.getBoundingClientRect()}))
      .filter((m): m is {id: NodeId; rect: DOMRect} => !!m.rect);
    if (!measured.length) return 0;

    measured.sort(
      (a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left
    );

    // 主轴判定
    const vRange =
      measured[measured.length - 1].rect.bottom - measured[0].rect.top;
    const hRange =
      Math.max(...measured.map(m => m.rect.right)) -
      Math.min(...measured.map(m => m.rect.left));
    const horizontal = hRange > vRange * 1.2;
    const cursor = horizontal ? canvasX : canvasY;

    for (let i = 0; i < measured.length; i++) {
      const mid = horizontal
        ? measured[i].rect.left + measured[i].rect.width / 2
        : measured[i].rect.top + measured[i].rect.height / 2;
      if (cursor < mid) return i;
    }
    return measured.length;
  }

  /** 计算指示线位置（感应区文档坐标，支持横/竖布局） */
  private computeIndicator(
    containerId: NodeId,
    index: number
  ): {
    x: number;
    y: number;
    width: number;
    height: number;
    horizontal: boolean;
  } {
    const containerEl = this.tree.getEl(containerId);
    const containerRect = containerEl?.getBoundingClientRect();
    const children = this.tree
      .getChildren(containerId)
      .filter(inst => inst.parentRegion === 'body')
      .sort((a, b) => {
        const ra = a.el?.getBoundingClientRect();
        const rb = b.el?.getBoundingClientRect();
        if (!ra || !rb) return 0;
        return ra.top - rb.top || ra.left - rb.left;
      });

    const cLeft = containerRect?.left ?? 0;
    const cTop = containerRect?.top ?? 0;
    const cWidth = containerRect?.width ?? 0;
    const cHeight = containerRect?.height ?? 0;

    // 主轴判定：水平跨度 > 垂直跨度 × 1.2 视为横向布局
    const measured = children
      .map(c => c.el?.getBoundingClientRect())
      .filter((r): r is DOMRect => !!r);
    const horizontal =
      measured.length > 0 &&
      Math.max(...measured.map(m => m.right)) -
        Math.min(...measured.map(m => m.left)) >
        (Math.max(...measured.map(m => m.bottom)) -
          Math.min(...measured.map(m => m.top))) *
          1.2;

    if (horizontal) {
      // 横向布局：竖向指示线（在插入位置 x，贯穿容器高度）
      let x: number;
      if (index >= children.length) {
        const last = children[children.length - 1]?.el?.getBoundingClientRect();
        x = last ? last.right : cLeft;
      } else {
        const ref = children[index]?.el?.getBoundingClientRect();
        x = ref ? ref.left : cLeft;
      }
      return {x, y: cTop, width: 2, height: cHeight, horizontal: true};
    }

    // 纵向布局：横向指示线（在插入位置 y，贯穿容器宽度）
    let y: number;
    if (index >= children.length) {
      const last = children[children.length - 1]?.el?.getBoundingClientRect();
      y = last ? last.bottom : cTop;
    } else {
      const ref = children[index]?.el?.getBoundingClientRect();
      y = ref ? ref.top : cTop;
    }
    return {x: cLeft, y, width: cWidth, height: 2, horizontal: false};
  }

  /** 渲染指示线到感应区文档（支持横/竖两种方向） */
  private renderIndicator(
    doc: Document,
    indicator: {
      x: number;
      y: number;
      width: number;
      height: number;
      horizontal: boolean;
    }
  ): void {
    if (this.indicatorEl && this.indicatorEl.ownerDocument !== doc) {
      this.clearIndicator();
    }
    if (!this.indicatorEl) {
      this.indicatorEl = doc.createElement('div');
      this.indicatorEl.className = 'assem-drag-indicator';
      this.indicatorEl.style.cssText =
        'position:absolute;background:#0079f2;z-index:99999;pointer-events:none;box-shadow:0 0 0 1px rgba(0,121,242,0.4);transition:top 0.05s,left 0.05s;';
    }
    if (!this.indicatorEl.parentElement) {
      doc.body.appendChild(this.indicatorEl);
    }
    const win = doc.defaultView;
    const sx = win?.scrollX ?? 0;
    const sy = win?.scrollY ?? 0;
    this.indicatorEl.style.left = `${indicator.x + sx}px`;
    this.indicatorEl.style.top = `${indicator.y + sy}px`;
    this.indicatorEl.style.width = `${
      indicator.horizontal ? 2 : indicator.width
    }px`;
    this.indicatorEl.style.height = `${
      indicator.horizontal ? indicator.height : 2
    }px`;
  }

  /** 清除指示线 */
  private clearIndicator(): void {
    if (this.indicatorEl?.parentElement) {
      this.indicatorEl.parentElement.removeChild(this.indicatorEl);
    }
    this.indicatorEl = null;
  }

  deactiveSensor(): void {
    this.clearIndicator();
  }

  /** 销毁 */
  destroy(): void {
    this.clearIndicator();
    this.sensorAvailable = false;
  }
}
