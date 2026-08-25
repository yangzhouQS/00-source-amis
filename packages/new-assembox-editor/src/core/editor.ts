import type { DragObject, DropLocation } from "../designer/drag/types";
import type {
  IComponentCatalog,
  INestingRules,
  IRenderer,
  ISchemaOps,
  ScenarioProfile,
} from "../scenario/types";
import type { InjectionToken } from "./di-container";
import type { Logger } from "./logger";
import type { EditorPluginObject, PluginContext } from "./plugin-types";
import { ComponentActionManager } from "../designer/component-action-manager";
import { ContextMenuManager } from "../designer/context-menu-manager";
import { Dragon } from "../designer/drag/dragon";
import { LiveEditing } from "../designer/live-editing";
import { builtinPlugins } from "../plugins/builtin-plugins";
import { ActionRegistry } from "../registry/action-registry";
import { AssetRegistry } from "../registry/asset-registry";
import { SetterRegistry } from "../registry/setter-registry";
import * as TOKENS from "../registry/tokens";
import { scenarioRegistry } from "../scenario/registry";
import { mergeAssets, normalizeRenderDependencies } from "../simulator/iframe/protocol";
import { Skeleton } from "../skeleton/skeleton";
/**
 * Editor 门面
 * 聚合所有核心子系统，对外提供高层 API
 * 取代旧版 getEditor() 全局单例 + window.lc-assemGlobalBus：改为 createEditor() 工厂，支持多实例
 *
 * 场景驱动：通过 ScenarioProfile 提供 schemaOps / renderer / catalog / nestingRules，
 * 不再依赖 amis 风格的 PageSchema/operations/bridge。
 */
import { DIContainer } from "./di-container";
import { EVENT, EventBus } from "./event-bus";
import { KeyboardManager } from "./keyboard-manager";
import { getLogger } from "./logger";
import { PluginManager } from "./plugin-manager";
import { EditorRouter } from "./router/editor-router";
import { Selection } from "./selection";
import { EditorStore } from "./store";

export interface EditorOptions {
  platform?: "desktop" | "mobile";
  /** 场景 id（决定 schemaOps/renderer/catalog/nestingRules） */
  scenario: string;
  /** 初始 schema（PC 格式，省略则用场景空模板） */
  schema?: any;
  /** 路由配置（sceneName → 路由信息，1:1 对应 schema 场景） */
  routerConfig?: import("./router/build-router").RouterConfig;
  /** 数据源配置（api/requestConfig/dataModelConfig/sharedFns） */
  dataSource?: any;
  /** 全局变量注入（扩展 $globalVars，如 $http/$portal，对齐旧版 bindAssemContext） */
  globalVars?: Record<string, any>;
  /** 用户插件（可带 options：[plugin, options]） */
  plugins?: Array<EditorPluginObject | [EditorPluginObject, any]>;
  /** 是否禁用内置插件（默认 false） */
  disableBuiltin?: boolean;
  /** 画布模式：inline（同 DOM 进程内） | iframe（资源隔离） */
  canvasMode?: "inline" | "iframe";
  /**
   * 画布渲染依赖（外置可配，iframe 模式生效；对齐旧版 ASSEM_RENDER_DEPENDENCIES_KEY 契约）。
   * - 支持旧版扁平格式 [{ fileType, packageName, fileUrl, global? }]（宿主服务端解析后下发）
   * - 或直接传 iframe 资产清单 { js: JsAsset[], css: string[] }（可带 asPlugin/components 标记）
   * 宿主项先于内置默认加载，按 src/global 去重（宿主可覆盖内置版本）。
   * 事后更新用 editor.setRenderDependencies()（须在 DesignerHost mount 前）。
   */
  renderDependencies?: import("../simulator/iframe/protocol").IframeAssetsManifest
    | import("../simulator/iframe/protocol").RenderDependencyItem[];
  /** 草稿自动保存（sessionStorage，刷新恢复，关标签页自动清除） */
  autoSave?: {
    /** sessionStorage 键名，默认 'assem-editor:draft' */
    key?: string;
    /** 防抖延迟（ms），默认 800 */
    debounce?: number;
  };
}

export class Editor {
  readonly di = new DIContainer();
  readonly bus = new EventBus();
  readonly store: EditorStore;
  readonly selection: Selection;
  readonly setterRegistry = new SetterRegistry();
  readonly assetRegistry = new AssetRegistry();
  readonly actionRegistry = new ActionRegistry();
  readonly pluginManager: PluginManager;
  readonly skeleton = new Skeleton();
  /** 场景档案 */
  readonly profile: ScenarioProfile;
  /** 设计态渲染器（由场景创建，DesignerHost 负责挂载） */
  renderer: IRenderer | null = null;
  /** 自模拟拖拽引擎（替代 HTML5 drag，跨 iframe 可靠） */
  readonly dragon: Dragon;
  /** 日志器（集中管理，按 bizName 隔离） */
  readonly logger: Logger;
  /** 快捷键管理器 */
  readonly keyboard: KeyboardManager;
  /** 原地文本编辑 */
  readonly liveEditing: LiveEditing;
  /** 右键菜单管理器（声明式注册 + 插件可扩展） */
  readonly contextMenu: ContextMenuManager;
  /** 组件工具栏动作管理器（选中节点工具栏按钮） */
  readonly componentActions: ComponentActionManager;
  /** 路由管理（vue-router 封装，管理场景切换路由状态） */
  readonly router: EditorRouter;
  /** 页面数据源配置（uiSkeleton 之外的运行时配置；由数据源面板 flush 整体替换引用） */
  dataSource: any;
  /** 全局变量注入（透传给渲染器 $globalVars） */
  readonly globalVars: Record<string, any>;
  /** 剪贴板（复制/粘贴用） */
  clipboard: any | null = null;

  /** 草稿配置 */
  private draftKey: string | null = null;
  private draftDebounce = 800;
  private draftTimer: ReturnType<typeof setTimeout> | null = null;

  private destroyed = false;

  /** 便捷别名：schema 操作 */
  get schemaOps(): ISchemaOps {
    return this.profile.schemaOps;
  }

  /** 便捷别名：嵌套校验 */
  get nestingRules(): INestingRules {
    return this.profile.nestingRules;
  }

  /** 便捷别名：组件目录 */
  get catalog(): IComponentCatalog {
    return this.profile.componentCatalog;
  }

  constructor(options: EditorOptions) {
    // 1. 激活场景档案
    this.profile = scenarioRegistry.activate(options.scenario);

    // 2. 草稿恢复（sessionStorage，在 store 初始化之前）
    let initialSchema = options.schema ?? this.profile.emptySchema();
    if (options.autoSave) {
      const draftKey = options.autoSave.key ?? "assem-editor:draft";
      const draft = this.readDraft(draftKey);
      if (draft) {
        initialSchema = draft;
      }
      this.draftKey = draftKey;
      this.draftDebounce = options.autoSave.debounce ?? 800;
    }

    // 3. 初始化 store（场景驱动 schemaOps）
    this.store = new EditorStore(
      initialSchema,
      this.profile.schemaOps,
    );
    this.store.state.platform = options.platform ?? "desktop";
    (this.store.state as any).canvasMode = options.canvasMode ?? "inline";
    // store 持有 editor 反向引用（bem-tools 用）
    (this.store as any).__editor = this;

    // 3.5 初始化路由 + 数据源 + 全局变量
    const scenes = this.store.schema && typeof this.store.schema === "object"
      ? Object.keys(this.store.schema)
      : [];
    this.router = new EditorRouter(options.routerConfig, scenes);
    this.dataSource = options.dataSource ?? {
      api: { config: {} },
      requestConfig: {},
      dataModelConfig: {},
      sharedFns: {},
    };
    this.globalVars = options.globalVars ?? {};

    this.selection = new Selection(this.store);
    this.pluginManager = new PluginManager(this.bus);
    // 注册插件：内置（除非 disableBuiltin）+ 用户插件（可带 options）
    if (!options.disableBuiltin) {
      for (const p of builtinPlugins) {
        this.pluginManager.register(p);
      }
    }
    for (const item of options.plugins ?? []) {
      if (Array.isArray(item)) {
        this.pluginManager.register(item[0], item[1]);
      } else {
        this.pluginManager.register(item);
      }
    }

    // 3. 创建渲染器并绑定回调（DesignerHost 负责 mount）
    // iframe 模式优先用场景的 iframe 渲染器（资源/样式隔离），否则降级 inline
    // 依赖合并策略（宿主下发优先 + 场景内置兜底）统一在此：mergeAssets(host, profile.defaultRenderAssets)
    const mergedAssets = mergeAssets(
      normalizeRenderDependencies(options.renderDependencies),
      this.profile.defaultRenderAssets,
    );
    this.renderer
      = options.canvasMode === "iframe" && this.profile.createIframeRenderer
        ? this.profile.createIframeRenderer(mergedAssets)
        : this.profile.createRenderer();
    this.renderer.onClick?.((nodeId, _e) => this.handleClick(nodeId));
    this.renderer.onHover?.(id => this.handleHover(id));
    this.renderer.onReady?.(() => this.handleRenderReady());

    // 4. 拖拽引擎（自模拟，跨 iframe 可靠）
    this.dragon = new Dragon();
    this.logger = getLogger("editor");
    this.wireDragon();

    // 快捷键
    this.keyboard = new KeyboardManager(this);

    // 原地编辑
    this.liveEditing = new LiveEditing(this);

    // 右键菜单
    this.contextMenu = new ContextMenuManager();
    this.registerBuiltinContextMenu();

    // 组件工具栏动作
    this.componentActions = new ComponentActionManager();
    this.registerBuiltinComponentActions();

    // 注入到 DI 容器（token 化，类型安全）
    this.di.register(TOKENS.EDITOR, this);
    this.di.register(TOKENS.STORE, this.store);
    this.di.register(TOKENS.BUS, this.bus);
    this.di.register(TOKENS.DI, this.di);
    this.di.register(TOKENS.PLUGIN_MANAGER, this.pluginManager);
    this.di.register(TOKENS.SETTER_REGISTRY, this.setterRegistry);
    this.di.register(TOKENS.ASSET_REGISTRY, this.assetRegistry);
    this.di.register(TOKENS.ACTION_REGISTRY, this.actionRegistry);
    this.di.register(TOKENS.SKELETON, this.skeleton);
    this.di.register(TOKENS.SELECTION, this.selection);

    this.logger.log("hello");
  }

  /**
   * 事后下发画布渲染依赖（对齐旧版 editor.set(ASSEM_RENDER_DEPENDENCIES_KEY) 异步场景：
   * 宿主从服务端解析依赖后延迟下发）。
   * 与场景内置默认重新合并（宿主项优先）；仅 iframe 模式生效，须在 DesignerHost mount 前调用。
   */
  setRenderDependencies(
    deps: import("../simulator/iframe/protocol").IframeAssetsManifest
      | import("../simulator/iframe/protocol").RenderDependencyItem[],
  ): void {
    const manifest = mergeAssets(
      normalizeRenderDependencies(deps),
      this.profile.defaultRenderAssets,
    );
    if (manifest && this.renderer?.setAssets) {
      this.renderer.setAssets(manifest);
    }
  }

  /** 连接拖拽引擎：投放执行 + 拖拽态副作用 */
  private wireDragon(): void { // 投放执行
    this.dragon.on({
      onDrop: (dragObject: DragObject, location: DropLocation) => {
        // 嵌套校验（最终拦截，兜底防漏）
        const parentNode = this.schemaOps.getNodeById(
          this.store.schema,
          location.containerId,
        );
        const parentRenderType = parentNode?.__nodeOptions?.renderType;
        const childRenderType
          = dragObject.type === "nodeData"
            ? dragObject.data?.renderType
            : dragObject.type === "node"
              ? this.schemaOps.getNodeById(this.store.schema, dragObject.nodeId!)
                ?.__nodeOptions
                ?.renderType
              : undefined;
        if (
          parentRenderType
          && childRenderType
          && !this.nestingRules.canNest(
            parentRenderType,
            location.region,
            childRenderType,
          )
        ) {
          return;
        }

        if (dragObject.type === "nodeData" && dragObject.data) {
          const renderType = dragObject.data.renderType ?? dragObject.data.type;
          const item = this.catalog
            .getComponents()
            .find(c => c.renderType === renderType);
          if (item) {
            const node = this.schemaOps.createNode(
              renderType,
              item.name,
              this.schemaOps.cloneSchema(item.scaffold),
            );
            this.insert(
              location.containerId,
              location.region,
              node,
              location.index,
            );
          }
        } else if (dragObject.type === "node" && dragObject.nodeId) {
          if (!this.isDescendantNode(dragObject.nodeId, location.containerId)) {
            this.move(
              dragObject.nodeId,
              location.containerId,
              location.region,
              location.index,
            );
          }
        }
      },
    });
    // 拖拽态副作用（光标 + renderer 拖拽态）
    this.dragon.setDragStateSetter((active: boolean) => {
      this.renderer?.setDraggingState(active);
      document.body.style.cursor = active ? "copy" : "";
      document.body.style.userSelect = active ? "none" : "";
      return () => {
        this.renderer?.setDraggingState(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    });
  }

  /** 判断 descendant 是否为 ancestor 的后代（public：供 CanvasSensor 拖拽阶段提前拦截） */
  isDescendantNode(
    descendantId: string,
    ancestorId: string,
  ): boolean {
    if (descendantId === ancestorId) {
      return true;
    }
    let cur = this.schemaOps.getParentById(this.store.schema, ancestorId);
    while (cur) {
      const curId = this.schemaOps.getNodeId(cur);
      if (curId === descendantId) {
        return true;
      }
      cur = this.schemaOps.getParentById(this.store.schema, curId);
    }
    return false;
  }

  /** 从组件面板发起拖拽（便捷 API） */
  startComponentDrag(e: MouseEvent, renderType: string): void {
    const item = this.catalog
      .getComponents()
      .find(c => c.renderType === renderType);
    this.dragon.boost(
      {
        type: "nodeData",
        data: item ?? { renderType },
        title: item?.name ?? renderType,
      },
      e,
    );
  }

  /** 画布内节点拖拽（便捷 API） */
  startNodeDrag(e: MouseEvent, nodeId: string): void {
    const node = this.schemaOps.getNodeById(this.store.schema, nodeId);
    this.dragon.boost(
      {
        type: "node",
        nodeId,
        title: this.schemaOps.getNodeLabel(node ?? {}) || "节点",
      },
      e,
    );
  }

  /** 根节点 id（场景树的顶层节点，供面板插入用） */
  get rootNodeId(): string | null {
    let rootId: string | null = null;
    this.schemaOps.walk(this.store.schema, (node, parent) => {
      if (parent === null && !rootId) {
        rootId = this.schemaOps.getNodeId(node);
      }
    });
    return rootId;
  }

  // --------------------- 启动 / 销毁 ---------------------

  /** 启动编辑器：激活插件（contributes 自动应用内聚到 PluginManager.activate） */
  async start(): Promise<void> {
    const ctx: PluginContext = {
      editor: this,
      store: this.store,
      di: this.di,
      bus: this.bus,
      skeleton: this.skeleton,
      setterRegistry: this.setterRegistry,
      assetRegistry: this.assetRegistry,
      actionRegistry: this.actionRegistry,
      getPlugin: (id: string) => this.pluginManager.getPlugin(id),
    };
    // activate 内聚 contributes 自动应用 + setup + 钩子绑定
    await this.pluginManager.activate(ctx, this.store.state.platform);

    this.bus.trigger(EVENT.EDITOR_INIT, { editor: this });
    this.store.setReady(true);
    this.bus.trigger(EVENT.EDITOR_READY, { editor: this });
    this.keyboard.attach();

    // 草稿自动保存（sessionStorage）
    if (this.draftKey) {
      const { watch } = await import("vue");
      watch(
        () => this.store.schemaRef.value,
        () => this.scheduleDraftSave(),
        { deep: false },
      );
      window.addEventListener("beforeunload", () => this.saveDraft());
    }
  }

  /** 注册内置右键菜单项 */
  private registerBuiltinContextMenu(): void {
    const cm = this.contextMenu;

    cm.register({
      name: "copy",
      title: "复制",
      weight: 10,
      condition: ({ nodeId }) => !!nodeId,
      action: ({ nodeId, editor }) => editor.copy(nodeId!),
    });

    cm.register({
      name: "paste",
      title: "粘贴",
      weight: 20,
      // 粘贴不要求选中节点（可粘贴到根容器）
      disabled: ({ editor }) => !editor.clipboard,
      action: ({ nodeId, editor }) => {
        if (nodeId) {
          editor.paste(nodeId);
        } else if (editor.clipboard) {
          // 无选中节点时粘贴到根容器
          editor.insert(editor.store.schema.$$id ?? "root", "body", editor.clipboard);
        }
      },
    });

    cm.register({ name: "sep1", title: "", separator: true, weight: 30, condition: ({ nodeId }) => !!nodeId });

    cm.register({
      name: "moveUp",
      title: "上移",
      weight: 40,
      condition: ({ nodeId }) => !!nodeId,
      action: ({ nodeId, editor }) => editor.moveUp(nodeId!),
    });

    cm.register({
      name: "moveDown",
      title: "下移",
      weight: 50,
      condition: ({ nodeId }) => !!nodeId,
      action: ({ nodeId, editor }) => editor.moveDown(nodeId!),
    });

    cm.register({ name: "sep2", title: "", separator: true, weight: 60, condition: ({ nodeId }) => !!nodeId });

    cm.register({
      name: "delete",
      title: "删除",
      danger: true,
      weight: 70,
      condition: ({ nodeId }) => !!nodeId,
      action: ({ nodeId, editor }) => editor.remove(nodeId!),
    });
  }

  /** 注册内置组件工具栏动作 */
  private registerBuiltinComponentActions(): void {
    const ca = this.componentActions;

    ca.register({
      name: "moveUp",
      title: "上移",
      weight: 10,
      condition: ({ nodeId }) => !!nodeId,
      action: ({ nodeId, editor }) => editor.moveUp(nodeId),
    });

    ca.register({
      name: "moveDown",
      title: "下移",
      weight: 20,
      condition: ({ nodeId }) => !!nodeId,
      action: ({ nodeId, editor }) => editor.moveDown(nodeId),
    });

    ca.register({
      name: "copy",
      title: "复制",
      weight: 30,
      condition: ({ nodeId }) => !!nodeId,
      action: ({ nodeId, editor }) => editor.copy(nodeId),
    });

    ca.register({
      name: "delete",
      title: "删除",
      danger: true,
      weight: 40,
      condition: ({ nodeId }) => !!nodeId,
      action: ({ nodeId, editor }) => editor.remove(nodeId),
    });
  }

  /** 销毁 */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.bus.trigger(EVENT.EDITOR_DESTROY, {});
    if (this.draftTimer) {
      clearTimeout(this.draftTimer);
      this.saveDraft();
    }
    this.dragon.destroy();
    this.keyboard.detach();
    this.liveEditing.dispose();
    this.renderer?.dispose();
    this.pluginManager.destroy();
    this.bus.destroy();
    this.di.clear();
  }

  // --------------------- 草稿（sessionStorage）---------------------

  /** 读取草稿 */
  private readDraft(key: string): any | null {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) {
        return null;
      }
      const entry = JSON.parse(raw);
      if (entry?.v === 1 && entry?.schema) {
        return entry.schema;
      }
      return null;
    } catch {
      return null;
    }
  }

  /** 防抖保存草稿 */
  private scheduleDraftSave(): void {
    if (this.draftTimer) {
      clearTimeout(this.draftTimer);
    }
    this.draftTimer = setTimeout(() => this.saveDraft(), this.draftDebounce);
  }

  /** 立即保存草稿 */
  private saveDraft(): void {
    if (!this.draftKey) {
      return;
    }
    try {
      const entry = { v: 1, ts: Date.now(), schema: this.store.schema };
      sessionStorage.setItem(this.draftKey, JSON.stringify(entry));
    } catch (e) {
      console.warn("[Editor] 草稿保存失败:", e);
    }
  }

  /** 清除草稿（新建页面时调用） */
  clearDraft(): void {
    if (!this.draftKey) {
      return;
    }
    try {
      sessionStorage.removeItem(this.draftKey);
    } catch {
      /* ignore */
    }
  }

  // --------------------- Schema 操作（高层 API） ---------------------

  /** 同步渲染器（结构/属性变更后调用） */
  private syncRenderer(): void {
    if (this.renderer) {
      this.renderer.setSchema(this.store.schema);
      this.renderer.onStructureChange?.();
    }
  }

  /** 加载 schema */
  loadSchema(schema: any): void {
    this.store.loadSchema(schema);
    this.bus.trigger(EVENT.SCHEMA_CHANGE, { schema });
    if (this.renderer) {
      this.renderer.setSchema(this.store.schema);
    }
  }

  /** 获取 schema（深拷贝） */
  getSchema(): any {
    return this.schemaOps.cloneSchema(this.store.schema);
  }

  /** 复制节点到剪贴板 */
  copy(nodeId: string): void {
    const node = this.schemaOps.getNodeById(this.store.schema, nodeId);
    if (node) {
      this.clipboard = this.schemaOps.cloneNode(node);
    }
  }

  /** 粘贴剪贴板节点（插入到目标节点之后；无选中节点时粘贴到当前场景根） */
  paste(nodeId?: string): void {
    if (!this.clipboard) {
      return;
    }

    // 有选中节点：粘贴到该节点之后（现有逻辑）
    if (nodeId) {
      const loc = this.schemaOps.findSlotOf?.(this.store.schema, nodeId);
      if (loc) {
        const cloned = this.schemaOps.cloneNode(this.clipboard);
        this.regenerateNodeIds(cloned);
        this.insert(loc.parentId, loc.slotKey, cloned, loc.index + 1);
        this.select(this.schemaOps.getNodeId(cloned));
        return;
      }
    }

    // 无选中节点（场景切换后）：粘贴到当前场景根节点的 defaultSlot
    const rootId = this.getCurrentSceneRootId();
    if (rootId) {
      const cloned = this.schemaOps.cloneNode(this.clipboard);
      this.regenerateNodeIds(cloned);
      this.insert(rootId, "defaultSlot", cloned);
      this.select(this.schemaOps.getNodeId(cloned));
    }
  }

  /** 获取当前激活场景的根节点 ID */
  private getCurrentSceneRootId(): string {
    const root = this.store.schema?.[this.activeScene]?.viewsProps?.planeOptions;
    return root ? this.schemaOps.getNodeId(root) : "";
  }

  /** 保存（触发 SAVE 事件，由宿主消费做持久化） */
  save(): void {
    this.bus.trigger(EVENT.SAVE, { schema: this.store.schema });
  }

  /** 插入节点 */
  insert(
    parentId: string,
    slotKey: string,
    node: any,
    index?: number,
  ): any | undefined {
    const event = this.bus.trigger(EVENT.BEFORE_INSERT, {
      parentId,
      slotKey,
      node,
      index,
    });
    if (event.prevented) {
      return undefined;
    }
    const created = this.schemaOps.cloneNode(node);
    this.ensureNodeId(created);
    this.store.commit("insert", (schema) => {
      this.schemaOps.insertNode(schema, parentId, slotKey, created, index);
    });
    this.bus.trigger(EVENT.AFTER_INSERT, { parentId, slotKey, node: created });
    this.syncRenderer();
    return created;
  }

  /** 更新节点 */
  update(nodeId: string, patch: any): void {
    const event = this.bus.trigger(EVENT.BEFORE_UPDATE, { nodeId, patch });
    if (event.prevented) {
      return;
    }
    this.store.commit("update", (schema) => {
      this.schemaOps.updateNode(schema, nodeId, patch);
    });
    this.bus.trigger(EVENT.AFTER_UPDATE, { nodeId, patch });
    if (this.renderer) {
      this.renderer.setSchema(this.store.schema);
      this.renderer.updateNode?.(nodeId, patch);
    }
  }

  /** 更新节点属性（便捷：属性写入 __nodeOptions） */
  updateProps(nodeId: string, props: Record<string, any>): void {
    this.update(nodeId, { __nodeOptions: props });
  }

  /** 移动节点 */
  move(
    nodeId: string,
    toParentId: string,
    slotKey: string,
    index?: number,
  ): void {
    const event = this.bus.trigger(EVENT.BEFORE_MOVE, {
      nodeId,
      toParentId,
      slotKey,
      index,
    });
    if (event.prevented) {
      return;
    }
    this.store.commit("move", (schema) => {
      this.schemaOps.moveNode(schema, nodeId, toParentId, slotKey, index);
    });
    this.bus.trigger(EVENT.AFTER_MOVE, { nodeId, toParentId, slotKey, index });
    this.syncRenderer();
  }

  /** 移除节点 */
  remove(nodeId: string): void {
    const event = this.bus.trigger(EVENT.BEFORE_DELETE, { nodeId });
    if (event.prevented) {
      return;
    }
    this.store.commit("delete", (schema) => {
      this.schemaOps.removeNode(schema, nodeId);
    });
    this.bus.trigger(EVENT.AFTER_DELETE, { nodeId });
    if (this.store.state.activeId === nodeId) {
      this.store.select(null);
    }
    this.syncRenderer();
  }

  /** 复制节点 */
  duplicate(nodeId: string): any | undefined {
    const node = this.schemaOps.getNodeById(this.store.schema, nodeId);
    if (!node) {
      return undefined;
    }
    const loc = this.schemaOps.findSlotOf?.(this.store.schema, nodeId);
    if (!loc) {
      return undefined;
    }
    const cloned = this.schemaOps.cloneNode(node);
    this.regenerateNodeIds(cloned);
    this.store.commit("duplicate", (schema) => {
      this.schemaOps.insertNode(schema, loc.parentId, loc.slotKey, cloned, loc.index + 1);
    });
    this.store.select(this.schemaOps.getNodeId(cloned));
    this.syncRenderer();
    return cloned;
  }

  /** 上移 */
  moveUp(nodeId: string): void {
    const event = this.bus.trigger(EVENT.BEFORE_MOVE, {
      nodeId,
      direction: "up",
    });
    if (event.prevented) {
      return;
    }
    this.store.commit("move-up", (schema) => {
      this.schemaOps.moveNodeUp?.(schema, nodeId);
    });
    this.syncRenderer();
  }

  /** 下移 */
  moveDown(nodeId: string): void {
    const event = this.bus.trigger(EVENT.BEFORE_MOVE, {
      nodeId,
      direction: "down",
    });
    if (event.prevented) {
      return;
    }
    this.store.commit("move-down", (schema) => {
      this.schemaOps.moveNodeDown?.(schema, nodeId);
    });
    this.syncRenderer();
  }

  /** 撤销 */
  undo(): void {
    if (this.store.undo()) {
      this.bus.trigger(EVENT.HISTORY_CHANGE, {});
      if (this.renderer) {
        this.renderer.setSchema(this.store.schema);
      }
    }
  }

  /** 重做 */
  redo(): void {
    if (this.store.redo()) {
      this.bus.trigger(EVENT.HISTORY_CHANGE, {});
      if (this.renderer) {
        this.renderer.setSchema(this.store.schema);
      }
    }
  }

  /** 切换设计/预览模式（同步渲染器） */
  setDesignMode(mode: "design" | "preview"): void {
    if (this.store.state.designMode !== mode) {
      this.store.toggleDesignMode();
    }
    this.renderer?.setDesignMode(mode);
  }

  // --------------------- 选区 ---------------------

  select(id: string | null): void {
    this.store.select(id);
    this.bus.trigger(EVENT.ACTIVE_CHANGE, { activeId: id });
    this.rebuildPanels();
  }

  // --------------------- 场景 ---------------------

  /** 当前激活场景名 */
  get activeScene(): string {
    return this.store.state.activeScene;
  }

  /** 获取所有场景名列表 */
  getScenes(): string[] {
    const schema = this.store.schema;
    return schema && typeof schema === "object" ? Object.keys(schema) : [];
  }

  /** 切换激活场景（路由跳转 + 画布渲染 + 清空选区） */
  setScene(sceneName: string): void {
    const scenes = this.getScenes();
    if (!scenes.includes(sceneName) || sceneName === this.activeScene) {
      return;
    }
    const ev = this.bus.trigger(EVENT.BEFORE_SCENE_CHANGE, {
      from: this.activeScene,
      to: sceneName,
    });
    if (ev.prevented) {
      return;
    }
    this.store.setActiveScene(sceneName);
    this.renderer?.setScene?.(sceneName);
    this.router.pushScene(sceneName);
    this.bus.trigger(EVENT.AFTER_SCENE_CHANGE, { sceneName });
  }

  /** 新增场景（页面）— 直接修改 schema + 清空历史，不走 commit */
  addScene(sceneName: string, path?: string): boolean {
    if (!sceneName || this.getScenes().includes(sceneName)) {
      return false;
    }

    // 生成空场景数据（复用场景空模板）
    const emptySchema = this.profile.emptySchema();
    const sceneData = emptySchema[Object.keys(emptySchema)[0]] ?? {
      viewsProps: { planeOptions: this.profile.emptySchema()[sceneName]?.viewsProps?.planeOptions },
    };

    // 直接修改 schema + 更新 schemaRef + 清空历史
    const ok = this.schemaOps.addScene?.(this.store.schema, sceneName, sceneData) ?? false;
    if (!ok) {
      return false;
    }
    this.store.schemaRef.value = this.store.schema;
    this.store.clearHistory();

    // EditorRouter 动态加路由
    this.router.addScene(sceneName, {
      name: sceneName,
      path: path ?? `/${sceneName}`,
      meta: { title: sceneName },
    });

    // 同步渲染器
    this.syncRenderer();

    // 自动切换到新场景
    this.setScene(sceneName);
    return true;
  }

  /** 删除场景（页面）— 直接修改 schema + 清空历史 */
  removeScene(sceneName: string): boolean {
    const scenes = this.getScenes();
    if (scenes.length <= 1 || !scenes.includes(sceneName)) {
      return false;
    }

    // 删的是当前场景：先切换到其他场景
    if (this.activeScene === sceneName) {
      const fallback = scenes.find(s => s !== sceneName)!;
      this.store.setActiveScene(fallback);
      this.renderer?.setScene?.(fallback);
    }

    // 直接删除 + 清空历史
    const ok = this.schemaOps.removeScene?.(this.store.schema, sceneName) ?? false;
    if (!ok) {
      return false;
    }
    this.store.schemaRef.value = this.store.schema;
    this.store.clearHistory();

    // EditorRouter 动态移除路由
    this.router.removeScene(sceneName);

    // 同步渲染器
    this.syncRenderer();
    return true;
  }

  /** 重新构建右侧面板（插件驱动） */
  rebuildPanels(): void {
    const node = this.store.activeNode;
    const panels: any[] = [];
    this.pluginManager.buildPanels(node, panels);
    this.store.setPanels(panels);
  }

  // --------------------- DI 便捷 ---------------------

  /** 按 token 获取服务 */
  resolve<T>(key: InjectionToken<T>): T {
    return this.di.require(key);
  }

  // --------------------- 内部事件处理 ---------------------

  private handleClick(id: string | null): void {
    this.select(id);
  }

  private handleHover(id: string | null): void {
    if (this.store.state.hoverId !== id) {
      this.store.setHover(id);
      this.bus.trigger(EVENT.HOVER_CHANGE, { hoverId: id });
    }
  }

  private handleRenderReady(): void {
    this.bus.trigger(EVENT.SIMULATOR_READY, {});
  }

  // --------------------- 节点 id 辅助 ---------------------

  /** 确保节点（及其子树）拥有唯一 id，无则生成 */
  private ensureNodeId(node: any): void {
    if (!node || typeof node !== "object") {
      return;
    }
    if (!node.__nodeId) {
      const renderType = node.__nodeOptions?.renderType ?? "node";
      node.__nodeId = this.schemaOps.genNodeId(renderType);
    }
  }

  /** 为克隆的节点子树重新生成全部 id（粘贴/复制用） */
  private regenerateNodeIds(node: any): void {
    if (!node || typeof node !== "object") {
      return;
    }
    if (node.__nodeId) {
      const renderType = node.__nodeOptions?.renderType ?? "node";
      node.__nodeId = this.schemaOps.genNodeId(renderType);
    }
    for (const v of Object.values(node)) {
      if (Array.isArray(v)) {
        v.forEach(child => this.regenerateNodeIds(child));
      } else if (v && typeof v === "object") {
        this.regenerateNodeIds(v);
      }
    }
  }
}

/** 工厂：创建编辑器实例（支持多实例） */
export function createEditor(options: EditorOptions): Editor {
  return new Editor(options);
}
