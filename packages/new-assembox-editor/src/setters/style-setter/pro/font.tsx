import type { PropType } from "vue";
import type { OnStyleChange } from "../utils";
/**
 * Font 面板 — fontSize / lineHeight / fontWeight / fontFamily / color / textAlign / opacity
 * 参考 lowcode pro/font
 */
import { computed, defineComponent } from "vue";
import { StyleRow } from "../components";
import { StyleColorInput } from "../components/color-input";
import { StyleNumberInput } from "../components/number-input";

const FONT_FAMILIES = [
  { value: "", label: "默认" },
  { value: "PingFang SC, Microsoft YaHei, sans-serif", label: "PingFang SC" },
  { value: "Helvetica, Arial, sans-serif", label: "Helvetica" },
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "serif", label: "serif" },
  { value: "monospace", label: "monospace" },
];

export const FontPanel = defineComponent({
  name: "StyleFontPanel",
  props: {
    styleData: { type: Object as PropType<Record<string, any>>, required: true },
    onStyleChange: { type: Function as PropType<OnStyleChange>, required: true },
  },
  setup(props) {
    const sd = computed(() => props.styleData);
    const emit = (styleKey: string, value: any) => {
      props.onStyleChange([{ styleKey, value: value ?? null }]);
    };
    return () => (
      <div class="style-panel">
        <StyleRow title="字号" hasValue={!!sd.value.fontSize}>
          <StyleNumberInput
            modelValue={sd.value.fontSize ?? ""}
            units={["px"]}
            min={0}
            max={100}
            placeholder="font-size"
            on-change={(v: string) => emit("fontSize", v)}
          />
        </StyleRow>
        <StyleRow title="行高" hasValue={!!sd.value.lineHeight}>
          <StyleNumberInput
            modelValue={sd.value.lineHeight ?? ""}
            units={["px"]}
            min={0}
            placeholder="line-height"
            on-change={(v: string) => emit("lineHeight", v)}
          />
        </StyleRow>
        <StyleRow title="字重" hasValue={!!sd.value.fontWeight}>
          <el-select modelValue={sd.value.fontWeight ?? ""} size="small" style="width:100%" onChange={(v: string) => emit("fontWeight", v)}>
            <el-option value="" label="默认" />
            <el-option value="300" label="Light (300)" />
            <el-option value="400" label="Normal (400)" />
            <el-option value="500" label="Medium (500)" />
            <el-option value="600" label="Semi-Bold (600)" />
            <el-option value="700" label="Bold (700)" />
          </el-select>
        </StyleRow>
        <StyleRow title="字体" hasValue={!!sd.value.fontFamily}>
          <el-select modelValue={sd.value.fontFamily ?? ""} size="small" style="width:100%" onChange={(v: string) => emit("fontFamily", v)}>
            {FONT_FAMILIES.map(f => (
              <el-option key={f.value} value={f.value} label={f.label} />
            ))}
          </el-select>
        </StyleRow>
        <StyleRow title="颜色" hasValue={!!sd.value.color}>
          <StyleColorInput
            modelValue={sd.value.color ?? ""}
            on-change={(v: string) => emit("color", v)}
          />
        </StyleRow>
        <StyleRow title="对齐" hasValue={!!sd.value.textAlign}>
          <el-select modelValue={sd.value.textAlign ?? ""} size="small" style="width:100%" onChange={(v: string) => emit("textAlign", v)}>
            <el-option value="" label="默认" />
            <el-option value="left" label="left" />
            <el-option value="center" label="center" />
            <el-option value="right" label="right" />
            <el-option value="justify" label="justify" />
          </el-select>
        </StyleRow>
        <StyleRow title="透明度" hasValue={sd.value.opacity != null}>
          <div class="style-panel__slider">
            <el-slider
              modelValue={Math.round((Number.parseFloat(sd.value.opacity) || 0) * 100)}
              min={0}
              max={100}
              step={1}
              style="flex:1"
              onUpdate:modelValue={(v: number) => emit("opacity", v === 0 ? "0" : String(v / 100))}
            />
            <span class="style-panel__slider-value">
              {Math.round((Number.parseFloat(sd.value.opacity) || 0) * 100)}
              %
            </span>
          </div>
        </StyleRow>
      </div>
    );
  },
});
