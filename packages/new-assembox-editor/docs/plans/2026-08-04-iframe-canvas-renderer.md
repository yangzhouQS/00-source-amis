# Iframe 画布渲染器 实施计划

> **目标：** 恢复 iframe 隔离渲染，集成到场景系统（IRenderer），保证设计态 === 生产态渲染（iframe 内加载 assembox-desktop-next），通信走同源直引。

**架构：** Host（编辑器主窗口）创建 iframe，iframe 加载独立的 canvas.html 入口（Vite 多页打包），内部用 AssemViews 渲染 schema 并标记 DOM（data-editor-id）。Host 通过 `iframe.contentWindow.__ASSEM_RENDERER__` 同源直引调用渲染器方法，DOM 查询走 `iframe.contentDocument`（同步）。参考 lowcode-engine builtin-simulator 的双进程模型，但用同源直引替代 postMessage（更简单、同步、够用）。

**通信模型总览：**

```
┌─ HOST（编辑器主窗口）──────────────┐         ┌─ IFRAME（canvas.html）──────────────┐
│ PcIframeRenderer implements IRenderer│         │ IframeRendererEntry                  │
│   创建 <iframe src="/canvas.html">   │         │   createApp + AssemPlugin+AssemViews │
│   win.__ASSEM_HOST__ = hostCallbacks │◄───────►│   win.__ASSEM_RENDERER__ = renderer  │
│   调用 renderer.setSchema(...)       │ 同源直引 │ IframeCanvasRenderer                 │
│ DOM 查询: iframe.contentDocument     │         │   渲染 schema + data-editor-id 标记  │
│   querySelector([data-editor-id])    │         │   click/hover → hostApi 回报         │
└──────────────────────────────────────┘         └──────────────────────────────────────┘
```

**关键决策：**
- **同源直引**（非 postMessage）：dev/prod 同源，直引同步、简单。postMessage 仅作跨源兜底（本期不实现）。
- **iframe 内加载 AssemViews**：与 PcRenderer 完全一致的渲染引擎，保证设计态 === 生产态。
- **schema 同步**：Host 每次 commit 后发 `setSchema(clone)` 给 iframe，iframe 维护自己的响应式副本。
- **DOM 标记复用**：assembox-desktop-next 已输出 `data-editor-id`/`data-slot-host`/`data-slot-key`，Host 直接在 contentDocument 查询。

**文件结构：**

| 文件 | 职责 |
|---|---|
| 新建 `src/simulator/iframe/protocol.ts` | 通信协议：双向 API 接口 + 握手常量 |
| 新建 `src/simulator/iframe/iframe-canvas-renderer.ts` | iframe 内侧渲染器：包装 AssemViews，实现 RendererApi |
| 新建 `src/simulator/iframe/iframe-renderer-entry.ts` | iframe 入口 bootstrap：加载 Vue+EP+assembox，暴露 renderer |
| 新建 `src/simulator/iframe/pc-iframe-renderer.ts` | Host 侧渲染器：管理 iframe 生命周期，实现 IRenderer |
| 新建 `canvas.html` | iframe 入口页（Vite 多页） |
| 改 `vite.config.ts` | 恢复 main + canvas 双入口 |
| 改 `src/scenario/types.ts` | ScenarioProfile 增 `createIframeRenderer?` |
| 改 `src/scenarios/pc-desktop/index.ts` | 提供 createIframeRenderer |
| 改 `src/core/editor.ts` | EditorOptions 增 `canvasMode`，选择渲染器 |
| 改 `src/designer/designer-host.tsx` | iframe 模式：创建 iframe 元素 + 挂载 |
| 改 `src/designer/drag/canvas-sensor.ts` | 感应区适配 iframe contentDocument |
| 改 `src/designer/bem-tools.tsx` | iframe rect 偏移（已有 iframeEl prop） |
| 改 `src/demo/main.tsx` | canvasMode: 'iframe' |

---

## Task 1: 通信协议 `protocol.ts`

**Files:**
- Create: `src/simulator/iframe/protocol.ts`

- [ ] **Step 1: 编写协议文件**

```ts
/**
 * iframe 画布通信协议
 *
 * 同源直引模型（dev/prod 同源，无需 postMessage）：
 *  Host 创建 iframe → iframe 加载 canvas.html → entry 暴露 win.__ASSEM_RENDERER__
 *  Host 通过 win.__ASSEM_RENDERER__.xxx() 调用渲染器
 *  Host 注入 win.__ASSEM_HOST__ = callbacks，渲染器通过它回报事件
 *  DOM 查询：Host 直接用 iframe.contentDocument（同步）
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Host 注入到 iframe window 的全局键 */
export const HOST_GLOBAL_KEY = '__ASSEM_HOST__';
/** iframe entry 暴露渲染器的全局键 */
export const RENDERER_GLOBAL_KEY = '__ASSEM_RENDERER__';

/** Host → Renderer 命令（Host 调用，Renderer 实现） */
export interface IframeRendererApi {
  readonly ready: boolean;
  /** 初始化：注入 schema 并首次挂载 */
  init(schema: any, designMode: 'design' | 'preview'): void;
  /** 全量同步 schema（结构变更后） */
  setSchema(schema: any): void;
  /** 定向更新节点属性（增量，可选实现） */
  updateNode?(nodeId: string, patch: any): void;
  /** 设计/预览模式切换 */
  setDesignMode(mode: 'design' | 'preview'): void;
  /** 拖拽态（禁用画布交互光标） */
  setDraggingState(active: boolean): void;
  /** 强制重渲染 */
  rerender(): void;
  /** 销毁 */
  dispose(): void;
}

/** Renderer → Host 回调（Host 注入，Renderer 调用） */
export interface IframeHostCallbacks {
  /** iframe 渲染器就绪 */
  onReady(): void;
  /** 画布内点击节点 */
  onClick(nodeId: string | null, originalEvent: MouseEvent): void;
  /** 画布内悬浮节点 */
  onHover(nodeId: string | null): void;
  /** 渲染器错误 */
  onError(message: string, detail?: any): void;
}
```

- [ ] **Step 2: 确认无类型错误**

Run: `npx vue-tsc --noEmit`
Expected: 无 protocol.ts 相关错误

---

## Task 2: iframe 内侧渲染器 `iframe-canvas-renderer.ts`

**Files:**
- Create: `src/simulator/iframe/iframe-canvas-renderer.ts`

此文件运行在 iframe 内部，与 PcRenderer 同构（都用 AssemViews），但不直接操作 Host store，而是通过 hostApi 回报事件。

- [ ] **Step 1: 编写 iframe 内侧渲染器**

```ts
/**
 * iframe 内侧渲染器（运行于 canvas.html 内部）
 * 包装 assembox-desktop-next 的 AssemViews，渲染 PC schema 并标记 DOM。
 * 与 PcRenderer 同构，但 schema 来自 host 下发，事件通过 hostApi 回报。
 */
import { createApp, reactive, h, type App } from 'vue';
import ElementPlus from 'element-plus';
import {
  AssemPlugin,
  registerDefaults,
  AssemViews,
} from '@cs/assembox-desktop-next';
import type { AssemConfig } from '@cs/assembox-core-next';
import type {
  IframeRendererApi,
  IframeHostCallbacks,
} from './protocol';

export class IframeCanvasRenderer implements IframeRendererApi {
  private app: App | null = null;
  private hostCallbacks: IframeHostCallbacks | null = null;
  /** 响应式 schema（驱动 AssemViews 渲染） */
  private schema = reactive<Record<string, any>>({});
  private designMode: 'design' | 'preview' = 'design';
  private dragging = false;
  ready = false;

  constructor(hostCallbacks?: IframeHostCallbacks) {
    this.hostCallbacks = hostCallbacks ?? null;
  }

  setHostCallbacks(cb: IframeHostCallbacks): void {
    this.hostCallbacks = cb;
  }

  init(schema: any, designMode: 'design' | 'preview' = 'design'): void {
    this.syncSchema(schema);
    this.designMode = designMode;
    (window as any).assemBoxIsEdit = true;
    (window as any).assemBoxDesignMode = designMode;
    this.mount();
  }

  setSchema(schema: any): void {
    if (!this.ready) {
      this.syncSchema(schema);
      this.mount();
      return;
    }
    this.syncSchema(schema);
  }

  setDesignMode(mode: 'design' | 'preview'): void {
    this.designMode = mode;
    (window as any).assemBoxDesignMode = mode;
  }

  setDraggingState(active: boolean): void {
    this.dragging = active;
    document.body.style.cursor = active ? 'copy' : '';
  }

  rerender(): void {
    this.syncSchema(this.schema);
  }

  /** 同步 schema 到响应式对象（in-place 替换 key） */
  private syncSchema(schema: any): void {
    const src = schema ?? {};
    for (const key of Object.keys(this.schema)) delete this.schema[key];
    for (const key of Object.keys(src)) this.schema[key] = src[key];
  }

  /** 挂载 Vue app（与 PcRenderer.mount 同构） */
  private mount(): void {
    const el = document.getElementById('app');
    if (!el) {
      this.hostCallbacks?.onError('canvas.html 缺少 #app 容器');
      return;
    }
    if (this.app) {
      this.app.unmount();
      this.app = null;
    }

    const config: AssemConfig = {
      uiSkeleton: this.schema,
      dataSource: {
        api: { config: {} },
        requestConfig: {},
        dataModelConfig: {},
        sharedFns: {},
      } as any,
      security: {},
    };

    this.app = createApp({
      render: () => {
        const scenes = Object.values(this.schema);
        const scene = scenes[0] as any;
        if (!scene?.viewsProps) return h('div', '空场景');
        return h(AssemViews, { viewsProps: scene.viewsProps });
      },
    });

    this.app.use(AssemPlugin, config);
    this.app.use(ElementPlus);
    registerDefaults();
    this.app.mount(el);

    this.bindCanvasEvents(el);
    this.ready = true;
    this.hostCallbacks?.onReady();
  }

  /** 绑定画布事件（click/hover → 回报 host） */
  private bindCanvasEvents(container: HTMLElement): void {
    const nodeIdFromEl = (el: HTMLElement | null): string | null => {
      if (!el) return null;
      const found = el.closest('[data-editor-id]') as HTMLElement | null;
      return found ? found.getAttribute('data-editor-id') : null;
    };

    container.addEventListener(
      'click',
      (e: MouseEvent) => {
        if ((window as any).assemBoxDesignMode !== 'design') return;
        const nodeId = nodeIdFromEl(e.target as HTMLElement);
        this.hostCallbacks?.onClick(nodeId, e);
        e.stopPropagation();
      },
      true
    );

    container.addEventListener(
      'mouseover',
      (e: MouseEvent) => {
        if ((window as any).assemBoxDesignMode !== 'design') return;
        const nodeId = nodeIdFromEl(e.target as HTMLElement);
        this.hostCallbacks?.onHover(nodeId);
        e.stopPropagation();
      },
      true
    );

    container.addEventListener(
      'mouseleave',
      () => this.hostCallbacks?.onHover(null),
      true
    );
  }

  dispose(): void {
    this.app?.unmount();
    this.app = null;
    this.ready = false;
    (window as any).assemBoxIsEdit = false;
  }
}
```

- [ ] **Step 2: 确认无类型错误**

Run: `npx vue-tsc --noEmit`
Expected: 无错误

---

## Task 3: iframe 入口 + canvas.html + Vite 配置

**Files:**
- Create: `src/simulator/iframe/iframe-renderer-entry.ts`
- Create: `canvas.html`
- Modify: `vite.config.ts`

- [ ] **Step 1: 编写 iframe 入口 bootstrap**

`src/simulator/iframe/iframe-renderer-entry.ts`:

```ts
/**
 * iframe 渲染器入口（运行于 canvas.html 内部）
 *
 * 握手流程：
 *  1. host 创建 iframe 后注入 win.__ASSEM_HOST__ = callbacks
 *  2. 本入口读取 hostCallbacks，构造 IframeCanvasRenderer
 *  3. 暴露 win.__ASSEM_RENDERER__ 供 host 直引
 *  4. host load/轮询拿到 renderer 后调用 init()
 */
import 'element-plus/dist/index.css';
import { IframeCanvasRenderer } from './iframe-canvas-renderer';
import type { IframeHostCallbacks } from './protocol';
import { HOST_GLOBAL_KEY, RENDERER_GLOBAL_KEY } from './protocol';

const win = window as any;

function getHostCallbacks(): IframeHostCallbacks | null {
  return win[HOST_GLOBAL_KEY] ?? null;
}

function bootstrap(): void {
  let hostCallbacks = getHostCallbacks();
  const renderer = new IframeCanvasRenderer(hostCallbacks ?? undefined);

  // 暴露 renderer 供 host 直引
  win[RENDERER_GLOBAL_KEY] = renderer;

  // host 延迟注入兜底：轮询
  if (!hostCallbacks) {
    const timer = win.setInterval(() => {
      hostCallbacks = getHostCallbacks();
      if (hostCallbacks) {
        renderer.setHostCallbacks(hostCallbacks);
        win.clearInterval(timer);
      }
    }, 16);
  }

  // 销毁清理
  win.addEventListener('beforeunload', () => {
    win[RENDERER_GLOBAL_KEY] = null;
    renderer.dispose();
  });
}

bootstrap();
```

- [ ] **Step 2: 创建 canvas.html**

```html
<!DOCTYPE html>
<html lang="zh-CN" class="engine-design-mode">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>assembox canvas</title>
    <style>
      html, body, #app {
        margin: 0;
        padding: 0;
        width: 100%;
        min-height: 100vh;
        font-family: "PingFang SC", "Microsoft YaHei", Helvetica, Arial, sans-serif;
        background: #fff;
      }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/simulator/iframe/iframe-renderer-entry.ts"></script>
  </body>
</html>
```

- [ ] **Step 3: 恢复 vite.config.ts 多页入口**

将 `build.rollupOptions.input` 改回双入口：

```ts
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        canvas: resolve(__dirname, "canvas.html")
      }
    }
  },
```

- [ ] **Step 4: 验证 build 双入口**

Run: `npx vite build`
Expected: 成功，dist 下出现 `canvas.html` + `canvas-*.js`

---

## Task 4: Host 侧渲染器 `pc-iframe-renderer.ts`

**Files:**
- Create: `src/simulator/iframe/pc-iframe-renderer.ts`

此文件运行在 Host 侧，实现 `IRenderer` 接口，管理 iframe 生命周期 + 同源直引通信 + DOM 查询。

- [ ] **Step 1: 编写 PcIframeRenderer**

```ts
/**
 * PcIframeRenderer —— Host 侧 iframe 渲染器
 * 实现 IRenderer：创建 iframe，同源直引通信，DOM 查询走 contentDocument。
 *
 * 与 PcRenderer（同 DOM 进程内）的区别：
 *  - schema 发送到 iframe 内的独立渲染器（资源/样式隔离）
 *  - DOM 查询通过 iframe.contentDocument（同步，同源）
 *  - click/hover 由 iframe 内渲染器回报
 */
import type {
  IRenderer,
  SlotMarker,
  RendererMountOptions,
} from '../../scenario/types';
import type {
  IframeRendererApi,
  IframeHostCallbacks,
} from './protocol';
import { HOST_GLOBAL_KEY, RENDERER_GLOBAL_KEY } from './protocol';

const CONNECT_TIMEOUT = 10000;
const POLL_INTERVAL = 30;

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
    onError: (msg, detail) => console.error('[PcIframeRenderer]', msg, detail)
  };

  async mount(
    container: HTMLElement,
    schema: any,
    _options?: RendererMountOptions
  ): Promise<void> {
    this.container = container;
    this.schema = schema;

    // 创建 iframe
    const iframe = document.createElement('iframe');
    iframe.src = '/canvas.html';
    iframe.style.cssText =
      'width:100%;height:100%;border:0;display:block;background:#fff;';
    iframe.setAttribute('name', 'assembox-canvas');
    container.appendChild(iframe);
    this.iframe = iframe;

    // 注入 host 回调（iframe load 后才可写 contentWindow）
    this.connect();
  }

  /** 同源直引连接：注入 hostCallbacks → 轮询等 renderer ready */
  private connect(): void {
    if (this.connected) return;

    const win = this.iframe?.contentWindow as any;
    if (!win) {
      // iframe 尚未 load，延迟重试
      this.iframe?.addEventListener('load', () => this.connect(), { once: true });
      return;
    }

    // 注入 host 回调
    win[HOST_GLOBAL_KEY] = this.hostCallbacks;

    // 轮询等 renderer 暴露
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

    // 应用待处理的 schema
    const schema = this.pendingSchema ?? this.schema;
    const designMode = this.pendingDesignMode;
    this.pendingSchema = null;

    if (api.ready) {
      // renderer 已 init（entry 可能已自动 mount），只 setSchema
      api.setSchema(schema);
      api.setDesignMode(designMode);
    } else {
      api.init(schema, designMode);
    }
  }

  setSchema(schema: any): void {
    this.schema = schema;
    if (this.rendererApi) {
      this.rendererApi.setSchema(schema);
    } else {
      this.pendingSchema = schema;
    }
  }

  updateNode?(nodeId: string, patch: any): void {
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
      rect: el.getBoundingClientRect()
    }));
  }

  resolveFromElement(el: HTMLElement | null): { nodeId: string; slotKey: string } | null {
    if (!el) return null;
    const nodeEl = el.closest('[data-editor-id]') as HTMLElement | null;
    if (!nodeEl) return null;
    const slotEl = el.closest('[data-slot-host]') as HTMLElement | null;
    return {
      nodeId: nodeEl.getAttribute('data-editor-id')!,
      slotKey: slotEl?.getAttribute('data-slot-key') || 'defaultSlot'
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
```

- [ ] **Step 2: 确认无类型错误**

Run: `npx vue-tsc --noEmit`
Expected: 无错误

---

## Task 5: 场景集成（types + pc-desktop + editor）

**Files:**
- Modify: `src/scenario/types.ts`
- Modify: `src/scenarios/pc-desktop/index.ts`
- Modify: `src/core/editor.ts`

- [ ] **Step 1: ScenarioProfile 增 createIframeRenderer**

`src/scenario/types.ts` 的 `ScenarioProfile` 接口末尾加：

```ts
export interface ScenarioProfile {
  readonly id: string;
  readonly name: string;
  readonly schemaOps: ISchemaOps;
  readonly createRenderer: () => IRenderer;
  readonly componentCatalog: IComponentCatalog;
  readonly nestingRules: INestingRules;
  readonly emptySchema: () => any;
  /** iframe 隔离渲染器工厂（可选，未提供时 iframe 模式降级为同 DOM） */
  readonly createIframeRenderer?: () => IRenderer;

  init?(ctx: ScenarioContext): void;
  destroy?(): void;
}
```

- [ ] **Step 2: PC 场景提供 createIframeRenderer**

`src/scenarios/pc-desktop/index.ts`：

```ts
import type { ScenarioProfile } from '../../scenario/types';
import { PcSchemaOps } from './schema-ops';
import { PcRenderer } from './renderer';
import { PcComponentCatalog } from './component-catalog';
import { PcNestingRules } from './nesting-rules';
import { PcIframeRenderer } from '../../simulator/iframe/pc-iframe-renderer';

export const pcDesktopProfile: ScenarioProfile = {
  id: 'pc-desktop',
  name: 'PC 桌面端',

  schemaOps: new PcSchemaOps(),
  createRenderer: () => new PcRenderer(),
  createIframeRenderer: () => new PcIframeRenderer(),
  componentCatalog: new PcComponentCatalog(),
  nestingRules: new PcNestingRules(),
  emptySchema: () => new PcSchemaOps().emptySchema(),
};
```

- [ ] **Step 3: EditorOptions 增 canvasMode + editor 选择渲染器**

`src/core/editor.ts`：

`EditorOptions` 接口加字段：
```ts
export interface EditorOptions {
  platform?: 'desktop' | 'mobile';
  scenario: string;
  schema?: any;
  plugins?: Array<EditorPluginObject | [EditorPluginObject, any]>;
  disableBuiltin?: boolean;
  /** 画布模式：inline（同 DOM 进程内） | iframe（资源隔离） */
  canvasMode?: 'inline' | 'iframe';
}
```

构造函数中渲染器选择逻辑改为：
```ts
    // 3. 创建渲染器并绑定回调（DesignerHost 负责 mount）
    this.renderer =
      options.canvasMode === 'iframe' && this.profile.createIframeRenderer
        ? this.profile.createIframeRenderer()
        : this.profile.createRenderer();
    this.renderer.onClick?.((nodeId, _e) => this.handleClick(nodeId));
    this.renderer.onHover?.(id => this.handleHover(id));
    this.renderer.onReady?.(() => this.handleRenderReady());
```

并在 store 上记录 canvasMode（供 DesignerHost 判断）：
```ts
    this.store.state.platform = options.platform ?? 'desktop';
    (this.store.state as any).canvasMode = options.canvasMode ?? 'inline';
```

- [ ] **Step 4: 确认无类型错误**

Run: `npx vue-tsc --noEmit`
Expected: 无错误

---

## Task 6: DesignerHost iframe 支持

**Files:**
- Modify: `src/designer/designer-host.tsx`

DesignerHost 需根据 canvasMode 渲染 `<iframe>` 或普通 `<div>` 容器，并把 iframe 信息传给 CanvasSensor 和 BemTools。

- [ ] **Step 1: 重写 DesignerHost 支持 iframe**

**核心设计：** DesignerHost 只渲染容器 div。PcIframeRenderer.mount 内部创建 iframe 并 append 到容器。mount 完成后 DesignerHost 用 `el.querySelector('iframe')` 拿到 iframe 引用，传给 CanvasSensor（contentDocument）和 BemTools（rect 偏移）。

```tsx
/**
 * DesignerHost 画布宿主组件
 * 聚合：IRenderer + BemTools + DnD 容器
 * inline 模式：renderer 挂载到 div 容器
 * iframe 模式：renderer 创建 iframe 到容器内，BemTools 用 iframe rect 偏移
 */
import {defineComponent, PropType, ref, onMounted, onBeforeUnmount, computed} from 'vue';
import {ElEmpty} from 'element-plus';
import type {Editor} from '../core/editor';
import {BemTools} from './bem-tools';
import {CanvasSensor} from './drag/canvas-sensor';
import {useAssemNamespace} from '../hooks/use-assem-namespace';
import './designer-host.less';

const ns = useAssemNamespace('designer');

export const DesignerHost = defineComponent({
  name: 'DesignerHost',
  props: {
    editor: {type: Object as PropType<Editor>, required: true}
  },
  setup(props) {
    const canvasRef = ref<HTMLElement | null>(null);
    const iframeRef = ref<HTMLIFrameElement | null>(null);

    const isIframe = computed(
      () => (props.editor.store.state as any).canvasMode === 'iframe'
    );

    onMounted(async () => {
      const el = canvasRef.value;
      const renderer = props.editor.renderer;
      if (!el || !renderer) return;

      // 1. 挂载渲染器（iframe 模式下 PcIframeRenderer 会创建 iframe 到 el 内）
      await renderer.mount(el, props.editor.store.schema, {isEditor: true});

      // 2. iframe 模式下获取 renderer 创建的 iframe
      iframeRef.value = isIframe.value
        ? (el.querySelector('iframe') as HTMLIFrameElement | null)
        : null;

      // 3. 注册拖拽感应区
      const sensor = new CanvasSensor(
        {
          id: isIframe.value ? 'pc-iframe' : 'pc-canvas',
          getContentDocument: () =>
            (iframeRef.value?.contentDocument as Document | null) ?? document,
          getBounds: () => el.getBoundingClientRect(),
          toGlobal: (lx, ly) => {
            const b = el.getBoundingClientRect();
            return {x: lx + b.left, y: ly + b.top};
          },
          elementFromPoint: (lx, ly) => {
            const b = el.getBoundingClientRect();
            return document.elementFromPoint(lx + b.left, ly + b.top);
          }
        },
        props.editor
      );
      props.editor.dragon.addSensor(sensor);

      // 4. 点击空白处取消选中
      const contentDoc = iframeRef.value?.contentDocument ?? document;
      contentDoc.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target === contentDoc.body || target === contentDoc.documentElement) {
          props.editor.select(null);
        }
      });
    });

    onBeforeUnmount(() => {
      props.editor.renderer?.dispose();
    });

    return () => {
      const schema = props.editor.store.schemaRef.value;
      const isEmpty = !schema;
      return (
        <div class={ns.b()}>
          <div class={ns.e('canvas')} ref={canvasRef}>
            {isEmpty ? (
              <div class={ns.e('canvas-empty')}>
                <ElEmpty description="从左侧组件库拖入组件开始搭建" />
              </div>
            ) : null}
            <BemTools
              store={props.editor.store}
              editor={props.editor}
              containerRef={canvasRef.value}
              iframeEl={iframeRef.value}
            />
          </div>
        </div>
      );
    };
  }
});
```

> **注意：** iframe 模式下 contentDocument 在 mount 后可能尚未 load 完成（iframe src 异步加载）。CanvasSensor 的 `getContentDocument` 是惰性函数（拖拽时才调用），届时 iframe 已 load，可正确返回 contentDocument。空白点击监听若 contentDoc 尚未就绪会失败但不报错（非关键路径）。

- [ ] **Step 2: 确认无类型错误**

Run: `npx vue-tsc --noEmit`
Expected: 无错误

---

## Task 7: CanvasSensor 适配 iframe contentDocument

**Files:**
- Modify: `src/designer/drag/canvas-sensor.ts`

CanvasSensor 已通过 `opts.getContentDocument()` 获取感应区文档，对 iframe 天然支持。需确认 `freshEl` 等方法用感应区文档查询（当前用 `editor.renderer.getNodeElement`，PcIframeRenderer 的 getNodeElement 走 contentDocument，已兼容）。

- [ ] **Step 1: 验证 CanvasSensor 无需改动**

CanvasSensor 的 `freshEl` 调用 `this.editor.renderer?.getNodeElement(id)`，PcIframeRenderer.getNodeElement 内部用 `iframe.contentDocument.querySelector`，已正确查询 iframe 内 DOM。

`contentDocument` getter 已通过 `opts.getContentDocument()` 提供。

**无需改动**，仅需验证。

- [ ] **Step 2: 验证拖拽在 iframe 内工作**

手动测试：拖组件到 iframe 画布，确认指示线在 iframe 内正确渲染、插入位置正确。

---

## Task 8: BemTools iframe rect 偏移

**Files:**
- Modify: `src/designer/bem-tools.tsx`

BemTools 已有 `iframeEl` prop 和 rect 偏移逻辑（computePos 中 `iRect` 偏移）。需确认 `containerRef` 为画布外层容器时偏移正确。

- [ ] **Step 1: 验证 BemTools 偏移逻辑**

BemTools.computePos 当前逻辑：
- `el.getBoundingClientRect()` 得到 iframe 内元素的视口坐标
- 加上 iframe 自身的 `iRect.left/top` 偏移（iframe 在宿主文档中的位置）
- 减去 container 的坐标

对 iframe 模式，元素在 iframe 内部，`getBoundingClientRect()` 返回的是相对 iframe 视口的坐标，需加上 iframe 元素在宿主文档中的偏移。当前代码已处理。**确认 iframeEl prop 正确传入。**

- [ ] **Step 2: 手动验证**

本地预览 iframe 模式，选中节点确认高亮框位置正确。

---

## Task 9: Demo + 验证

**Files:**
- Modify: `src/demo/main.tsx`

- [ ] **Step 1: demo 启用 iframe 模式**

`src/demo/main.tsx` 的 createEditor 加 `canvasMode: 'iframe'`：

```ts
  const editor = createEditor({
    platform: 'desktop',
    scenario: 'pc-desktop',
    canvasMode: 'iframe'
  });
```

- [ ] **Step 2: 启动 dev server 验证**

Run: `npx vite`
打开 `http://localhost:5174/index.html`

验证清单：
- [ ] iframe 画布出现（DevTools 可见 iframe[src="/canvas.html"]）
- [ ] PC 空 schema 正常渲染
- [ ] 拖组件到画布 → 正确插入
- [ ] 点击节点 → 右侧属性面板出现
- [ ] hover 节点 → 高亮框
- [ ] 选中节点 → 高亮框 + 工具栏
- [ ] 修改属性 → 画布实时更新
- [ ] 撤销/重做正常

- [ ] **Step 3: typecheck + build**

Run: `npx vue-tsc --noEmit && npx vite build`
Expected: 全部通过

---

## 设计说明

### 为什么用同源直引而非 postMessage

| 维度 | 同源直引（本方案） | postMessage |
|---|---|---|
| 调用方式 | `win.__ASSEM_RENDERER__.setSchema()` 同步 | `postMessage` + 监听，异步 |
| DOM 查询 | `iframe.contentDocument.querySelector` 同步 | 需请求-响应配对，复杂 |
| 适用场景 | dev/prod 同源（本项目） | 跨源 / CDN 部署 |
| 复杂度 | 低 | 高（序列化、id 配对、超时） |

本项目 dev（localhost）与 prod（同站）均同源，同源直引最简单可靠。postMessage 协议接口（protocol.ts）保留抽象，跨源时可在其上桥接。

### iframe 内加载 AssemViews 的意义

PcRenderer（inline）和 IframeCanvasRenderer（iframe）都包装 assembox-desktop-next 的 AssemViews，保证**设计态渲染引擎 === 生产态渲染引擎**。iframe 仅提供资源/样式隔离，不改变渲染逻辑。这是用户强调"上线会存在差异"问题的根本解决——两边跑同一套 assembox-desktop-next。

### schema 同步策略

Host 每次 `store.commit` 后调 `renderer.setSchema(clone)`。IframeCanvasRenderer.setSchema 做响应式 in-place 替换（删旧 key、写新 key），触发 AssemViews 重渲染。深拷贝保证两侧引用独立。
