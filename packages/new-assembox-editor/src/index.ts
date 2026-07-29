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
export {EditorStore, createEmptySchema} from './core/store';
export type {EditorState, HistoryEntry} from './core/store';
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
export {
  ComponentRegistry,
  EditorComponent,
  inferSetterName
} from './registry/component-registry';
export {SetterRegistry} from './registry/setter-registry';
export {AssetRegistry} from './registry/asset-registry';
export {ActionRegistry} from './registry/action-registry';
export type {ActionContext} from './registry/action-registry';
export * as TOKENS from './registry/tokens';

// Schema
export type {
  PageSchema,
  PageNode,
  NodeId,
  PropConfig,
  PropType,
  EventConfig,
  RegionConfig,
  ActionSchema,
  OnEventConfig,
  PanelItem,
  ToolbarItem,
  ContextMenuItem,
  ComponentMeta,
  SetterMeta,
  ActionMeta,
  AssetMeta,
  VueComponent
} from './schema/types';
export * as schemaOps from './schema/operations';

// 骨架层
export {Skeleton} from './skeleton/skeleton';
export type {WidgetConfig, WidgetType, AreaName} from './skeleton/types';
export type {Area} from './skeleton/skeleton';
export {Workbench} from './skeleton/workbench';
export type {WorkbenchProps} from './skeleton/workbench';

// 模拟器层
export {NodeTree} from './simulator/node-tree';
export type {NodeInstance} from './simulator/node-tree';
export type {SimulatorBridge} from './simulator/bridge';
export {InProcessBridge} from './simulator/in-process-bridge';
export {SchemaRenderer, NodeRenderer} from './simulator/renderer';
// iframe 模拟器
export {IframeBridge} from './simulator/iframe/iframe-bridge';
export type {IframeBridgeOptions} from './simulator/iframe/iframe-bridge';
export {IframeSimulatorRenderer} from './simulator/iframe/simulator-renderer';
export type {
  SimulatorRendererApi,
  SimulatorHostApi,
  ComponentMapping,
  InitPayload,
  HostMessage,
  RendererMessage
} from './simulator/iframe/protocol';
export {HOST_CMD, RENDERER_EVT, PROTOCOL_NS} from './simulator/iframe/protocol';

// 设计器层
export {DesignerHost} from './designer/designer-host';
export {IframeDesignerHost} from './designer/iframe-designer-host';
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

// assembox-desktop 契约集成（P0）
export {AssemboxBridge} from './simulator/assembox/assembox-bridge';
export type {AssemboxBridgeCallbacks} from './simulator/assembox/assembox-bridge';
export {EidRegistry} from './simulator/assembox/eid-registry';
export type {EidNodeInfo} from './simulator/assembox/eid-registry';
