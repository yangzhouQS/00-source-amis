/**
 * iframe 内侧渲染器（运行于 canvas.html 内部）
 * 包装 assembox-desktop-next 的 AssemViews，渲染 PC schema 并标记 DOM。
 * 与 PcRenderer 同构，但 schema 来自 host 下发，事件通过 hostApi 回报。
 */
import { createApp, reactive, nextTick, h, type App, type Component } from 'vue';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import {
  AssemPlugin,
  registerDefaults,
  registerExternal,
  AssemViews,
} from '@cs/assembox-desktop-next';
import { adaptNodeTree, type AssemConfig } from '@cs/assembox-core-next';
import type {
  IframeRendererApi,
  IframeHostCallbacks,
  IframeAssetsManifest,
} from './protocol';

/** 按点分路径从 window 取全局值（如 'ElementPlusUi.ToggleChip'） */
function resolveGlobalPath(root: any, path: string): unknown {
  return path.split('.').reduce<any>((acc, key) => (acc == null ? acc : acc[key]), root);
}

export class IframeCanvasRenderer implements IframeRendererApi {
  private app: App | null = null;
  private hostCallbacks: IframeHostCallbacks | null = null;
  /** 响应式 schema（驱动 AssemViews 渲染，host 下发克隆副本，in-place 同步触发重渲染） */
  private schema = reactive<Record<string, any>>({});
  private designMode: 'design' | 'preview' = 'design';
  /** 动态依赖清单（host 下发：插件 / 外部组件） */
  private assets: IframeAssetsManifest;
  ready = false;

  constructor(hostCallbacks?: IframeHostCallbacks, assets: IframeAssetsManifest = {}) {
    this.hostCallbacks = hostCallbacks ?? null;
    this.assets = assets;
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
    document.body.style.cursor = active ? 'copy' : '';
  }

  rerender(): void {
    this.syncSchema(this.schema);
  }

  /** 同步 schema 到响应式对象（in-place 替换 key；adaptNodeTree 编译事件 handler） */
  private syncSchema(schema: any): void {
    const adapted = adaptNodeTree(schema ?? {}) as Record<string, any>;
    const src = adapted ?? {};
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

    // assembox-desktop-next use-editor 契约：节点挂载/更新/卸载回调
    // onMountedInstance/onUpdatedInstance 由 useEditor 在组件 mount/update 时回调，
    // 这里据此为节点根元素打 data-editor-id（供 host 在 contentDocument 查询定位）
    (window as any).AssemVueRenderer = {
      onMountedInstance: (instance: unknown) => this.markInstance(instance),
      onUpdatedInstance: (instance: unknown) => this.markInstance(instance),
      onUnmountedInstance: (_instance: unknown) => {},
    };

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
    // 遍历 assets.js 清单，按标记注册（对应旧版 registerPlugin 的全部能力）。
    // 这些 CDN 全局包均基于 window.Vue（= 本 ESM Vue 实例），与 assembox-desktop-next 共用同一 Vue
    const w = window as any;
    for (const a of this.assets.js ?? []) {
      if (!a.global) continue;
      const target = w[a.global];
      if (target == null) continue;

      // 框架引导初始化（如 new window.Vue3WebFramework.WebFramework({})）
      if (a.bootstrap) {
        const ctor = a.bootstrap.ctorPath ? resolveGlobalPath(target, a.bootstrap.ctorPath) : target;
        if (typeof ctor === 'function') {
          try {
            new ctor(...(a.bootstrap.args ?? []));
          } catch (e) {
            this.hostCallbacks?.onError(`bootstrap 失败: ${a.global}`, e);
          }
        }
      }

      // 作为 Vue 插件 app.use(target, pluginOptions)
      if (a.asPlugin) {
        let options = a.pluginOptions;
        // ElementPlus 默认注入中文 locale（除非 pluginOptions 已指定）
        if (a.global === 'ElementPlus' && !(options && options.locale)) {
          options = { ...(options || {}), locale: zhCn };
        }
        try {
          this.app.use(target, options);
        } catch (e) {
          this.hostCallbacks?.onError(`app.use(${a.global}) 失败`, e);
        }
      }

      // 图标库：遍历注册为全局组件（对应旧版 Object.entries(ElementPlusIconsVue)）
      if (a.asIcons && typeof target === 'object') {
        for (const [key, comp] of Object.entries(target)) {
          if (comp) this.app.component(key, comp as Component);
        }
      }

      // 全局组件别名注册（对应旧版 box/Box = ElementPro.Box）
      for (const c of a.components ?? []) {
        const comp = c.path ? resolveGlobalPath(target, c.path) : target;
        if (comp) this.app.component(c.name, comp as Component);
      }
    }
    // 额外登记的插件全局名（已由 js 加载，这里只 app.use）
    for (const name of this.assets.plugins ?? []) {
      if (w[name]) this.app.use(w[name]);
    }

    this.app.use(AssemPlugin, config);
    registerDefaults();

    // 注册外部组件（registerExternal，补全内置 manifest 未含的组件，如 ToggleChip）
    for (const ext of this.assets.externals ?? []) {
      const comp = resolveGlobalPath(w, ext.globalPath) as Component | undefined;
      if (!comp) {
        this.hostCallbacks?.onError(`外部组件全局路径解析为空: ${ext.globalPath}`);
        continue;
      }
      try {
        registerExternal({
          name: ext.renderType,
          component: comp,
          category: ext.category as any,
        });
      } catch (e) {
        this.hostCallbacks?.onError(`registerExternal 失败: ${ext.renderType}`, e);
      }
    }

    this.app.mount(el);

    this.bindCanvasEvents(el);

    // 在 nextTick 后置 ready，确保 assembox-desktop-next 的 data-editor-id 标记已落 DOM
    nextTick(() => {
      if (!this.ready) {
        this.ready = true;
        this.hostCallbacks?.onReady();
      }
    });
  }

  /** 为组件实例标记 data-editor-id（节点根元素，供 host 在 contentDocument 查询） */
  private markInstance(instance: unknown): void {
    const inst = instance as any;
    const nodeId = inst?.props?.__nodeId;
    if (!nodeId) return;
    if ((window as any).assemBoxDesignMode === 'preview') return;
    const el = inst?.proxy?.$el ?? inst?.$el;
    if (el && el.nodeType === 1) {
      el.setAttribute('data-editor-id', nodeId);
    }
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
    (window as any).AssemVueRenderer = undefined;
    (window as any).assemBoxIsEdit = false;
  }
}
