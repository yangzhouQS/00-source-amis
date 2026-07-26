import type { EditorContext } from '@/types/editor-context';
import type { AmisSchema } from '@/types/schema';
import type { useEditorStore } from '@/store/editor-store';

/** 由 editorStore 构造供插件使用的受控上下文 */
export function createEditorContext(
  store: ReturnType<typeof useEditorStore>
): EditorContext {
  return {
    getSchema: () => store.schema,
    getSelectedPath: () => store.selectedPath,
    select: (path: string | null) => store.select(path),
    updateNode: (path: string, patch: Record<string, any>) =>
      store.updateNode(path, patch),
    insertNode: (
      parentPath: string,
      region: string,
      node: AmisSchema,
      index?: number
    ) => store.insertNode(parentPath, region, node, index),
    removeNode: (path: string) => store.removeNode(path)
  };
}
