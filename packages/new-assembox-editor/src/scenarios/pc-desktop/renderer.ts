import { createApp, reactive, h, type App } from 'vue';
import ElementPlus from 'element-plus';
import {
  AssemPlugin,
  registerDefaults,
  AssemViews,
  lookupComponent,
} from '@cs/assembox-desktop-next';
import type { AssemConfig } from '@cs/assembox-core-next';
import type {
  IRenderer,
  SlotMarker,
  RendererMountOptions,
} from '../../scenario/types';

/**
 * PC 场景设计态渲染器
 *
 * 包装 assembox-desktop-next（生产渲染器），增加编辑器专属能力：
 * - reactive schema 桥接（Store.schema === AssemCore.uiSkeleton 同一引用）
 * - DOM 查询（data-editor-id / data-slot-host / data-slot-key）
 * - 事件回调（onClick / onHover / onReady）
 */
export class PcRenderer implements IRenderer {
  private app: App | null = null;
  private container: HTMLElement | null = null;
  private schema: any = null;
  private core: any = null;

  private readyCbs: Array<() => void> = [];
  private clickCb: ((nodeId: string | null, e: MouseEvent) => void) | null = null;
  private hoverCb: ((nodeId: string | null) => void) | null = null;
  private readyFired = false;

  async mount(
    container: HTMLElement,
    schema: any,
    options?: RendererMountOptions,
  ): Promise<void> {
    this.container = container;
    this.schema = schema;

    (window as any).assemBoxIsEdit = true;
    (window as any).assemBoxDesignMode = 'design';

    (window as any).assemVueRenderer = {
      onMountedInstance: (_instance: unknown) => {
        if (!this.readyFired) {
          this.readyFired = true;
          this.readyCbs.forEach((cb) => cb());
        }
      },
      onUpdatedInstance: (_instance: unknown) => {},
      onUnmountedInstance: (_instance: unknown) => {},
    };

    this.bindCanvasEvents(container);

    const config: AssemConfig = {
      uiSkeleton: schema,
      dataSource: { api: { config: {} }, requestConfig: {}, dataModelConfig: {}, sharedFns: {} } as any,
      security: {},
    };

    this.app = createApp({
      render: () => {
        const scenes = Object.values(this.schema || {});
        const scene = scenes[0] as any;
        if (!scene?.viewsProps) return h('div', '空场景');
        return h(AssemViews, { viewsProps: scene.viewsProps });
      },
    });

    this.app.use(AssemPlugin, config);
    this.app.use(ElementPlus);
    registerDefaults();
    this.app.mount(container);

    this.core = this.app.config.globalProperties.$assemCore;
  }

  setSchema(schema: any): void {
    const oldKeys = Object.keys(this.schema || {});
    const newKeys = Object.keys(schema || {});
    for (const key of oldKeys) delete this.schema[key];
    for (const key of newKeys) this.schema[key] = schema[key];
  }

  updateNode(nodeId: string, patch: any): void {
    const node = this.findNodeById(nodeId);
    if (!node) return;
    if (patch.__nodeOptions) Object.assign(node.__nodeOptions, patch.__nodeOptions);
    if (patch.__nodeEvent) Object.assign(node.__nodeEvent, patch.__nodeEvent);
    if (patch.__nodeStyle) node.__nodeStyle = { ...(node.__nodeStyle || {}), ...patch.__nodeStyle };
  }

  onStructureChange(): void {
    // 结构变更靠 reactive 数组操作自动 diff
  }

  setDraggingState(active: boolean): void {
    if (this.container) {
      this.container.style.cursor = active ? 'copy' : '';
    }
  }

  setDesignMode(mode: 'design' | 'preview'): void {
    (window as any).assemBoxDesignMode = mode;
  }

  getNodeElement(nodeId: string): HTMLElement | null {
    if (!this.container) return null;
    return this.container.querySelector(`[data-editor-id="${nodeId}"]`) as HTMLElement | null;
  }

  getRect(nodeId: string): DOMRect | null {
    const el = this.getNodeElement(nodeId);
    return el ? el.getBoundingClientRect() : null;
  }

  nodeIdFromElement(el: HTMLElement | null): string | null {
    if (!el) return null;
    const found = el.closest('[data-editor-id]') as HTMLElement | null;
    return found ? found.getAttribute('data-editor-id') : null;
  }

  getSlotMarkers(nodeId: string): SlotMarker[] | null {
    if (!this.container) return null;
    const els = this.container.querySelectorAll(`[data-slot-host="${nodeId}"]`);
    if (!els.length) return null;
    return Array.from(els).map((el) => ({
      slotKey: el.getAttribute('data-slot-key') || 'defaultSlot',
      el: el as HTMLElement,
      rect: el.getBoundingClientRect(),
    }));
  }

  resolveFromElement(el: HTMLElement | null): { nodeId: string; slotKey: string } | null {
    if (!el) return null;
    const nodeEl = el.closest('[data-editor-id]') as HTMLElement | null;
    if (!nodeEl) return null;
    const slotEl = el.closest('[data-slot-host]') as HTMLElement | null;
    return {
      nodeId: nodeEl.getAttribute('data-editor-id')!,
      slotKey: slotEl?.getAttribute('data-slot-key') || 'defaultSlot',
    };
  }

  onReady(cb: () => void): void { this.readyCbs.push(cb); }
  onClick(cb: (nodeId: string | null, e: MouseEvent) => void): void { this.clickCb = cb; }
  onHover(cb: (nodeId: string | null) => void): void { this.hoverCb = cb; }

  private bindCanvasEvents(container: HTMLElement): void {
    // 方案 B：mousedown 替代 click 做选区主通道（disabled 元素 click 不触发，mousedown 触发）
    container.addEventListener('mousedown', (e: MouseEvent) => {
      if ((window as any).assemBoxDesignMode !== 'design') return;
      if (e.button !== 0) return; // 仅左键
      const nodeId = this.nodeIdFromElement(e.target as HTMLElement);
      this.clickCb?.(nodeId, e);
    }, true);

    // click 作为补充（非 disabled 元素走 click，更精确）
    container.addEventListener('click', (e: MouseEvent) => {
      if ((window as any).assemBoxDesignMode !== 'design') return;
      const nodeId = this.nodeIdFromElement(e.target as HTMLElement);
      // 仅当 mousedown 未已触发选中时才用 click（避免重复）
      // mousedown 已处理 → click 到达说明元素未 disabled → 不重复
      // 实际：mousedown 总是先触发，click 后触发；只让 mousedown 处理选中
      e.stopPropagation();
    }, true);

    container.addEventListener('mouseover', (e: MouseEvent) => {
      if ((window as any).assemBoxDesignMode !== 'design') return;
      const nodeId = this.nodeIdFromElement(e.target as HTMLElement);
      this.hoverCb?.(nodeId);
      e.stopPropagation();
    }, true);

    container.addEventListener('mouseleave', () => {
      this.hoverCb?.(null);
    }, true);
  }

  private findNodeById(nodeId: string): any | undefined {
    const SLOT_FIELDS = ['defaultSlot', 'toolSlot', 'filterSlot', 'headerSlot', 'rightSlot', 'labelSlot', 'bottomSlot', 'columRender', 'buttonOption'];
    const walk = (node: any): any => {
      if (!node || typeof node !== 'object') return undefined;
      if (node.__nodeId === nodeId) return node;
      const opts = node.__nodeOptions;
      if (!opts) return undefined;
      for (const field of SLOT_FIELDS) {
        const val = opts[field];
        if (Array.isArray(val)) {
          for (const child of val) { const f = walk(child); if (f) return f; }
        } else if (val && typeof val === 'object') {
          const f = walk(val); if (f) return f;
        }
      }
      if (Array.isArray(opts.itemConfig)) {
        for (const item of opts.itemConfig) {
          if (item?.defaultSlot) { const f = walk(item.defaultSlot); if (f) return f; }
        }
      }
      return undefined;
    };
    const scenes = Object.values(this.schema || {});
    for (const scene of scenes) {
      const root = (scene as any)?.viewsProps?.planeOptions;
      if (root) { const f = walk(root); if (f) return f; }
    }
    return undefined;
  }

  dispose(): void {
    this.app?.unmount();
    this.app = null;
    this.container = null;
    this.schema = null;
    this.core = null;
    (window as any).assemVueRenderer = undefined;
  }
}
