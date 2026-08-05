import type { PropType } from "vue";
/**
 * 场景切换器（顶部工具栏 Widget）
 * 下拉选择当前编辑的场景（uiSkeleton 顶层 key），
 * 切换后画布 + 大纲树响应更新。
 * 支持新增页面 / 删除页面（多路由页面管理）。
 */
import type { Editor } from "../../core/editor";
import { ElMessage, ElMessageBox } from "element-plus";
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

    const handleAddScene = async () => {
      try {
        const { value } = await ElMessageBox.prompt(
          "请输入页面名称（字母开头，仅含字母数字和连字符）",
          "新建页面",
          {
            inputPattern: /^[a-zA-Z][\w-]*$/,
            inputErrorMessage: "名称需以字母开头，只能包含字母数字和连字符",
            confirmButtonText: "确定",
            cancelButtonText: "取消",
          },
        );
        const ok = props.editor.addScene(value);
        if (!ok) {
          ElMessage.warning("页面名称已存在或创建失败");
        }
      } catch {
        // 用户取消
      }
    };

    const handleRemoveScene = async () => {
      const current = props.editor.activeScene;
      if (sceneOptions.value.length <= 1) {
        ElMessage.warning("至少保留一个页面");
        return;
      }
      try {
        await ElMessageBox.confirm(
          `确定删除页面「${current}」吗？删除后历史记录将清空。`,
          "删除页面",
          {
            type: "warning",
            confirmButtonText: "删除",
            cancelButtonText: "取消",
          },
        );
        const ok = props.editor.removeScene(current);
        if (!ok) {
          ElMessage.warning("删除失败");
        }
      } catch {
        // 用户取消
      }
    };

    return () => {
      const options = sceneOptions.value;
      if (options.length === 0) {
        return null;
      }
      return (
        <div class={ns.b()} style="display: flex; align-items: center; gap: 4px; flex-shrink: 0; white-space: nowrap;">
          <el-select
            modelValue={props.editor.activeScene}
            size="small"
            style="width: 120px; flex-shrink: 0;"
            onChange={handleSceneChange}
          >
            {options.map(opt => (
              <el-option key={opt.value} value={opt.value} label={opt.label} />
            ))}
          </el-select>
          <el-button
            size="small"
            icon="Plus"
            title="新建页面"
            onClick={handleAddScene}
          />
          {options.length > 1 && (
            <el-button
              size="small"
              icon="Delete"
              title="删除当前页面"
              onClick={handleRemoveScene}
            />
          )}
        </div>
      );
    };
  },
});
