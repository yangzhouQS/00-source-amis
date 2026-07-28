/**
 * ModelNameSetter - model/field binding picker (tree-select)
 */
import {defineComponent, ref, watch} from 'vue';
import {ElPopover, ElInput, ElScrollbar, ElTree, ElIcon} from 'element-plus';
import {CircleCheck} from '@element-plus/icons-vue';

interface ModelTreeItem {
  key: string;
  fullPath?: string;
  isLeaf?: boolean;
  description?: string;
  children?: ModelTreeItem[];
}

export const ModelNameSetter = defineComponent({
  name: 'ModelNameSetter',
  props: {
    value: {type: [Object, String], default: ''},
    onChange: {type: Function, required: true},
    modelTree: {type: Array as () => ModelTreeItem[], default: () => []},
    placeholder: {type: String, default: 'Select bound model'},
    clearable: {type: Boolean, default: true},
    disabled: {type: Boolean, default: false}
  },
  setup(props) {
    const visible = ref(false);
    const filterText = ref('');
    const treeRef = ref<any>(null);
    const defaultExpandedKeys = ref<string[]>([]);

    watch(filterText, val => {
      treeRef.value?.filter(val?.trim());
    });

    watch(
      () => props.value,
      val => {
        if (val) defaultExpandedKeys.value = [String(val)];
      },
      {immediate: true}
    );

    const handleNodeClick = (data: ModelTreeItem) => {
      const path = data.fullPath ?? data.key;
      props.onChange(path);
      visible.value = false;
    };

    const filterNodeMethod = (val: string, data: any) => {
      if (!val) return true;
      return (data.key ?? '').includes(val);
    };

    return () => (
      <ElPopover
        v-model:visible={visible.value}
        placement="bottom"
        width={320}
        trigger="click"
      >
        {{
          reference: () => (
            <ElInput
              modelValue={String(props.value ?? '')}
              placeholder={props.placeholder}
              clearable={props.clearable}
              disabled={props.disabled}
              onUpdate:modelValue={(v: string) => props.onChange(v)}
            />
          ),
          default: () => (
            <>
              <ElInput
                v-model={filterText.value}
                placeholder="Search field"
                clearable
                size="small"
                style="margin-bottom:8px"
              />
              <ElScrollbar max-height={300}>
                <ElTree
                  ref={treeRef}
                  data={props.modelTree as any}
                  nodeKey="fullPath"
                  defaultExpandedKeys={defaultExpandedKeys.value}
                  filterNodeMethod={filterNodeMethod}
                  props={{children: 'children', label: 'key'}}
                  onNode-click={handleNodeClick}
                >
                  {{
                    default: ({data}: {data: ModelTreeItem}) => (
                      <div style="display:flex;justify-content:space-between;align-items:center;width:100%">
                        <span>{data.key}</span>
                        <span style="display:flex;align-items:center;gap:4px">
                          {data.description ? (
                            <em style="color:#909399;font-style:normal">
                              ({data.description})
                            </em>
                          ) : null}
                          {data.isLeaf && (
                            <ElIcon color="var(--el-color-success)">
                              <CircleCheck />
                            </ElIcon>
                          )}
                        </span>
                      </div>
                    )
                  }}
                </ElTree>
              </ElScrollbar>
            </>
          )
        }}
      </ElPopover>
    );
  }
});
