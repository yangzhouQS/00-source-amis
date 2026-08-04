/**
 * CanvasSensor —— 画布感应区
 * 负责：命中测试、坐标换算、投放位置计算、插入指示线渲染
 *
 * 通过注入的 editor 适配场景渲染器与 schemaOps：
 *  - 容器判定：schemaOps.isContainer / nestingRules
 *  - 子节点列表：schemaOps.getSlotChildren
 *  - DOM 元素：renderer.getNodeElement / resolveFromElement
 */
import type {DragSensor, DropLocation} from './types';
import type {Editor} from '../../core/editor';
import {ATTR_EDITOR_ID} from '../dom-marking';

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
    private readonly editor: Editor
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
   * 使用 DOM 实时元素（非缓存），避免 re-render 后 stale ref
   */
  locate(
    target: Element | null,
    canvasX: number,
    canvasY: number
  ): DropLocation | null {
    const doc = this.contentDocument;
    if (!doc) return null;

    // 1. 找落点容器（向上找最近容器节点），同时拿到 DOM 元素
    const {id: containerId, el: containerEl, slotKey} = this.findContainerEl(target);
    const finalSlotKey = slotKey ?? 'defaultSlot';
    const finalContainerId =
      containerId ?? this.editor.rootNodeId ?? '';
    const finalContainerEl =
      containerEl ??
      (this.editor.renderer?.getNodeElement(finalContainerId) ?? null);

    // 2. 计算插入索引（用 DOM 实时元素测几何）
    const index = this.computeInsertIndex(
      finalContainerId,
      finalSlotKey,
      canvasX,
      canvasY,
      doc
    );

    // 3. 计算指示线位置
    const indicator = this.computeIndicator(
      finalContainerId,
      finalSlotKey,
      index,
      finalContainerEl
    );

    // 4. 渲染指示线
    this.renderIndicator(doc, indicator);

    return {
      containerId: finalContainerId,
      region: finalSlotKey,
      index,
      indicator
    };
  }

  /** 向上找最近的容器节点 id + DOM 元素 + 槽位键（DOM 实时） */
  private findContainerEl(el: Element | null): {
    id: string | null;
    el: Element | null;
    slotKey: string | null;
  } {
    const renderer = this.editor.renderer;
    let cur: Element | null = el;
    while (cur) {
      const id = cur.getAttribute && cur.getAttribute(ATTR_EDITOR_ID);
      if (id) {
        const node = this.editor.schemaOps.getNodeById(
          this.editor.store.schema,
          id
        );
        if (node && this.editor.schemaOps.isContainer?.(node)) {
          return {id, el: cur, slotKey: 'defaultSlot'};
        }
      }
      // 检测槽位宿主标记（data-slot-host / data-slot-key）
      const slotHost = cur.getAttribute && cur.getAttribute('data-slot-host');
      const slotKey = cur.getAttribute && cur.getAttribute('data-slot-key');
      if (slotHost && slotKey) {
        const slotNode = this.editor.schemaOps.getNodeById(
          this.editor.store.schema,
          slotHost
        );
        if (slotNode) return {id: slotHost, el: cur, slotKey};
      }
      // 渲染器解析兜底
      if (renderer) {
        const resolved = renderer.resolveFromElement(cur as HTMLElement);
        if (resolved) {
          const node = this.editor.schemaOps.getNodeById(
            this.editor.store.schema,
            resolved.nodeId
          );
          if (node && this.editor.schemaOps.isContainer?.(node)) {
            return {id: resolved.nodeId, el: cur, slotKey: resolved.slotKey};
          }
        }
      }
      cur = cur.parentElement;
    }
    return {id: null, el: null, slotKey: null};
  }

  /** DOM 实时查询节点元素（避免缓存 stale） */
  private freshEl(doc: Document, id: string): HTMLElement | null {
    return (
      this.editor.renderer?.getNodeElement(id) ??
      (doc.querySelector(`[${ATTR_EDITOR_ID}="${id}"]`) as HTMLElement | null)
    );
  }

  /** 计算插入索引：按光标位置在子节点序列中的相对位置 */
  private computeInsertIndex(
    containerId: string,
    slotKey: string,
    canvasX: number,
    canvasY: number,
    doc: Document
  ): number {
    const parentNode = this.editor.schemaOps.getNodeById(
      this.editor.store.schema,
      containerId
    );
    if (!parentNode) return 0;
    const children = this.editor.schemaOps.getSlotChildren(parentNode, slotKey);
    if (!children.length) return 0;

    // 用 DOM 实时查询元素（避免 el stale）
    const measured = children
      .map(c => {
        const id = this.editor.schemaOps.getNodeId(c);
        const el = this.freshEl(doc, id);
        return el ? {id, rect: el.getBoundingClientRect()} : null;
      })
      .filter((m): m is {id: string; rect: DOMRect} => !!m && !!m.rect);
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
    containerId: string,
    slotKey: string,
    index: number,
    containerEl: Element | null
  ): {
    x: number;
    y: number;
    width: number;
    height: number;
    horizontal: boolean;
  } {
    const doc = this.contentDocument!;
    const containerRect = containerEl?.getBoundingClientRect();
    const parentNode = this.editor.schemaOps.getNodeById(
      this.editor.store.schema,
      containerId
    );
    const children = parentNode
      ? this.editor.schemaOps.getSlotChildren(parentNode, slotKey)
      : [];

    const cLeft = containerRect?.left ?? 0;
    const cTop = containerRect?.top ?? 0;
    const cWidth = containerRect?.width ?? 0;
    const cHeight = containerRect?.height ?? 0;

    // 用 DOM 实时查询子节点元素
    const childEls = children
      .map(c => this.freshEl(doc, this.editor.schemaOps.getNodeId(c)))
      .filter((el): el is HTMLElement => !!el);
    const childRects = childEls.map(el => el.getBoundingClientRect());

    // 主轴判定
    const horizontal =
      childRects.length > 0 &&
      Math.max(...childRects.map(m => m.right)) -
        Math.min(...childRects.map(m => m.left)) >
        (Math.max(...childRects.map(m => m.bottom)) -
          Math.min(...childRects.map(m => m.top))) *
          1.2;

    if (horizontal) {
      let x: number;
      if (index >= childRects.length) {
        x = childRects.length ? childRects[childRects.length - 1].right : cLeft;
      } else {
        x = childRects[index]?.left ?? cLeft;
      }
      return {x, y: cTop, width: 2, height: cHeight, horizontal: true};
    }

    // 纵向布局：横向指示线
    let y: number;
    if (index >= childRects.length) {
      y = childRects.length ? childRects[childRects.length - 1].bottom : cTop;
    } else {
      y = childRects[index]?.top ?? cTop;
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
