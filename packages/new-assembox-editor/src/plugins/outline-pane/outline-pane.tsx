import type { Editor } from "../../core/editor";
import type { OutlineNode } from "../../core/store";
/**
 * 大纲树面板
 * 基于 schemaOps.walk 构建大纲树（格式无关），响应式渲染
 * 点击节点选中，支持展开/折叠
 */
import { computed, defineComponent, PropType } from "vue";
import { buildOutlineFromSchemaOps } from "../../core/store";
import { useAssemNamespace } from "../../hooks/use-assem-namespace";
import "./outline-pane-style.less";

const ns = useAssemNamespace("outline-pane");

export const OutlinePane = defineComponent({
  name: "OutlinePane",
  props: {
    editor: { type: Object as PropType<Editor>, required: true },
  },
  setup(props) {
    /** 树节点 props 配置 */
    const treeProps = {
      label: "label",
      children: "children",
    };

    /** 响应式大纲：依赖 store.schemaRef */
    const outlineData = computed<OutlineNode[]>(() => {
      void props.editor.store.schemaRef.value;
      const schema = props.editor.store.schema;
      return buildOutlineFromSchemaOps(schema, props.editor.schemaOps);
    });

    const handleNodeClick = (data: OutlineNode) => {
      props.editor.select(data.id);
    };

    return () => {
      const data = outlineData.value;
      if (!data.length) {
        return (
          <div class={ns.b()}>
            <el-empty description="暂无节点" imageSize={50} />
          </div>
        );
      }
      return (
        <div class={ns.b()}>
          <el-tree
            data={data}
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
  },
});
