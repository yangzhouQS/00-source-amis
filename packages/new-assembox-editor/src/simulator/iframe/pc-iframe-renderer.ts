/**
 * PcIframeRenderer —— Host 侧 iframe 渲染器
 * 实现 IRenderer：创建 iframe，同源直引通信，DOM 查询走 contentDocument。
 *
 * 与 PcRenderer（同 DOM 进程内）的区别：
 *  - schema 发送到 iframe 内的独立渲染器（资源/样式隔离）
 *  - DOM 查询通过 iframe.contentDocument（同步，同源）
 *  - click/hover 由 iframe 内渲染器回报
 *  - schema 深拷贝后再下发，保证两侧引用独立
 */
import type {
  IRenderer,
  SlotMarker,
  RendererMountOptions,
} from '../../scenario/types';
import type {
  IframeRendererApi,
  IframeHostCallbacks,
  IframeAssetsManifest,
} from './protocol';
import { HOST_GLOBAL_KEY, RENDERER_GLOBAL_KEY } from './protocol';

const CONNECT_TIMEOUT = 10000;
const POLL_INTERVAL = 30;

/** 深拷贝（与 PcSchemaOps.cloneSchema 一致的 JSON 方案，structuredClone 优先） */
function deepClone<T>(obj: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(obj);
    } catch {
      /* 含不可结构化克隆的值时回退 JSON */
    }
  }
  return JSON.parse(JSON.stringify(obj));
}

const CDN_BASE = 'https://cdn.yearrow.com/files';

/**
 * PC 桌面端默认依赖清单（基础 UI 库栈，按依赖顺序加载）。
 * - element-plus / element-pro / element-plus-ui / table-pro 标 asPlugin（自动 app.use）
 * - icons-vue / vue-router / axios 仅挂全局（供组件运行时取用）
 * 换场景或换库时，构造 PcIframeRenderer 传入不同清单即可。
 */
export const DEFAULT_PC_ASSETS: IframeAssetsManifest = {
  js: [
    { src: `${CDN_BASE}/element-plus/2.13.7/index.full.min.js`, global: 'ElementPlus', asPlugin: true },
    { src: `${CDN_BASE}/@element-plus/icons-vue/2.3.1/global.iife.min.js`, global: 'ElementPlusIconsVue', asIcons: true },
    { src: `${CDN_BASE}/vue-router/4.2.5/vue-router.global.prod.js`, global: 'VueRouter' },
    { src: `${CDN_BASE}/axios/1.7.0/axios.min.js`, global: 'axios' },
    {
      src: `${CDN_BASE}/@cs/element-pro/1.7.6/element-pro.iife.js`,
      global: 'ElementPro',
      asPlugin: true,
      // 旧版兼容：Box 组件同时注册为 box / Box 全局组件
      components: [
        { name: 'box', path: 'Box' },
        { name: 'Box', path: 'Box' },
      ],
    },
    { src: `${CDN_BASE}/@cs/element-plus-ui/1.0.1/element-plus-ui.iife.js`, global: 'ElementPlusUi', asPlugin: true },
    { src: `${CDN_BASE}/@cs/table-pro/1.0.13/table-pro.iife.js`, global: 'TablePro', asPlugin: true },
  ],
  css: [
    `${CDN_BASE}/@cs/element-pro/1.7.6/theme/index.css`,
    `${CDN_BASE}/@cs/element-plus-ui/1.0.1/theme/yun-que.css`,
    `${CDN_BASE}/fonts/material-cloud/1.0.0/iconfont.css`,
    `${CDN_BASE}/@cs/table-pro/1.0.13/theme/index.css`,
  ],
};

export class PcIframeRenderer implements IRenderer {
  private iframe: HTMLIFrameElement | null = null;
  private container: HTMLElement | null = null;
  private schema: any = null;
  private rendererApi: IframeRendererApi | null = null;
  private connected = false;
  private pendingSchema: any = null;
  private pendingDesignMode: 'design' | 'preview' = 'design';

  private readyCbs: Array<() => void> = [];
  private clickCb: ((nodeId: string | null, e: MouseEvent) => void) | null = null;
  private hoverCb: ((nodeId: string | null) => void) | null = null;
  private readyFired = false;

  /** Host 回调对象（注入到 iframe window） */
  private hostCallbacks: IframeHostCallbacks = {
    onReady: () => {
      if (!this.readyFired) {
        this.readyFired = true;
        this.readyCbs.forEach(cb => cb());
      }
    },
    onClick: (nodeId, e) => this.clickCb?.(nodeId, e),
    onHover: nodeId => this.hoverCb?.(nodeId),
    onError: (msg, detail) => console.error('[PcIframeRenderer]', msg, detail),
  };

  /** 动态依赖清单（mount 时随 __ASSEM_HOST__ 下发给 iframe） */
  private assets: IframeAssetsManifest;

  constructor(assets: IframeAssetsManifest = DEFAULT_PC_ASSETS) {
    this.assets = assets;
  }

  /** 更新依赖清单（需在 mount 前调用；mount 后改动需重建 iframe） */
  setAssets(assets: IframeAssetsManifest): void {
    this.assets = assets;
  }

  async mount(
    container: HTMLElement,
    schema: any,
    _options?: RendererMountOptions,
  ): Promise<void> {
    this.container = container;
    this.schema = schema;

    const iframe = document.createElement('iframe');
    iframe.src = '/canvas.html';
    iframe.style.cssText =
      'width:100%;height:100%;border:0;display:block;background:#fff;';
    iframe.setAttribute('name', 'assembox-canvas');
    container.appendChild(iframe);
    this.iframe = iframe;

    this.connect();
  }

  /** 同源直引连接：注入 hostCallbacks → 轮询等 renderer 暴露 */
  private connect(): void {
    if (this.connected) return;

    const win = this.iframe?.contentWindow as any;
    if (!win) {
      this.iframe?.addEventListener('load', () => this.connect(), { once: true });
      return;
    }

    // 注入 host 回调 + 依赖清单（iframe entry 据此加载 JS/CSS、注册插件/外部组件）
    win[HOST_GLOBAL_KEY] = { ...this.hostCallbacks, assets: this.assets };

    let attempts = 0;
    const maxAttempts = Math.ceil(CONNECT_TIMEOUT / POLL_INTERVAL);
    const timer = setInterval(() => {
      attempts++;
      const api = win[RENDERER_GLOBAL_KEY] as IframeRendererApi | undefined;
      if (api) {
        clearInterval(timer);
        this.onConnected(api);
      } else if (attempts > maxAttempts) {
        clearInterval(timer);
        console.error('[PcIframeRenderer] 渲染器连接超时');
      }
    }, POLL_INTERVAL);
  }

  private onConnected(api: IframeRendererApi): void {
    this.connected = true;
    this.rendererApi = api;

    const schema = this.pendingSchema ?? this.schema;
    const designMode = this.pendingDesignMode;
    this.pendingSchema = null;

    if (api.ready) {
      api.setSchema(deepClone(schema));
      api.setDesignMode(designMode);
    } else {
      api.init(deepClone(schema), designMode);
    }
  }

  setSchema(schema: any): void {
    this.schema = schema;
    if (this.rendererApi) {
      this.rendererApi.setSchema(deepClone(schema));
    } else {
      this.pendingSchema = schema;
    }
  }

  updateNode(nodeId: string, patch: any): void {
    if (this.rendererApi?.updateNode) {
      this.rendererApi.updateNode(nodeId, patch);
    } else {
      this.setSchema(this.schema);
    }
  }

  onStructureChange(): void {
    // 结构变更靠 setSchema 全量同步
  }

  setDraggingState(active: boolean): void {
    this.rendererApi?.setDraggingState(active);
  }

  setDesignMode(mode: 'design' | 'preview'): void {
    if (this.rendererApi) {
      this.rendererApi.setDesignMode(mode);
    } else {
      this.pendingDesignMode = mode;
    }
  }

  // ── DOM 查询（走 iframe.contentDocument，同步） ──

  private get doc(): Document | null {
    return this.iframe?.contentDocument ?? null;
  }

  getNodeElement(nodeId: string): HTMLElement | null {
    const doc = this.doc;
    if (!doc) return null;
    return doc.querySelector(`[data-editor-id="${nodeId}"]`) as HTMLElement | null;
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
    const doc = this.doc;
    if (!doc) return null;
    const els = doc.querySelectorAll(`[data-slot-host="${nodeId}"]`);
    if (!els.length) return null;
    return Array.from(els).map(el => ({
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

  onReady(cb: () => void): void {
    this.readyCbs.push(cb);
  }

  onClick(cb: (nodeId: string | null, e: MouseEvent) => void): void {
    this.clickCb = cb;
  }

  onHover(cb: (nodeId: string | null) => void): void {
    this.hoverCb = cb;
  }

  dispose(): void {
    this.rendererApi?.dispose();
    this.rendererApi = null;
    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }
    this.container = null;
    this.connected = false;
    this.readyFired = false;
  }
}
