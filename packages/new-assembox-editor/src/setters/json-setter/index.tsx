/**
 * JsonSetter - JSON editor (Monaco，语法高亮 + 校验)
 * 替换原 textarea：Monaco 自带 JSON 语法错误标记，有效时才 onChange
 */
import {VueMonacoEditor} from '@guolao/vue-monaco-editor';
import {defineComponent, ref, watch} from 'vue';

const toString = (v: unknown): string => {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
};

export const JsonSetter = defineComponent({
  name: 'JsonSetter',
  props: {
    value: {type: null as any, default: undefined},
    onChange: {type: Function, required: true},
    disabled: {type: Boolean, default: false},
    rows: {type: Number, default: 6}
  },
  setup(props) {
    const text = ref(toString(props.value));

    // 外部 value 变化 → 同步编辑器（避免覆盖用户正在编辑的内容）
    watch(
      () => props.value,
      v => {
        const fresh = toString(v);
        if (fresh !== text.value) text.value = fresh;
      }
    );

    const onInput = (val: string) => {
      text.value = val;
      if (val === '') {
        props.onChange(undefined);
        return;
      }
      // 仅 JSON 有效时才回写（无效时 Monaco 自带语法错误标记，不弹提示）
      try {
        props.onChange(JSON.parse(val));
      } catch {
        /* JSON 不完整，忽略，等待用户修正 */
      }
    };

    return () => (
      <div style={{height: `${props.rows * 18 + 8}px`, width: '100%'}}>
        <VueMonacoEditor
          value={text.value}
          onUpdate:value={onInput}
          language="json"
          theme="vs"
          options={{
            minimap: {enabled: false},
            fontSize: 12,
            automaticLayout: true,
            readOnly: props.disabled,
            scrollBeyondLastLine: false,
            lineNumbers: 'off',
            lineDecorationsWidth: 6,
            padding: {top: 4}
          }}
        />
      </div>
    );
  }
});
