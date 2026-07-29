import {useAssemNamespace} from '../../hooks/use-assem-namespace';
const ns = useAssemNamespace('doc-setter');

/**
 * DocSetter - documentation link display
 */
import {defineComponent} from 'vue';

interface DocItem {
  docTitle: string;
  docUrl: string;
}

export const DocSetter = defineComponent({
  name: 'DocSetter',
  props: {
    value: {type: [Array, Object], default: () => []}
  },
  setup(props) {
    const renderDocItem = (item: DocItem) => (
      <div class="assem-doc-item">
        <a
          href={item.docUrl}
          target="_blank"
          rel="noopener"
          class="assem-doc-link"
        >
          {item.docTitle}
        </a>
      </div>
    );
    return () => {
      if (!props.value) return null;
      const list = Array.isArray(props.value) ? props.value : [props.value];
      return <div class="assem-doc-setter">{list.map(renderDocItem)}</div>;
    };
  }
});
