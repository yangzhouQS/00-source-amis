/**
 * 多场景可插拔渲染器接口定义
 * 设计文档: docs/10-多场景可插拔渲染器设计.md (v3)
 */

// ═══════════════════════════════════════════════
// ISchemaOps — Schema 树操作
// ═══════════════════════════════════════════════

export interface ISchemaOps {
  getNodeId: (node: any) => string;
  setNodeId: (node: any, id: string) => void;
  genNodeId: (type: string) => string;
  getNodeLabel: (node: any) => string;

  getNodeById: (schema: any, id: string) => any | undefined;
  getParentById: (schema: any, id: string) => any | undefined;
  walk: (schema: any, visitor: (node: any, parent: any | null, slotKey: string) => void) => void;
  getSlotChildren: (parentNode: any, slotKey: string) => any[];
  getSlots: (node: any) => { key: string; label: string }[];

  insertNode: (schema: any, parentId: string, slotKey: string, node: any, index?: number) => any | undefined;
  removeNode: (schema: any, nodeId: string) => any | undefined;
  moveNode: (schema: any, nodeId: string, toParentId: string, slotKey: string, index?: number) => boolean;
  updateNode: (schema: any, nodeId: string, patch: any) => any | undefined;
  cloneNode: (node: any) => any;
  cloneSchema: (schema: any) => any;

  createNode: (renderType: string, nodeName: string, overrides?: any) => any;
  emptySchema: () => any;

  // ── 辅助（供 Editor 的 paste/duplicate/moveUp/moveDown）──
  isContainer?: (node: any) => boolean;
  /** 指定宿主槽位是否为单节点语义（wrapper 硬编码单节点渲染，如 YqToolBar.defaultSlot
   *  固定单 FlexLine）——供拖拽传感器提前拦截"单节点槽已占用"的投放 */
  isSingleNodeSlot?: (renderType: string | undefined, slotKey: string) => boolean;
  findSlotOf?: (schema: any, nodeId: string) => { parentId: string; slotKey: string; index: number } | undefined;
  moveNodeUp?: (schema: any, nodeId: string) => boolean;
  moveNodeDown?: (schema: any, nodeId: string) => boolean;

  // ── 场景级操作（多路由页面增删）──
  listScenes?: (schema: any) => string[];
  addScene?: (schema: any, sceneName: string, sceneData: any) => boolean;
  removeScene?: (schema: any, sceneName: string) => boolean;
}

// ═══════════════════════════════════════════════
// IRenderer — 设计态渲染器
// ═══════════════════════════════════════════════

export interface SlotMarker {
  slotKey: string;
  el: HTMLElement;
  rect: DOMRect;
}

export interface RendererMountOptions {
  isEditor?: boolean;
  /** 路由配置（sceneName → 路由信息），用于 iframe 内构建 vue-router */
  routerConfig?: Record<string, { name: string; path: string; meta?: Record<string, any> }>;
  /** 数据源配置（api/requestConfig/dataModelConfig/sharedFns） */
  dataSource?: any;
  /** 全局变量注入（扩展 $globalVars，如 $http/$portal） */
  globalVars?: Record<string, any>;
}

export interface IRenderer {
  mount: (container: HTMLElement, schema: any, options?: RendererMountOptions) => Promise<void>;
  setSchema: (schema: any) => void;
  /** 切换当前渲染的场景（场景名 = uiSkeleton 的顶层 key） */
  setScene?: (sceneName: string) => void;
  updateNode?: (nodeId: string, patch: any) => void;
  onStructureChange?: () => void;
  setDraggingState: (active: boolean) => void;
  setDesignMode: (mode: "design" | "preview") => void;
  dispose: () => void;

  /**
   * 更新画布依赖清单（仅 iframe 隔离渲染器支持；须在 mount 前调用，
   * mount 后改动需重建 iframe 才能生效）
   */
  setAssets?: (assets: import("../simulator/iframe/protocol").IframeAssetsManifest) => void;

  getNodeElement: (nodeId: string) => HTMLElement | null;
  getRect: (nodeId: string) => DOMRect | null;
  nodeIdFromElement: (el: HTMLElement | null) => string | null;

  getSlotMarkers: (nodeId: string) => SlotMarker[] | null;
  resolveFromElement: (el: HTMLElement | null) => { nodeId: string; slotKey: string } | null;

  onReady?: (cb: () => void) => void;
  onClick?: (cb: (nodeId: string | null, e: MouseEvent) => void) => void;
  onHover?: (cb: (nodeId: string | null) => void) => void;
}

// ═══════════════════════════════════════════════
// IComponentCatalog — 组件面板数据
// ═══════════════════════════════════════════════

export interface ComponentPropConfig {
  name: string;
  title?: string;
  propType: import("../schema/types").PropType;
  defaultValue?: any;
  setter?: string;
  setterProps?: Record<string, any>;
  /** 面板布局：false 时顶层不占 label 列（复合 setter 自带结构时用，如格子配置） */
  labelVisible?: boolean;
  /** 面板布局：ObjectSetter 内两列网格（半宽，布尔/短枚举类字段用） */
  halfWidth?: boolean;
}

/** 组件导出方法配置（defineExpose 暴露，供事件脚本/编排调用） */
export interface ComponentMethodConfig {
  name: string;
  title?: string;
  /** 方法签名（TypeScript 形式，如 "(options?: { isReset?: boolean }) => Promise<void>"） */
  signature?: string;
  description?: string;
}

/**
 * 槽位语义声明（借鉴旧版 components-config-pc 的 slotConfig，数据驱动）。
 *
 * - slotType: object = 单节点（渲染层 wrapper `:node="options.xxxSlot"` 直渲，
 *   无 v-for——数组化会崩）；array = 数组（v-for 消费）
 * - slotRender: 组件级白名单（精确 renderType），缺省回落 category 门禁
 *   （渲染库 nesting.ts SLOTS / 编辑器 nesting-rules 链）
 * - 声明位置：component-metadata-config/ 各组件分类文件（宿主槽位语义唯一真相源）
 * - 消费链：buildSlotSemantics 编译 → setSlotSemantics 注入 slot-accessors/
 *   nesting-rules（见 scenarios/pc-desktop/slot-semantics.ts）
 */
export interface ComponentSlotConfig {
  /** 槽位键（slot-accessors DIRECT_SLOTS 键：defaultSlot/toolSlot/...） */
  name: string;
  /** object = 单节点（wrapper 直渲）；array = 数组（v-for 消费） */
  slotType: "object" | "array";
  /** 组件级白名单（renderType 精确匹配）；缺省回落 category 门禁 */
  slotRender?: string[];
  /** 槽位显示名（大纲树/占位文案单一来源） */
  description?: string;
}

export interface ComponentCatalogItem {
  renderType: string;
  name: string;
  /** 图标：组件（优先，拷贝自旧版编辑器）或外链 URL */
  icon?: import("../schema/types").VueComponent | string;
  group?: string;
  category?: string;
  scaffold: Record<string, any>;
  props?: ComponentPropConfig[];
  events?: { name: string; title?: string }[];
  methods?: ComponentMethodConfig[];
  /** 槽位语义声明（宿主维度；单节点/白名单/显示名） */
  slots?: ComponentSlotConfig[];
}

export interface IComponentCatalog {
  getComponents: () => ComponentCatalogItem[];
  getGroups: () => { name: string; title: string }[];
  getCategories: (groupName: string) => { name: string; title: string }[];
}

// ═══════════════════════════════════════════════
// INestingRules — 嵌套校验
// ═══════════════════════════════════════════════

export interface INestingRules {
  canNest: (parentRenderType: string, slotKey: string, childRenderType: string) => boolean;
  getAllowedCategories: (parentRenderType: string, slotKey: string) => string[] | undefined;
  getCategory: (renderType: string) => string | undefined;
}

// ═══════════════════════════════════════════════
// ScenarioProfile — 场景档案
// ═══════════════════════════════════════════════

export interface ScenarioContext {
  editor: any;
  bus: any;
  skeleton: any;
  setterRegistry: any;
  componentRegistry: any;
}

export interface ScenarioProfile {
  readonly id: string;
  readonly name: string;
  readonly schemaOps: ISchemaOps;
  readonly createRenderer: () => IRenderer;
  readonly componentCatalog: IComponentCatalog;
  readonly nestingRules: INestingRules;
  readonly emptySchema: () => any;
  /**
   * 场景内置默认依赖清单（iframe 模式）。与宿主下发依赖（EditorOptions.renderDependencies）
   * 合并策略见 simulator/iframe/protocol.ts 的 mergeAssets：宿主项优先，内置兜底
   */
  readonly defaultRenderAssets?: import("../simulator/iframe/protocol").IframeAssetsManifest;
  /**
   * 悬停时槽位几何解析（多槽位组件的插槽识别，编辑器侧实现、渲染库零侵入）。
   * canvas-sensor 命中容器（data-editor-id + isContainer）后调用：
   * 按场景规则表定位槽位区域 DOM，判断命中元素 contained 于哪个区域 → slotKey。
   * 未实现/未登记/区域外返回 null → 传感器回退 defaultSlot。
   * 见 scenarios/pc-desktop/slot-dom/（按组件拆分的 resolver 注册表）
   */
  readonly resolveSlotKeyFromDom?: (
    renderType: string | undefined,
    containerEl: Element,
    hitEl: Element | null,
  ) => string | null;
  /** iframe 隔离渲染器工厂（可选，未提供时 iframe 模式降级为同 DOM）；入参为合并后的最终清单，缺省用渲染器内置默认 */
  readonly createIframeRenderer?: (assets?: import("../simulator/iframe/protocol").IframeAssetsManifest) => IRenderer;

  init?: (ctx: ScenarioContext) => void;
  destroy?: () => void;
}
