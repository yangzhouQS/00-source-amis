/**
 * 节点镜像树
 * 借鉴 amis-editor-core 的 EditorNode：渲染期构建，与 schema 双向派生
 * Host 维护 Map<$$id, NodeInstance>，用于选区、高亮几何、能力判断
 */
import type {PageNode, NodeId, RegionConfig} from '../schema/types';
import type {ComponentMeta} from '../schema/types';

export interface NodeInstance {
  $$id: NodeId;
  type: string;
  /** 父节点 id */
  parentId: NodeId | null;
  /** 所在 region key */
  parentRegion: string;
  /** schema 节点引用（响应式，随 store 更新） */
  node: PageNode;
  /** 组件元信息 */
  meta: ComponentMeta | undefined;
  /** 区域配置 */
  regions: RegionConfig[];
  /** DOM 根元素引用 */
  el: HTMLElement | null;
  /** 是否容器 */
  isContainer: boolean;
  /** 组件实例引用 */
  componentInstance: any;
}

export class NodeTree {
  private map = new Map<NodeId, NodeInstance>();
  private parentMap = new Map<NodeId, NodeId>();
  /** parentId → 子实例（索引，避免拖拽中全量遍历） */
  private childrenMap = new Map<NodeId, NodeInstance[]>();

  /** 注册节点实例 */
  register(inst: NodeInstance): void {
    this.map.set(inst.$$id, inst);
    if (inst.parentId) {
      this.parentMap.set(inst.$$id, inst.parentId);
      const arr = this.childrenMap.get(inst.parentId) ?? [];
      arr.push(inst);
      this.childrenMap.set(inst.parentId, arr);
    }
  }

  /** 注销 */
  unregister(id: NodeId): void {
    const inst = this.map.get(id);
    this.map.delete(id);
    this.parentMap.delete(id);
    if (inst?.parentId) {
      const arr = this.childrenMap.get(inst.parentId);
      if (arr) {
        const idx = arr.indexOf(inst);
        if (idx >= 0) arr.splice(idx, 1);
        if (arr.length === 0) this.childrenMap.delete(inst.parentId);
      }
    }
  }

  /** 获取 */
  get(id: NodeId): NodeInstance | undefined {
    return this.map.get(id);
  }

  /** 获取 DOM */
  getEl(id: NodeId): HTMLElement | null {
    return this.map.get(id)?.el ?? null;
  }

  /** 获取父 id */
  getParent(id: NodeId): NodeId | null {
    return this.parentMap.get(id) ?? null;
  }

  /** 更新 DOM 引用 */
  setEl(id: NodeId, el: HTMLElement | null): void {
    const inst = this.map.get(id);
    if (inst) inst.el = el;
  }

  /** 清空 */
  clear(): void {
    this.map.clear();
    this.parentMap.clear();
    this.childrenMap.clear();
  }

  /** 所有实例 */
  all(): NodeInstance[] {
    return Array.from(this.map.values());
  }

  /** 获取指定父节点的子实例（索引查询，O(1) + 子节点数） */
  getChildren(parentId: NodeId): NodeInstance[] {
    return this.childrenMap.get(parentId) ?? [];
  }
}
