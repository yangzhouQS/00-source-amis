/**
 * 大纲树面板
 * 基于 store.outline（响应式）渲染节点树
 * 点击节点选中，支持展开/折叠
 */
import {defineComponent, PropType, ref} from 'vue';
import {ElTree} from 'element-plus';
import type {Editor} from '../../core/editor';
import type {OutlineNode} from '../../core/store';
import {useAssemNamespace} from '../../hooks/use-assem-namespace';
import './../pane.less';

const ns = useAssemNamespace('outline-pane');

export const OutlinePane = defineComponent({
  name: 'OutlinePane',
  props: {
    editor: {type: Object as PropType<Editor>, required: true}
  },
  setup(props) {
    const expandedKeys = ref<string[]>([]);

    /** 树节点 props 配置 */
    const treeProps = {
      label: 'label',
      children: 'children'
    };

    const handleNodeClick = (data: OutlineNode) => {
      props.editor.select(data.id);
    };

    return () => {
      const data = props.editor.store.outline.value;
      return (
        <div class={ns.b()}>
          <ElTree
            data={[data]}
            props={treeProps}
            nodeKey="id"
            defaultExpandAll
            highlightCurrent
            currentNodeKey={props.editor.store.state.activeId ?? undefined}
            onNode-click={handleNodeClick}
          />
        </div>
      );
    };
  }
});
