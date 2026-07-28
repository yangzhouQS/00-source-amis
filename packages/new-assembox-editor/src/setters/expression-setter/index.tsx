/**
 * ExpressionSetter - JS expression editor ({{expr}} + context hints)
 */
import {defineComponent, ref, computed} from 'vue';
import {ElAutocomplete} from 'element-plus';

interface ExpressionValue {
  type: 'JSExpression';
  value: string;
}

const HELP_MAP: Record<string, string> = {
  this: 'container context object',
  state: 'container state',
  props: 'container props',
  schema: 'page context object',
  constants: 'app constants object',
  utils: 'app utils object'
};

export const ExpressionSetter = defineComponent({
  name: 'ExpressionSetter',
  props: {
    value: {type: null as any, default: undefined},
    onChange: {type: Function, required: true},
    contextKeys: {
      type: Array as () => string[],
      default: () => Object.keys(HELP_MAP)
    },
    disabled: {type: Boolean, default: false}
  },
  setup(props) {
    const isExpr = (v: any): v is ExpressionValue =>
      v && typeof v === 'object' && v.type === 'JSExpression';
    const inner = ref(
      isExpr(props.value)
        ? props.value.value
        : typeof props.value === 'string'
        ? props.value
        : ''
    );
    let timer: any = null;

    const suggestions = computed(() =>
      props.contextKeys.map(k => ({value: k, help: HELP_MAP[k] ?? ''}))
    );

    const querySearch = (query: string, cb: (items: any[]) => void) => {
      const q = (query || '').toLowerCase();
      const results = q
        ? suggestions.value.filter(s => s.value.toLowerCase().includes(q))
        : suggestions.value;
      cb(results);
    };

    const emit = (expr: string) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        props.onChange(expr ? {type: 'JSExpression', value: expr} : undefined);
      }, 300);
    };

    return () => (
      <div style="display:flex;align-items:center;gap:2px;width:100%">
        <span style="color:#909399">{'{{'}</span>
        <ElAutocomplete
          modelValue={inner.value}
          disabled={props.disabled}
          fetchSuggestions={querySearch}
          placeholder="JS expression"
          style="flex:1"
          onUpdate:modelValue={(v: any) => {
            inner.value = v;
            emit(v);
          }}
        >
          {{
            default: ({item}: {item: {value: string; help: string}}) => (
              <div style="display:flex;justify-content:space-between;width:100%">
                <span style="font-family:monospace">{item.value}</span>
                {item.help && (
                  <span style="color:#909399;font-size:12px">{item.help}</span>
                )}
              </div>
            )
          }}
        </ElAutocomplete>
        <span style="color:#909399">{'}}'}</span>
      </div>
    );
  }
});
