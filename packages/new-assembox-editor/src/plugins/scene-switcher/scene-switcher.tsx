import type { PropType } from "vue";
/**
 * 场景切换器（顶部工具栏 Widget）
 * 下拉选择当前编辑的场景（uiSkeleton 顶层 key），
 * 切换后画布 + 大纲树响应更新
 */
import type { Editor } from "../../core/editor";
import { computed, defineComponent } from "vue";
import { useAssemNamespace } from "../../hooks/use-assem-namespace";

const ns = useAssemNamespace("scene-switcher");

export const SceneSwitcher = defineComponent({
  name: "SceneSwitcher",
  props: {
    editor: { type: Object as PropType<Editor>, required: true },
  },
  setup(props) {
    const sceneOptions = computed(() => {
      void props.editor.store.schemaRef.value;
      return props.editor.getScenes().map(name => ({
        value: name,
        label: name,
      }));
    });

    const handleSceneChange = (name: string) => {
      props.editor.setScene(name);
    };

    return () => {
      const options = sceneOptions.value;
      if (options.length <= 1) {
        return null;
      }
      return (
        <div class={ns.b()}>
          <el-select
            modelValue={props.editor.activeScene}
            size="small"
            style="width: 140px"
            onChange={handleSceneChange}
          >
            {options.map(opt => (
              <el-option key={opt.value} value={opt.value} label={opt.label} />
            ))}
          </el-select>
        </div>
      );
    };
  },
});
