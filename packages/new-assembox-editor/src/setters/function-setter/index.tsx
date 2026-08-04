import { Check, FullScreen } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
/**
 * FunctionSetter - code editor (textarea + fullscreen + syntax validation)
 * Props contract kept compatible so Monaco can be swapped in later
 */
import { computed, defineComponent, ref } from "vue";
import { useAssemNamespace } from "../../hooks/use-assem-namespace";
import "./function-setter.less";

const ns = useAssemNamespace("function-setter");

export const FunctionSetter = defineComponent({
  name: "FunctionSetter",
  props: {
    value: { type: String, default: "" },
    onChange: { type: Function, required: true },
    disabled: { type: Boolean, default: false },
    language: { type: String, default: "javascript" },
    height: { type: Number, default: 120 },
    supportFullScreen: { type: Boolean, default: true },
    wrapFunction: { type: Boolean, default: false },
  },
  setup(props) {
    const draft = ref(props.value ?? "");
    const fullscreen = ref(false);
    const displayValue = computed(() => props.value ?? "");

    const commit = () => {
      const code = draft.value;
      try {
        if (code.trim()) {
          // eslint-disable-next-line no-new-func, no-new
          new Function(code);
        }
        props.onChange(code);
        ElMessage.success("Code saved");
        fullscreen.value = false;
      } catch {
        ElMessage.error("Syntax error, please check");
      }
    };

    const onInput = (v: string) => {
      draft.value = v;
    };

    return () => (
      <div class={ns.b()}>
        <div class={ns.e("code-editor")} style={{ height: `${props.height}px` }}>
          <textarea
            class={ns.e("code-textarea")}
            disabled={props.disabled}
            value={displayValue.value}
            onInput={(e: Event) =>
              onInput((e.target as HTMLTextAreaElement).value)}
            placeholder={`// ${props.language}`}
          />
        </div>
        <div class={ns.e("actions")}>
          <el-button
            size="small"
            type="primary"
            icon={Check}
            disabled={props.disabled}
            onClick={commit}
          >
            Save
          </el-button>
          {props.supportFullScreen && (
            <el-button
              size="small"
              icon={FullScreen}
              disabled={props.disabled}
              onClick={() => {
                draft.value = props.value ?? "";
                fullscreen.value = true;
              }}
            >
              Fullscreen
            </el-button>
          )}
        </div>
        {props.supportFullScreen && (
          <el-dialog
            v-model={fullscreen.value}
            title="Code Editor"
            width="70%"
            destroyOnClose
            appendToBody
          >
            <div class={[ns.e("code-editor"), ns.m("fullscreen")]}>
              <textarea
                class={ns.e("code-textarea")}
                value={draft.value}
                onInput={(e: Event) =>
                  onInput((e.target as HTMLTextAreaElement).value)}
              />
            </div>
            {{
              footer: () => (
                <span>
                  <el-button onClick={() => (fullscreen.value = false)}>
                    Cancel
                  </el-button>
                  <el-button type="primary" onClick={commit}>
                    Save
                  </el-button>
                </span>
              ),
            }}
          </el-dialog>
        )}
      </div>
    );
  },
});
