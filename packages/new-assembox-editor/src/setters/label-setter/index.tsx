/**
 * LabelSetter - read-only label display
 */
import {defineComponent} from 'vue';

export const LabelSetter = defineComponent({
  name: 'LabelSetter',
  props: {
    value: {type: [String, Number], default: ''},
    onChange: {type: Function, default: () => {}}
  },
  setup(props) {
    return () => (
      <span class="assem-label-setter">{String(props.value ?? '')}</span>
    );
  }
});
