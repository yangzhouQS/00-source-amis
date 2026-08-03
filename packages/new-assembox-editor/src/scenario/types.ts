/**
 * 多场景可插拔渲染器接口定义
 * 设计文档: docs/10-多场景可插拔渲染器设计.md (v3)
 */

// ═══════════════════════════════════════════════
// ISchemaOps — Schema 树操作
// ═══════════════════════════════════════════════

export interface ISchemaOps {
  getNodeId(node: any): string;
  setNodeId(node: any, id: string): void;
  genNodeId(type: string): string;
  getNodeLabel(node: any): string;

  getNodeById(schema: any, id: string): any | undefined;
  getParentById(schema: any, id: string): any | undefined;
  walk(schema: any, visitor: (node: any, parent: any | null, slotKey: string) => void): void;
  getSlotChildren(parentNode: any, slotKey: string): any[];
  getSlots(node: any): { key: string; label: string }[];

  insertNode(schema: any, parentId: string, slotKey: string, node: any, index?: number): any | undefined;
  removeNode(schema: any, nodeId: string): any | undefined;
  moveNode(schema: any, nodeId: string, toParentId: string, slotKey: string, index?: number): boolean;
  updateNode(schema: any, nodeId: string, patch: any): any | undefined;
  cloneNode(node: any): any;
  cloneSchema(schema: any): any;

  createNode(renderType: string, nodeName: string, overrides?: any): any;
  emptySchema(): any;
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
}

export interface IRenderer {
  mount(container: HTMLElement, schema: any, options?: RendererMountOptions): Promise<void>;
  setSchema(schema: any): void;
  updateNode?(nodeId: string, patch: any): void;
  onStructureChange?(): void;
  setDraggingState(active: boolean): void;
  setDesignMode(mode: 'design' | 'preview'): void;
  dispose(): void;

  getNodeElement(nodeId: string): HTMLElement | null;
  getRect(nodeId: string): DOMRect | null;
  nodeIdFromElement(el: HTMLElement | null): string | null;

  getSlotMarkers(nodeId: string): SlotMarker[] | null;
  resolveFromElement(el: HTMLElement | null): { nodeId: string; slotKey: string } | null;

  onReady?(cb: () => void): void;
  onClick?(cb: (nodeId: string | null, e: MouseEvent) => void): void;
  onHover?(cb: (nodeId: string | null) => void): void;
}

// ═══════════════════════════════════════════════
// IComponentCatalog — 组件面板数据
// ═══════════════════════════════════════════════

export interface ComponentPropConfig {
  name: string;
  title?: string;
  propType: string;
  defaultValue?: any;
  setter?: string;
  setterProps?: Record<string, any>;
}

export interface ComponentCatalogItem {
  renderType: string;
  name: string;
  icon?: string;
  group?: string;
  category?: string;
  scaffold: Record<string, any>;
  props?: ComponentPropConfig[];
  events?: { name: string; title?: string }[];
}

export interface IComponentCatalog {
  getComponents(): ComponentCatalogItem[];
  getGroups(): { name: string; title: string }[];
  getCategories(groupName: string): { name: string; title: string }[];
}

// ═══════════════════════════════════════════════
// INestingRules — 嵌套校验
// ═══════════════════════════════════════════════

export interface INestingRules {
  canNest(parentRenderType: string, slotKey: string, childRenderType: string): boolean;
  getAllowedCategories(parentRenderType: string, slotKey: string): string[] | undefined;
  getCategory(renderType: string): string | undefined;
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

  init?(ctx: ScenarioContext): void;
  destroy?(): void;
}
