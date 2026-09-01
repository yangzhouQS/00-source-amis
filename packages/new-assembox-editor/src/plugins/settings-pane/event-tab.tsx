import type { Editor } from "../../core/editor";
/**
 * 事件 Tab
 * 事件动作编排器（声明式 __nodeEvent.actions 卡片编辑）
 */
import { computed, defineComponent, PropType } from "vue";
import { useAssemNamespace } from "../../hooks/use-assem-namespace";

const ns = useAssemNamespace("setting-pane");

export const EventTab = defineComponent({
  name: "SettingsPaneEventTab",
  props: {
    editor: { type: Object as PropType<Editor>, required: true },
    events: { type: Array as () => any[], default: () => [] },
  },
  setup(props) {
    const node = computed(() => props.editor.store.activeNode);

    const getActions = (evName: string): any[] => {
      return node.value?.__nodeEvent?.[evName]?.actions ?? [];
    };

    const addAction = (evName: string) => {
      const actions = [
        ...getActions(evName),
        { actionType: "toast", args: { message: "新动作" } },
      ];
      props.editor.update(node.value!.__nodeId, {
        __nodeEvent: { [evName]: { actions } },
      });
    };

    const removeAction = (evName: string, idx: number) => {
      const actions = [...getActions(evName)];
      actions.splice(idx, 1);
      props.editor.update(node.value!.__nodeId, {
        __nodeEvent: { [evName]: { actions } },
      });
    };

    const updateAction = (evName: string, idx: number, patch: any) => {
      const actions = [...getActions(evName)];
      actions[idx] = { ...actions[idx], ...patch };
      props.editor.update(node.value!.__nodeId, {
        __nodeEvent: { [evName]: { actions } },
      });
    };

    const actionTypes = computed(() => props.editor.actionRegistry.all());

    return () => (
      <div class={ns.e("event-list")}>
        {props.events.length
          ? (
              props.events.map((ev: any) => {
                const actions = getActions(ev.name);
                return (
                  <div class={ns.e("event-item")} key={ev.name}>
                    <div
                      style={{
                        "display": "flex",
                        "align-items": "center",
                        "justify-content": "space-between",
                      }}
                    >
                      <span class={ns.e("event-name")}>{ev.title ?? ev.name}</span>
                      <el-button
                        size="small"
                        type="primary"
                        link
                        onClick={() => addAction(ev.name)}
                      >
                        + 添加动作
                      </el-button>
                    </div>
                    {actions.length > 0 && (
                      <div
                        style={{
                          "margin-top": "6px",
                          "display": "flex",
                          "flex-direction": "column",
                          "gap": "4px",
                        }}
                      >
                        {actions.map((action: any, idx: number) => (
                          <div
                            key={idx}
                            style={{
                              "display": "flex",
                              "align-items": "center",
                              "gap": "4px",
                              "padding": "4px 6px",
                              "background": "#f5f7fa",
                              "border-radius": "3px",
                            }}
                          >
                            <select
                              value={action.actionType}
                              onChange={(e: Event) =>
                                updateAction(ev.name, idx, {
                                  actionType: (e.target as HTMLSelectElement).value,
                                })}
                              style={{
                                "flex": "1",
                                "border": "1px solid #dcdfe6",
                                "border-radius": "3px",
                                "padding": "2px 4px",
                                "font-size": "12px",
                              }}
                            >
                              {actionTypes.value.map((a: any) => (
                                <option key={a.actionType} value={a.actionType}>
                                  {a.title ?? a.actionType}
                                </option>
                              ))}
                            </select>
                            {action.actionType === "toast" && (
                              <input
                                value={action.args?.message ?? ""}
                                onInput={(e: Event) =>
                                  updateAction(ev.name, idx, {
                                    args: {
                                      ...action.args,
                                      message: (e.target as HTMLInputElement).value,
                                    },
                                  })}
                                placeholder="消息内容"
                                style={{
                                  "flex": "1",
                                  "border": "1px solid #dcdfe6",
                                  "border-radius": "3px",
                                  "padding": "2px 4px",
                                  "font-size": "12px",
                                }}
                              />
                            )}
                            {action.actionType === "navigate" && (
                              <input
                                value={action.args?.url ?? ""}
                                onInput={(e: Event) =>
                                  updateAction(ev.name, idx, {
                                    args: {
                                      ...action.args,
                                      url: (e.target as HTMLInputElement).value,
                                    },
                                  })}
                                placeholder="跳转 URL"
                                style={{
                                  "flex": "1",
                                  "border": "1px solid #dcdfe6",
                                  "border-radius": "3px",
                                  "padding": "2px 4px",
                                  "font-size": "12px",
                                }}
                              />
                            )}
                            <el-button
                              size="small"
                              link
                              type="danger"
                              onClick={() => removeAction(ev.name, idx)}
                            >
                              ×
                            </el-button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )
          : (
              <el-empty description="无可配置事件" imageSize={50} />
            )}
      </div>
    );
  },
});
