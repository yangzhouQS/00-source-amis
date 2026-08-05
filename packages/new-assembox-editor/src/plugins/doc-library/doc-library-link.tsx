import { Link } from "@element-plus/icons-vue";
/**
 * 文档库链接（左侧图标，点击跳转外部文档）
 * 仅渲染为 icon + tooltip，新标签页打开文档库地址
 */
import { defineComponent } from "vue";
import { useAssemNamespace } from "../../hooks/use-assem-namespace";

const ns = useAssemNamespace("doc-link");

export const DocLibraryLink = defineComponent({
  name: "DocLibraryLink",
  props: {
    /** 文档库地址 */
    url: { type: String, default: "" },
  },
  setup(props) {
    const openDoc = () => {
      if (props.url) {
        window.open(props.url, "_blank", "noopener");
      }
    };
    return () => (
      <div
        class={ns.b()}
        title="组件文档库"
        onClick={openDoc}
      >
        <el-icon size={18}>
          <Link />
        </el-icon>
      </div>
    );
  },
});
