/**
 * RequestFnSetter - request/data-source service picker (tree-select)
 */
import {defineComponent} from 'vue';
import {ElTreeSelect} from 'element-plus';
import {CircleCheck} from '@element-plus/icons-vue';
import {normalizeOptions} from '../base';

interface TreeDataItem {
  id: string;
  description?: string;
  isGroup?: boolean;
  disabled?: boolean;
  children?: TreeDataItem[];
}

export const RequestFnSetter = defineComponent({
  name: 'RequestFnSetter',
  props: {
    value: {type: [String, Object], default: ''},
    onChange: {type: Function, required: true},
    dataSourceTree: {type: Array as () => TreeDataItem[], default: () => []},
    dataSource: {
      type: Array as () => Array<{
        id: string;
        description?: string;
        disabled?: boolean;
      }>,
      default: () => []
    },
    placeholder: {type: String, default: 'Select data source'},
    clearable: {type: Boolean, default: true},
    disabled: {type: Boolean, default: false}
  },
  setup(props) {
    const filterMethod = (val: string, data: any) => {
      if (!val) return true;
      return `${data.description ?? ''}${data.id}`
        .toLowerCase()
        .includes(`${val}`.toLowerCase());
    };

    const handleChange = (id: string) => {
      if (!id) return;
      props.onChange(id);
    };

    return () => {
      if (props.dataSourceTree.length) {
        const treeProps = {
          'modelValue': props.value,
          'data': props.dataSourceTree,
          'nodeKey': 'id',
          'filterable': true,
          'clearable': props.clearable,
          'disabled': props.disabled,
          'checkStrictly': true,
          'placeholder': props.placeholder,
          'filterNodeMethod': filterMethod,
          'style': 'width:100%',
          'onUpdate:modelValue': (v: any) => handleChange(v)
        };
        return (
          <ElTreeSelect {...(treeProps as any)}>
            {{
              default: ({data}: {data: TreeDataItem}) => (
                <div style="display:flex;justify-content:space-between;align-items:center;width:100%">
                  <span>
                    {data.description ?? data.id}
                    {!data.isGroup && data.description ? ` (${data.id})` : ''}
                  </span>
                  {!data.isGroup && (
                    <CircleCheck style="color:var(--el-color-success)" />
                  )}
                </div>
              )
            }}
          </ElTreeSelect>
        );
      }
      const options = normalizeOptions(
        props.dataSource.map(d => ({
          label: d.description ?? d.id,
          value: d.id,
          disabled: d.disabled
        }))
      );
      const flatProps = {
        'modelValue': props.value,
        'data': options.map(o => ({
          id: o.value,
          description: o.label,
          disabled: o.disabled
        })),
        'nodeKey': 'id',
        'filterable': true,
        'clearable': props.clearable,
        'disabled': props.disabled,
        'placeholder': props.placeholder,
        'style': 'width:100%',
        'onUpdate:modelValue': (v: any) => props.onChange(v)
      };
      return <ElTreeSelect {...(flatProps as any)} />;
    };
  }
});
