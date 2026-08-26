import type { DsIssue } from "../doc/types";
import type { DsDocHandle } from "../doc/use-data-source-doc";
import { ElMessage } from "element-plus";
/**
 * 共享方法编辑器（Drawer）
 * 函数名/描述/enabled + Monaco fn 编辑 + ctx 能力速查 + 沙箱试运行
 */
import { computed, defineComponent, PropType, ref } from "vue";
import { useAssemNamespace } from "../../../hooks/use-assem-namespace";
import { CodeEditor } from "../../../components/code-editor";
import { defaultSharedFnCode } from "../constants";
import { canCompileFn, hasBlockingIssues, validateSharedFn } from "../doc/validate";
import "../data-source-pane-style.less";

const ns = useAssemNamespace("ds-editor");

/** ctx 能力速查（渲染层 createEventContext 契约） */
const CTX_CHEATSHEET: Array<{ sig: string; desc: string }> = [
  { sig: "ctx.$dataModels.<model>.<table>.<field>", desc: "读写数据模型（响应式）" },
  { sig: "ctx.$requestFns.<name>(params)", desc: "调用服务请求" },
  { sig: "ctx.$sharedFns.<name>(ctx, payload)", desc: "调用其他共享方法" },
  { sig: "ctx.$globalVars.$context.orgId", desc: "全局上下文（组织/租户等）" },
  { sig: "ctx.getNode('TableAsync::name')", desc: "按设计期 ID 取组件实例" },
  { sig: "entry.exposed.reloadData({ isReset: true })", desc: "表格重载等暴露方法" },
  { sig: "entry.updateProps({ disabled: true })", desc: "运行时改组件属性" },
];

/** 沙箱试运行（mock ctx + console 捕获） */
function tryRunFn(fnText: string): { logs: string[]; error: string | null; result: string } {
  const logs: string[] = [];
  const error: { msg: string | null } = { msg: null };
  const formatValue = (v: unknown): string => {
    if (typeof v === "string") {
      return v;
    }
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  };
  const mockCtx = new Proxy(
    { $dataModels: {}, $requestFns: {}, $sharedFns: {}, $globalVars: { $context: {} }, $utils: {} },
    {
      get(target, key: string) {
        if (key in target) {
          return (target as any)[key];
        }
        logs.push(`[访问] ctx.${String(key)}（mock：undefined）`);
        return () => logs.push(`[调用] ctx.${String(key)}(...) mock 未实现`);
      },
    },
  );
  let result: unknown;
  try {
    // eslint-disable-next-line no-new-func
    const factory = new Function(`return (${fnText});`)() as (ctx: unknown, payload: unknown) => unknown;
    result = factory(mockCtx, {});
  } catch (e) {
    error.msg = e instanceof Error ? e.message : String(e);
  }
  return { logs, error: error.msg, result: formatValue(result) };
}

export const FnEditor = defineComponent({
  name: "DsFnEditor",
  props: {
    doc: { type: Object as PropType<DsDocHandle>, required: true },
    mode: { type: String as PropType<"add" | "edit">, required: true },
    name: { type: String, default: "" },
    onClose: { type: Function as PropType<() => void>, required: true },
  },
  setup(props) {
    const visible = ref(true);
    const original = props.doc.state.sharedFns[props.name];
    const draft = ref({
      id: props.mode === "edit" ? props.name : "",
      description: original?.description ?? "",
      enabled: original?.enabled ?? true,
      fn: original?.fn ?? defaultSharedFnCode(),
    });
    const issues = ref<DsIssue[]>([]);
    const runOutput = ref<{ logs: string[]; error: string | null; result: string } | null>(null);

    const title = computed(() => (props.mode === "add" ? "新增方法" : `编辑方法：${props.name}`));

    const save = () => {
      const list = validateSharedFn(draft.value.id, draft.value, props.doc.state, {
        excludeName: props.mode === "edit" ? props.name : undefined,
      });
      issues.value = list;
      if (hasBlockingIssues(list)) {
        return;
      }
      props.doc.commit(
        `${props.mode === "add" ? "新增" : "编辑"}方法 ${draft.value.id}`,
        (doc) => {
          if (props.mode === "edit" && props.name !== draft.value.id) {
            delete doc.sharedFns[props.name];
          }
          doc.sharedFns[draft.value.id] = {
            enabled: draft.value.enabled,
            fn: draft.value.fn,
            description: draft.value.description ?? "",
          };
        },
      );
      ElMessage.success("方法已保存");
      visible.value = false;
    };

    const run = () => {
      if (!canCompileFn(draft.value.fn)) {
        runOutput.value = { logs: [], error: "函数存在语法错误，无法试运行", result: "" };
        return;
      }
      runOutput.value = tryRunFn(draft.value.fn);
    };

    return () => (
      <el-drawer
        v-model={visible.value}
        title={title.value}
        size="640px"
        appendToBody
        destroyOnClose
        onClose={props.onClose}
      >
        {{
          default: () => (
            <div class={ns.b()}>
              <el-form labelWidth="90px" size="small" class={ns.e("form")}>
                <el-form-item label="函数名" required>
                  <el-input
                    modelValue={draft.value.id}
                    onUpdate:modelValue={(v: string) => (draft.value.id = v)}
                    placeholder="如 searchTable（标识符，唯一）"
                  />
                </el-form-item>
                <el-form-item label="描述" required>
                  <el-input
                    modelValue={draft.value.description}
                    onUpdate:modelValue={(v: string) => (draft.value.description = v)}
                    maxlength={30}
                    showWordLimit
                    placeholder="功能描述"
                  />
                </el-form-item>
                <el-form-item label="启用">
                  <el-switch modelValue={draft.value.enabled} onUpdate:modelValue={(v: boolean) => (draft.value.enabled = v)} />
                </el-form-item>
              </el-form>

              <div class={ns.e("section")}>
                <div class={ns.e("section-title")}>函数体</div>
                <CodeEditor
                  value={draft.value.fn}
                  onUpdate:value={(v: string) => (draft.value.fn = v)}
                  language="javascript"
                  height={300}
                />
              </div>

              <div class={ns.e("section")}>
                <div class={ns.e("section-title")}>ctx 能力速查</div>
                <div class={ns.e("cheatsheet")}>
                  {CTX_CHEATSHEET.map(c => (
                    <div class={ns.e("cheatsheet-item")} key={c.sig}>
                      <code>{c.sig}</code>
                      <span>{c.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div class={ns.e("section")}>
                <div class={[ns.e("section-title"), ns.em("section-title", "with-op")]}>
                  试运行（mock ctx 沙箱）
                  <el-button size="small" onClick={run}>运行</el-button>
                </div>
                {runOutput.value
                  ? (
                      <div class={ns.e("run-output")}>
                        {runOutput.value.error
                          ? (
                              <div class={ns.e("run-error")}>
                                Error:
                                {runOutput.value.error}
                              </div>
                            )
                          : null}
                        {runOutput.value.logs.map((l, i) => (
                          <div class={ns.e("run-log")} key={i}>{l}</div>
                        ))}
                        <div class={ns.e("run-result")}>
                          return →
                          {runOutput.value.result || "undefined"}
                        </div>
                      </div>
                    )
                  : <div class={ns.e("run-placeholder")}>点击「运行」查看 mock 执行结果</div>}
              </div>

              {issues.value.length
                ? (
                    <div class={ns.e("issues")}>
                      {issues.value.map((i, idx) => (
                        <div class={ns.e(`issue-${i.level}`)} key={idx}>
                          {i.level === "error" ? "✕" : "⚠"}
                          {" "}
                          {i.message}
                        </div>
                      ))}
                    </div>
                  )
                : null}

              <div class={ns.e("footer")}>
                <el-button size="small" onClick={() => (visible.value = false)}>取消</el-button>
                <el-button size="small" type="primary" onClick={save}>保存</el-button>
              </div>
            </div>
          ),
        }}
      </el-drawer>
    );
  },
});
