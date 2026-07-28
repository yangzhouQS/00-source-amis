/**
 * IframeBridge —— host 侧 iframe 通信桥
 * 实现 SimulatorBridge，管理 iframe 生命周期 + 直引调用 + 事件路由
 *
 * 通信方式：同源直引（win.__ASSEM_RENDERER__），延迟兜底 postMessage
 * 坐标：iframe 内部逻辑坐标，host 缩放由 iframe 元素 transform: scale() 处理
 */
import type {PageSchema, PageNode, NodeId} from '../../schema/types';
import type {SimulatorBridge} from '../bridge';
import type {NodeTree, NodeInstance} from '../node-tree';
import type {
  SimulatorRendererApi,
  SimulatorHostApi,
  ComponentMapping,
  InitPayload
} from './protocol';
import {HOST_CMD, envelope} from './protocol';
import type {EditorStore} from '../../core/store';
import * as ops from '../../schema/operations';

export interface IframeBridgeOptions {
  /** iframe src（canvas.html 路径） */
  src?: string;
  /** host 回调 */
  onClick: (nodeId: NodeId | null, e: MouseEvent) => void;
  onHover: (nodeId: NodeId | null) => void;
  onReady?: () => void;
  onInstancesUpdated?: (instances: NodeInstance[]) => void;
  onScroll?: (scrollX: number, scrollY: number) => void;
}

export class IframeBridge implements SimulatorBridge, SimulatorHostApi {
  readonly isSimulatorHost = true as const;

  private iframe: HTMLIFrameElement | null = null;
  private renderer: SimulatorRendererApi | null = null;
  private ready = false;
  private readyPromise: Promise<void> | null = null;
  private readyResolve: (() => void) | null = null;
  private pendingInit: InitPayload | null = null;
  private eventCleanups: Array<() => void> = [];

  constructor(
    private readonly store: EditorStore,
    private readonly tree: NodeTree,
    private readonly options: IframeBridgeOptions
  ) {}

  // ══════════ 生命周期 ══════════

  /** 绑定 iframe 元素（由 DesignerHost 在 onMounted 调用） */
  attach(iframe: HTMLIFrameElement): Promise<void> {
    this.iframe = iframe;
    this.ready = false;
    this.readyPromise = new Promise(resolve => {
      this.readyResolve = resolve;
    });

    const src = this.options.src ?? '/canvas.html';
    // 注入 hostApi 到 iframe window（srcdoc 模式需 load 后注入；src 模式 load 后注入）
    const injectAndAwait = () => {
      const win = iframe.contentWindow as any;
      if (!win) return;
      // 注入 hostApi
      win.__ASSEM_HOST__ = this;
      // 监听 load，拿 renderer
      const onLoaded = () => {
        this.tryConnect(win);
      };
      if (win.document.readyState === 'complete') {
        onLoaded();
      } else {
        win.addEventListener('load', onLoaded);
      }
    };

    if (!iframe.src && !iframe.getAttribute('srcdoc')) {
      iframe.src = src;
    }
    // iframe 已有 src 时直接注入
    injectAndAwait();

    return this.readyPromise;
  }

  /** 尝试连接 renderer（轮询兜底） */
  private tryConnect(win: any): void {
    if (this.ready) return;
    const renderer = win.__ASSEM_RENDERER__;
    if (renderer) {
      this.connect(win, renderer);
    } else {
      // 轮询（renderer bundle 异步加载）
      let attempts = 0;
      const timer = setInterval(() => {
        attempts++;
        const r = win.__ASSEM_RENDERER__;
        if (r) {
          clearInterval(timer);
          this.connect(win, r);
        } else if (attempts > 200) {
          clearInterval(timer);
          console.error('[IframeBridge] 渲染器连接超时');
        }
      }, 30);
    }
  }

  /** 连接成功 */
  private connect(win: any, renderer: SimulatorRendererApi): void {
    if (this.ready) return;
    this.renderer = renderer;
    this.ready = true;

    // 应用待初始化载荷
    if (this.pendingInit) {
      renderer.init(this.pendingInit);
      this.pendingInit = null;
    }

    this.setupEventRouting(win);
    this.options.onReady?.();
    this.readyResolve?.();
  }

  /** 设置初始 schema + 组件映射（attach 前或后都可调） */
  init(
    schema: PageSchema,
    components: ComponentMapping[],
    designMode: 'design' | 'preview' = 'design'
  ): void {
    const payload: InitPayload = {
      schema: ops.cloneSchema(schema),
      components,
      designMode,
      platform: this.store.state.platform
    };
    if (this.renderer && this.ready) {
      this.renderer.init(payload);
    } else {
      this.pendingInit = payload;
    }
  }

  /** 事件路由：iframe document 的 mousedown/mouseover/click/scroll */
  private setupEventRouting(win: any): void {
    const doc: Document = win.document;

    // 滚动同步（覆盖层定位用）
    const onScroll = () => {
      this.options.onScroll?.(win.scrollX, win.scrollY);
    };
    win.addEventListener('scroll', onScroll, {passive: true});

    // 点击空白取消选中（落在 #app 容器而非节点上）
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && !target.closest(`[${'data-editor-id'}]`)) {
        this.options.onClick(null, e);
      }
    };
    doc.addEventListener('click', onDocClick, true);

    this.eventCleanups.push(() => {
      win.removeEventListener('scroll', onScroll);
      doc.removeEventListener('click', onDocClick, true);
    });
    // 节点点击/悬浮由 iframe 内 IframeNodeWrapper 通过 hostApi.onNodeClick/onNodeHover 回报
  }

  // ══════════ SimulatorHostApi（renderer 回调） ══════════

  onRendererReady(): void {
    this.options.onReady?.();
  }

  onNodeClick(nodeId: NodeId | null, originalEvent?: any): void {
    this.options.onClick(nodeId, originalEvent);
  }

  onNodeHover(nodeId: NodeId | null): void {
    this.options.onHover(nodeId);
  }

  onInstancesUpdated(instances: NodeInstance[]): void {
    // 同步到 host 节点镜像树
    this.tree.clear();
    instances.forEach(inst => this.tree.register(inst));
    this.options.onInstancesUpdated?.(instances);
  }

  onScroll(scrollX: number, scrollY: number): void {
    this.options.onScroll?.(scrollX, scrollY);
  }

  onResize(): void {
    /* 覆盖层会通过 ResizeObserver 重算 */
  }

  onError(error: string): void {
    console.error('[IframeBridge] renderer error:', error);
  }

  // ══════════ SimulatorBridge（host 高层调用） ══════════

  renderSchema(schema: PageSchema): void {
    this.callRenderer(r => r.renderSchema(ops.cloneSchema(schema)));
  }

  updateNode(nodeId: NodeId, patch: Partial<PageNode>): void {
    this.callRenderer(r => r.updateNode(nodeId, patch));
  }

  insertNode(
    parentId: NodeId,
    region: string,
    node: PageNode,
    index?: number
  ): void {
    this.callRenderer(r =>
      r.insertNode(parentId, region, ops.cloneSchema(node), index)
    );
  }

  moveNode(
    nodeId: NodeId,
    toParentId: NodeId,
    region: string,
    index?: number
  ): void {
    this.callRenderer(r => r.moveNode(nodeId, toParentId, region, index));
  }

  removeNode(nodeId: NodeId): void {
    this.callRenderer(r => r.removeNode(nodeId));
  }

  setDraggingState(active: boolean): void {
    this.callRenderer(r => r.setDraggingState(active));
  }

  rerender(): void {
    this.callRenderer(r => r.rerender());
  }

  onRenderReady(cb: () => void): void {
    if (this.ready) cb();
    else this.readyPromise?.then(cb);
  }

  // onNodeClick / onNodeHover 由 SimulatorHostApi 实现统一处理（避免与 SimulatorBridge 重复）

  getNodeTree(): NodeTree {
    return this.tree;
  }

  getRect(nodeId: NodeId): DOMRect | null {
    return this.renderer?.getRect(nodeId) ?? null;
  }

  /** 直引调用 renderer，未就绪则兜底 postMessage */
  private callRenderer(fn: (r: SimulatorRendererApi) => void): void {
    if (this.renderer) {
      fn(this.renderer);
      return;
    }
    // postMessage 兜底
    const win = this.iframe?.contentWindow;
    if (win) {
      // 简化：实际跨源时需序列化命令，此处仅示意
    }
  }

  /** 销毁 */
  dispose(): void {
    this.eventCleanups.forEach(fn => fn());
    this.eventCleanups = [];
    this.renderer?.dispose();
    this.renderer = null;
    this.ready = false;
    this.iframe = null;
  }

  get isReady(): boolean {
    return this.ready;
  }

  /** 发送 host 命令（postMessage 模式，跨源用） */
  postHostCommand(msg: HostMessageLike): void {
    const win = this.iframe?.contentWindow;
    if (win) {
      win.postMessage(envelope('host', msg as any), '*');
    }
  }
}

type HostMessageLike = {type: string; payload?: any};
void HOST_CMD;
