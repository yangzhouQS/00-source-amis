import type { Editor } from "../../core/editor";
/**
 * 样式 Tab
 * StyleSetter 编辑 __nodeStyle，变更通过 editor.update 同步到画布
 */
import { computed, defineComponent, PropType } from "vue";
import { StyleSetter } from "../../setters/style-setter";

export const StyleTab = defineComponent({
  name: "SettingsPaneStyleTab",
  props: {
    editor: { type: Object as PropType<Editor>, required: true },
  },
  setup(props) {
    const activeNode = computed(() => props.editor.store.activeNode);

    return () => {
      const node = activeNode.value;
      if (!node) {
        return <el-empty description="请选择组件" imageSize={50} />;
      }
      return (
        <StyleSetter
          value={node.__nodeStyle ?? {}}
          onChange={(v: Record<string, any>) => {
            props.editor.update(node.__nodeId, { __nodeStyle: v });
          }}
        />
      );
    };
  },
});
