import type { AmisSchema } from './schema';

/**
 * 编辑器上下文，提供给插件操作编辑器状态的受控接口。
 * Phase 6 实现 createEditorContext(store)。
 */
export interface EditorContext {
  /** 获取当前整棵 schema */
  getSchema: () => AmisSchema;
  /** 当前选中节点的路径，'' 表示根节点，null 表示未选中 */
  getSelectedPath: () => string | null;
  /** 选中某个路径的节点 */
  select: (path: string | null) => void;
  /** 用 patch 更新指定路径节点 */
  updateNode: (path: string, patch: Record<string, any>) => void;
  /** 在父节点的指定区域插入子节点 */
  insertNode: (
    parentPath: string,
    region: string,
    node: AmisSchema,
    index?: number
  ) => void;
  /** 删除指定路径节点 */
  removeNode: (path: string) => void;
}
