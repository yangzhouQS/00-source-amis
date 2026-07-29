/**
 * 模拟器 Bridge 通信契约
 * 取代旧版 4 条通信通道（DI notify + eventBus + globalBus + direct refs + CustomEvent）
 * 统一为单一 Bridge 接口。实现：InProcessBridge（同 DOM）或 IframeBridge（postMessage）
 */
import type {PageSchema, PageNode, NodeId} from '../schema/types';
import type {NodeTree} from './node-tree';

export interface SimulatorBridge {
  /** Host → Renderer */
  /** 渲染整棵 schema */
  renderSchema(schema: PageSchema): void;
  /** 更新单个节点 */
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
  /** 设置拖拽态（禁止 iframe 内交互/选区） */
  setDraggingState(active: boolean): void;
  /** 重新渲染 */
  rerender(): void;

  /** Renderer → Host 回调 */
  onRenderReady(cb: () => void): void;
  onNodeClick(nodeId: NodeId | null, e: MouseEvent): void;
  onNodeHover(nodeId: NodeId | null): void;

  /** 获取节点树 */
  getNodeTree(): NodeTree;
  /** 获取节点 DOM 几何 */
  getRect(nodeId: NodeId): DOMRect | null;
  /** 销毁（释放 iframe / 事件监听等资源，幂等） */
  dispose?(): void;
}
