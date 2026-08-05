import type { PropType } from "vue";
import type { OnStyleChange } from "../utils";
/**
 * Position 面板 — 深度复刻 lowcode pro/position
 * position / PositionBox(可视化偏移) / zIndex / float / clear
 */
import { computed, defineComponent } from "vue";
import { StyleRow } from "../components";
import { PositionBox } from "../components/position-box";

export const PositionPanel = defineComponent({
  name: "StylePositionPanel",
  props: {
    styleData: { type: Object as PropType<Record<string, any>>, required: true },
    onStyleChange: { type: Function as PropType<OnStyleChange>, required: true },
  },
  setup(props) {
    const sd = computed(() => props.styleData);
    const showOffset = computed(() => sd.value.position && sd.value.position !== "static" && sd.value.position !== "");
    const emit = (styleKey: string, value: any) => {
      props.onStyleChange([{ styleKey, value: value ?? null }]);
    };
    return () => (
      <div class="position-style-container">
        <StyleRow title="定位" hasValue={!!sd.value.position}>
          <el-select modelValue={sd.value.position ?? ""} size="small" style="width:100%" onChange={(v: string) => emit("position", v)}>
            <el-option value="" label="默认" />
            <el-option value="static" label="static" />
            <el-option value="relative" label="relative" />
            <el-option value="absolute" label="absolute" />
            <el-option value="fixed" label="fixed" />
            <el-option value="sticky" label="sticky" />
          </el-select>
        </StyleRow>

        {showOffset.value && (
          <PositionBox styleData={sd.value} onStyleChange={props.onStyleChange} />
        )}

        <StyleRow title="层级" hasValue={sd.value.zIndex != null}>
          <el-input-number
            modelValue={sd.value.zIndex != null ? Number(sd.value.zIndex) : undefined}
            size="small"
            controls={false}
            min={0}
            placeholder="z-index"
            style="width:100%"
            onUpdate:modelValue={(v: number) => emit("zIndex", v != null ? String(v) : "")}
          />
        </StyleRow>

        <StyleRow title="浮动" hasValue={!!sd.value.float}>
          <el-select modelValue={sd.value.float ?? ""} size="small" style="width:100%" onChange={(v: string) => emit("float", v)}>
            <el-option value="" label="默认" />
            <el-option value="left" label="left" />
            <el-option value="right" label="right" />
            <el-option value="none" label="none" />
          </el-select>
        </StyleRow>

        <StyleRow title="清除浮动" hasValue={!!sd.value.clear}>
          <el-select modelValue={sd.value.clear ?? ""} size="small" style="width:100%" onChange={(v: string) => emit("clear", v)}>
            <el-option value="" label="默认" />
            <el-option value="left" label="left" />
            <el-option value="right" label="right" />
            <el-option value="both" label="both" />
            <el-option value="none" label="none" />
          </el-select>
        </StyleRow>
      </div>
    );
  },
});
