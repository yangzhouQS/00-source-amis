import {useAssemNamespace} from '../../hooks/use-assem-namespace';
const ns = useAssemNamespace('mixed-setter');

/**
 * MixedSetter - switch between multiple setters
 */
import {defineComponent, ref, watch, h} from 'vue';
import {ElDropdown, ElDropdownMenu, ElDropdownItem} from 'element-plus';
import {useSetterCtx} from '../base';
import './../composite.less';

interface SetterOption {
  name: string;
  title?: string;
  props?: Record<string, any>;
  initialValue?: any;
}

export const MixedSetter = defineComponent({
  name: 'MixedSetter',
  props: {
    value: {type: null as any, default: undefined},
    onChange: {type: Function, required: true},
    setters: {
      type: Array as () => Array<string | SetterOption>,
      default: () => []
    },
    usedSetter: {type: String, default: ''},
    disabled: {type: Boolean, default: false}
  },
  emits: ['update:usedSetter'],
  setup(props, {emit}) {
    const ctx = useSetterCtx();
    const innerUsed = ref<string>('');

    const normalizeSetters = (): SetterOption[] => {
      if (!Array.isArray(props.setters)) return [];
      return props.setters.map((s, i) => {
        if (typeof s === 'string') {
          return {name: s, title: s};
        }
        return {
          name: s.name ?? `setter_${i}`,
          title: s.title ?? s.name,
          props: s.props,
          initialValue: s.initialValue
        };
      });
    };

    const currentSetter = ref<SetterOption | null>(null);
    const computeCurrent = () => {
      const list = normalizeSetters();
      if (!list.length) {
        currentSetter.value = null;
        return;
      }
      const used = props.usedSetter || innerUsed.value;
      const found = list.find(s => s.name === used);
      currentSetter.value = found ?? list[0];
    };

    watch(() => [props.setters, props.usedSetter], computeCurrent, {
      immediate: true,
      deep: true
    });

    const switchSetter = (opt: SetterOption) => {
      innerUsed.value = opt.name;
      emit('update:usedSetter', opt.name);
      computeCurrent();
      if (opt.initialValue !== undefined) {
        props.onChange(JSON.parse(JSON.stringify(opt.initialValue)));
      }
    };

    return () => {
      const list = normalizeSetters();
      const cur = currentSetter.value;
      const SetterComp = cur ? ctx?.setterRegistry.get(cur.name) : undefined;

      return (
        <div class="assem-mixed-setter">
          <div class="assem-mixed-setter-body">
            {SetterComp && cur ? (
              h(SetterComp, {
                value: props.value,
                disabled: props.disabled,
                onChange: (v: any) => props.onChange(v),
                ...(cur.props ?? {})
              })
            ) : (
              <span class="assem-setter-missing">no setter available</span>
            )}
          </div>
          {list.length > 1 && (
            <ElDropdown
              trigger="click"
              disabled={props.disabled}
              onCommand={(cmd: string) => {
                const opt = list.find(s => s.name === cmd);
                if (opt) switchSetter(opt);
              }}
            >
              {{
                default: () => <span class="assem-mixed-trigger">&#8646;</span>,
                dropdown: () => (
                  <ElDropdownMenu>
                    {list.map(s => (
                      <ElDropdownItem
                        key={s.name}
                        command={s.name}
                        disabled={cur?.name === s.name}
                      >
                        {s.title}
                      </ElDropdownItem>
                    ))}
                  </ElDropdownMenu>
                )
              }}
            </ElDropdown>
          )}
        </div>
      );
    };
  }
});
