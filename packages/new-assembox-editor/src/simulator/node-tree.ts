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

  /** 注册节点实例 */
  register(inst: NodeInstance): void {
    this.map.set(inst.$$id, inst);
    if (inst.parentId) this.parentMap.set(inst.$$id, inst.parentId);
  }

  /** 注销 */
  unregister(id: NodeId): void {
    this.map.delete(id);
    this.parentMap.delete(id);
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
  }

  /** 所有实例 */
  all(): NodeInstance[] {
    return Array.from(this.map.values());
  }
}
