/**
 * ColorInput — 颜色选择器（el-color-picker + hex 输入）
 * 参考 lowcode ColorInput：SketchPicker 替换为 el-color-picker
 */
import { defineComponent } from "vue";

const PRESET_COLORS = [
  "#0079f2",
  "#00c587",
  "#f0b40e",
  "#f04631",
  "#909399",
  "#303133",
  "#ffffff",
  "#000000",
  "rgba(0,0,0,0)",
];

export const StyleColorInput = defineComponent({
  name: "StyleColorInput",
  props: {
    modelValue: { type: String, default: "" },
    disabled: { type: Boolean, default: false },
  },
  emits: ["update:modelValue", "change"],
  setup(props, { emit }) {
    const onInput = (v: string | null) => {
      const val = v === "rgba(0, 0, 0, 0)" || v === "" ? "" : v ?? "";
      emit("update:modelValue", val);
      emit("change", val);
    };
    return () => (
      <div class="style-color-input">
        <el-color-picker
          modelValue={props.modelValue || undefined}
          size="small"
          predefine={PRESET_COLORS}
          showAlpha
          disabled={props.disabled}
          onUpdate:modelValue={onInput}
        />
        <el-input
          modelValue={props.modelValue}
          size="small"
          placeholder="#000000"
          disabled={props.disabled}
          style="flex: 1; min-width: 0;"
          onUpdate:modelValue={(v: string) => onInput(v)}
        />
      </div>
    );
  },
});
