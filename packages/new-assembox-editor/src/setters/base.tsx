/**
 * Setter 基础工具：provide/inject 上下文 + 通用渲染辅助
 */
import {inject, h, defineComponent, type PropType} from 'vue';
import {
  SETTER_CONTEXT_KEY,
  type SetterContext,
  type SetterProps
} from './types';

/** provide/inject key（re-export） */
export {SETTER_CONTEXT_KEY};

/** 注入 setter 上下文（复合 setter 用） */
export function useSetterCtx(): SetterContext | null {
  return inject<SetterContext | null>(SETTER_CONTEXT_KEY, null);
}

/** 标准化 options（兼容 {label,value}/string 两种格式） */
export function normalizeOptions(
  options?: any[]
): Array<{label: string; value: any; disabled?: boolean; children?: any[]}> {
  if (!Array.isArray(options)) return [];
  return options.map(item => {
    if (typeof item === 'string' || typeof item === 'number') {
      return {label: String(item), value: item};
    }
    return {
      label: item.label ?? item.title ?? String(item.value ?? '-'),
      value: item.value,
      disabled: item.disabled ?? false,
      children: Array.isArray(item.children)
        ? normalizeOptions(item.children)
        : undefined
    };
  });
}

/**
 * 通用 Setter 包装：统一处理 disabled/isPreview
 * 将 onChange 的值规范化后透传
 */
export function defineSetter<T = any>(
  name: string,
  render: (props: SetterProps<T>, ctx: SetterContext | null) => any
) {
  return defineComponent({
    name,
    props: {
      value: {type: null as any, default: undefined},
      defaultValue: {type: null as any, default: undefined},
      onChange: {type: Function as PropType<(v: T) => void>, required: true},
      placeholder: {type: String, default: ''},
      isPreview: {type: Boolean, default: false},
      disabled: {type: Boolean, default: false},
      fieldName: {type: String, default: ''}
    },
    setup(props) {
      const ctx = useSetterCtx();
      return () => render(props as SetterProps<T>, ctx);
    }
  });
}

/** 渲染只读预览态 */
export function renderPreview(value: any, placeholder = '—'): any {
  const text =
    value === undefined || value === null || value === ''
      ? placeholder
      : String(value);
  return h(
    'div',
    {
      class: 'assem-setter-preview',
      style: 'color:#909399;font-size:12px;padding:4px 0'
    },
    text
  );
}
