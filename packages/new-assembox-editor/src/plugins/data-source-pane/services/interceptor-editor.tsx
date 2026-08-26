import type { DsInterceptorConfig } from "../doc/types";
/**
 * 拦截器编辑器（Dialog + Monaco）
 * beforeReq(requestConfig) / afterReq(responseResult)，必须 return
 */
import { defineComponent, PropType, ref, watch } from "vue";
import { useAssemNamespace } from "../../../hooks/use-assem-namespace";
import { CodeEditor } from "../../../components/code-editor";
import { defaultInterceptorCode } from "../constants";
import "../data-source-pane-style.less";

const ns = useAssemNamespace("ds-editor");

export const InterceptorEditor = defineComponent({
  name: "DsInterceptorEditor",
  props: {
    type: { type: String as PropType<"beforeReq" | "afterReq">, required: true },
    modelValue: { type: Object as PropType<DsInterceptorConfig | undefined>, default: undefined },
    onSave: { type: Function as PropType<(config: DsInterceptorConfig) => void>, required: true },
  },
  setup(props) {
    const visible = ref(false);
    const enabled = ref(false);
    const fnText = ref("");

    watch(visible, (v) => {
      if (v) {
        enabled.value = props.modelValue?.enabled ?? false;
        fnText.value = props.modelValue?.fn?.trim() ? props.modelValue.fn : defaultInterceptorCode(props.type);
      }
    });

    const open = () => {
      visible.value = true;
    };

    return () => (
      <>
        <el-button size="small" text type="primary" onClick={open}>编辑</el-button>
        <el-dialog
          v-model={visible.value}
          title={`${props.type === "beforeReq" ? "前置拦截（改请求配置）" : "后置拦截（改响应结果）"} ${props.type}`}
          width="720px"
          appendToBody
          destroyOnClose
        >
          {{
            default: () => (
              <div class={ns.b()}>
                <div class={ns.e("interceptor-head")}>
                  <el-switch modelValue={enabled.value} onUpdate:modelValue={(v: boolean) => (enabled.value = v)} />
                  <span>{enabled.value ? "已启用" : "已禁用"}</span>
                  <span class={ns.e("section-hint")}>
                    签名：
                    <code>
                      async function
                      {props.type}
                      (
                      {props.type === "beforeReq" ? "requestConfig" : "responseResult"}
                      )
                    </code>
                    ，必须 return
                  </span>
                </div>
                <CodeEditor
                  value={fnText.value}
                  onUpdate:value={(v: string) => (fnText.value = v)}
                  language="javascript"
                  height={320}
                />
              </div>
            ),
            footer: () => (
              <>
                <el-button size="small" onClick={() => (visible.value = false)}>取消</el-button>
                <el-button
                  size="small"
                  type="primary"
                  onClick={() => {
                    props.onSave({ enabled: enabled.value, fn: fnText.value });
                    visible.value = false;
                  }}
                >
                  保存
                </el-button>
              </>
            ),
          }}
        </el-dialog>
      </>
    );
  },
});
