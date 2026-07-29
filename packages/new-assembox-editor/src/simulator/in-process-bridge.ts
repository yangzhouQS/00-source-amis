/**
 * 进程内 Bridge（同 DOM 实现）
 * 直接操作 store.schema + node tree，无 iframe/postMessage 开销
 * 可替换为 IframeBridge（postMessage）以支持隔离/跨域
 */
import type {SimulatorBridge} from './bridge';
import type {NodeTree} from './node-tree';
import type {EditorStore} from '../core/store';
import * as ops from '../schema/operations';
import type {PageSchema, PageNode, NodeId} from '../schema/types';

export interface InProcessBridgeCallbacks {
  onClick: (nodeId: NodeId | null, e: MouseEvent) => void;
  onHover: (nodeId: NodeId | null) => void;
  onRenderReady?: () => void;
}

export class InProcessBridge implements SimulatorBridge {
  private renderReadyCbs: Array<() => void> = [];
  private dragged = false;

  constructor(
    private readonly store: EditorStore,
    private readonly tree: NodeTree,
    private readonly callbacks: InProcessBridgeCallbacks
  ) {}

  renderSchema(_schema: PageSchema): void {
    // 同 DOM 模式：schema 变更由响应式驱动重渲染，无需手动调用
    // 但需触发 ready 回调
    this.fireReady();
  }

  updateNode(nodeId: NodeId, patch: Partial<PageNode>): void {
    this.store.commit('update', schema => {
      ops.updateNode(schema, nodeId, patch);
    });
  }

  insertNode(
    parentId: NodeId,
    region: string,
    node: PageNode,
    index?: number
  ): void {
    this.store.commit('insert', schema => {
      ops.insertNode(schema, parentId, region, node, index);
    });
  }

  moveNode(
    nodeId: NodeId,
    toParentId: NodeId,
    region: string,
    index?: number
  ): void {
    this.store.commit('move', schema => {
      ops.moveNode(schema, nodeId, toParentId, region, index);
    });
  }

  removeNode(nodeId: NodeId): void {
    this.store.commit('delete', schema => {
      ops.removeNode(schema, nodeId);
    });
  }

  setDraggingState(active: boolean): void {
    this.dragged = active;
  }

  rerender(): void {
    // 同 DOM 模式：schema 变更由 store.schemaRef 响应式驱动重渲染，无需手动触发
  }

  onRenderReady(cb: () => void): void {
    this.renderReadyCbs.push(cb);
  }

  onNodeClick(nodeId: NodeId | null, e: MouseEvent): void {
    this.callbacks.onClick(nodeId, e);
  }

  onNodeHover(nodeId: NodeId | null): void {
    this.callbacks.onHover(nodeId);
  }

  getNodeTree(): NodeTree {
    return this.tree;
  }

  getRect(nodeId: NodeId): DOMRect | null {
    const el = this.tree.getEl(nodeId);
    return el ? el.getBoundingClientRect() : null;
  }

  private fireReady(): void {
    this.renderReadyCbs.forEach(cb => {
      try {
        cb();
      } catch (err) {
        console.error('[InProcessBridge] renderReady 回调出错:', err);
      }
    });
  }
}
