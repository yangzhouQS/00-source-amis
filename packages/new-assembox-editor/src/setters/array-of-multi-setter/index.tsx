/**
 * ArrayOfMultiSetter - multi-select checkbox group
 */
import {defineComponent} from 'vue';
import {ElCheckboxGroup, ElCheckbox} from 'element-plus';
import {normalizeOptions} from '../base';

export const ArrayOfMultiSetter = defineComponent({
  name: 'ArrayOfMultiSetter',
  props: {
    value: {type: Array, default: () => []},
    onChange: {type: Function, required: true},
    options: {type: Array, default: () => []},
    disabled: {type: Boolean, default: false},
    direction: {type: String, default: 'column'}
  },
  setup(props) {
    return () => {
      const options = normalizeOptions(props.options);
      const current = Array.isArray(props.value) ? props.value : [];
      return (
        <ElCheckboxGroup
          modelValue={current as any}
          disabled={props.disabled}
          onUpdate:modelValue={(v: any) =>
            props.onChange(Array.isArray(v) ? v : [v])
          }
        >
          <div
            style={{
              display: 'flex',
              flexDirection: props.direction === 'row' ? 'row' : 'column',
              gap: '6px',
              flexWrap: 'wrap'
            }}
          >
            {options.map(opt => (
              <ElCheckbox
                key={String(opt.value)}
                value={opt.value}
                disabled={opt.disabled}
              >
                {opt.label}
              </ElCheckbox>
            ))}
          </div>
        </ElCheckboxGroup>
      );
    };
  }
});
