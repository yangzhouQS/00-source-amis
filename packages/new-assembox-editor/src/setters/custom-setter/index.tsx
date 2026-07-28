/**
 * CustomSetter - custom render setter (render fn or component)
 */
import {defineComponent, h} from 'vue';

export const CustomSetter = defineComponent({
  name: 'CustomSetter',
  props: {
    value: {type: null as any, default: undefined},
    onChange: {type: Function, required: true},
    render: {type: Function, default: null},
    component: {type: [Object, Function], default: null},
    disabled: {type: Boolean, default: false}
  },
  setup(props) {
    return () => {
      if (typeof props.render === 'function') {
        return h('div', {class: 'assem-custom-setter'}, [
          props.render({
            value: props.value,
            onChange: props.onChange,
            disabled: props.disabled
          })
        ]);
      }
      if (props.component) {
        return h('div', {class: 'assem-custom-setter'}, [
          h(props.component as any, {
            value: props.value,
            onChange: props.onChange,
            disabled: props.disabled
          })
        ]);
      }
      return h(
        'div',
        {class: 'assem-custom-setter', style: 'color:#909399;font-size:12px'},
        'CustomSetter: no render/component configured'
      );
    };
  }
});
