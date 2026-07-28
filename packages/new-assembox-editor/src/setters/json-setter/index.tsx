/**
 * JsonSetter - JSON editor (textarea + parse validation)
 */
import {ElInput, ElMessage} from 'element-plus';
import {defineComponent, computed} from 'vue';

export const JsonSetter = defineComponent({
  name: 'JsonSetter',
  props: {
    value: {type: null as any, default: undefined},
    onChange: {type: Function, required: true},
    disabled: {type: Boolean, default: false},
    rows: {type: Number, default: 6},
    placeholder: {type: String, default: ''}
  },
  setup(props) {
    const textValue = computed({
      get() {
        const v = props.value;
        if (v === undefined || v === null) return '';
        if (typeof v === 'string') return v;
        try {
          return JSON.stringify(v, null, 2);
        } catch {
          return String(v);
        }
      },
      set(val: string) {
        if (val === '') {
          props.onChange(undefined);
          return;
        }
        try {
          props.onChange(JSON.parse(val));
          ElMessage.success('JSON updated');
        } catch {
          ElMessage.warning('Invalid JSON, not saved');
        }
      }
    });

    return () => (
      <ElInput
        type="textarea"
        rows={props.rows}
        modelValue={textValue.value}
        disabled={props.disabled}
        placeholder={props.placeholder || 'Enter JSON'}
        onUpdate:modelValue={(v: string) => (textValue.value = v)}
        style="--el-input-font-family: monospace"
      />
    );
  }
});
