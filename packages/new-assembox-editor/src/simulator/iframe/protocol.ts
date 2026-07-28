/**
 * iframe 模拟器标准接口协议
 *
 * 设计参考 lowcode-engine 的 host/renderer 双进程模型，但：
 * - 通信层抽象为 SimulatorHostApi / SimulatorRendererApi 双向接口（可同源直引，也可 postMessage）
 * - DOM 标记用 data-editor-id（可 querySelector），取代 lowcode 的 React fiber + SYMBOL_VNID
 *
 * ┌─ HOST (top window) ─────────────┐         ┌─ IFRAME (canvas.html) ────────────┐
 * │ IframeBridge                     │ 直引/   │ IframeSimulatorRenderer            │
 * │   实现 SimulatorBridge           │ postMsg │   实现 SimulatorRendererApi        │
 * │   持有 hostApi (SimulatorHostApi)│◄───────►│   持有 renderer 引用               │
 * │ BemTools 覆盖层（兄弟层）         │         │ SchemaRenderer + data-editor-id    │
 * └──────────────────────────────────┘         └────────────────────────────────────┘
 */

import type {PageSchema, PageNode, NodeId} from '../../schema/types';
import type {NodeInstance} from '../node-tree';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ════════════════════════════════════════════════════════════════
// 一、消息协议（postMessage 序列化用，同源直引时也可直接调方法）
// ════════════════════════════════════════════════════════════════

/** 协议命名空间前缀，避免与其它 postMessage 冲突 */
export const PROTOCOL_NS = 'assem:sim';

/** Host → Renderer 命令类型 */
export const HOST_CMD = {
  INIT: 'init', // 初始化：schema + 组件映射 + 依赖
  RENDER_SCHEMA: 'render-schema', // 全量重渲染
  UPDATE_NODE: 'update-node', // 更新节点（props/style/onEvent 合并）
  INSERT_NODE: 'insert-node', // 插入子节点
  MOVE_NODE: 'move-node', // 移动节点
  REMOVE_NODE: 'remove-node', // 移除节点
  SET_DRAGGING: 'set-dragging', // 设置拖拽态（禁用画布交互/选区）
  SET_COMPONENTS: 'set-components', // 动态更新组件映射
  SET_DESIGN_MODE: 'set-design-mode', // 设计/预览模式切换
  RERENDER: 'rerender', // 强制重渲染
  GET_RECT: 'get-rect', // 查询节点几何（请求）
  GET_INSTANCE_TREE: 'get-instance-tree' // 查询实例树（请求）
} as const;

/** Renderer → Host 事件类型 */
export const RENDERER_EVT = {
  READY: 'ready', // 渲染器就绪
  NODE_CLICK: 'node-click', // 节点点击
  NODE_HOVER: 'node-hover', // 节点悬浮
  INSTANCES_UPDATED: 'instances-updated', // 实例树变更
  RECT: 'rect', // 几何查询响应
  INSTANCE_TREE: 'instance-tree', // 实例树查询响应
  SCROLL: 'scroll', // 画布滚动
  RESIZE: 'resize', // 画布尺寸变化
  ERROR: 'error' // 渲染器错误
} as const;

/** Host → Renderer 命令消息 */
export interface HostMessage {
  type: (typeof HOST_CMD)[keyof typeof HOST_CMD];
  id?: string; // 请求 id（用于请求-响应配对）
  payload?: any;
}

/** Renderer → Host 事件消息 */
export interface RendererMessage {
  type: (typeof RENDERER_EVT)[keyof typeof RENDERER_EVT];
  id?: string;
  payload?: any;
}

/** 协议信封（postMessage data） */
export interface ProtocolEnvelope {
  ns: typeof PROTOCOL_NS;
  from: 'host' | 'renderer';
  message: HostMessage | RendererMessage;
}

/** 组件映射项：node.type → iframe 内全局组件名 + 容器标记 */
export interface ComponentMapping {
  /** 节点 type */
  type: string;
  /** iframe 内全局注册的组件名（如 ElButton）；为空表示纯文本/自定义渲染 */
  globalName?: string;
  /** 是否容器（可投放子节点） */
  isContainer?: boolean;
}

/** 初始化载荷 */
export interface InitPayload {
  schema: PageSchema;
  /** 组件映射（type → globalName） */
  components: ComponentMapping[];
  designMode?: 'design' | 'preview';
  /** 平台 */
  platform?: 'desktop' | 'mobile';
}

// ════════════════════════════════════════════════════════════════
// 二、双向 API 接口（同源直引时直接实现，跨源时由 postMessage 桥接）
// ════════════════════════════════════════════════════════════════

/**
 * Renderer 端实现的能力（Host 调用）
 * 对标 lowcode IPublicTypeSimulatorRenderer，适配 Vue + data-editor-id
 */
export interface SimulatorRendererApi {
  readonly isSimulatorRenderer: true;

  /** 初始化（schema + 组件映射 + 模式），并挂载渲染 */
  init(payload: InitPayload): void;
  /** 渲染整棵 schema */
  renderSchema(schema: PageSchema): void;
  /** 更新单个节点（深度合并 props/style/onEvent） */
  updateNode(nodeId: NodeId, patch: Partial<PageNode>): void;
  /** 插入节点 */
  insertNode(
    parentId: NodeId,
    region: string,
    node: PageNode,
    index?: number
  ): void;
  /** 移动节点 */
  moveNode(
    nodeId: NodeId,
    toParentId: NodeId,
    region: string,
    index?: number
  ): void;
  /** 移除节点 */
  removeNode(nodeId: NodeId): void;
  /** 设置拖拽态（拖拽时禁用 iframe 交互与选区高亮） */
  setDraggingState(active: boolean): void;
  /** 设置原生选区（属性面板聚焦输入时禁用画布选区） */
  setNativeSelection(enable: boolean): void;
  /** 设置设计/预览模式 */
  setDesignMode(mode: 'design' | 'preview'): void;
  /** 动态更新组件映射 */
  setComponents(components: ComponentMapping[]): void;
  /** 强制重渲染 */
  rerender(): void;
  /** 获取节点 DOM 几何（用于覆盖层定位） */
  getRect(nodeId: NodeId): DOMRect | null;
  /** 获取当前实例树 */
  getInstanceTree(): NodeInstance[];
  /** 销毁 */
  dispose(): void;
}

/**
 * Host 端暴露给 Renderer 的能力（Renderer 调用）
 * Renderer 通过 host 回报事件/状态
 */
export interface SimulatorHostApi {
  readonly isSimulatorHost: true;
  /** 渲染器就绪通知 */
  onRendererReady(): void;
  /** 节点点击 */
  onNodeClick(nodeId: NodeId | null, originalEvent?: any): void;
  /** 节点悬浮 */
  onNodeHover(nodeId: NodeId | null): void;
  /** 实例树变更 */
  onInstancesUpdated(instances: NodeInstance[]): void;
  /** 画布滚动 */
  onScroll(scrollX: number, scrollY: number): void;
  /** 画布尺寸变化 */
  onResize(): void;
  /** 渲染器错误 */
  onError(error: string, detail?: any): void;
}

/** 信封构造助手 */
export function envelope(
  from: 'host' | 'renderer',
  message: HostMessage | RendererMessage
): ProtocolEnvelope {
  return {ns: PROTOCOL_NS, from, message};
}

/** 判断是否为协议信封 */
export function isProtocolEnvelope(data: any): data is ProtocolEnvelope {
  return data && typeof data === 'object' && data.ns === PROTOCOL_NS;
}
