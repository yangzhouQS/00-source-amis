import type { OnStyleChange, StyleData } from "./utils";
import { VueMonacoEditor } from "@guolao/vue-monaco-editor";
/**
 * StyleSetter — CSS 可视化样式编辑器（参考 lowcode-engine-ext style-setter v2）
 *
 * 5 大面板：布局 / 字体 / 边框 / 背景 / 定位
 * 全部基于 Element Plus 组件实现
 *
 * 值契约：value = Record<camelCase, string>（如 { marginTop: "10px", color: "#f00" }）
 * 变更契约：onChange(wholeStyle) — 每次修改输出完整 style 对象
 */
import { computed, defineComponent, ref, watch } from "vue";
import { BackgroundPanel } from "./pro/background";
import { BorderPanel } from "./pro/border";
import { FontPanel } from "./pro/font";
import { LayoutPanel } from "./pro/layout";
import { PositionPanel } from "./pro/position";
import "./style-setter-style.less";

const PANELS = [
  { name: "layout", title: "布局", component: LayoutPanel },
  { name: "font", title: "字体", component: FontPanel },
  { name: "border", title: "边框", component: BorderPanel },
  { name: "background", title: "背景", component: BackgroundPanel },
  { name: "position", title: "定位", component: PositionPanel },
];

export const StyleSetter = defineComponent({
  name: "StyleSetter",
  props: {
    value: { type: Object, default: () => ({}) },
    onChange: { type: Function, required: true },
    disabled: { type: Boolean, default: false },
  },
  setup(props) {
    const sd = computed(() => (props.value && typeof props.value === "object" ? props.value : {}));

    const showJsonEditor = ref(false);
    const jsonText = ref("");

    /** 同步 style → JSON 文本（面板操作后更新编辑器） */
    watch(
      () => sd.value,
      (v) => {
        jsonText.value = JSON.stringify(v, null, 2);
      },
      { immediate: true, deep: true },
    );

    /** JSON 编辑器输入 → 回写 style 对象 */
    const onJsonInput = (val: string) => {
      jsonText.value = val;
      if (!val.trim()) {
        props.onChange({});
        return;
      }
      try {
        const parsed = JSON.parse(val);
        if (parsed && typeof parsed === "object") {
          props.onChange(parsed);
        }
      } catch {
        // JSON 不完整，忽略（Monaco 自带语法错误标记）
      }
    };

    const onStyleChange: OnStyleChange = (changes: StyleData[]) => {
      const next = { ...sd.value };
      for (const { styleKey, value } of changes) {
        if (value == null || value === "") {
          delete next[styleKey];
        } else {
          next[styleKey] = value;
        }
      }
      props.onChange(next);
    };

    return () => (
      <div class="style-setter">
        <div class="style-setter__topbar">
          <el-text size="small" type="info">样式配置</el-text>
          <el-tooltip content="JSON 编辑" placement="top">
            <el-button
              text
              size="small"
              type={showJsonEditor.value ? "primary" : "default"}
              onClick={() => {
                showJsonEditor.value = !showJsonEditor.value;
              }}
            >
              JSON
            </el-button>
          </el-tooltip>
        </div>

        {showJsonEditor.value && (
          <div class="style-setter__json-editor">
            <VueMonacoEditor
              value={jsonText.value}
              onUpdate:value={onJsonInput}
              language="json"
              theme="vs"
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                automaticLayout: true,
                readOnly: props.disabled,
                scrollBeyondLastLine: false,
                lineNumbers: "off",
                lineDecorationsWidth: 6,
                padding: { top: 4 },
              }}
            />
          </div>
        )}

        <el-collapse modelValue={PANELS.map(p => p.name)}>
          {PANELS.map(({ name, title, component: Panel }) => (
            <el-collapse-item key={name} title={title} name={name}>
              <Panel styleData={sd.value} onStyleChange={onStyleChange} />
            </el-collapse-item>
          ))}
        </el-collapse>
      </div>
    );
  },
});
