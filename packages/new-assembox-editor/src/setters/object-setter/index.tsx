/**
 * ObjectSetter - object editor
 * Renders child fields from config.items; child setters resolved via SetterRegistry
 */
import {defineComponent, h} from 'vue';
import {ElForm, ElFormItem, ElEmpty} from 'element-plus';
import {useSetterCtx} from '../base';
import {resolveSetter, isFieldHidden} from '../resolve';
import type {PropConfig} from '../../schema/types';
import './../composite.less';

export const ObjectSetter = defineComponent({
  name: 'ObjectSetter',
  props: {
    value: {type: Object, default: () => ({})},
    onChange: {type: Function, required: true},
    config: {
      type: Object as () => {items: PropConfig[]},
      default: () => ({items: []})
    },
    disabled: {type: Boolean, default: false}
  },
  setup(props) {
    const ctx = useSetterCtx();
    return () => {
      const value =
        props.value && typeof props.value === 'object' ? props.value : {};
      const items = props.config?.items ?? [];
      if (!items.length) {
        return <ElEmpty description="No field config" imageSize={50} />;
      }
      return (
        <div class="assem-object-setter">
          <ElForm labelWidth="90px" size="small" disabled={props.disabled}>
            {items.map(prop => {
              if (isFieldHidden(prop, value)) return null;
              const resolved = ctx?.setterRegistry
                ? resolveSetter(ctx.setterRegistry, prop)
                : null;
              const childValue = value[prop.name];
              const SetterComp = resolved?.component;
              return (
                <ElFormItem key={prop.name} label={prop.title ?? prop.name}>
                  {SetterComp ? (
                    h(SetterComp, {
                      value: childValue,
                      defaultValue: prop.defaultValue,
                      disabled: props.disabled,
                      onChange: (v: any) => {
                        const next = {...value, [prop.name]: v};
                        props.onChange(next);
                      },
                      ...resolved.setterProps
                    })
                  ) : (
                    <span class="assem-setter-missing">
                      no setter: {resolved?.setterName ?? '?'}
                    </span>
                  )}
                </ElFormItem>
              );
            })}
          </ElForm>
        </div>
      );
    };
  }
});
