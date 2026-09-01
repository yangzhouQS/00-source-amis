import type { Editor } from "../../core/editor";
/**
 * 设置面板（属性/样式/事件/高级 Tab）
 * 选区驱动：读取 store.activeNode，各 Tab 内容拆分至 *-tab.tsx
 * 变更通过 editor.updateProps / editor.update 同步到画布
 */
import { computed, defineComponent, provide, PropType } from "vue";
import { useAssemNamespace } from "../../hooks/use-assem-namespace";
import { SETTER_CONTEXT_KEY } from "../../setters";
import { AdvancedTab } from "./advanced-tab";
import { AttributeTab } from "./attribute-tab";
import { EventTab } from "./event-tab";
import "./setting-pane-style.less";
import { StyleTab } from "./style-tab";

const ns = useAssemNamespace("setting-pane");

export const SettingsPane = defineComponent({
  name: "SettingsPane",
  props: {
    editor: { type: Object as PropType<Editor>, required: true },
  },
  setup(props) {
    const activeNode = computed(() => props.editor.store.activeNode);
    const catalogItem = computed(() => {
      const node = activeNode.value;
      if (!node) {
        return undefined;
      }
      const renderType = node.__nodeOptions?.renderType;
      return props.editor.catalog
        .getComponents()
        .find(c => c.renderType === renderType);
    });

    /** 提供 SetterContext 给复合 setter（Object/Array/Style 等解析子 setter） */
    provide(SETTER_CONTEXT_KEY, {
      get editor() {
        return props.editor;
      },
      get setterRegistry() {
        return props.editor.setterRegistry;
      },
      get nodeId() {
        return activeNode.value?.__nodeId;
      },
    });

    return () => {
      const node = activeNode.value;
      if (!node) {
        return (
          <div class={ns.b()}>
            <el-empty description="请选择组件" imageSize={60} />
          </div>
        );
      }
      const m = catalogItem.value;

      return (
        <div class={ns.b()}>
          <div class={ns.e("header")}>
            <span class={ns.e("title")}>{m?.name ?? node.__nodeName}</span>
            <span class={ns.e("type")}>{node.__nodeOptions?.renderType}</span>
          </div>
          <div class={ns.e("content")}>
            <el-tabs modelValue="attribute">
              <el-tab-pane label="属性" name="attribute">
                <AttributeTab editor={props.editor} propsList={m?.props ?? []} />
              </el-tab-pane>
              <el-tab-pane label="样式" name="style">
                <StyleTab editor={props.editor} />
              </el-tab-pane>
              <el-tab-pane label="事件" name="event">
                <EventTab editor={props.editor} events={m?.events ?? []} />
              </el-tab-pane>
              <el-tab-pane label="高级" name="advanced">
                <AdvancedTab editor={props.editor} nodeId={node.__nodeId} />
              </el-tab-pane>
            </el-tabs>
          </div>
        </div>
      );
    };
  },
});
