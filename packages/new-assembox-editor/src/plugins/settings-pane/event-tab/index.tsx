import type { Editor } from "../../../core/editor";
import { CaretBottom, Delete, Edit } from "@element-plus/icons-vue";
/**
 * 事件 Tab（入口）
 *
 * 交互模式（对齐旧版 component-event）：
 * - 默认不展示任何事件，通过下拉选择添加
 * - 已添加事件显示在列表中（启停 / 编辑 / 删除）
 * - 下拉中已添加的事件禁用（防重复）
 * - 双击事件行打开编辑器
 *
 * schema 契约：__nodeEvent[eventName] = { enabled, fn }
 */
import { computed, defineComponent, PropType, ref } from "vue";
import { useAssemNamespace } from "../../../hooks/use-assem-namespace";
import { EventCodeEditor } from "./event-code-editor";
import "./event-tab-style.less";

const ns = useAssemNamespace("event-tab");

const DEFAULT_FN = "function(ctx, payload) {\n  // ctx.getNode(id) / ctx.$dataModels / ctx.$sharedFns / ctx.$globalVars\n  \n}";

export const EventTab = defineComponent({
  name: "SettingsPaneEventTab",
  props: {
    editor: { type: Object as PropType<Editor>, required: true },
    events: { type: Array as () => any[], default: () => [] },
  },
  setup(props) {
    const node = computed(() => props.editor.store.activeNode);
    /** 已绑定的事件名集合 */
    const boundNames = computed(() =>
      Object.keys(node.value?.__nodeEvent ?? {}).filter(k =>
        node.value.__nodeEvent[k]?.fn?.trim()));

    /** 编辑器弹窗状态 */
    const editorVisible = ref(false);
    const editingEvent = ref<{ name: string; title: string } | null>(null);
    const editingFn = ref("");

    /** 添加事件（从下拉选择）：写入默认函数 + 打开编辑器 */
    const addEvent = (eventName: string) => {
      const ev = props.events.find(e => e.name === eventName);
      const current = { ...(node.value?.__nodeEvent ?? {}) };
      if (!current[eventName]?.fn) {
        current[eventName] = { enabled: true, fn: DEFAULT_FN };
        props.editor.update(node.value!.__nodeId, { __nodeEvent: current });
      }
      openEditor(eventName, ev?.title ?? eventName);
    };

    const openEditor = (eventName: string, title: string) => {
      const cfg = node.value?.__nodeEvent?.[eventName];
      editingEvent.value = { name: eventName, title };
      editingFn.value = cfg?.fn ?? DEFAULT_FN;
      editorVisible.value = true;
    };

    const saveFn = (fn: string) => {
      if (!editingEvent.value) return;
      const current = { ...(node.value?.__nodeEvent ?? {}) };
      current[editingEvent.value.name] = {
        ...(current[editingEvent.value.name] ?? {}),
        enabled: true,
        fn,
      };
      props.editor.update(node.value!.__nodeId, { __nodeEvent: current });
    };

    const removeEvent = (eventName: string) => {
      const current = { ...(node.value?.__nodeEvent ?? {}) };
      delete current[eventName];
      props.editor.update(node.value!.__nodeId, { __nodeEvent: current });
    };

    const toggleEnabled = (eventName: string, val: boolean) => {
      const current = { ...(node.value?.__nodeEvent ?? {}) };
      if (current[eventName]) {
        current[eventName] = { ...current[eventName], enabled: val };
        props.editor.update(node.value!.__nodeId, { __nodeEvent: current });
      }
    };

    const hasAvailable = computed(() =>
      props.events.some(ev => !boundNames.value.includes(ev.name)));

    return () => (
      <div class={ns.b()}>
        {/* 添加事件下拉 */}
        <div class={ns.e("add-bar")}>
          <el-alert
            title="从下拉列表选择事件进行绑定"
            type="info"
            closable={false}
            showIcon
          />
          <el-dropdown
            size="small"
            trigger="click"
            onCommand={addEvent}
            disabled={!hasAvailable.value}
          >
            {{
              default: () => (
                <el-button size="small" type="primary">
                  添加事件
                  <el-icon class="el-icon--right"><CaretBottom /></el-icon>
                </el-button>
              ),
              dropdown: () => (
                <el-dropdown-menu>
                  {props.events.map(ev => {
                    const isBound = boundNames.value.includes(ev.name);
                    return (
                      <el-dropdown-item
                        key={ev.name}
                        command={ev.name}
                        disabled={isBound}
                      >
                        <div class={ns.e("dropdown-item")}>
                          <span>{ev.title ?? ev.name}</span>
                          {isBound && <span class={ns.e("dropdown-bound")}>已绑定</span>}
                        </div>
                      </el-dropdown-item>
                    );
                  })}
                </el-dropdown-menu>
              ),
            }}
          </el-dropdown>
        </div>

        {/* 已绑定事件列表 */}
        {boundNames.value.length > 0
          ? (
              <div class={ns.e("bound-list")}>
                {boundNames.value.map(name => {
                  const ev = props.events.find(e => e.name === name);
                  const cfg = node.value.__nodeEvent[name];
                  return (
                    <div
                      key={name}
                      class={ns.e("bound-item")}
                      onDblclick={() => openEditor(name, ev?.title ?? name)}
                    >
                      <span class={ns.e("bound-name")}>{ev?.title ?? name}</span>
                      <div class={ns.e("bound-ops")}>
                        <el-switch
                          modelValue={cfg?.enabled !== false}
                          size="small"
                          onChange={(v: any) => toggleEnabled(name, v)}
                        />
                        <el-button
                          size="small"
                          link
                          type="primary"
                          onClick={() => openEditor(name, ev?.title ?? name)}
                        >
                          <el-icon size={14}><Edit /></el-icon>
                        </el-button>
                        <el-popconfirm
                          title="确定删除该事件绑定吗？"
                          width={180}
                          onConfirm={() => removeEvent(name)}
                        >
                          {{
                            reference: () => (
                              <el-button size="small" link type="danger">
                                <el-icon size={14}><Delete /></el-icon>
                              </el-button>
                            ),
                          }}
                        </el-popconfirm>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          : (
              <el-empty
                description="暂无绑定事件，从上方下拉添加"
                imageSize={50}
              />
            )}

        {/* 事件代码编辑器（三栏：片段 + 参数 + Monaco） */}
        <EventCodeEditor
          visible={editorVisible.value}
          onUpdate:visible={(v: boolean) => (editorVisible.value = v)}
          editor={props.editor}
          eventName={editingEvent.value?.title ?? ""}
          fn={editingFn.value}
          onSave={saveFn}
        />
      </div>
    );
  },
});
