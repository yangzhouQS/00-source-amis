/**
 * NutIconSetter - NutUI icon picker (mobile)
 * NutUI is not a dependency; iconList config-driven, falls back to Element icons
 */
import {defineComponent, ref, computed, h} from 'vue';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import {ElInput, ElPopover, ElButton, ElIcon} from 'element-plus';

interface NutIconItem {
  name: string;
  key?: string;
  render?: () => any;
}

export const NutIconSetter = defineComponent({
  name: 'NutIconSetter',
  props: {
    value: {type: String, default: ''},
    onChange: {type: Function, required: true},
    disabled: {type: Boolean, default: false},
    iconList: {type: Array as () => NutIconItem[], default: () => []},
    prefix: {type: String, default: 'nut-icon-'}
  },
  setup(props) {
    const visible = ref(false);
    const search = ref('');
    const filtered = computed(() =>
      props.iconList.filter(i =>
        i.name.toLowerCase().includes(search.value.toLowerCase())
      )
    );
    const useFallback = computed(() => props.iconList.length === 0);

    return () => (
      <ElInput
        modelValue={props.value ?? ''}
        disabled={props.disabled}
        placeholder="Select icon"
        clearable
        onUpdate:modelValue={(v: string) => props.onChange(v ?? '')}
      >
        {{
          prepend: () => (
            <ElPopover
              v-model:visible={visible.value}
              placement="left"
              width={400}
              trigger="click"
            >
              {{
                reference: () => (
                  <ElButton style="width:40px;padding:0">
                    <ElIcon size={16}>
                      {useFallback.value &&
                      props.value &&
                      ElementPlusIconsVue[
                        props.value as keyof typeof ElementPlusIconsVue
                      ] ? (
                        h(
                          ElementPlusIconsVue[
                            props.value as keyof typeof ElementPlusIconsVue
                          ]
                        )
                      ) : (
                        <span>...</span>
                      )}
                    </ElIcon>
                  </ElButton>
                ),
                default: () => (
                  <div>
                    <ElInput
                      v-model={search.value}
                      placeholder="Search"
                      clearable
                      size="small"
                      style="margin-bottom:8px"
                    />
                    {useFallback.value ? (
                      <div style="padding:12px;font-size:12px;color:#909399">
                        No NutUI icon configured (pass via iconList)
                      </div>
                    ) : (
                      <ul style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px;list-style:none;padding:0;margin:0;max-height:300px;overflow:auto">
                        {filtered.value.map(item => (
                          <li
                            key={item.key ?? item.name}
                            title={item.name}
                            style="display:flex;flex-direction:column;align-items:center;gap:2px;height:52px;cursor:pointer;border:1px solid transparent;border-radius:4px"
                            onClick={() =>
                              props.onChange(
                                `${props.prefix}${item.key ?? item.name}`
                              )
                            }
                          >
                            {item.render ? (
                              item.render()!
                            ) : (
                              <i
                                class={[props.prefix + (item.key ?? item.name)]}
                                style="font-size:20px"
                              />
                            )}
                            <span style="font-size:10px;color:#909399;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                              {item.name}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              }}
            </ElPopover>
          )
        }}
      </ElInput>
    );
  }
});
