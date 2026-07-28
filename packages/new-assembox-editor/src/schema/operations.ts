/**
 * Schema 操作纯函数
 * 单一变更入口，所有 schema 写入都走这里，便于历史记录与事件触发
 */
import type {PageSchema, PageNode, NodeId} from './types';

/** 生成节点 id（短且唯一） */
export function genNodeId(prefix = 'n'): NodeId {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now()
    .toString(36)
    .slice(-4)}`;
}

/** 深克隆 schema */
export function cloneSchema<T>(schema: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(schema);
    } catch {
      /* fallthrough */
    }
  }
  return JSON.parse(JSON.stringify(schema));
}

/** 递归为缺失 $$id 的节点补 id */
export function ensureIds(node: PageNode, regenerate = false): PageNode {
  if (!node.$$id || regenerate) {
    node.$$id = genNodeId(node.type);
  }
  if (Array.isArray(node.body)) {
    node.body.forEach(child => ensureIds(child));
  }
  return node;
}

/** DFS 查找节点 by id */
export function getNodeById(
  schema: PageSchema | PageNode,
  id: NodeId
): PageNode | undefined {
  if (!schema) return undefined;
  if (schema.$$id === id) return schema;
  const children = getChildren(schema);
  for (const child of children) {
    const found = getNodeById(child as PageNode, id);
    if (found) return found;
  }
  return undefined;
}

/** 获取节点的所有子节点（合并 body + 其它数组型 region） */
export function getChildren(node: PageNode): PageNode[] {
  const result: PageNode[] = [];
  if (Array.isArray(node.body)) result.push(...node.body);
  // 兼容其它命名的子区域（如 tabs.children）
  for (const key of Object.keys(node)) {
    if (
      key === 'body' ||
      key === 'props' ||
      key === 'style' ||
      key === 'onEvent'
    )
      continue;
    const val = (node as any)[key];
    if (
      Array.isArray(val) &&
      val.length &&
      val[0] &&
      typeof val[0] === 'object' &&
      '$$id' in val[0]
    ) {
      result.push(...val);
    }
  }
  return result;
}

/** 查找父节点 by child id */
export function getParentById(
  schema: PageSchema | PageNode,
  id: NodeId
): PageNode | undefined {
  if (!schema) return undefined;
  const children = getChildren(schema);
  for (const child of children) {
    if (child.$$id === id) return schema;
    const found = getParentById(child, id);
    if (found) return found;
  }
  return undefined;
}

/** 查找子节点所在的 region key + index */
export function locateChild(
  parent: PageNode,
  childId: NodeId
): {region: string; index: number} | undefined {
  for (const key of Object.keys(parent)) {
    const val = (parent as any)[key];
    if (Array.isArray(val)) {
      const idx = val.findIndex((c: any) => c?.$$id === childId);
      if (idx >= 0) return {region: key, index: idx};
    }
  }
  return undefined;
}

/** 插入子节点到指定 region */
export function insertNode(
  schema: PageSchema,
  parentId: NodeId,
  region: string,
  node: PageNode,
  index?: number
): PageNode | undefined {
  const parent = getNodeById(schema, parentId);
  if (!parent) return undefined;
  const arr = (parent as any)[region];
  if (!Array.isArray(arr)) {
    (parent as any)[region] = [];
  }
  const target = (parent as any)[region] as PageNode[];
  ensureIds(node);
  const at =
    index === undefined
      ? target.length
      : Math.max(0, Math.min(index, target.length));
  target.splice(at, 0, node);
  return node;
}

/** 移除节点（返回被移除的节点） */
export function removeNode(
  schema: PageSchema,
  id: NodeId
): PageNode | undefined {
  const parent = getParentById(schema, id);
  if (!parent) return undefined;
  const loc = locateChild(parent, id);
  if (!loc) return undefined;
  const arr = (parent as any)[loc.region] as PageNode[];
  const [removed] = arr.splice(loc.index, 1);
  return removed;
}

/** 移动节点到目标 region 的 index */
export function moveNode(
  schema: PageSchema,
  nodeId: NodeId,
  toParentId: NodeId,
  region: string,
  index?: number
): boolean {
  const target = getNodeById(schema, toParentId);
  if (!target) return false;
  // 同父移动需要校正 index
  const oldParent = getParentById(schema, nodeId);
  const removed = removeNode(schema, nodeId);
  if (!removed) return false;
  let finalIndex = index;
  if (oldParent && oldParent.$$id === toParentId) {
    const loc = locateChild(target, nodeId);
    if (loc && index !== undefined && index > loc.index) {
      finalIndex = index - 1;
    }
  }
  insertNode(schema, toParentId, region, removed, finalIndex);
  return true;
}

/** 更新节点（合并 patch，深度合并 props/style/onEvent） */
export function updateNode(
  schema: PageSchema,
  id: NodeId,
  patch: Partial<PageNode>
): PageNode | undefined {
  const node = getNodeById(schema, id);
  if (!node) return undefined;
  if (patch.props) node.props = {...(node.props || {}), ...patch.props};
  if (patch.style) node.style = {...(node.style || {}), ...patch.style};
  if (patch.onEvent) node.onEvent = {...(node.onEvent || {}), ...patch.onEvent};
  if (patch.label !== undefined) node.label = patch.label;
  if (patch.body) node.body = patch.body;
  if (patch.type) node.type = patch.type;
  return node;
}

/** 节点上移 */
export function moveUp(schema: PageSchema, id: NodeId): boolean {
  const parent = getParentById(schema, id);
  if (!parent) return false;
  const loc = locateChild(parent, id);
  if (!loc || loc.index <= 0) return false;
  const arr = (parent as any)[loc.region] as PageNode[];
  [arr[loc.index - 1], arr[loc.index]] = [arr[loc.index], arr[loc.index - 1]];
  return true;
}

/** 节点下移 */
export function moveDown(schema: PageSchema, id: NodeId): boolean {
  const parent = getParentById(schema, id);
  if (!parent) return false;
  const loc = locateChild(parent, id);
  if (!loc) return false;
  const arr = (parent as any)[loc.region] as PageNode[];
  if (loc.index >= arr.length - 1) return false;
  [arr[loc.index + 1], arr[loc.index]] = [arr[loc.index], arr[loc.index + 1]];
  return true;
}

/** 克隆节点（生成新 id） */
export function cloneNode(node: PageNode): PageNode {
  const cloned = cloneSchema(node);
  reassignIds(cloned);
  return cloned;
}

/** 递归重新分配 id */
function reassignIds(node: PageNode): void {
  node.$$id = genNodeId(node.type);
  const children = getChildren(node);
  children.forEach(reassignIds);
}

/** 获取节点标题（大纲显示） */
export function getNodeLabel(node: PageNode): string {
  return node.label || node.props?.label || node.props?.title || node.type;
}

/** 获取祖先链（从根到节点） */
export function getAncestors(schema: PageSchema, id: NodeId): PageNode[] {
  const chain: PageNode[] = [];
  const find = (node: PageNode, path: PageNode[]): boolean => {
    const newPath = [...path, node];
    if (node.$$id === id) {
      chain.push(...newPath);
      return true;
    }
    for (const child of getChildren(node)) {
      if (find(child, newPath)) return true;
    }
    return false;
  };
  find(schema, []);
  return chain;
}
