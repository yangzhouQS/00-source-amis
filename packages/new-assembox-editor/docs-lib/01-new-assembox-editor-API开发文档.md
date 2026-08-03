# @cs/new-assembox-editor — API 开发文档

> **版本**：0.1.0
> **技术栈**：Vue 3 + TypeScript (TSX) + Element Plus
> **定位**：声明式插件系统 / 响应式 Store / 标准化画布 / 自模拟拖拽引擎 / assembox-desktop 契约集成

---

## 目录

- [1. 快速开始](#1-快速开始)
- [2. 架构总览](#2-架构总览)
- [3. 核心 API（Core）](#3-核心-apicore)
- [4. 注册表 API（Registry）](#4-注册表-apiregistry)
- [5. Schema 类型与操作](#5-schema-类型与操作)
- [6. 骨架/布局 API（Skeleton）](#6-骨架布局-apiskeleton)
- [7. 模拟器/画布 API（Simulator）](#7-模拟器画布-apisimulator)
- [8. 设计器 API（Designer）](#8-设计器-apidesigner)
- [9. 拖拽引擎 API（Dragon）](#9-拖拽引擎-apidragon)
- [10. 内置 Setter](#10-内置-setter)
- [11. 内置插件](#11-内置插件)
- [12. assembox-desktop 契约](#12-assembox-desktop-契约)
- [13. 模块依赖关系](#13-模块依赖关系)
- [14. 最佳实践](#14-最佳实践)

---

## 1. 快速开始

```typescript
import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import { createEditor, Workbench, registerComponent } from '@cs/new-assembox-editor';

// 1. 注册组件
registerComponent({
  type: 'button',
  name: '按钮',
  scaffold: { type: 'button', props: { content: '按钮', type: 'primary' } },
  props: [
    { name: 'content', title: '文字', propType: 'string', defaultValue: '按钮' },
    { name: 'type', title: '类型', propType: { type: 'oneOf', value: ['primary', 'success', 'danger'] }, defaultValue: 'primary' }
  ],
  events: [{ name: 'click', title: '点击' }]
});

// 2. 创建编辑器实例
const editor = createEditor({
  platform: 'desktop',
  canvasMode: 'iframe',  // 'inline' 同 DOM | 'iframe' 隔离渲染
  schema: { type: 'page', $$id: 'root', body: [] }
});

// 3. 启动
await editor.start();

// 4. 挂载
createApp({ render: () => <Workbench skeleton={editor.skeleton} store={editor.store} editor={editor} /> })
  .use(ElementPlus)
  .mount('#app');
```

---

## 2. 架构总览

```
src/
├── core/          DI容器 · 事件总线 · 插件管理 · 响应式Store · Logger · Editor门面
├── registry/      组件注册表 · Setter注册表 · 资产注册表 · 动作注册表 · DI Tokens
├── schema/        类型定义( amis风格 ) · 纯函数操作(增删改查移动)
├── skeleton/      Workbench · 7区域 · Widget/Panel/PanelDock · BEM命名
├── simulator/     NodeTree · Bridge契约 · InProcessBridge · IframeBridge · IframeSimulatorRenderer
├── designer/      DesignerHost · IframeDesignerHost · BemTools · Dragon · CanvasSensor · DragGhost
├── setters/       25个内置Setter · 契约类型 · resolve辅助
├── actions/       声明式动作(toast/ajax/navigate/...)
├── plugins/       内置插件集 · 右键菜单 · 顶部工具栏 · 各面板
├── hooks/         useAssemNamespace(BEM) · useEditorShortcuts(快捷键)
└── index.ts       统一出口
```

**tags**: `architecture`, `overview`, `module-organization`

---

## 3. 核心 API（Core）

### 3.1 Editor

> **tags**: `core`, `editor`, `facade`, `public-api`
> **文件**: `src/core/editor.ts`

编辑器门面类，聚合所有子系统。

```typescript
class Editor {
  // 属性
  readonly di: DIContainer;
  readonly bus: EventBus;
  readonly store: EditorStore;
  readonly selection: Selection;
  readonly componentRegistry: ComponentRegistry;
  readonly setterRegistry: SetterRegistry;
  readonly assetRegistry: AssetRegistry;
  readonly actionRegistry: ActionRegistry;
  readonly pluginManager: PluginManager;
  readonly skeleton: Skeleton;
  readonly nodeTree: NodeTree;
  readonly bridge: SimulatorBridge;
  readonly canvasMode: 'inline' | 'iframe';
  readonly dragon: Dragon;
  readonly logger: Logger;

  // 生命周期
  async start(): Promise<void>;
  destroy(): void;

  // Schema 操作
  loadSchema(schema: PageSchema): void;
  getSchema(): PageSchema;
  insert(parentId: NodeId, region: string, node: PageNode, index?: number): PageNode | undefined;
  update(nodeId: NodeId, patch: Partial<PageNode>): void;
  updateProps(nodeId: NodeId, props: Record<string, any>): void;
  move(nodeId: NodeId, toParentId: NodeId, region: string, index?: number): void;
  remove(nodeId: NodeId): void;
  duplicate(nodeId: NodeId): PageNode | undefined;
  moveUp(nodeId: NodeId): void;
  moveDown(nodeId: NodeId): void;

  // 撤销/重做
  undo(): void;
  redo(): void;

  // 选区
  select(id: NodeId | null): void;

  // DI
  resolve<T>(key: InjectionToken<T>): T;

  // 拖拽便捷
  startComponentDrag(e: MouseEvent, componentType: string): void;
  startNodeDrag(e: MouseEvent, nodeId: NodeId): void;
}
```

**工厂函数**:
```typescript
function createEditor(options?: EditorOptions): Editor;

interface EditorOptions {
  platform?: 'desktop' | 'mobile';
  schema?: PageSchema;
  plugins?: PluginProvider[];
  canvasMode?: 'inline' | 'iframe';
}
```

---

### 3.2 DIContainer

> **tags**: `core`, `di`, `dependency-injection`, `token`
> **文件**: `src/core/di-container.ts`

类型安全的依赖注入容器。

```typescript
class DIContainer {
  register<T>(key: InjectionToken<T>, value: T): this;
  get<T>(key: InjectionToken<T>): T | undefined;
  require<T>(key: InjectionToken<T>): T;     // 不存在则抛错
  has<T>(key: InjectionToken<T>): boolean;
  when<T>(key: InjectionToken<T>): Promise<T>; // 异步等待
  unregister<T>(key: InjectionToken<T>): boolean;
  clear(): void;
}

function token<T>(name: string): InjectionToken<T>;
```

**示例**:
```typescript
import { token } from '@cs/new-assembox-editor';
const MY_SERVICE = token<MyService>('my-service');
di.register(MY_SERVICE, new MyService());
const svc = di.require(MY_SERVICE);
```

---

### 3.3 EventBus

> **tags**: `core`, `event`, `event-bus`, `public-api`
> **文件**: `src/core/event-bus.ts`

统一事件总线（preventDefault / stopPropagation / async）。

```typescript
class EventBus {
  on<C>(type: string, fn: EventListener<C>): () => void;   // 返回取消器
  once<C>(type: string, fn: EventListener<C>): () => void;
  off(type: string, fn: EventListener<any>): void;
  trigger<C>(type: string, context: C): EditorEvent<C>;
  hasListener(type: string): boolean;
  destroy(): void;
}

interface EditorEvent<C = any> {
  type: string;
  context: C;
  prevented: boolean;
  stoped: boolean;
  preventDefault(): void;
  stopPropagation(): void;
  allDone(): Promise<void>;
}
```

**内置事件常量** `EVENT`:
| 常量 | 值 | 说明 |
|---|---|---|
| `EDITOR_INIT` | `editor.init` | 编辑器初始化 |
| `EDITOR_READY` | `editor.ready` | 就绪 |
| `BEFORE_INSERT` / `AFTER_INSERT` | `before-insert` / `after-insert` | 插入前后（可 preventDefault） |
| `BEFORE_UPDATE` / `AFTER_UPDATE` | `before-update` / `after-update` | 更新前后 |
| `BEFORE_DELETE` / `AFTER_DELETE` | `before-delete` / `after-delete` | 删除前后 |
| `SELECTION_CHANGE` | `selection-change` | 选区变化 |
| `HOVER_CHANGE` | `hover-change` | 悬浮变化 |
| `SIMULATOR_READY` | `simulator-ready` | 画布就绪 |

---

### 3.4 EditorStore

> **tags**: `core`, `store`, `reactive`, `state-management`
> **文件**: `src/core/store.ts`

响应式状态管理（基于 Vue reactive），含本地历史。

```typescript
interface EditorState {
  schema: PageSchema;
  selectedIds: NodeId[];
  activeId: NodeId | null;
  hoverId: NodeId | null;
  platform: 'desktop' | 'mobile';
  device: DevicePreset;
  ready: boolean;
  rightPanelVisible: boolean;
  designMode: 'design' | 'preview';
}

class EditorStore {
  readonly state: EditorState;
  readonly schemaRef: ShallowRef<PageSchema>;

  loadSchema(schema: PageSchema): void;
  commit(label: string, mutator: (schema: PageSchema) => void): PageSchema;
  undo(): boolean;
  redo(): boolean;
  get canUndo(): boolean;
  get canRedo(): boolean;

  // 选区
  select(id: NodeId | null): void;
  clearSelection(): void;
  setHover(id: NodeId | null): void;

  // 面板
  toggleRightPanel(visible?: boolean): void;
  toggleDesignMode(): void;
}
```

---

### 3.5 Logger

> **tags**: `core`, `logger`, `debug`, `public-api`
> **文件**: `src/core/logger.ts`

集中式日志管理（URL `__logConf__` 动态调级）。

```typescript
class Logger {
  debug(...args: any[]): void;
  log(...args: any[]): void;
  info(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
  setLevel(level: LogLevel): void;
}

function getLogger(bizName: string, level?: LogLevel): Logger;
function setGlobalLevel(level: LogLevel): void;

type LogLevel = 'debug' | 'log' | 'info' | 'warn' | 'error';
```

**URL 调级**: `?__logConf__=debug` 全开 | `?__logConf__=warn|dragon` 指定模块

---

### 3.6 PluginManager

> **tags**: `core`, `plugin`, `lifecycle`, `public-api`
> **文件**: `src/core/plugin-manager.ts`

插件系统（生命周期 / 优先级覆盖 / 场景过滤）。

```typescript
function registerPlugin(provider: PluginProvider): void;
function unregisterPlugin(id: string): void;
function listRegisteredPlugins(): PluginProvider[];

interface EditorPluginObject {
  id: string;
  name?: string;
  priority?: number;       // 越大越优先
  scene?: string[];
  init?(ctx: PluginContext): void | Promise<void>;
  destroy?(): void;
  contributes?: PluginContributes;
  // 生命周期钩子（EventBus 事件 camelize 映射）
  beforeInsert?(context: any): void;
  afterInsert?(context: any): void;
  // ...beforeUpdate/afterUpdate/beforeDelete/afterDelete
}

function definePlugin(plugin: Partial<EditorPluginObject>): EditorPluginObject;
```

**PluginContext** 可注入的能力：
```typescript
interface PluginContext {
  editor: Editor;
  store: EditorStore;
  di: DIContainer;
  bus: EventBus;
  componentRegistry: ComponentRegistry;
  setterRegistry: SetterRegistry;
  assetRegistry: AssetRegistry;
  actionRegistry: ActionRegistry;
}
```

---

## 4. 注册表 API（Registry）

### 4.1 ComponentRegistry

> **tags**: `registry`, `component`, `metadata`, `public-api`
> **文件**: `src/registry/component-registry.ts`

```typescript
class ComponentRegistry {
  register(meta: ComponentMeta): void;
  unregister(type: string): boolean;
  get(type: string): ComponentMeta | undefined;
  resolve(node: PageNode): ComponentMeta | undefined;
  listForPalette(): ComponentMeta[];
  groupForPalette(): Map<string, Map<string, ComponentMeta[]>>;
  createNode(type: string, overrides?: Partial<PageNode>): PageNode | undefined;
  allMetas(): ComponentMeta[];
}

interface ComponentMeta {
  type: string;           // 与 schema.type 对应
  name: string;
  icon?: any;
  category?: string;
  group?: string;
  scaffold?: Partial<PageNode>;
  props?: PropConfig[];
  events?: EventConfig[];
  regions?: RegionConfig[];
  isContainer?: boolean;
  renderComponent?: VueComponent | (() => Promise<{ default: VueComponent }>);
  override?: boolean;
  weight?: number;
}
```

### 4.2 SetterRegistry

> **tags**: `registry`, `setter`, `property-panel`

```typescript
class SetterRegistry {
  register(name: string, component: VueComponent): void;
  get(name: string): VueComponent | undefined;
  resolve(propType: PropType, explicitSetter?: string): VueComponent | undefined;
}
```

### 4.3 ActionRegistry

> **tags**: `registry`, `action`, `event`, `declarative`

```typescript
class ActionRegistry {
  register(meta: ActionMeta): void;
  get(actionType: string): ActionMeta | undefined;
  async runActions(actions: ActionSchema[], baseCtx: ActionContext): Promise<void>;
}
```

### 4.4 AssetRegistry

> **tags**: `registry`, `asset`, `dependency`, `iframe`

```typescript
class AssetRegistry {
  register(asset: AssetMeta): void;
  all(): AssetMeta[];
  async injectInto(win: Window): Promise<void>;  // 向 iframe 注入 JS/CSS
}
```

---

## 5. Schema 类型与操作

> **tags**: `schema`, `types`, `operations`, `amis-style`
> **文件**: `src/schema/types.ts`, `src/schema/operations.ts`

### 5.1 核心类型

```typescript
interface PageNode {
  type: string;          // 组件类型
  $$id: NodeId;          // 节点唯一 ID
  props?: Record<string, any>;
  style?: Record<string, any>;
  onEvent?: OnEventConfig;
  body?: PageNode[];
}

interface PageSchema extends PageNode {
  type: 'page';
  $$id: NodeId;
  body?: PageNode[];
}

type NodeId = string;

interface OnEventConfig {
  [eventName: string]: {
    actions: ActionSchema[];
    weight?: number;
  };
}

interface ActionSchema {
  actionType: string;
  componentId?: NodeId;
  args?: Record<string, any>;
  data?: Record<string, any>;
  expression?: string;
  preventDefault?: boolean;
  stopPropagation?: boolean;
}
```

### 5.2 操作纯函数（schemaOps）

```typescript
export const schemaOps = {
  genNodeId(prefix?: string): NodeId;
  cloneSchema<T>(schema: T): T;
  ensureIds(node: PageNode, regenerate?: boolean): PageNode;
  getNodeById(schema: PageSchema, id: NodeId): PageNode | undefined;
  getParentById(schema: PageSchema, id: NodeId): PageNode | undefined;
  getChildren(node: PageNode): PageNode[];
  insertNode(schema, parentId, region, node, index?): PageNode | undefined;
  removeNode(schema, id: NodeId): PageNode | undefined;
  moveNode(schema, nodeId, toParentId, region, index?): boolean;
  updateNode(schema, id, patch): PageNode | undefined;
  moveUp(schema, id): boolean;
  moveDown(schema, id): boolean;
  cloneNode(node: PageNode): PageNode;
  getNodeLabel(node: PageNode): string;
};
```

---

## 6. 骨架/布局 API（Skeleton）

> **tags**: `skeleton`, `layout`, `workbench`, `panel`, `dock`
> **文件**: `src/skeleton/`

```typescript
class Skeleton {
  topArea: Area;
  leftArea: Area;
  leftFixedArea: Area;     // 互斥
  leftFloatArea: Area;     // 互斥
  centerArea: Area;
  rightArea: Area;
  bottomArea: Area;

  add(config: WidgetConfig): Widget;
  remove(name: string): Widget | undefined;
  get(name: string): Widget | undefined;
}

interface WidgetConfig {
  type: 'Widget' | 'Panel' | 'PanelDock';
  name: string;
  area?: AreaName;
  content?: VueComponent;
  contentProps?: Record<string, any>;
  panelProps?: { panelName?: string; area?: AreaName };
  props?: { title?: string; icon?: any; align?: 'top' | 'bottom' };
  disabledPanelCache?: boolean;
}

// Workbench 组件
<Workbench skeleton={editor.skeleton} store={editor.store} editor={editor} />
```

---

## 7. 模拟器/画布 API（Simulator）

> **tags**: `simulator`, `bridge`, `iframe`, `node-tree`
> **文件**: `src/simulator/`

### 7.1 NodeTree

```typescript
class NodeTree {
  register(inst: NodeInstance): void;
  unregister(id: NodeId): void;
  get(id: NodeId): NodeInstance | undefined;
  getEl(id: NodeId): HTMLElement | null;
  getParent(id: NodeId): NodeId | null;
  getChildren(parentId: NodeId): NodeInstance[];
  clear(): void;
}

interface NodeInstance {
  $$id: NodeId;
  type: string;
  parentId: NodeId | null;
  parentRegion: string;
  node: PageNode;
  el: HTMLElement | null;
  isContainer: boolean;
}
```

### 7.2 Bridge 契约

```typescript
interface SimulatorBridge {
  renderSchema(schema: PageSchema): void;
  updateNode(nodeId: NodeId, patch: Partial<PageNode>): void;
  insertNode(parentId: NodeId, region: string, node: PageNode, index?: number): void;
  moveNode(nodeId: NodeId, toParentId: NodeId, region: string, index?: number): void;
  removeNode(nodeId: NodeId): void;
  setDraggingState(active: boolean): void;
  rerender(): void;
  onRenderReady(cb: () => void): void;
  onNodeClick(nodeId: NodeId | null, e: MouseEvent): void;
  onNodeHover(nodeId: NodeId | null): void;
  getNodeTree(): NodeTree;
  getRect(nodeId: NodeId): DOMRect | null;
}
```

### 7.3 iframe 协议常量

```typescript
const HOST_CMD = { INIT, RENDER_SCHEMA, UPDATE_NODE, INSERT_NODE, MOVE_NODE, REMOVE_NODE, SET_DRAGGING, ... };
const RENDERER_EVT = { READY, NODE_CLICK, NODE_HOVER, INSTANCES_UPDATED, RECT, ... };
const PROTOCOL_NS = "assem:sim";
```

---

## 8. 设计器 API（Designer）

> **tags**: `designer`, `canvas`, `bem-tools`, `host`
> **文件**: `src/designer/`

| 组件 | 说明 |
|---|---|
| `DesignerHost` | 同 DOM 画布宿主（inline 模式） |
| `IframeDesignerHost` | iframe 隔离画布宿主（iframe 模式） |
| `BemTools` | 覆盖层（选中高亮 + 悬浮高亮 + 工具栏） |

---

## 9. 拖拽引擎 API（Dragon）

> **tags**: `drag`, `dragon`, `sensor`, `dnd`, `custom-engine`
> **文件**: `src/designer/drag/`

```typescript
class Dragon {
  from(shell: Element, boost: (e: MouseEvent) => DragObject | null): () => void;
  boost(dragObject: DragObject, boostEvent: MouseEvent): void;
  addSensor(sensor: DragSensor): void;
  removeSensor(sensorId: string): void;
  on(callbacks: DragonCallbacks): () => void;
  setDragStateSetter(setter: (active: boolean) => () => void): void;
  get dragging(): boolean;
}

class CanvasSensor implements DragSensor {
  isEnter(globalX: number, globalY: number): boolean;
  toGlobal(localX: number, localY: number): { x: number; y: number };
  elementFromPoint(localX: number, localY: number): Element | null;
  locate(target: Element | null, canvasX: number, canvasY: number): DropLocation | null;
  deactiveSensor(): void;
}
```

---

## 10. 内置 Setter

> **tags**: `setter`, `builtin`, `property-editor`
> **文件**: `src/setters/`

25 个内置 setter，统一 `value` / `onChange` 契约：

| Setter | propType | 说明 |
|---|---|---|
| `StringSetter` | string | 文本输入 |
| `TextareaSetter` | — | 多行文本 |
| `NumberSetter` | number | 数字（min/max/step） |
| `BoolSetter` | boolean | 开关 |
| `SelectSetter` | oneOf | 下拉（分组/搜索/多选） |
| `RadioGroupSetter` | — | 单选按钮组 |
| `ColorSetter` | color | 颜色选择 |
| `JsonSetter` | json | JSON 编辑（校验） |
| `IconSetter` | icon | 图标选择（Element + iconFont） |
| `ObjectSetter` | shape | 对象表单 |
| `ArraySetter` | array | 数组编辑（增删/拖拽排序） |
| `ArrayOfMultiSetter` | — | 多选勾选 |
| `MixedSetter` | — | 多 setter 切换 |
| `FunctionSetter` | — | 代码编辑（全屏+校验） |
| `JSFunctionSetter` | — | JS 函数编辑（参数+测试运行） |
| `StyleSetter` | — | CSS 样式分组编辑 |
| `ClassNameSetter` | — | 类名多选 |
| `VariableSetter` | — | 变量绑定 `{{expr}}` |
| `ExpressionSetter` | — | JS 表达式 |
| `LabelSetter` | — | 只读标签 |
| `DocSetter` | — | 文档链接 |
| `CustomSetter` | — | 自定义渲染 |

注册函数：
```typescript
function registerBuiltinSetters(registry: SetterRegistry): void;
```

---

## 11. 内置插件

> **tags**: `plugin`, `builtin`
> **文件**: `src/plugins/builtin-plugins.tsx`

| 插件 | id | 区域 | 功能 |
|---|---|---|---|
| coreRegistry | `builtin-core-registry` | — | 注册内置 setter + action |
| toolbar | `builtin-toolbar` | topArea | 设计/预览 + 撤销/重做 + 节点操作 |
| simulatorSize | `builtin-simulator-size` | topArea | 设备预设（默认/平板/手机） |
| designer | `builtin-designer` | centerArea | 画布（inline / iframe 自动切换） |
| componentsPane | `builtin-components-pane` | leftArea→leftFixedArea | 组件库（拖拽 + 搜索） |
| outlinePane | `builtin-outline-pane` | leftArea→leftFixedArea | 大纲树 |
| schemaPane | `builtin-schema-pane` | leftArea→leftFloatArea | Schema 源码 |
| historyPane | `builtin-history-pane` | leftArea→leftFloatArea | 历史记录 |
| settingsPane | `builtin-settings-pane` | rightArea | 属性/样式/事件/高级 |

---

## 12. assembox-desktop 契约

> **tags**: `assembox-desktop`, `contract`, `eid`, `bridge`
> **文件**: `src/simulator/assembox/`

```typescript
class AssemboxBridge {
  readonly registry: EidRegistry;
  onMountedInstance(instance: any): void;
  onUnmountedInstance(instance: any): void;
  getRect(eid: string): DOMRect | null;
  eidFromEl(el: HTMLElement | null): string | null;
}

class EidRegistry {
  assignEids(root: any): void;
  matchAndRegister(instance: any): EidNodeInfo | null;
  unregisterByInstance(instance: any): void;
  get(eid: string): EidNodeInfo | undefined;
  all(): EidNodeInfo[];
  count(): number;
  static stripEids(node: any): void;
}
```

---

## 13. 模块依赖关系

```
                    ┌──────────┐
                    │  Editor  │ ← 门面
                    └────┬─────┘
          ┌──────┬───────┼───────┬──────────┐
          ▼      ▼       ▼       ▼          ▼
     EventBus  Store  PluginMgr  Dragon   Skeleton
          │      │       │       │          │
          │      │       │       │          ▼
          │      │       ▼       ▼      Workbench
          │      │  ComponentReg  CanvasSensor
          │      │  SetterReg     DragGhost
          │      │  ActionReg
          │      │  AssetReg
          │      │       │
          ▼      ▼       ▼
     DIContainer  Schema(types + operations)
          │
          ▼
     Bridge(InProcess / Iframe)
          │
          ▼
     DesignerHost / IframeDesignerHost
          │
          ▼
     BemTools + NodeTree
```

**依赖方向**：
- Editor → 所有子系统
- PluginManager → EventBus + 所有 Registry
- Dragon → CanvasSensor → NodeTree + Store
- Bridge → Store + NodeTree
- BemTools → Store + NodeTree
- Setters → SetterRegistry + resolveSetter

---

## 14. 最佳实践

### 14.1 自定义插件

```typescript
import { registerPlugin, definePlugin } from '@cs/new-assembox-editor';

const myPlugin = definePlugin({
  id: 'my-analytics',
  priority: 50,
  init(ctx) {
    ctx.bus.on('after-insert', e => {
      console.log('节点插入', e.context.nodeId);
    });
  }
});
registerPlugin(myPlugin);
```

### 14.2 自定义 Setter

```typescript
editor.setterRegistry.register('ColorAdvance', MyColorPicker);
// 在 ComponentMeta.props 中使用：{ name: 'color', setter: 'ColorAdvance' }
```

### 14.3 自定义动作

```typescript
editor.actionRegistry.register({
  actionType: 'showMessage',
  title: '显示消息',
  run: async (ctx) => {
    alert(ctx.action.args?.text);
  }
});
// 在事件编排 UI 中选择 'showMessage'
```

### 14.4 自定义组件

```typescript
registerComponent({
  type: 'my-table',
  name: '数据表格',
  isContainer: false,
  scaffold: { type: 'my-table', props: { columns: [] } },
  props: [
    { name: 'columns', title: '列配置', propType: 'json', defaultValue: [] }
  ],
  events: [{ name: 'rowClick', title: '行点击' }],
  renderComponent: MyTableComponent
});
```

### 14.5 日志调试

```typescript
import { getLogger } from '@cs/new-assembox-editor';
const logger = getLogger('my-plugin');
logger.debug('调试信息');
logger.error('出错了', error);
// URL: ?__logConf__=debug|my-plugin
```

---

**tags**: `api-reference`, `development-guide`, `typescript`, `vue3`, `lowcode-editor`, `visual-editor`, `bem`, `iframe`, `drag-and-drop`, `plugin-system`
