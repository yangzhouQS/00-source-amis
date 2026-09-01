/**
 * new-assembox-editor 包入口
 */

import "./styles/global.less";

export { registerBuiltinActions } from "./actions/builtin-actions";
export { DIContainer, token } from "./core/di-container";
export type { InjectionToken } from "./core/di-container";
// 核心层
export { createEditor, Editor } from "./core/editor";
export type { EditorOptions } from "./core/editor";
export { camelize, EVENT, EventBus } from "./core/event-bus";
export type { EditorEvent, EventListener } from "./core/event-bus";
export { getLogger, Logger, setGlobalLevel } from "./core/logger";
export type { LoggerOptions, LogLevel } from "./core/logger";
export { PluginManager } from "./core/plugin-manager";
export { definePlugin } from "./core/plugin-types";
export type {
  EditorPluginObject,
  PluginContext,
  PluginContributes,
  SkeletonContribution,
} from "./core/plugin-types";
export { Selection } from "./core/selection";
export { EditorStore } from "./core/store";
export type { EditorState, HistoryEntry, OutlineNode } from "./core/store";

export { buildOutlineFromSchemaOps } from "./core/store";
export { BemTools } from "./designer/bem-tools";
// 设计器层
export { DesignerHost } from "./designer/designer-host";
export { CanvasSensor } from "./designer/drag/canvas-sensor";
export type { CanvasSensorOptions } from "./designer/drag/canvas-sensor";
export { DragGhost } from "./designer/drag/drag-ghost";

// 自模拟拖拽引擎
export { Dragon, isShaken } from "./designer/drag/dragon";
export type {
  DragObject,
  DragObjectType,
  DragonCallbacks,
  DragSensor,
  DropLocation,
  LocateEvent,
} from "./designer/drag/types";

// 内置插件（导入即注册）
export { builtinPlugins } from "./plugins/builtin-plugins";

export { ActionRegistry } from "./registry/action-registry";
export type { ActionContext } from "./registry/action-registry";
export { AssetRegistry } from "./registry/asset-registry";
export { inferSetterName } from "./registry/setter-inference";
// 注册表层
export { SetterRegistry } from "./registry/setter-registry";

export * as TOKENS from "./registry/tokens";
// 场景层（多场景可插拔）
export {
  registerScenario,
  scenarioRegistry,
} from "./scenario";
export type {
  ComponentCatalogItem,
  ComponentMethodConfig,
  ComponentPropConfig,
  ComponentSlotConfig,
  IComponentCatalog,
  INestingRules,
  IRenderer,
  ISchemaOps,
  RendererMountOptions,
  ScenarioContext,
  ScenarioProfile,
  SlotMarker,
} from "./scenario/types";
// 内置 PC 桌面场景档案（宿主集成时注册：registerScenario(pcDesktopProfile)）
export { pcDesktopProfile } from "./scenarios/pc-desktop";
// Portal 上下文桥接 Hook（编辑器/渲染器双运行环境：
// JsWebFramework（门户宿主）/ JsKanbanFramework（看板宿主）window 运行时查找，
// 宿主模块取 portalStore/$http/portalPinia 统一走这里，禁止静态 import 框架包）
export { usePortalContext } from "./scenarios/pc-desktop/hooks/use-portal-context";
export type {
  PortalPiniaUtils,
  UsePortalContextReturn,
} from "./scenarios/pc-desktop/hooks/use-portal-context";
// Schema 类型（通用类型定义，供 setter / 插件使用）
export type {
  ActionMeta,
  AssetMeta,
  ComponentMeta,
  ContextMenuItem,
  NodeId,
  PanelItem,
  PropConfig,
  PropType,
  SetterMeta,
  ToolbarItem,
  VueComponent,
} from "./schema/types";
// 内置 setter / action
export { registerBuiltinSetters } from "./setters";
// 宿主外置渲染依赖（对齐旧版 ASSEM_RENDER_DEPENDENCIES_KEY 契约）
export type {
  ExternalComponentDef,
  IframeAssetsManifest,
  JsAsset,
  RenderDependencyItem,
} from "./simulator/iframe/protocol";
export { mergeAssets, normalizeRenderDependencies } from "./simulator/iframe/protocol";
// iframe 画布渲染器（canvas.html 内侧运行；生产 canvas 部署用）
export { IframeCanvasRenderer } from "./simulator/iframe/iframe-canvas-renderer";
// 骨架层
export { Skeleton } from "./skeleton/skeleton";
export type { Area } from "./skeleton/skeleton";

export type { AreaName, WidgetConfig, WidgetType } from "./skeleton/types";
export { Workbench } from "./skeleton/workbench";

export type { WorkbenchProps } from "./skeleton/workbench";
