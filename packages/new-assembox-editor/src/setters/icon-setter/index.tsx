import {useAssemNamespace} from '../../hooks/use-assem-namespace';
const ns = useAssemNamespace('icon-picker');

/**
 * IconSetter - icon picker (Element Plus icons + iconFont)
 */
import {defineComponent, ref, computed, h} from 'vue';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import {
  ElInput,
  ElPopover,
  ElButton,
  ElTabs,
  ElTabPane,
  ElIcon
} from 'element-plus';
import './style.less';

export const IconSetter = defineComponent({
  name: 'IconSetter',
  props: {
    value: {type: String, default: ''},
    onChange: {type: Function, required: true},
    disabled: {type: Boolean, default: false},
    iconType: {type: String, default: ''},
    iconFontList: {
      type: Array as () => Array<{font_class: string; name?: string}>,
      default: () => []
    },
    iconFontPrefix: {type: String, default: 'icon cs-common '}
  },
  setup(props) {
    const activeName = ref(props.iconType === 'iconFont' ? 'iconFont' : 'icon');
    const elSearch = ref('');
    const fontSearch = ref('');

    const elIconNames = computed(() =>
      Object.keys(ElementPlusIconsVue).filter(n =>
        n.toLowerCase().includes(elSearch.value.toLowerCase())
      )
    );

    const fontIcons = computed(() =>
      (props.iconFontList || []).filter(i =>
        `${i.font_class}${i.name ?? ''}`
          .toLowerCase()
          .includes(fontSearch.value.toLowerCase())
      )
    );

    const previewIcon = computed(() => {
      if (!props.value) return null;
      if (
        ElementPlusIconsVue[props.value as keyof typeof ElementPlusIconsVue]
      ) {
        return h(
          ElementPlusIconsVue[props.value as keyof typeof ElementPlusIconsVue]
        );
      }
      return null;
    });

    const pickEl = (name: string) => props.onChange(name);
    const pickFont = (item: {font_class: string}) =>
      props.onChange(`${props.iconFontPrefix}${item.font_class}`);

    const iconContent = () => (
      <div class={ns.b()}>
        <ElInput
          v-model={elSearch.value}
          placeholder="Search Element icon"
          clearable
          size="small"
          style="margin:8px 0"
        />
        <ul class={ns.e('grid')}>
          {elIconNames.value.slice(0, 200).map(name => (
            <li
              key={name}
              class={[ns.e('cell'), {active: props.value === name}]}
              title={name}
              onClick={() => pickEl(name)}
            >
              <ElIcon size={20}>
                {h(
                  ElementPlusIconsVue[name as keyof typeof ElementPlusIconsVue]
                )}
              </ElIcon>
              <span class={ns.e('name')}>{name}</span>
            </li>
          ))}
        </ul>
      </div>
    );

    const fontContent = () => (
      <div class={ns.b()}>
        <ElInput
          v-model={fontSearch.value}
          placeholder="Search iconFont"
          clearable
          size="small"
          style="margin:8px 0"
        />
        {fontIcons.value.length ? (
          <ul class={ns.e('grid')}>
            {fontIcons.value.map(item => (
              <li
                key={item.font_class}
                class={[
                  ns.e('cell'),
                  {active: props.value.includes(item.font_class)}
                ]}
                title={item.font_class}
                onClick={() => pickFont(item)}
              >
                <i class={[props.iconFontPrefix.trim(), item.font_class]} />
                <span class={ns.e('name')}>{item.font_class}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div class={ns.e('empty')}>
            No iconFont configured (pass via iconFontList)
          </div>
        )}
      </div>
    );

    return () => (
      <ElInput
        modelValue={props.value ?? ''}
        disabled={props.disabled}
        placeholder="Select icon"
        clearable
        class="assem-icon-setter"
        onUpdate:modelValue={(v: string) => props.onChange(v ?? '')}
      >
        {{
          prepend: () => (
            <ElPopover placement="left" width={420} trigger="click">
              {{
                reference: () => (
                  <ElButton style="width:40px;padding:0">
                    <ElIcon size={16}>
                      {previewIcon.value ?? <span>...</span>}
                    </ElIcon>
                  </ElButton>
                ),
                default: () => (
                  <ElTabs v-model={activeName.value} type="card">
                    {props.iconType !== 'iconFont' && (
                      <ElTabPane label="Element Icon" name="icon" lazy>
                        {iconContent()}
                      </ElTabPane>
                    )}
                    {props.iconType !== 'elementIcon' && (
                      <ElTabPane label="iconFont" name="iconFont" lazy>
                        {fontContent()}
                      </ElTabPane>
                    )}
                  </ElTabs>
                )
              }}
            </ElPopover>
          )
        }}
      </ElInput>
    );
  }
});
