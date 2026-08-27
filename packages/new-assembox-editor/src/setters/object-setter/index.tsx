import type { PropConfig } from "../../schema/types";

/**
 * ObjectSetter - object editor
 * Renders child fields from config.items; child setters resolved via SetterRegistry
 *
 * 紧凑布局（窄面板场景，如格子配置）：
 * - labelWidth 可经 props 覆盖（默认 90px，格子场景声明 68px）
 * - items 支持 halfWidth: true 的字段两列网格排布（布尔/短枚举）
 */
import { defineComponent, h } from "vue";
import { useAssemNamespace } from "../../hooks/use-assem-namespace";
import { useSetterCtx } from "../base";
import { isFieldHidden, resolveSetter } from "../resolve";
import "./object-setter-style.less";

const ns = useAssemNamespace("object-setter");

export const ObjectSetter = defineComponent({
  name: "ObjectSetter",
  props: {
    value: { type: Object, default: () => ({}) },
    onChange: { type: Function, required: true },
    config: {
      type: Object as () => { items: PropConfig[] },
      default: () => ({ items: [] }),
    },
    disabled: { type: Boolean, default: false },
    /** 紧凑布局：内层 label 列宽（默认 90px；窄面板声明更小值如 "68px"） */
    labelWidth: { type: String, default: "90px" },
    /** 紧凑布局：halfWidth 字段两列网格（默认开；两列时 label 收窄建议配合小 labelWidth） */
    grid: { type: Boolean, default: true },
  },
  setup(props) {
    const ctx = useSetterCtx();
    return () => {
      const value
        = props.value && typeof props.value === "object" ? props.value : {};
      const items = props.config?.items ?? [];
      if (!items.length) {
        return <el-empty description="No field config" imageSize={50} />;
      }
      return (
        <div class={[ns.b(), { [ns.m("grid")]: props.grid }]}>
          <el-form labelWidth={props.labelWidth} disabled={props.disabled}>
            {items.map((prop) => {
              if (isFieldHidden(prop, value)) {
                return null;
              }
              const resolved = ctx?.setterRegistry
                ? resolveSetter(ctx.setterRegistry, prop)
                : null;
              const childValue = value[prop.name];
              const SetterComp = resolved?.component;
              return (
                <el-form-item
                  key={prop.name}
                  label={prop.title ?? prop.name}
                  class={prop.halfWidth ? ns.m("half") : undefined}
                >
                  {SetterComp
                    ? (
                        h(SetterComp, {
                          value: childValue,
                          defaultValue: prop.defaultValue,
                          disabled: props.disabled,
                          onChange: (v: any) => {
                            const next = { ...value, [prop.name]: v };
                            props.onChange(next);
                          },
                          ...resolved.setterProps,
                        })
                      )
                    : (
                        <span class="lc-assem-setter-missing">
                          no setter:
                          {" "}
                          {resolved?.setterName ?? "?"}
                        </span>
                      )}
                </el-form-item>
              );
            })}
          </el-form>
        </div>
      );
    };
  },
});
