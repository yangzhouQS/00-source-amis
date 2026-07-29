import {useAssemNamespace} from '../../hooks/use-assem-namespace';
const ns = useAssemNamespace('array-setter');

/**
 * ArraySetter - array editor (add/remove/sort items, itemSetter for children)
 */
import {defineComponent, h, ref} from 'vue';
import {ElButton, ElEmpty} from 'element-plus';
import {Plus, Delete, Rank} from '@element-plus/icons-vue';
import {useSetterCtx} from '../base';
import './../composite.less';
import type {PropConfig} from '../../schema/types';

interface ListItemConfig {
  setter?: string;
  config?: {items: PropConfig[]};
  initialValue?: any;
  props?: Record<string, any>;
}

export const ArraySetter = defineComponent({
  name: 'ArraySetter',
  props: {
    value: {type: Array, default: () => []},
    onChange: {type: Function, required: true},
    itemSetter: {type: [String, Object] as any, default: 'StringSetter'},
    itemConfig: {
      type: Object as () => {items: PropConfig[]},
      default: undefined
    },
    initialValue: {type: null as any, default: ''},
    itemMaxLength: {type: Number, default: undefined},
    disabled: {type: Boolean, default: false},
    mode: {type: String, default: 'list'}
  },
  setup(props) {
    const ctx = useSetterCtx();
    const draggingIndex = ref<number | null>(null);

    const getInitial = () => {
      if (props.initialValue !== undefined && props.initialValue !== '')
        return JSON.parse(JSON.stringify(props.initialValue));
      const itemSetter = props.itemSetter as ListItemConfig;
      if (itemSetter?.initialValue !== undefined)
        return JSON.parse(JSON.stringify(itemSetter.initialValue));
      return '';
    };

    const resolveItemSetter = () => {
      const itemSetter = props.itemSetter;
      let setterName =
        typeof itemSetter === 'string' ? itemSetter : 'StringSetter';
      let setterProps: Record<string, any> = {};
      const itemConfig: {items: PropConfig[]} | undefined = props.itemConfig;
      if (typeof itemSetter === 'object' && itemSetter) {
        setterName = (itemSetter as ListItemConfig).setter ?? 'StringSetter';
        setterProps = (itemSetter as ListItemConfig).props ?? {};
        const cfg = (itemSetter as ListItemConfig).config ?? itemConfig;
        if (setterName === 'ObjectSetter' && cfg) {
          setterProps.config = cfg;
        }
      } else if (setterName === 'ObjectSetter' && itemConfig) {
        setterProps.config = itemConfig;
      }
      const comp = ctx?.setterRegistry.get(setterName);
      return {comp, setterName, setterProps};
    };

    const addItem = () => {
      const next = [...(props.value ?? []), getInitial()];
      props.onChange(next);
    };
    const removeItem = (index: number) => {
      const next = [...(props.value ?? [])];
      next.splice(index, 1);
      props.onChange(next);
    };
    const updateItem = (index: number, v: any) => {
      const next = [...(props.value ?? [])];
      next[index] = v;
      props.onChange(next);
    };
    const onDragStart = (index: number) => {
      draggingIndex.value = index;
    };
    const onDrop = (index: number) => {
      if (draggingIndex.value === null || draggingIndex.value === index) return;
      const next = [...(props.value ?? [])];
      const [moved] = next.splice(draggingIndex.value, 1);
      next.splice(index, 0, moved);
      draggingIndex.value = null;
      props.onChange(next);
    };

    return () => {
      const list = Array.isArray(props.value) ? props.value : [];
      const {comp: ItemComp, setterName, setterProps} = resolveItemSetter();
      const reachedMax =
        props.itemMaxLength !== undefined && list.length >= props.itemMaxLength;

      return (
        <div class="assem-array-setter">
          {list.length ? (
            <div class="assem-array-list">
              {list.map((item: any, index: number) => (
                <div
                  key={index}
                  class="assem-array-item"
                  draggable={!props.disabled}
                  onDragstart={() => onDragStart(index)}
                  onDragover={(e: DragEvent) => e.preventDefault()}
                  onDrop={() => onDrop(index)}
                >
                  <div class="assem-array-item-handle">
                    <Rank />
                  </div>
                  <div class="assem-array-item-body">
                    {ItemComp ? (
                      h(ItemComp, {
                        value: item,
                        disabled: props.disabled,
                        onChange: (v: any) => updateItem(index, v),
                        ...setterProps
                      })
                    ) : (
                      <span class="assem-setter-missing">
                        no setter: {setterName}
                      </span>
                    )}
                  </div>
                  <div class="assem-array-item-actions">
                    <ElButton
                      link
                      disabled={props.disabled}
                      onClick={() => removeItem(index)}
                    >
                      <Delete />
                    </ElButton>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ElEmpty
              description="No items, click below to add"
              imageSize={40}
            />
          )}
          {!reachedMax && !props.disabled && (
            <ElButton
              class="assem-array-add"
              type="primary"
              link
              onClick={addItem}
            >
              <Plus /> Add item
            </ElButton>
          )}
        </div>
      );
    };
  }
});
