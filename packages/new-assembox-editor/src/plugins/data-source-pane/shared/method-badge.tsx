/**
 * HTTP 方法徽标（get绿/post蓝/put橙/delete红/patch灰）
 */
import { defineComponent, PropType } from "vue";
import { useAssemNamespace } from "../../../hooks/use-assem-namespace";
import { METHOD_BADGE_COLORS } from "../constants";

const ns = useAssemNamespace("ds-method-badge");

export const DsMethodBadge = defineComponent({
  name: "DsMethodBadge",
  props: {
    method: { type: String as PropType<string>, default: "" },
  },
  setup(props) {
    return () => {
      const method = (props.method || "?").toLowerCase();
      const color = METHOD_BADGE_COLORS[method] ?? "#909399";
      return (
        <span
          class={ns.b()}
          style={{
            color,
            border: `1px solid ${color}`,
            background: `${color}14`,
          }}
        >
          {method.toUpperCase()}
        </span>
      );
    };
  },
});
