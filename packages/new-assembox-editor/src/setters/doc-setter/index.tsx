/**
 * DocSetter - documentation link display
 */
import { defineComponent } from "vue";

import { useAssemNamespace } from "../../hooks/use-assem-namespace";
import "./doc-setter-style.less";

const ns = useAssemNamespace("doc-setter");

interface DocItem {
  docTitle: string;
  docUrl: string;
}

export const DocSetter = defineComponent({
  name: "DocSetter",
  props: {
    value: { type: [Array, Object], default: () => [] },
  },
  setup(props) {
    const renderDocItem = (item: DocItem) => (
      <div class={ns.e("item")}>
        <a
          href={item.docUrl}
          target="_blank"
          rel="noopener"
          class={ns.e("link")}
        >
          {item.docTitle}
        </a>
      </div>
    );
    return () => {
      if (!props.value) {
        return null;
      }
      const list = Array.isArray(props.value) ? props.value : [props.value];
      return <div class={ns.b()}>{list.map(renderDocItem)}</div>;
    };
  },
});
