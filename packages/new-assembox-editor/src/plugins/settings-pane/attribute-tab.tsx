import type { Editor } from "../../core/editor";
/**
 * 属性 Tab
 * 按 catalog 组件 props 配置渲染 setter，变更通过 editor.updateProps 同步到画布（属性写入 __nodeOptions）
 */
import { computed, defineComponent, h, PropType } from "vue";
import { useAssemNamespace } from "../../hooks/use-assem-namespace";
import { isFieldHidden, resolveSetter } from "../../setters";

const ns = useAssemNamespace("setting-pane");

export const AttributeTab = defineComponent({
  name: "SettingsPaneAttributeTab",
  props: {
    editor: { type: Object as PropType<Editor>, required: true },
    propsList: { type: Array as () => any[], default: () => [] },
  },
  setup(props) {
    const activeNode = computed(() => props.editor.store.activeNode);

    /** 渲染单个 setter */
    const renderField = (propConfig: any) => {
      const node = activeNode.value;
      if (!node) {
        return null;
      }
      const nodeOptions = node.__nodeOptions ?? {};
      if (isFieldHidden(propConfig, nodeOptions)) {
        return null;
      }
      const resolved = resolveSetter(props.editor.setterRegistry, propConfig);
      const SetterComp = resolved.component;
      const currentValue = nodeOptions[propConfig.name];
      // labelVisible=false：复合 setter（格子配置等）自带结构，不占 label 列让内容全宽
      const hideLabel = propConfig.labelVisible === false;

      return (
        <el-form-item
          key={propConfig.name}
          label={hideLabel ? undefined : (propConfig.title ?? propConfig.name)}
          labelWidth={hideLabel ? "0px" : undefined}
        >
          {SetterComp
            ? (
                h(SetterComp, {
                  value: currentValue,
                  defaultValue: propConfig.defaultValue,
                  fieldName: propConfig.name,
                  onChange: (v: any) => {
                    props.editor.updateProps(node.__nodeId, { [propConfig.name]: v });
                  },
                  ...resolved.setterProps,
                })
              )
            : (
                <span class="assem-setter-missing">
                  无 setter:
                  {" "}
                  {resolved.setterName}
                </span>
              )}
        </el-form-item>
      );
    };

    return () => (
      <el-form labelWidth="80px" size="small">
        {props.propsList.length
          ? (
              props.propsList.map(renderField)
            )
          : (
              <el-empty description="无可配置属性" imageSize={50} />
            )}
      </el-form>
    );
  },
});
