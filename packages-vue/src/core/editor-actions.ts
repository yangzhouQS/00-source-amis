import { useEditorStore } from '@/store/editor-store';
import { findComponent } from '@/core/component-registry';
import { getPrimaryRegion, hasRegions } from '@/core/plugin-host';
import { getByPath } from '@/core/schema-utils';

/**
 * 添加一个组件到 schema。
 * 目标容器解析规则：
 *   1. 显式传入的 parentPath；
 *   2. 否则当前选中节点（若它是可插入容器）；
 *   3. 否则回退到根节点（page）。
 */
export function addComponent(type: string, parentPath?: string): void {
  const store = useEditorStore();
  const item = findComponent(type);
  if (!item) return;

  let path = parentPath ?? store.selectedPath ?? '';
  let node = getByPath(store.schema, path);
  if (!node || !hasRegions(node.type)) {
    path = '';
    node = store.schema;
  }
  const region = getPrimaryRegion(node.type);
  store.insertNode(path, region, item.schema());
}
