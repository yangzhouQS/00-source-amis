/**
 * new-assembox-editor 包入口
 */

// 核心层
export {Editor, createEditor} from './core/editor';
export type {EditorOptions} from './core/editor';
export {DIContainer, token} from './core/di-container';
export type {InjectionToken} from './core/di-container';
export {EventBus, EVENT, camelize} from './core/event-bus';
export type {EditorEvent, EventListener} from './core/event-bus';
export {Logger, getLogger, setGlobalLevel} from './core/logger';
export type {LogLevel, LoggerOptions} from './core/logger';
export {EditorStore} from './core/store';
export type {EditorState, HistoryEntry, OutlineNode} from './core/store';
export {buildOutlineFromSchemaOps} from './core/store';
export {Selection} from './core/selection';
export {PluginManager} from './core/plugin-manager';
export {definePlugin} from './core/plugin-types';
export type {
  EditorPluginObject,
  PluginContext,
  PluginContributes,
  SkeletonContribution
} from './core/plugin-types';

// 注册表层
export {SetterRegistry} from './registry/setter-registry';
export {AssetRegistry} from './registry/asset-registry';
export {ActionRegistry} from './registry/action-registry';
export type {ActionContext} from './registry/action-registry';
export {inferSetterName} from './registry/setter-inference';
export * as TOKENS from './registry/tokens';

// 场景层（多场景可插拔）
export {
  scenarioRegistry,
  registerScenario
} from './scenario';
export type {
  ISchemaOps,
  IRenderer,
  IComponentCatalog,
  INestingRules,
  ScenarioProfile,
  ScenarioContext,
  ComponentCatalogItem,
  ComponentPropConfig,
  SlotMarker,
  RendererMountOptions
} from './scenario/types';

// Schema 类型（通用类型定义，供 setter / 插件使用）
export type {
  NodeId,
  PropConfig,
  PropType,
  PanelItem,
  ToolbarItem,
  ContextMenuItem,
  ComponentMeta,
  SetterMeta,
  ActionMeta,
  AssetMeta,
  VueComponent
} from './schema/types';

// 骨架层
export {Skeleton} from './skeleton/skeleton';
export type {WidgetConfig, WidgetType, AreaName} from './skeleton/types';
export type {Area} from './skeleton/skeleton';
export {Workbench} from './skeleton/workbench';
export type {WorkbenchProps} from './skeleton/workbench';

// 设计器层
export {DesignerHost} from './designer/designer-host';
export {BemTools} from './designer/bem-tools';
// 自模拟拖拽引擎
export {Dragon, isShaken} from './designer/drag/dragon';
export {CanvasSensor} from './designer/drag/canvas-sensor';
export type {CanvasSensorOptions} from './designer/drag/canvas-sensor';
export {DragGhost} from './designer/drag/drag-ghost';
export type {
  DragObject,
  DragObjectType,
  LocateEvent,
  DropLocation,
  DragSensor,
  DragonCallbacks
} from './designer/drag/types';

// 内置 setter / action
export {registerBuiltinSetters} from './setters';
export {registerBuiltinActions} from './actions/builtin-actions';

// 内置插件（导入即注册）
export {builtinPlugins} from './plugins/builtin-plugins';
