/**
 * 设置面板（属性/样式/事件/高级 Tab）
 * 选区驱动：读取 store.activeNode，用 ComponentMeta.props 渲染 setter
 * 变更通过 editor.updateProps 同步到画布
 */
import {defineComponent, PropType, computed, h, provide} from 'vue';
import {
  ElTabs,
  ElTabPane,
  ElForm,
  ElFormItem,
  ElEmpty,
  ElButton
} from 'element-plus';
import type {Editor} from '../../core/editor';
import {resolveSetter, isFieldHidden, SETTER_CONTEXT_KEY} from '../../setters';
import {useAssemNamespace} from '../../hooks/use-assem-namespace';
import './../pane.less';

const ns = useAssemNamespace('setting-pane');

export const SettingsPane = defineComponent({
  name: 'SettingsPane',
  props: {
    editor: {type: Object as PropType<Editor>, required: true}
  },
  setup(props) {
    const activeNode = computed(() => props.editor.store.activeNode);
    const meta = computed(() =>
      activeNode.value
        ? props.editor.componentRegistry.get(activeNode.value.type)
        : undefined
    );

    /** 提供 SetterContext 给复合 setter（Object/Array/Style 等解析子 setter） */
    provide(SETTER_CONTEXT_KEY, {
      get editor() {
        return props.editor;
      },
      get setterRegistry() {
        return props.editor.setterRegistry;
      },
      get nodeId() {
        return activeNode.value?.$$id;
      }
    });

    /** 渲染单个 setter */
    const renderField = (propConfig: any) => {
      const node = activeNode.value;
      if (!node) return null;
      if (isFieldHidden(propConfig, node.props)) return null;
      const resolved = resolveSetter(props.editor.setterRegistry, propConfig);
      const SetterComp = resolved.component;
      const currentValue = (node.props ?? {})[propConfig.name];

      return (
        <ElFormItem
          key={propConfig.name}
          label={propConfig.title ?? propConfig.name}
        >
          {SetterComp ? (
            h(SetterComp, {
              value: currentValue,
              defaultValue: propConfig.defaultValue,
              onChange: (v: any) => {
                props.editor.updateProps(node.$$id, {[propConfig.name]: v});
              },
              ...resolved.setterProps
            })
          ) : (
            <span class="assem-setter-missing">
              无 setter: {resolved.setterName}
            </span>
          )}
        </ElFormItem>
      );
    };

    return () => {
      const node = activeNode.value;
      if (!node) {
        return (
          <div class={ns.b()}>
            <ElEmpty description="请选择组件" imageSize={60} />
          </div>
        );
      }
      const m = meta.value;
      const propsList = m?.props ?? [];
      const events = m?.events ?? [];

      return (
        <div class={ns.b()}>
          <div class={ns.e('header')}>
            <span class={ns.e('title')}>{m?.name ?? node.type}</span>
            <span class={ns.e('type')}>{node.type}</span>
          </div>
          <ElTabs modelValue="attribute">
            <ElTabPane label="属性" name="attribute">
              <ElForm labelWidth="80px" size="small">
                {propsList.length ? (
                  propsList.map(renderField)
                ) : (
                  <ElEmpty description="无可配置属性" imageSize={50} />
                )}
              </ElForm>
            </ElTabPane>
            <ElTabPane label="样式" name="style">
              <StyleEditor
                editor={props.editor}
                nodeId={node.$$id}
                style={node.style ?? {}}
              />
            </ElTabPane>
            <ElTabPane label="事件" name="event">
              <EventList editor={props.editor} events={events} />
            </ElTabPane>
            <ElTabPane label="高级" name="advanced">
              <AdvancedEditor editor={props.editor} nodeId={node.$$id} />
            </ElTabPane>
          </ElTabs>
        </div>
      );
    };
  }
});

/** 样式编辑器（常用样式） */
const StyleEditor = defineComponent({
  props: {
    editor: {type: Object as PropType<Editor>, required: true},
    nodeId: {type: String, required: true},
    style: {type: Object, required: true}
  },
  setup(props) {
    const update = (key: string, value: any) => {
      props.editor.update(props.nodeId, {style: {[key]: value}});
    };
    const ColorSetter = props.editor.setterRegistry.get('ColorSetter');
    const NumberSetter = props.editor.setterRegistry.get('NumberSetter');
    const SelectSetter = props.editor.setterRegistry.get('SelectSetter');
    const styleFields = [
      {key: 'width', label: '宽度', setter: NumberSetter, unit: true},
      {key: 'height', label: '高度', setter: NumberSetter, unit: true},
      {key: 'marginTop', label: '上边距', setter: NumberSetter, unit: true},
      {key: 'marginBottom', label: '下边距', setter: NumberSetter, unit: true},
      {key: 'backgroundColor', label: '背景色', setter: ColorSetter},
      {key: 'color', label: '文字颜色', setter: ColorSetter}
    ];
    const displayOptions = [
      {label: '默认', value: ''},
      {label: '块级', value: 'block'},
      {label: '弹性', value: 'flex'},
      {label: '内联块', value: 'inline-block'}
    ];
    return () => (
      <ElForm labelWidth="80px" size="small">
        {styleFields.map(f =>
          f.setter ? (
            <ElFormItem key={f.key} label={f.label}>
              {h(f.setter, {
                value: props.style[f.key],
                onChange: (v: any) => update(f.key, v)
              })}
            </ElFormItem>
          ) : null
        )}
        {SelectSetter ? (
          <ElFormItem label="显示模式">
            {h(SelectSetter, {
              value: props.style.display ?? '',
              options: displayOptions,
              onChange: (v: any) => update('display', v)
            })}
          </ElFormItem>
        ) : null}
      </ElForm>
    );
  }
});

/** 事件动作编排器（声明式 onEvent.actions 卡片编辑） */
const EventList = defineComponent({
  props: {
    editor: {type: Object as PropType<Editor>, required: true},
    events: {type: Array as () => any[], default: () => []}
  },
  setup(props) {
    const node = computed(() => props.editor.store.activeNode);

    const getActions = (evName: string): any[] => {
      return node.value?.onEvent?.[evName]?.actions ?? [];
    };

    const addAction = (evName: string) => {
      const actions = [
        ...getActions(evName),
        {actionType: 'toast', args: {message: '新动作'}}
      ];
      props.editor.update(node.value!.$$id, {
        onEvent: {[evName]: {actions}}
      });
    };

    const removeAction = (evName: string, idx: number) => {
      const actions = [...getActions(evName)];
      actions.splice(idx, 1);
      props.editor.update(node.value!.$$id, {
        onEvent: {[evName]: {actions}}
      });
    };

    const updateAction = (evName: string, idx: number, patch: any) => {
      const actions = [...getActions(evName)];
      actions[idx] = {...actions[idx], ...patch};
      props.editor.update(node.value!.$$id, {
        onEvent: {[evName]: {actions}}
      });
    };

    const actionTypes = computed(() => props.editor.actionRegistry.all());

    return () => (
      <div class={ns.e('event-list')}>
        {props.events.length ? (
          props.events.map((ev: any) => {
            const actions = getActions(ev.name);
            return (
              <div class={ns.e('event-item')} key={ev.name}>
                <div
                  style={{
                    'display': 'flex',
                    'align-items': 'center',
                    'justify-content': 'space-between'
                  }}
                >
                  <span class={ns.e('event-name')}>{ev.title ?? ev.name}</span>
                  <ElButton
                    size="small"
                    type="primary"
                    link
                    onClick={() => addAction(ev.name)}
                  >
                    + 添加动作
                  </ElButton>
                </div>
                {actions.length > 0 && (
                  <div
                    style={{
                      'margin-top': '6px',
                      'display': 'flex',
                      'flex-direction': 'column',
                      'gap': '4px'
                    }}
                  >
                    {actions.map((action: any, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          'display': 'flex',
                          'align-items': 'center',
                          'gap': '4px',
                          'padding': '4px 6px',
                          'background': '#f5f7fa',
                          'border-radius': '3px'
                        }}
                      >
                        <select
                          value={action.actionType}
                          onChange={(e: Event) =>
                            updateAction(ev.name, idx, {
                              actionType: (e.target as HTMLSelectElement).value
                            })
                          }
                          style={{
                            'flex': '1',
                            'border': '1px solid #dcdfe6',
                            'border-radius': '3px',
                            'padding': '2px 4px',
                            'font-size': '12px'
                          }}
                        >
                          {actionTypes.value.map((a: any) => (
                            <option key={a.actionType} value={a.actionType}>
                              {a.title ?? a.actionType}
                            </option>
                          ))}
                        </select>
                        {action.actionType === 'toast' && (
                          <input
                            value={action.args?.message ?? ''}
                            onInput={(e: Event) =>
                              updateAction(ev.name, idx, {
                                args: {
                                  ...action.args,
                                  message: (e.target as HTMLInputElement).value
                                }
                              })
                            }
                            placeholder="消息内容"
                            style={{
                              'flex': '1',
                              'border': '1px solid #dcdfe6',
                              'border-radius': '3px',
                              'padding': '2px 4px',
                              'font-size': '12px'
                            }}
                          />
                        )}
                        {action.actionType === 'navigate' && (
                          <input
                            value={action.args?.url ?? ''}
                            onInput={(e: Event) =>
                              updateAction(ev.name, idx, {
                                args: {
                                  ...action.args,
                                  url: (e.target as HTMLInputElement).value
                                }
                              })
                            }
                            placeholder="跳转 URL"
                            style={{
                              'flex': '1',
                              'border': '1px solid #dcdfe6',
                              'border-radius': '3px',
                              'padding': '2px 4px',
                              'font-size': '12px'
                            }}
                          />
                        )}
                        <ElButton
                          size="small"
                          link
                          type="danger"
                          onClick={() => removeAction(ev.name, idx)}
                        >
                          ×
                        </ElButton>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <ElEmpty description="无可配置事件" imageSize={50} />
        )}
      </div>
    );
  }
});

/** 高级编辑器（节点 id / 删除） */
const AdvancedEditor = defineComponent({
  props: {
    editor: {type: Object as PropType<Editor>, required: true},
    nodeId: {type: String, required: true}
  },
  setup(props) {
    return () => (
      <ElForm labelWidth="80px" size="small">
        <ElFormItem label="节点ID">
          <code class={ns.e('node-id')}>{props.nodeId}</code>
        </ElFormItem>
        <ElFormItem label="操作">
          <ElButton
            type="danger"
            size="small"
            onClick={() => props.editor.remove(props.nodeId)}
          >
            删除节点
          </ElButton>
        </ElFormItem>
      </ElForm>
    );
  }
});
