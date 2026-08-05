/**
 * LabelSetter - read-only label display
 */
import { defineComponent } from "vue";

import { useAssemNamespace } from "../../hooks/use-assem-namespace";
import "./label-setter-style.less";

const ns = useAssemNamespace("label-setter");

export const LabelSetter = defineComponent({
  name: "LabelSetter",
  props: {
    value: { type: [String, Number], default: "" },
    onChange: { type: Function, default: () => {} },
  },
  setup(props) {
    return () => (
      <span class={ns.b()}>{String(props.value ?? "")}</span>
    );
  },
});
