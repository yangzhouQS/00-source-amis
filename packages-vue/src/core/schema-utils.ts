import type { AmisSchema } from '@/types/schema';

let idSeed = 0;

/** 生成一个节点编辑器唯一 id */
export function generateEid(): string {
  idSeed += 1;
  return `n_${Date.now().toString(36)}_${idSeed}`;
}

/**
 * 深拷贝 schema。
 * 使用 JSON 方式以正确穿透 Vue 的 reactive Proxy（structuredClone 无法克隆 Proxy）。
 * amis schema 为纯 JSON 可序列化结构，因此安全。
 */
export function cloneSchema<T>(schema: T): T {
  return JSON.parse(JSON.stringify(schema));
}

/** 为 schema 树中缺失 $$eid 的节点补齐 */
export function assignIds(schema: AmisSchema): AmisSchema {
  walk(schema, node => {
    if (!node.$$eid) {
      node.$$eid = generateEid();
    }
  });
  return schema;
}

/** 剥离编辑器注入的内部字段，得到干净的 amis 源码 schema */
export function stripEditorKeys<T>(schema: T): T {
  const cloned = cloneSchema(schema);
  walk(cloned as unknown as AmisSchema, node => {
    delete node.$$eid;
  });
  return cloned;
}

/** 节点的子区域字段名集合（amis 常见容器字段） */
export const REGION_KEYS = [
  'body',
  'controls',
  'tabs',
  'items',
  'columns',
  'options',
  'buttons',
  'actions',
  'toolbar'
];

/** 遍历 schema 树，callback 作用于每个节点（含根） */
export function walk(
  schema: AmisSchema | undefined | null,
  cb: (node: AmisSchema) => void
): void {
  if (!schema || typeof schema !== 'object') return;
  cb(schema);
  for (const key of REGION_KEYS) {
    const child = (schema as any)[key];
    if (Array.isArray(child)) {
      child.forEach(c => walk(c, cb));
    } else if (child && typeof child === 'object') {
      walk(child, cb);
    }
  }
}

/** 解析路径为分段数组。'' 表示根节点 */
function parsePath(path: string | null | undefined): string[] {
  if (path == null || path === '') return [];
  return path.split('.');
}

/** 根据路径取节点。'' 为根节点 */
export function getByPath(
  schema: AmisSchema,
  path: string | null | undefined
): AmisSchema | undefined {
  const parts = parsePath(path);
  let cur: any = schema;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur as AmisSchema;
}

/** 取父节点与最后一段 key/index */
export function getParent(
  schema: AmisSchema,
  path: string
): { parent: AmisSchema; key: string } | undefined {
  const parts = parsePath(path);
  if (parts.length === 0) return undefined;
  const last = parts.pop()!;
  const parent = getByPath(schema, parts.join('.'));
  if (!parent) return undefined;
  return { parent, key: last };
}

/** 用 patch 浅合并到指定路径节点 */
export function assignByPath(
  schema: AmisSchema,
  path: string,
  patch: Record<string, any>
): void {
  const node = getByPath(schema, path);
  if (node) Object.assign(node, patch);
}

/** 在父节点的指定区域数组中插入子节点，index 缺省追加到末尾 */
export function insertChild(
  parent: AmisSchema,
  region: string,
  node: AmisSchema,
  index?: number
): void {
  let arr = (parent as any)[region];
  if (!Array.isArray(arr)) {
    arr = [];
    (parent as any)[region] = arr;
  }
  const at = typeof index === 'number' ? index : arr.length;
  arr.splice(at, 0, node);
}

/** 删除指定路径节点，返回是否删除成功 */
export function removeByPath(schema: AmisSchema, path: string): boolean {
  const info = getParent(schema, path);
  if (!info) return false;
  const { parent, key } = info;
  if (Array.isArray(parent)) {
    const idx = Number(key);
    if (Number.isNaN(idx) || idx < 0 || idx >= parent.length) return false;
    parent.splice(idx, 1);
    return true;
  }
  delete (parent as any)[key];
  return true;
}

/** 根据路径查找节点在同级数组中的 index */
export function indexOfPath(schema: AmisSchema, path: string): number {
  const info = getParent(schema, path);
  if (!info || !Array.isArray(info.parent)) return -1;
  return Number(info.key);
}
