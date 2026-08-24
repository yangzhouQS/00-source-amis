import type { AssemConfig } from "@cs/assembox-core-next";
import type { App } from "vue";
import type { RouterConfig } from "../../core/router/build-router";
import type {
  IRenderer,
  RendererMountOptions,
  SlotMarker,
} from "../../scenario";
import {
  AssemPlugin,
  AssemViews,
  registerDefaults,
} from "@cs/assembox-desktop-next";
import ElementPlus from "element-plus";
import { computed, createApp, h, reactive } from "vue";
import { buildSceneRouter } from "../../core/router/build-router";
import { DOCUMENT_ARRAYS, forEachChild } from "./slot-accessors";

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
  /** 响应式场景状态（驱动 render 渲染当前激活场景） */
  private sceneState = reactive({ name: "" });
  /** vue-router 实例（供 NavigationBar 等组件 useRouter） */
  private router: any = null;
  /** 运行时配置缓存（routerConfig/dataSource/globalVars） */
  private runtimeConfig: { routerConfig: RouterConfig; dataSource: any; globalVars: Record<string, any> } = {
    routerConfig: {},
    dataSource: {},
    globalVars: {},
  };

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

    // 推断初始场景名（取 uiSkeleton 第一个 key）
    const sceneKeys = schema && typeof schema === "object" ? Object.keys(schema) : [];
    this.sceneState.name = sceneKeys[0] ?? "";

    // 缓存运行时配置（供 setScene 后重新 install router 时使用）
    const routerConfig = (options?.routerConfig ?? {}) as RouterConfig;
    const dataSource = options?.dataSource ?? {
      api: { config: {} },
      requestConfig: {},
      dataModelConfig: {},
      sharedFns: {},
    };
    const globalVars = options?.globalVars ?? {};
    this.runtimeConfig = { routerConfig, dataSource, globalVars };

    (window as any).assemBoxIsEdit = true;
    (window as any).assemBoxDesignMode = "design";
    document.body.setAttribute("data-design-mode", "design");

    (window as any).assemVueRenderer = {
      onMountedInstance: (_instance: unknown) => {
        if (!this.readyFired) {
          this.readyFired = true;
          this.readyCbs.forEach(cb => cb());
        }
      },
      onUpdatedInstance: (_instance: unknown) => {},
      onUnmountedInstance: (_instance: unknown) => {},
    };

    this.bindCanvasEvents(container);

    const config: AssemConfig = {
      uiSkeleton: schema,
      dataSource: dataSource as any,
      routerConfig: routerConfig as any,
      security: {},
    };

    // 构建 vue-router（memory history，供 NavigationBar 等组件 useRouter 使用）
    const router = buildSceneRouter(routerConfig, sceneKeys, this.sceneState.name);
    this.router = router;

    this.app = createApp({
      setup: () => {
        // 响应式：sceneState.name 变化时自动重渲染当前场景
        const viewsProps = computed(() => {
          const scene = this.schema?.[this.sceneState.name];
          return scene?.viewsProps ?? null;
        });
        return () => {
          const vp = viewsProps.value;
          if (!vp) {
            return h("div", "空场景");
          }
          return h(AssemViews, { viewsProps: vp });
        };
      },
    });

    // 安装宿主框架 pinia（对齐真实宿主 new WebFramework() 内部的 app.use(createPinia())）。
    // portalPinia.defineStore 依赖 activePinia，不安装则渲染含 tableCode 的表格时抛
    // "Cannot read properties of undefined (reading '_s')"（宿主全局由 index.html CDN 脚本提供）
    const portalPinia = (window as any).JsWebFramework?.portalPinia;
    if (portalPinia?.createPinia) {
      this.app.use(portalPinia.createPinia());
    }

    this.app.use(router);
    this.app.use(AssemPlugin, config);
    this.app.use(ElementPlus);
    registerDefaults();
    this.app.mount(container);

    this.core = this.app.config.globalProperties.$assemCore;
    // 注入 $globalVars.$router + 业务全局变量（对齐旧版 bindAssemContext）
    this.injectGlobalVars();
  }

  /** 切换当前渲染的场景 */
  setScene(sceneName: string): void {
    this.sceneState.name = sceneName;
    this.router?.push?.({ name: sceneName });
  }

  /** 注入 $globalVars.$router + 业务全局变量（对齐旧版 bindAssemContext） */
  private injectGlobalVars(): void {
    const assemCore = this.core;
    if (!assemCore) {
      return;
    }
    assemCore.$globalVars = assemCore.$globalVars ?? {};
    if (this.router) {
      assemCore.$globalVars.$router = this.router;
    }
    Object.assign(assemCore.$globalVars, this.runtimeConfig.globalVars);
  }

  setSchema(schema: any): void {
    const oldKeys = Object.keys(this.schema || {});
    const newKeys = Object.keys(schema || {});
    for (const key of oldKeys) {
      delete this.schema[key];
    }
    for (const key of newKeys) {
      this.schema[key] = schema[key];
    }
    // 增删场景后动态同步路由
    this.syncRouterRoutes();
  }

  /** 动态同步路由（场景增删后补缺失 / 移多余） */
  private syncRouterRoutes(): void {
    if (!this.router) {
      return;
    }
    const sceneKeys = Object.keys(this.schema || {});
    const existing = new Set(
      this.router.getRoutes().map((r: any) => r.name).filter(Boolean),
    );
    // 补缺失路由
    for (const name of sceneKeys) {
      if (!existing.has(name)) {
        const cfg = this.runtimeConfig.routerConfig[name];
        this.router.addRoute({
          path: cfg?.path ?? `/${name}`,
          name,
          component: { render: () => h("div") },
          meta: cfg?.meta ?? {},
        } as any);
      }
    }
    // 移多余路由（schema 中已不存在的场景）
    for (const routeName of existing) {
      if (typeof routeName === "string" && !sceneKeys.includes(routeName)) {
        this.router.removeRoute(routeName);
      }
    }
  }

  updateNode(nodeId: string, patch: any): void {
    const node = this.findNodeById(nodeId);
    if (!node) {
      return;
    }
    if (patch.__nodeOptions) {
      Object.assign(node.__nodeOptions, patch.__nodeOptions);
    }
    if (patch.__nodeEvent) {
      Object.assign(node.__nodeEvent, patch.__nodeEvent);
    }
    if (patch.__nodeStyle) {
      node.__nodeStyle = { ...(node.__nodeStyle || {}), ...patch.__nodeStyle };
    }
  }

  onStructureChange(): void {
    // 结构变更靠 reactive 数组操作自动 diff
  }

  setDraggingState(active: boolean): void {
    if (this.container) {
      this.container.style.cursor = active ? "copy" : "";
    }
  }

  setDesignMode(mode: "design" | "preview"): void {
    (window as any).assemBoxDesignMode = mode;
    document.body.setAttribute("data-design-mode", mode);
  }

  getNodeElement(nodeId: string): HTMLElement | null {
    if (!this.container) {
      return null;
    }
    return this.container.querySelector(`[data-editor-id="${nodeId}"]`) as HTMLElement | null;
  }

  getRect(nodeId: string): DOMRect | null {
    const el = this.getNodeElement(nodeId);
    return el ? el.getBoundingClientRect() : null;
  }

  nodeIdFromElement(el: HTMLElement | null): string | null {
    if (!el) {
      return null;
    }
    const found = el.closest("[data-editor-id]") as HTMLElement | null;
    return found ? found.getAttribute("data-editor-id") : null;
  }

  getSlotMarkers(nodeId: string): SlotMarker[] | null {
    if (!this.container) {
      return null;
    }
    const els = this.container.querySelectorAll(`[data-slot-host="${nodeId}"]`);
    if (!els.length) {
      return null;
    }
    return Array.from(els).map(el => ({
      slotKey: el.getAttribute("data-slot-key") || "defaultSlot",
      el: el as HTMLElement,
      rect: el.getBoundingClientRect(),
    }));
  }

  resolveFromElement(el: HTMLElement | null): { nodeId: string; slotKey: string } | null {
    if (!el) {
      return null;
    }
    const nodeEl = el.closest("[data-editor-id]") as HTMLElement | null;
    if (!nodeEl) {
      return null;
    }
    const slotEl = el.closest("[data-slot-host]") as HTMLElement | null;
    return {
      nodeId: nodeEl.getAttribute("data-editor-id")!,
      slotKey: slotEl?.getAttribute("data-slot-key") || "defaultSlot",
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

  private bindCanvasEvents(container: HTMLElement): void {
    // 方案 B：mousedown 替代 click 做选区主通道（disabled 元素 click 不触发，mousedown 触发）
    container.addEventListener("mousedown", (e: MouseEvent) => {
      if ((window as any).assemBoxDesignMode !== "design") {
        return;
      }
      if (e.button !== 0) {
        return;
      } // 仅左键
      const nodeId = this.nodeIdFromElement(e.target as HTMLElement);
      this.clickCb?.(nodeId, e);
    }, true);

    // click 作为补充（非 disabled 元素走 click，更精确）
    container.addEventListener("click", (e: MouseEvent) => {
      if ((window as any).assemBoxDesignMode !== "design") {
        return;
      }
      // 仅当 mousedown 未已触发选中时才用 click（避免重复）
      // mousedown 已处理 → click 到达说明元素未 disabled → 不重复
      // 实际：mousedown 总是先触发，click 后触发；只让 mousedown 处理选中
      e.stopPropagation();
    }, true);

    container.addEventListener("mouseover", (e: MouseEvent) => {
      if ((window as any).assemBoxDesignMode !== "design") {
        return;
      }
      const nodeId = this.nodeIdFromElement(e.target as HTMLElement);
      this.hoverCb?.(nodeId);
      e.stopPropagation();
    }, true);

    container.addEventListener("mouseleave", () => {
      this.hoverCb?.(null);
    }, true);
  }

  private findNodeById(nodeId: string): any | undefined {
    const walk = (node: any): any => {
      if (!node || typeof node !== "object") {
        return undefined;
      }
      if (node.__nodeId === nodeId) {
        return node;
      }
      let found: any;
      forEachChild(node, (child) => {
        if (!found) {
          found = walk(child);
        }
      });
      return found;
    };
    const scenes = Object.values(this.schema || {});
    for (const scene of scenes) {
      const vp = (scene as any)?.viewsProps;
      if (!vp) {
        continue;
      }
      if (vp.planeOptions) {
        const f = walk(vp.planeOptions);
        if (f) {
          return f;
        }
      }
      for (const docArr of DOCUMENT_ARRAYS) {
        if (Array.isArray(vp[docArr])) {
          for (const doc of vp[docArr]) {
            const f = walk(doc);
            if (f) {
              return f;
            }
          }
        }
      }
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
