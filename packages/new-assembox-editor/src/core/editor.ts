/**
 * Editor 门面
 * 聚合所有核心子系统，对外提供高层 API
 * 取代旧版 getEditor() 全局单例 + window.AssemGlobalBus：改为 createEditor() 工厂，支持多实例
 */
import {DIContainer} from './di-container';
import {EventBus, EVENT} from './event-bus';
import {EditorStore} from './store';
import {Selection} from './selection';
import {PluginManager} from './plugin-manager';
import {
  ComponentRegistry,
  flushDecorators
} from '../registry/component-registry';
import {SetterRegistry} from '../registry/setter-registry';
import {AssetRegistry} from '../registry/asset-registry';
import {ActionRegistry} from '../registry/action-registry';
import {Skeleton} from '../skeleton/skeleton';
import {NodeTree} from '../simulator/node-tree';
import {InProcessBridge} from '../simulator/in-process-bridge';
import {IframeBridge} from '../simulator/iframe/iframe-bridge';
import type {SimulatorBridge} from '../simulator/bridge';
import {Dragon} from '../designer/drag/dragon';
import {KeyboardManager} from './keyboard-manager';
import {LiveEditing} from '../designer/live-editing';
import {ContextMenuManager} from '../designer/context-menu-manager';
import {ComponentActionManager} from '../designer/component-action-manager';
import type {DragObject, DropLocation} from '../designer/drag/types';
import {getLogger, type Logger} from './logger';
import * as TOKENS from '../registry/tokens';
import type {PageSchema, PageNode, NodeId} from '../schema/types';
import type {PluginContext, EditorPluginObject} from './plugin-types';
import type {InjectionToken} from './di-container';
import {builtinPlugins} from '../plugins/builtin-plugins';
import * as ops from '../schema/operations';

export interface EditorOptions {
  platform?: 'desktop' | 'mobile';
  /** 初始 schema */
  schema?: PageSchema;
  /** 用户插件（可带 options：[plugin, options]） */
  plugins?: Array<EditorPluginObject | [EditorPluginObject, any]>;
  /** 是否禁用内置插件（默认 false） */
  disableBuiltin?: boolean;
  /** 画布渲染模式：inline=同 DOM，iframe=iframe 隔离渲染 */
  canvasMode?: 'inline' | 'iframe';
}

export class Editor {
  readonly di = new DIContainer();
  readonly bus = new EventBus();
  readonly store: EditorStore;
  readonly selection: Selection;
  readonly componentRegistry = new ComponentRegistry();
  readonly setterRegistry = new SetterRegistry();
  readonly assetRegistry = new AssetRegistry();
  readonly actionRegistry = new ActionRegistry();
  readonly pluginManager: PluginManager;
  readonly skeleton = new Skeleton();
  readonly nodeTree = new NodeTree();
  readonly bridge: SimulatorBridge;
  /** 画布模式 */
  readonly canvasMode: 'inline' | 'iframe';
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
  clipboard: PageNode | null = null;

  private destroyed = false;

  constructor(options: EditorOptions = {}) {
    this.store = new EditorStore(options.schema);
    this.store.state.platform = options.platform ?? 'desktop';
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

    // bridge（按画布模式选择）
    this.canvasMode = options.canvasMode ?? 'inline';
    if (this.canvasMode === 'iframe') {
      this.bridge = new IframeBridge(this.store, this.nodeTree, {
        onClick: (id, _e) => this.handleClick(id),
        onHover: id => this.handleHover(id),
        onReady: () => this.handleRenderReady(),
        onScroll: () => this.handleRenderReady(),
        onDblClick: (nodeId, e, doc) => {
          this.liveEditing.apply(nodeId, e, doc);
        }
      });
    } else {
      this.bridge = new InProcessBridge(this.store, this.nodeTree, {
        onClick: (id, _e) => this.handleClick(id),
        onHover: id => this.handleHover(id),
        onRenderReady: () => this.handleRenderReady()
      });
    }

    // 拖拽引擎（自模拟，跨 iframe 可靠）
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
    this.di.register(TOKENS.COMPONENT_REGISTRY, this.componentRegistry);
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
          // 新增组件
          const node = this.componentRegistry.createNode(dragObject.data.type);
          if (node) {
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
      this.bridge.setDraggingState(active);
      document.body.style.cursor = active ? 'copy' : '';
      document.body.style.userSelect = active ? 'none' : '';
      return () => {
        this.bridge.setDraggingState(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    });
  }

  /** 判断 descendant 是否为 ancestor 的后代 */
  private isDescendantNode(
    descendantId: import('../schema/types').NodeId,
    ancestorId: import('../schema/types').NodeId
  ): boolean {
    if (descendantId === ancestorId) return true;
    let cur = this.nodeTree.getParent(ancestorId);
    while (cur) {
      if (cur === descendantId) return true;
      cur = this.nodeTree.getParent(cur);
    }
    return false;
  }

  /** 从组件面板发起拖拽（便捷 API） */
  startComponentDrag(e: MouseEvent, componentType: string): void {
    const meta = this.componentRegistry.get(componentType);
    this.dragon.boost(
      {type: 'nodeData', data: meta, title: meta?.name ?? componentType},
      e
    );
  }

  /** 画布内节点拖拽（便捷 API） */
  startNodeDrag(e: MouseEvent, nodeId: import('../schema/types').NodeId): void {
    const node = ops.getNodeById(this.store.schema, nodeId);
    this.dragon.boost(
      {
        type: 'node',
        nodeId,
        title: ops.getNodeLabel(node ?? ({} as any)) || '节点'
      },
      e
    );
  }

  // --------------------- 启动 / 销毁 ---------------------

  /** 启动编辑器：激活插件（contributes 自动应用内聚到 PluginManager.activate） */
  async start(): Promise<void> {
    // flush 装饰器注册的组件
    flushDecorators(this.componentRegistry);

    const ctx: PluginContext = {
      editor: this,
      store: this.store,
      di: this.di,
      bus: this.bus,
      skeleton: this.skeleton,
      componentRegistry: this.componentRegistry,
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
    this.bridge.dispose?.();
    this.pluginManager.destroy();
    this.nodeTree.clear();
    this.bus.destroy();
    this.di.clear();
  }

  // --------------------- Schema 操作（高层 API） ---------------------

  /** 加载 schema */
  loadSchema(schema: PageSchema): void {
    this.store.loadSchema(schema);
    this.bus.trigger(EVENT.SCHEMA_CHANGE, {schema});
    this.bridge.rerender();
  }

  /** 获取 schema（深拷贝） */
  getSchema(): PageSchema {
    return ops.cloneSchema(this.store.schema);
  }

  /** 复制节点到剪贴板 */
  copy(nodeId: NodeId): void {
    const node = ops.getNodeById(this.store.schema, nodeId);
    if (node) this.clipboard = ops.cloneNode(node);
  }

  /** 粘贴剪贴板节点（插入到目标节点之后） */
  paste(nodeId: NodeId): void {
    if (!this.clipboard) return;
    const parent = ops.getParentById(this.store.schema, nodeId);
    if (!parent) return;
    const loc = ops.locateChild(parent, nodeId);
    if (!loc) return;
    const cloned = ops.cloneNode(this.clipboard);
    this.insert(parent.$$id, loc.region, cloned, loc.index + 1);
    this.select(cloned.$$id);
  }

  /** 保存（触发 SAVE 事件，由宿主消费做持久化） */
  save(): void {
    this.bus.trigger(EVENT.SAVE, {schema: this.store.schema});
  }

  /** 插入节点 */
  insert(
    parentId: NodeId,
    region: string,
    node: PageNode,
    index?: number
  ): PageNode | undefined {
    const event = this.bus.trigger(EVENT.BEFORE_INSERT, {
      parentId,
      region,
      node,
      index
    });
    if (event.prevented) return undefined;
    const created = ops.cloneSchema(node);
    ops.ensureIds(created);
    this.store.commit('insert', schema => {
      ops.insertNode(schema, parentId, region, created, index);
    });
    this.bus.trigger(EVENT.AFTER_INSERT, {parentId, region, node: created});
    this.bridge.rerender();
    return created;
  }

  /** 更新节点 */
  update(nodeId: NodeId, patch: Partial<PageNode>): void {
    const event = this.bus.trigger(EVENT.BEFORE_UPDATE, {nodeId, patch});
    if (event.prevented) return;
    this.store.commit('update', schema => {
      ops.updateNode(schema, nodeId, patch);
    });
    this.bus.trigger(EVENT.AFTER_UPDATE, {nodeId, patch});
    this.bridge.rerender();
  }

  /** 更新节点属性（便捷） */
  updateProps(nodeId: NodeId, props: Record<string, any>): void {
    this.update(nodeId, {props});
  }

  /** 移动节点 */
  move(
    nodeId: NodeId,
    toParentId: NodeId,
    region: string,
    index?: number
  ): void {
    const event = this.bus.trigger(EVENT.BEFORE_MOVE, {
      nodeId,
      toParentId,
      region,
      index
    });
    if (event.prevented) return;
    this.store.commit('move', schema => {
      ops.moveNode(schema, nodeId, toParentId, region, index);
    });
    this.bus.trigger(EVENT.AFTER_MOVE, {nodeId, toParentId, region, index});
    this.bridge.rerender();
  }

  /** 移除节点 */
  remove(nodeId: NodeId): void {
    const event = this.bus.trigger(EVENT.BEFORE_DELETE, {nodeId});
    if (event.prevented) return;
    this.store.commit('delete', schema => {
      ops.removeNode(schema, nodeId);
    });
    this.bus.trigger(EVENT.AFTER_DELETE, {nodeId});
    if (this.store.state.activeId === nodeId) {
      this.store.select(null);
    }
    this.bridge.rerender();
  }

  /** 复制节点 */
  duplicate(nodeId: NodeId): PageNode | undefined {
    const node = ops.getNodeById(this.store.schema, nodeId);
    if (!node) return undefined;
    const parent = ops.getParentById(this.store.schema, nodeId);
    if (!parent) return undefined;
    const loc = ops.locateChild(parent, nodeId);
    if (!loc) return undefined;
    const cloned = ops.cloneNode(node);
    this.store.commit('duplicate', schema => {
      ops.insertNode(schema, parent.$$id, loc.region, cloned, loc.index + 1);
    });
    this.store.select(cloned.$$id);
    this.bridge.rerender();
    return cloned;
  }

  /** 上移 */
  moveUp(nodeId: NodeId): void {
    const event = this.bus.trigger(EVENT.BEFORE_MOVE, {
      nodeId,
      direction: 'up'
    });
    if (event.prevented) return;
    this.store.commit('move-up', schema => {
      ops.moveUp(schema, nodeId);
    });
    this.bridge.rerender();
  }

  /** 下移 */
  moveDown(nodeId: NodeId): void {
    const event = this.bus.trigger(EVENT.BEFORE_MOVE, {
      nodeId,
      direction: 'down'
    });
    if (event.prevented) return;
    this.store.commit('move-down', schema => {
      ops.moveDown(schema, nodeId);
    });
    this.bridge.rerender();
  }

  /** 撤销 */
  undo(): void {
    if (this.store.undo()) {
      this.bus.trigger(EVENT.HISTORY_CHANGE, {});
      this.bridge.rerender();
    }
  }

  /** 重做 */
  redo(): void {
    if (this.store.redo()) {
      this.bus.trigger(EVENT.HISTORY_CHANGE, {});
      this.bridge.rerender();
    }
  }

  // --------------------- 选区 ---------------------

  select(id: NodeId | null): void {
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

  private handleClick(id: NodeId | null): void {
    this.select(id);
  }

  private handleHover(id: NodeId | null): void {
    if (this.store.state.hoverId !== id) {
      this.store.setHover(id);
      this.bus.trigger(EVENT.HOVER_CHANGE, {hoverId: id});
    }
  }

  private handleRenderReady(): void {
    this.bus.trigger(EVENT.SIMULATOR_READY, {});
  }
}

/** 工厂：创建编辑器实例（支持多实例） */
export function createEditor(options?: EditorOptions): Editor {
  return new Editor(options ?? {});
}
