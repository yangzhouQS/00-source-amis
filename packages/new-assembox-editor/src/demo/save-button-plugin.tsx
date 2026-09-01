import type { Editor } from "../core/editor";
import type { EditorPluginObject } from "../core/plugin-types";
import { FolderChecked } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { defineComponent } from "vue";
/**
 * 保存按钮插件（demo / 宿主可注册）
 *
 * 在编辑器顶部工具栏右侧（topArea align="right"）添加"保存"按钮：
 * - 点击：当前 schema 序列化写入 localStorage（key: assem-editor:saved:<id>）
 * - 刷新时：demo main.tsx 优先从 localStorage 读取保存的数据
 *
 * 通过 definePlugin + contributes.skeleton 注册 Widget，不侵入编辑器源码。
 * 宿主接入：editor.pluginManager.register(saveButtonPlugin).activate()
 */

const STORAGE_PREFIX = "assem-editor:saved:";

export function getSavedSchema(id: string): any | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + id);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSavedSchema(id: string): void {
  localStorage.removeItem(STORAGE_PREFIX + id);
}

/** 保存按钮（topArea 右侧 Widget） */
const SaveButton = defineComponent({
  name: "AssemSaveButton",
  props: {
    editor: { type: Object as () => Editor, required: true },
  },
  setup(props) {
    const saveId = "demo";
    const handleSave = () => {
      const schema = props.editor.schemaOps.cloneSchema(props.editor.store.schema);
      localStorage.setItem(STORAGE_PREFIX + saveId, JSON.stringify(schema));
      ElMessage.success("已保存到本地缓存");
    };
    return () => (
      <el-button
        size="small"
        type="primary"
        icon={FolderChecked}
        onClick={handleSave}
      >
        保存
      </el-button>
    );
  },
});

export const saveButtonPlugin: EditorPluginObject = {
  id: "demo-save-button",
  name: "保存按钮",
  priority: 100,
  scene: ["global"],
  contributes: {
    skeleton: [
      {
        area: "topArea",
        type: "Widget",
        name: "saveButton",
        content: SaveButton,
        props: { align: "right", title: "保存" },
        contentProps: {},
      },
    ],
  },
};
