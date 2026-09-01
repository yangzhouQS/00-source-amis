import type { Editor } from "../../../core/editor";
import type { CodeSnippet, SnippetParam } from "./code-snippets";
/**
 * 事件代码编辑器（Drawer 三栏：片段分类 + 参数表单 + Monaco）
 * 参考旧版 pc-func-editor-dialog：左栏选操作 → 中栏填参数生成代码 → 右栏 Monaco 编辑
 */
import { ElMessage } from "element-plus";
import { CaretRight, MagicStick } from "@element-plus/icons-vue";
import { computed, defineComponent, PropType, reactive, ref, watch } from "vue";
import { useAssemNamespace } from "../../../hooks/use-assem-namespace";
import { CodeEditor } from "../../../components/code-editor";
import { codeSnippets, SNIPPET_CATEGORIES } from "./code-snippets";
import "./event-tab-style.less";

const ns = useAssemNamespace("event-tab");

const DEFAULT_FN = "function(ctx, payload) {\n  \n}";

export const EventCodeEditor = defineComponent({
  name: "EventCodeEditor",
  props: {
    visible: { type: Boolean, default: false },
    editor: { type: Object as PropType<Editor>, required: true },
    eventName: { type: String, required: true },
    fn: { type: String, default: "" },
    onSave: { type: Function as PropType<(fn: string) => void>, required: true },
  },
  emits: ["update:visible"],
  setup(props, { emit }) {
    const text = ref(props.fn);
    let lastSaved = "";
    /** 当前选中的代码片段 */
    const activeSnippet = ref<CodeSnippet | null>(null);
    /** 片段参数值 */
    const paramValues = reactive<Record<string, string>>({});

    watch(
      () => props.visible,
      (v) => {
        if (v) {
          text.value = props.fn || DEFAULT_FN;
          lastSaved = text.value;
          activeSnippet.value = null;
          Object.keys(paramValues).forEach(k => delete paramValues[k]);
        }
      },
    );

    const isDirty = computed(() => text.value !== lastSaved);

    const selectSnippet = (snippet: CodeSnippet) => {
      activeSnippet.value = snippet;
      Object.keys(paramValues).forEach(k => delete paramValues[k]);
      snippet.params.forEach(p => { paramValues[p.key] = ""; });
    };

    /** 生成代码并追加到编辑器当前光标处 */
    const insertCode = () => {
      if (!activeSnippet.value) return;
      const code = activeSnippet.value.generate({ ...paramValues });
      // 在函数体末尾（最后一个 } 前）插入
      const lines = text.value.split("\n");
      let lastBrace = -1;
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim() === "}") { lastBrace = i; break; }
      }
      if (lastBrace > 0) {
        lines.splice(lastBrace, 0, ...code.split("\n").map(l => l ? `  ${l}` : l));
        text.value = lines.join("\n");
      } else {
        text.value += `\n${code}`;
      }
    };

    /** 渲染单个参数控件 */
    const renderParam = (p: SnippetParam) => {
      if (p.type === "select" && p.options) {
        return (
          <el-select
            modelValue={paramValues[p.key]}
            size="small"
            filterable
            onUpdate:modelValue={(v: any) => (paramValues[p.key] = v)}
          >
            {p.options.map(o => (
              <el-option key={o.value} value={o.value} label={o.label} />
            ))}
          </el-select>
        );
      }
      return (
        <el-input
          modelValue={paramValues[p.key]}
          size="small"
          placeholder={p.placeholder || p.label}
          onUpdate:modelValue={(v: string) => (paramValues[p.key] = v)}
        />
      );
    };

    const save = () => {
      const trimmed = text.value.trim();
      if (!trimmed) {
        ElMessage.warning("事件处理函数不能为空");
        return;
      }
      try {
        // eslint-disable-next-line no-new-func
        new Function(`return (${trimmed})`);
      } catch (e) {
        ElMessage.error(`语法错误：${e instanceof Error ? e.message : String(e)}`);
        return;
      }
      props.onSave(trimmed);
      lastSaved = trimmed;
      ElMessage.success("事件处理已保存");
      emit("update:visible", false);
    };

    return () => (
      <el-drawer
        modelValue={props.visible}
        onUpdate:modelValue={(v: boolean) => emit("update:visible", v)}
        title={`事件处理：${props.eventName}`}
        size="720px"
        appendToBody
        destroyOnClose
        closeOnClickModal={false}
      >
        {{
          default: () => (
            <div class={ns.e("code-editor-wrap")}>
              {/* 上方：片段生成区（左分类 + 右参数） */}
              <div class={ns.e("snippet-area")}>
                <div class={ns.e("snippet-categories")}>
                  {SNIPPET_CATEGORIES.map(cat => (
                    <div key={cat} class={ns.e("snippet-category")}>
                      <div class={ns.e("snippet-cat-name")}>{cat}</div>
                      {codeSnippets.filter(s => s.category === cat).map(s => (
                        <div
                          key={s.name}
                          class={[
                            ns.e("snippet-item"),
                            { "is-active": activeSnippet.value === s },
                          ]}
                          onClick={() => selectSnippet(s)}
                        >
                          {s.name}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div class={ns.e("snippet-detail")}>
                  {activeSnippet.value
                    ? (
                        <>
                          <div class={ns.e("snippet-desc")}>{activeSnippet.value.description}</div>
                          {activeSnippet.value.params.map(p => (
                            <div key={p.key} class={ns.e("snippet-param-row")}>
                              <span class={ns.e("snippet-param-label")}>{p.label}</span>
                              {renderParam(p)}
                            </div>
                          ))}
                          <el-button
                            type="primary"
                            size="small"
                            icon={MagicStick}
                            onClick={insertCode}
                            style="margin-top: 8px; width: 100%"
                          >
                            生成代码并插入
                          </el-button>
                        </>
                      )
                    : (
                        <div class={ns.e("snippet-empty")}>
                          <el-icon size={20}><CaretRight /></el-icon>
                          <span>选择左侧操作后填入参数生成代码</span>
                        </div>
                      )}
                </div>
              </div>

              {/* 下方：Monaco 编辑器 */}
              <div class={ns.e("code-editor-main")}>
                <CodeEditor
                  value={text.value}
                  onUpdate:value={(v: string) => (text.value = v)}
                  language="javascript"
                  height="100%"
                />
              </div>

              {/* 底部操作 */}
              <div class={ns.e("code-editor-footer")}>
                <el-button onClick={() => emit("update:visible", false)}>取消</el-button>
                <el-button type="primary" disabled={!isDirty.value} onClick={save}>
                  保存
                </el-button>
              </div>
            </div>
          ),
        }}
      </el-drawer>
    );
  },
});
