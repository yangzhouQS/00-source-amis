/**
 * Editor 门面
 * 聚合所有核心子系统，对外提供高层 API
 * 取代旧版 getEditor() 全局单例 + window.lc-assemGlobalBus：改为 createEditor() 工厂，支持多实例
 *
 * 场景驱动：通过 ScenarioProfile 提供 schemaOps / renderer / catalog / nestingRules，
 * 不再依赖 amis 风格的 PageSchema/operations/bridge。
 */
import {DIContainer} from './di-container';
import {EventBus, EVENT} from './event-bus';
import {EditorStore} from './store';
import {Selection} from './selection';
import {PluginManager} from './plugin-manager';
import {SetterRegistry} from '../registry/setter-registry';
import {AssetRegistry} from '../registry/asset-registry';
import {ActionRegistry} from '../registry/action-registry';
import {Skeleton} from '../skeleton/skeleton';
import {Dragon} from '../designer/drag/dragon';
import {KeyboardManager} from './keyboard-manager';
import {LiveEditing} from '../designer/live-editing';
import {ContextMenuManager} from '../designer/context-menu-manager';
import {ComponentActionManager} from '../designer/component-action-manager';
import type {DragObject, DropLocation} from '../designer/drag/types';
import {getLogger, type Logger} from './logger';
import * as TOKENS from '../registry/tokens';
import type {
  ISchemaOps,
  IRenderer,
  INestingRules,
  IComponentCatalog,
  ScenarioProfile
} from '../scenario/types';
import {scenarioRegistry} from '../scenario/registry';
import type {PluginContext, EditorPluginObject} from './plugin-types';
import type {InjectionToken} from './di-container';
import {builtinPlugins} from '../plugins/builtin-plugins';

export interface EditorOptions {
  platform?: 'desktop' | 'mobile';
  /** 场景 id（决定 schemaOps/renderer/catalog/nestingRules） */
  scenario: string;
  /** 初始 schema（PC 格式，省略则用场景空模板） */
  schema?: any;
  /** 用户插件（可带 options：[plugin, options]） */
  plugins?: Array<EditorPluginObject | [EditorPluginObject, any]>;
  /** 是否禁用内置插件（默认 false） */
  disableBuiltin?: boolean;
  /** 画布模式：inline（同 DOM 进程内） | iframe（资源隔离） */
  canvasMode?: 'inline' | 'iframe';
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
  /** 剪贴板（复制/粘贴用） */
  clipboard: any | null = null;

  private destroyed = false;

  /** 便捷别名：schema 操作 */
  get schemaOps(): ISchemaOps { return this.profile.schemaOps; }
  /** 便捷别名：嵌套校验 */
  get nestingRules(): INestingRules { return this.profile.nestingRules; }
  /** 便捷别名：组件目录 */
  get catalog(): IComponentCatalog { return this.profile.componentCatalog; }

  constructor(options: EditorOptions) {
    // 1. 激活场景档案
    this.profile = scenarioRegistry.activate(options.scenario);

    // 2. 初始化 store（场景驱动 schemaOps）
    this.store = new EditorStore(
      options.schema ?? this.profile.emptySchema(),
      this.profile.schemaOps
    );
    this.store.state.platform = options.platform ?? 'desktop';
    (this.store.state as any).canvasMode = options.canvasMode ?? 'inline';
    // store 持有 editor 反向引用（bem-tools 用）
    (this.store as any).__editor = this;

    this.selection = new Selection(this.store);
    this.pluginManager = new PluginManager(this.bus);
    // 注册插件：内置（除非 disableBuiltin）+ 用户插件（可带 options）
    if (!options.disableBuiltin) {
      for (const p of builtinPlugins) this.pluginManager.register(p);
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
    this.renderer =
      options.canvasMode === 'iframe' && this.profile.createIframeRenderer
        ? this.profile.createIframeRenderer()
        : this.profile.createRenderer();
    this.renderer.onClick?.((nodeId, _e) => this.handleClick(nodeId));
    this.renderer.onHover?.(id => this.handleHover(id));
    this.renderer.onReady?.(() => this.handleRenderReady());

    // 4. 拖拽引擎（自模拟，跨 iframe 可靠）
    this.dragon = new Dragon();
    this.logger = getLogger('editor');
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
  }

  /** 连接拖拽引擎：投放执行 + 拖拽态副作用 */
  private wireDragon(): void {
    // 投放执行
    this.dragon.on({
      onDrop: (dragObject: DragObject, location: DropLocation) => {
        if (dragObject.type === 'nodeData' && dragObject.data) {
          // 新增组件：从目录取 scaffold 创建节点
          const renderType = dragObject.data.renderType ?? dragObject.data.type;
          const item = this.catalog
            .getComponents()
            .find(c => c.renderType === renderType);
          if (item) {
            const node = this.schemaOps.createNode(
              renderType,
              item.name,
              this.schemaOps.cloneSchema(item.scaffold)
            );
            this.insert(
              location.containerId,
              location.region,
              node,
              location.index
            );
          }
        } else if (dragObject.type === 'node' && dragObject.nodeId) {
          // 移动现有节点
          if (!this.isDescendantNode(dragObject.nodeId, location.containerId)) {
            this.move(
              dragObject.nodeId,
              location.containerId,
              location.region,
              location.index
            );
          }
        }
      }
    });
    // 拖拽态副作用（光标 + renderer 拖拽态）
    this.dragon.setDragStateSetter((active: boolean) => {
      this.renderer?.setDraggingState(active);
      document.body.style.cursor = active ? 'copy' : '';
      document.body.style.userSelect = active ? 'none' : '';
      return () => {
        this.renderer?.setDraggingState(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    });
  }

  /** 判断 descendant 是否为 ancestor 的后代 */
  private isDescendantNode(
    descendantId: string,
    ancestorId: string
  ): boolean {
    if (descendantId === ancestorId) return true;
    let cur = this.schemaOps.getParentById(this.store.schema, ancestorId);
    while (cur) {
      const curId = this.schemaOps.getNodeId(cur);
      if (curId === descendantId) return true;
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
        type: 'nodeData',
        data: item ?? {renderType},
        title: item?.name ?? renderType
      },
      e
    );
  }

  /** 画布内节点拖拽（便捷 API） */
  startNodeDrag(e: MouseEvent, nodeId: string): void {
    const node = this.schemaOps.getNodeById(this.store.schema, nodeId);
    this.dragon.boost(
      {
        type: 'node',
        nodeId,
        title: this.schemaOps.getNodeLabel(node ?? {}) || '节点'
      },
      e
    );
  }

  /** 根节点 id（场景树的顶层节点，供面板插入用） */
  get rootNodeId(): string | null {
    let rootId: string | null = null;
    this.schemaOps.walk(this.store.schema, (node, parent) => {
      if (parent === null && !rootId) rootId = this.schemaOps.getNodeId(node);
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
      getPlugin: (id: string) => this.pluginManager.getPlugin(id)
    };
    // activate 内聚 contributes 自动应用 + setup + 钩子绑定
    await this.pluginManager.activate(ctx, this.store.state.platform);

    this.bus.trigger(EVENT.EDITOR_INIT, {editor: this});
    this.store.setReady(true);
    this.bus.trigger(EVENT.EDITOR_READY, {editor: this});
    this.keyboard.attach();
  }

  /** 注册内置右键菜单项 */
  private registerBuiltinContextMenu(): void {
    const cm = this.contextMenu;

    cm.register({
      name: 'copy',
      title: '复制',
      weight: 10,
      condition: ({nodeId}) => !!nodeId,
      action: ({nodeId, editor}) => editor.copy(nodeId!)
    });

    cm.register({
      name: 'paste',
      title: '粘贴',
      weight: 20,
      condition: ({nodeId}) => !!nodeId,
      disabled: ({editor}) => !editor.clipboard,
      action: ({nodeId, editor}) => editor.paste(nodeId!)
    });

    cm.register({name: 'sep1', title: '', separator: true, weight: 30});

    cm.register({
      name: 'moveUp',
      title: '上移',
      weight: 40,
      condition: ({nodeId}) => !!nodeId,
      action: ({nodeId, editor}) => editor.moveUp(nodeId!)
    });

    cm.register({
      name: 'moveDown',
      title: '下移',
      weight: 50,
      condition: ({nodeId}) => !!nodeId,
      action: ({nodeId, editor}) => editor.moveDown(nodeId!)
    });

    cm.register({name: 'sep2', title: '', separator: true, weight: 60});

    cm.register({
      name: 'delete',
      title: '删除',
      danger: true,
      weight: 70,
      condition: ({nodeId}) => !!nodeId,
      action: ({nodeId, editor}) => editor.remove(nodeId!)
    });
  }

  /** 注册内置组件工具栏动作 */
  private registerBuiltinComponentActions(): void {
    const ca = this.componentActions;

    ca.register({
      name: 'moveUp',
      title: '上移',
      weight: 10,
      condition: ({nodeId}) => !!nodeId,
      action: ({nodeId, editor}) => editor.moveUp(nodeId)
    });

    ca.register({
      name: 'moveDown',
      title: '下移',
      weight: 20,
      condition: ({nodeId}) => !!nodeId,
      action: ({nodeId, editor}) => editor.moveDown(nodeId)
    });

    ca.register({
      name: 'copy',
      title: '复制',
      weight: 30,
      condition: ({nodeId}) => !!nodeId,
      action: ({nodeId, editor}) => editor.copy(nodeId)
    });

    ca.register({
      name: 'delete',
      title: '删除',
      danger: true,
      weight: 40,
      condition: ({nodeId}) => !!nodeId,
      action: ({nodeId, editor}) => editor.remove(nodeId)
    });
  }

  /** 销毁 */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.bus.trigger(EVENT.EDITOR_DESTROY, {});
    this.dragon.destroy();
    this.keyboard.detach();
    this.liveEditing.dispose();
    this.renderer?.dispose();
    this.pluginManager.destroy();
    this.bus.destroy();
    this.di.clear();
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
    this.bus.trigger(EVENT.SCHEMA_CHANGE, {schema});
    if (this.renderer) this.renderer.setSchema(this.store.schema);
  }

  /** 获取 schema（深拷贝） */
  getSchema(): any {
    return this.schemaOps.cloneSchema(this.store.schema);
  }

  /** 复制节点到剪贴板 */
  copy(nodeId: string): void {
    const node = this.schemaOps.getNodeById(this.store.schema, nodeId);
    if (node) this.clipboard = this.schemaOps.cloneNode(node);
  }

  /** 粘贴剪贴板节点（插入到目标节点之后） */
  paste(nodeId: string): void {
    if (!this.clipboard) return;
    const loc = this.schemaOps.findSlotOf?.(this.store.schema, nodeId);
    if (!loc) return;
    const cloned = this.schemaOps.cloneNode(this.clipboard);
    this.regenerateNodeIds(cloned);
    this.insert(loc.parentId, loc.slotKey, cloned, loc.index + 1);
    this.select(this.schemaOps.getNodeId(cloned));
  }

  /** 保存（触发 SAVE 事件，由宿主消费做持久化） */
  save(): void {
    this.bus.trigger(EVENT.SAVE, {schema: this.store.schema});
  }

  /** 插入节点 */
  insert(
    parentId: string,
    slotKey: string,
    node: any,
    index?: number
  ): any | undefined {
    const event = this.bus.trigger(EVENT.BEFORE_INSERT, {
      parentId,
      slotKey,
      node,
      index
    });
    if (event.prevented) return undefined;
    const created = this.schemaOps.cloneNode(node);
    this.ensureNodeId(created);
    this.store.commit('insert', schema => {
      this.schemaOps.insertNode(schema, parentId, slotKey, created, index);
    });
    this.bus.trigger(EVENT.AFTER_INSERT, {parentId, slotKey, node: created});
    this.syncRenderer();
    return created;
  }

  /** 更新节点 */
  update(nodeId: string, patch: any): void {
    const event = this.bus.trigger(EVENT.BEFORE_UPDATE, {nodeId, patch});
    if (event.prevented) return;
    this.store.commit('update', schema => {
      this.schemaOps.updateNode(schema, nodeId, patch);
    });
    this.bus.trigger(EVENT.AFTER_UPDATE, {nodeId, patch});
    if (this.renderer) {
      this.renderer.setSchema(this.store.schema);
      this.renderer.updateNode?.(nodeId, patch);
    }
  }

  /** 更新节点属性（便捷：属性写入 __nodeOptions） */
  updateProps(nodeId: string, props: Record<string, any>): void {
    this.update(nodeId, {__nodeOptions: props});
  }

  /** 移动节点 */
  move(
    nodeId: string,
    toParentId: string,
    slotKey: string,
    index?: number
  ): void {
    const event = this.bus.trigger(EVENT.BEFORE_MOVE, {
      nodeId,
      toParentId,
      slotKey,
      index
    });
    if (event.prevented) return;
    this.store.commit('move', schema => {
      this.schemaOps.moveNode(schema, nodeId, toParentId, slotKey, index);
    });
    this.bus.trigger(EVENT.AFTER_MOVE, {nodeId, toParentId, slotKey, index});
    this.syncRenderer();
  }

  /** 移除节点 */
  remove(nodeId: string): void {
    const event = this.bus.trigger(EVENT.BEFORE_DELETE, {nodeId});
    if (event.prevented) return;
    this.store.commit('delete', schema => {
      this.schemaOps.removeNode(schema, nodeId);
    });
    this.bus.trigger(EVENT.AFTER_DELETE, {nodeId});
    if (this.store.state.activeId === nodeId) {
      this.store.select(null);
    }
    this.syncRenderer();
  }

  /** 复制节点 */
  duplicate(nodeId: string): any | undefined {
    const node = this.schemaOps.getNodeById(this.store.schema, nodeId);
    if (!node) return undefined;
    const loc = this.schemaOps.findSlotOf?.(this.store.schema, nodeId);
    if (!loc) return undefined;
    const cloned = this.schemaOps.cloneNode(node);
    this.regenerateNodeIds(cloned);
    this.store.commit('duplicate', schema => {
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
      direction: 'up'
    });
    if (event.prevented) return;
    this.store.commit('move-up', schema => {
      this.schemaOps.moveNodeUp?.(schema, nodeId);
    });
    this.syncRenderer();
  }

  /** 下移 */
  moveDown(nodeId: string): void {
    const event = this.bus.trigger(EVENT.BEFORE_MOVE, {
      nodeId,
      direction: 'down'
    });
    if (event.prevented) return;
    this.store.commit('move-down', schema => {
      this.schemaOps.moveNodeDown?.(schema, nodeId);
    });
    this.syncRenderer();
  }

  /** 撤销 */
  undo(): void {
    if (this.store.undo()) {
      this.bus.trigger(EVENT.HISTORY_CHANGE, {});
      if (this.renderer) this.renderer.setSchema(this.store.schema);
    }
  }

  /** 重做 */
  redo(): void {
    if (this.store.redo()) {
      this.bus.trigger(EVENT.HISTORY_CHANGE, {});
      if (this.renderer) this.renderer.setSchema(this.store.schema);
    }
  }

  /** 切换设计/预览模式（同步渲染器） */
  setDesignMode(mode: 'design' | 'preview'): void {
    if (this.store.state.designMode !== mode) {
      this.store.toggleDesignMode();
    }
    this.renderer?.setDesignMode(mode);
  }

  // --------------------- 选区 ---------------------

  select(id: string | null): void {
    this.store.select(id);
    this.bus.trigger(EVENT.ACTIVE_CHANGE, {activeId: id});
    this.rebuildPanels();
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
      this.bus.trigger(EVENT.HOVER_CHANGE, {hoverId: id});
    }
  }

  private handleRenderReady(): void {
    this.bus.trigger(EVENT.SIMULATOR_READY, {});
  }

  // --------------------- 节点 id 辅助 ---------------------

  /** 确保节点（及其子树）拥有唯一 id，无则生成 */
  private ensureNodeId(node: any): void {
    if (!node || typeof node !== 'object') return;
    if (!node.__nodeId) {
      const renderType = node.__nodeOptions?.renderType ?? 'node';
      node.__nodeId = this.schemaOps.genNodeId(renderType);
    }
  }

  /** 为克隆的节点子树重新生成全部 id（粘贴/复制用） */
  private regenerateNodeIds(node: any): void {
    if (!node || typeof node !== 'object') return;
    if (node.__nodeId) {
      const renderType = node.__nodeOptions?.renderType ?? 'node';
      node.__nodeId = this.schemaOps.genNodeId(renderType);
    }
    for (const v of Object.values(node)) {
      if (Array.isArray(v)) v.forEach(child => this.regenerateNodeIds(child));
      else if (v && typeof v === 'object') this.regenerateNodeIds(v);
    }
  }
}

/** 工厂：创建编辑器实例（支持多实例） */
export function createEditor(options: EditorOptions): Editor {
  return new Editor(options);
}
