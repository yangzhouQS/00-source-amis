import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  PropType,
  ref,
} from "vue";
import { VueMonacoEditor } from "@guolao/vue-monaco-editor";
import { FullScreen } from "@element-plus/icons-vue";
import { useAssemNamespace } from "../../hooks/use-assem-namespace";
/**
 * 共享代码编辑器（Monaco + 全屏放大），自 data-source-pane 提升为公共组件
 *
 * 借鉴旧版 assembox-editor base-monaco-editor 的 supportFullScreen 实现：
 * - 编辑区右上角全屏切换角标（hover 显现，全屏时常驻）
 * - 全屏态：position:fixed 铺满视口（z-index 3000 压过 el-drawer/el-dialog
 *   弹层栈），minimap 开启并放大字号；还原态恢复紧凑配置
 * - ESC 退出全屏（window 捕获阶段拦截，不触发宿主弹层的
 *   close-on-press-escape）；automaticLayout 承担尺寸自适应
 * - 受控 value/onUpdate:value + 语言/选项透传
 *
 * 使用方：schema-pane（源码面板）/ data-source-pane（方法・拦截器・全局配置）
 */
import "./code-editor-style.less";

const ns = useAssemNamespace("code-editor");

export const CodeEditor = defineComponent({
  name: "AssemCodeEditor",
  props: {
    value: { type: String, default: "" },
    language: { type: String, default: "javascript" },
    /** 还原态编辑区高度（数值 px 或任意 CSS 长度，如 "100%"）；全屏态铺满视口 */
    height: { type: [Number, String], default: 300 },
    /** Monaco options 透传（与全屏联动项 merge：minimap/fontSize） */
    options: { type: Object as PropType<Record<string, any>>, default: () => ({}) },
    /** 是否提供全屏切换（默认开） */
    supportFullScreen: { type: Boolean, default: true },
  },
  emits: ["update:value"],
  setup(props, { emit }) {
    const full = ref(false);
    /** Monaco 实例引用（全屏切换时 updateOptions 联动 minimap，对齐旧版） */
    const editorRef = ref<any>(null);
    const monacoReady = ref(false);

    onMounted(() => {
      requestAnimationFrame(() => (monacoReady.value = true));
    });

    const applyOptions = (fullscreen: boolean) => {
      requestAnimationFrame(() => {
        editorRef.value?.updateOptions({
          minimap: { enabled: fullscreen },
          fontSize: fullscreen ? 13 : 12,
        });
      });
    };

    const toggle = () => {
      full.value = !full.value;
      applyOptions(full.value);
    };

    /** 全屏态 ESC：捕获阶段拦截并阻断传播，防止同时触发宿主
     *  el-drawer / el-dialog 的 close-on-press-escape 把弹层一起关掉 */
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !full.value) {
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      full.value = false;
      applyOptions(false);
    };
    onMounted(() => window.addEventListener("keydown", onKeydown, true));
    onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown, true));

    const heightStyle = computed(() =>
      typeof props.height === "number" ? `${props.height}px` : props.height);

    const mergedOptions = computed<Record<string, any>>(() => ({
      minimap: { enabled: false },
      fontSize: 12,
      automaticLayout: true,
      scrollBeyondLastLine: false,
      lineNumbers: "on",
      ...props.options,
    }));

    const onMount = (instance: any) => {
      editorRef.value = instance;
    };

    return () => (
      <div
        class={[ns.b(), { [ns.m("full")]: full.value }]}
        style={full.value ? undefined : { height: heightStyle.value }}
      >
        {monacoReady.value
          ? (
            <VueMonacoEditor
              value={props.value}
              onUpdate:value={(v: string) => emit("update:value", v)}
              language={props.language}
              theme="vs"
              options={mergedOptions.value}
              onMount={onMount}
            />
          )
          : <div class={ns.e("loading")}>编辑器加载中…</div>}
        {props.supportFullScreen && (
          <div
            class={ns.e("fs-btn")}
            title={full.value ? "退出全屏（ESC）" : "全屏编辑"}
            onClick={toggle}
          >
            <el-icon size={14}>
              <FullScreen />
            </el-icon>
            {full.value ? "退出全屏" : "全屏"}
          </div>
        )}
      </div>
    );
  },
});
