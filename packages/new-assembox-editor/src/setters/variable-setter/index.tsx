/**
 * VariableSetter - variable binding ({{expression}})
 */
import {defineComponent} from 'vue';
import {ElInput} from 'element-plus';

interface VariableValue {
  type: 'variable';
  value: string;
}

export const VariableSetter = defineComponent({
  name: 'VariableSetter',
  props: {
    value: {type: null as any, default: undefined},
    onChange: {type: Function, required: true},
    variables: {
      type: Array as () => Array<{label: string; value: string}>,
      default: () => []
    },
    disabled: {type: Boolean, default: false}
  },
  setup(props) {
    const isVar = (v: any): v is VariableValue =>
      v && typeof v === 'object' && v.type === 'variable';
    const getExpr = () => (isVar(props.value) ? props.value.value : '');
    const setExpr = (expr: string) => {
      props.onChange(expr ? {type: 'variable', value: expr} : undefined);
    };
    return () => (
      <ElInput
        modelValue={getExpr()}
        disabled={props.disabled}
        placeholder="Bind variable, e.g. this.state.foo"
        clearable
        onUpdate:modelValue={(v: string) => setExpr(v ?? '')}
      >
        {{
          prepend: () => <span style="color:#909399">{'{{'}</span>,
          append: () => <span style="color:#909399">{'}}'}</span>
        }}
      </ElInput>
    );
  }
});
