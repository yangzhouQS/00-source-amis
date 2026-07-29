/**
 * Title 组件（参考 lowcode-engine title 设计）
 * 渲染 label + 可选 tip；有 tip 时显示虚线下划线 + cursor help
 * 支持字符串 `{label}` 或对象 `{label, icon, tip, description, className}`
 */
import {defineComponent, type PropType} from 'vue';
import {Tip} from '../tip';
import './title.less';

export interface TitleConfig {
  label?: string;
  icon?: any;
  tip?: string;
  description?: string;
  className?: string;
}

export const Title = defineComponent({
  name: 'AssemTitle',
  props: {
    title: {
      type: [String, Object] as PropType<string | TitleConfig>,
      default: ''
    },
    placement: {
      type: String as PropType<'top' | 'right' | 'bottom' | 'left'>,
      default: 'right'
    }
  },
  setup(props, {slots}) {
    return () => {
      const t: TitleConfig =
        typeof props.title === 'string'
          ? {label: props.title}
          : (props.title as TitleConfig) || {};
      if (!t.label && !slots.default) return null;

      const tip = t.tip || t.description;
      const inner = (
        <span
          class={['assem-title', t.className, {'assem-title--has-tip': !!tip}]}
        >
          {slots.default?.() ?? <span class="assem-title__txt">{t.label}</span>}
        </span>
      );

      if (tip) {
        return (
          <Tip content={tip} placement={props.placement}>
            {() => inner}
          </Tip>
        );
      }
      return inner;
    };
  }
});
