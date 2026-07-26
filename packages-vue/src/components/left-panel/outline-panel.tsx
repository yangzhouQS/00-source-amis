import { defineComponent, computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { ElTree, ElEmpty, ElTag, ElIcon } from 'element-plus';
import {
  Top,
  Bottom,
  CopyDocument,
  Delete
} from '@element-plus/icons-vue';
import { useEditorStore } from '@/store/editor-store';
import { REGION_KEYS } from '@/core/schema-utils';
import type { AmisSchema } from '@/types/schema';

interface TreeNode {
  label: string;
  path: string;
  type: string;
  root: boolean;
  children: TreeNode[];
}

function toTreeNode(schema: AmisSchema, path: string, root: boolean): TreeNode {
  const label = schema.title || schema.name || schema.label || schema.type;
  const children: TreeNode[] = [];
  for (const region of REGION_KEYS) {
    const arr = (schema as any)[region];
    if (Array.isArray(arr)) {
      arr.forEach((child: AmisSchema, i: number) => {
        const childPath = path ? `${path}.${region}.${i}` : `${region}.${i}`;
        children.push(toTreeNode(child, childPath, false));
      });
    }
  }
  return { label, path, type: schema.type, root, children };
}

export default defineComponent({
  name: 'OutlinePanel',
  setup() {
    const store = useEditorStore();
    const { schema, selectedPath } = storeToRefs(store);
    const treeRef = ref<InstanceType<typeof ElTree>>();

    const treeData = computed<TreeNode[]>(() => [
      toTreeNode(schema.value, '', true)
    ]);

    watch(
      selectedPath,
      path => {
        const tree = treeRef.value as any;
        if (!tree) return;
        tree.setCurrentKey(path == null || path === '' ? null : path);
      },
      { immediate: true }
    );

    const handleNodeClick = (data: TreeNode) => store.select(data.path);
    const handleDelete = (data: TreeNode) => {
      if (data.root) return;
      store.removeNode(data.path);
    };
    const handleDuplicate = (data: TreeNode) => {
      if (data.root) return;
      store.duplicateNode(data.path);
    };
    const handleMove = (data: TreeNode, dir: -1 | 1) => {
      if (data.root) return;
      store.moveNode(data.path, dir);
    };
    const stop = (e: Event) => e.stopPropagation();

    return () => (
      <div class="amis-outline">
        <ElTree
          ref={treeRef}
          data={treeData.value}
          nodeKey="path"
          highlightCurrent
          defaultExpandAll
          expandOnClickNode
          currentNodeKey={selectedPath.value ?? ''}
          onNodeClick={handleNodeClick}
        >
          {{
            default: ({ data: node }: { data: TreeNode }) => (
              <span class="amis-outline__node">
                <span class="amis-outline__label">{node.label}</span>
                <ElTag size="small" type="info" effect="plain">
                  {node.type}
                </ElTag>
                {!node.root && (
                  <span class="amis-outline__actions">
                    <span
                      class="amis-outline__btn"
                      title="上移"
                      onClick={(e: Event) => {
                        stop(e);
                        handleMove(node, -1);
                      }}
                    >
                      <ElIcon><Top /></ElIcon>
                    </span>
                    <span
                      class="amis-outline__btn"
                      title="下移"
                      onClick={(e: Event) => {
                        stop(e);
                        handleMove(node, 1);
                      }}
                    >
                      <ElIcon><Bottom /></ElIcon>
                    </span>
                    <span
                      class="amis-outline__btn"
                      title="复制"
                      onClick={(e: Event) => {
                        stop(e);
                        handleDuplicate(node);
                      }}
                    >
                      <ElIcon><CopyDocument /></ElIcon>
                    </span>
                    <span
                      class="amis-outline__btn amis-outline__btn--danger"
                      title="删除"
                      onClick={(e: Event) => {
                        stop(e);
                        handleDelete(node);
                      }}
                    >
                      <ElIcon><Delete /></ElIcon>
                    </span>
                  </span>
                )}
              </span>
            )
          }}
        </ElTree>
        {treeData.value[0].children.length === 0 && (
          <ElEmpty description="暂无内容" imageSize={60} />
        )}
      </div>
    );
  }
});
