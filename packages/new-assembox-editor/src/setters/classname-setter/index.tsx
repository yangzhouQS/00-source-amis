/**
 * ClassNameSetter - CSS class name multi-select (tag mode)
 */
import {defineComponent} from 'vue';
import {ElSelect, ElOption} from 'element-plus';

export const ClassNameSetter = defineComponent({
  name: 'ClassNameSetter',
  props: {
    value: {type: String, default: ''},
    onChange: {type: Function, required: true},
    classNameList: {type: Array as () => string[], default: () => []},
    allowCreate: {type: Boolean, default: true},
    disabled: {type: Boolean, default: false}
  },
  setup(props) {
    return () => {
      const selected = (props.value || '').split(/\s+/).filter(Boolean);
      const options = Array.from(
        new Set([...props.classNameList, ...selected])
      );
      return (
        <ElSelect
          modelValue={selected}
          multiple
          filterable
          clearable
          disabled={props.disabled}
          allowCreate={props.allowCreate}
          defaultFirstOption
          placeholder="Select or type class name"
          style="width:100%"
          onUpdate:modelValue={(v: any) =>
            props.onChange(Array.isArray(v) ? v.join(' ') : String(v))
          }
        >
          {options.map(cls => (
            <ElOption key={cls} label={cls} value={cls} />
          ))}
        </ElSelect>
      );
    };
  }
});
