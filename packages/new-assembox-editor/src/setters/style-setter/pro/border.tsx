import type { PropType } from "vue";
import type { OnStyleChange } from "../utils";
/**
 * Border 面板 — borderRadius / borderWidth / borderColor / borderStyle / boxShadow
 * 参考 lowcode pro/border
 */
import { computed, defineComponent, ref, watch } from "vue";
import { StyleRow } from "../components";
import { StyleColorInput } from "../components/color-input";
import { StyleNumberInput } from "../components/number-input";

const CORNERS = ["borderTopLeftRadius", "borderTopRightRadius", "borderBottomRightRadius", "borderBottomLeftRadius"];

export const BorderPanel = defineComponent({
  name: "StyleBorderPanel",
  props: {
    styleData: { type: Object as PropType<Record<string, any>>, required: true },
    onStyleChange: { type: Function as PropType<OnStyleChange>, required: true },
  },
  setup(props) {
    const sd = computed(() => props.styleData);

    // 圆角模式：统一 vs 分角
    const radiusMode = ref<"fixed" | "part">("fixed");
    watch(
      () => sd.value,
      (v) => {
        if (CORNERS.some(k => v[k] != null)) {
          radiusMode.value = "part";
        } else {
          radiusMode.value = "fixed";
        }
      },
      { immediate: true, deep: true },
    );

    const emit = (styleKey: string, value: any) => {
      props.onStyleChange([{ styleKey, value: value ?? null }]);
    };

    const emitBatch = (changes: Array<{ styleKey: string; value: any }>) => {
      props.onStyleChange(changes.map(c => ({ styleKey: c.styleKey, value: c.value ?? null })));
    };

    // boxShadow 合成
    const buildShadow = (segs: string[]): string => {
      const [x, y, blur, spread, color, inset] = segs;
      const parts = [inset === "inset" ? "inset" : "", x || "0", y || "0", blur || "0", spread || "0", color || "#000"].filter(Boolean);
      return parts.join(" ");
    };

    const shadowSegs = computed(() => {
      const raw = sd.value.boxShadow;
      if (!raw) {
        return ["", "", "", "", "#000", ""];
      }
      const isInset = raw.includes("inset");
      const body = raw.replace("inset", "").trim();
      const parts = body.split(/\s+/);
      return [parts[0] ?? "", parts[1] ?? "", parts[2] ?? "", parts[3] ?? "", parts[4] ?? "#000", isInset ? "inset" : ""];
    });

    const setShadow = (index: number, val: string) => {
      const segs = [...shadowSegs.value];
      segs[index] = val;
      emit("boxShadow", buildShadow(segs));
    };

    const onRadiusFixed = (v: string) => {
      emitBatch([
        { styleKey: "borderRadius", value: v },
        ...CORNERS.map(k => ({ styleKey: k, value: null })),
      ]);
    };

    const onRadiusPart = (key: string, v: string) => {
      emitBatch([
        { styleKey: key, value: v },
        { styleKey: "borderRadius", value: null },
      ]);
    };

    return () => (
      <div class="style-panel">
        {/* 圆角 */}
        <StyleRow title="圆角" hasValue={!!sd.value.borderRadius || CORNERS.some(k => sd.value[k] != null)}>
          <el-radio-group
            modelValue={radiusMode.value}
            size="small"
            style="margin-bottom: 8px"
            onChange={(v: string) => {
              radiusMode.value = v as any;
            }}
          >
            <el-radio-button value="fixed" label="统一" />
            <el-radio-button value="part" label="分角" />
          </el-radio-group>
          {radiusMode.value === "fixed"
            ? (
                <StyleNumberInput modelValue={sd.value.borderRadius ?? ""} units={["px", "%"]} min={0} max={100} placeholder="radius" on-change={onRadiusFixed} />
              )
            : (
                <div class="style-panel__box">
                  {CORNERS.map(k => (
                    <StyleNumberInput key={k} modelValue={sd.value[k] ?? ""} units={["px", "%"]} min={0} max={100} placeholder={k.replace("border", "").replace("Radius", "")} on-change={(v: string) => onRadiusPart(k, v)} />
                  ))}
                </div>
              )}
        </StyleRow>

        {/* 边框方向 */}
        <StyleRow title="边框" hasValue={!!sd.value.borderWidth || !!sd.value.borderTopWidth}>
          <div class="style-panel__border-grid">
            <StyleNumberInput modelValue={sd.value.borderWidth ?? sd.value.borderTopWidth ?? ""} units={["px"]} min={0} max={30} placeholder="宽度" on-change={(v: string) => emit("borderWidth", v)} />
            <el-select modelValue={sd.value.borderStyle ?? ""} size="small" style="flex:1" onChange={(v: string) => emit("borderStyle", v)}>
              <el-option value="" label="默认" />
              <el-option value="none" label="none" />
              <el-option value="solid" label="solid" />
              <el-option value="dashed" label="dashed" />
              <el-option value="dotted" label="dotted" />
            </el-select>
            <StyleColorInput modelValue={sd.value.borderColor ?? ""} on-change={(v: string) => emit("borderColor", v)} />
          </div>
        </StyleRow>

        {/* 阴影 */}
        <StyleRow title="阴影" hasValue={!!sd.value.boxShadow}>
          <div class="style-panel__shadow">
            <StyleColorInput modelValue={shadowSegs.value[4]} on-change={(v: string) => setShadow(4, v)} />
            <div class="style-panel__box">
              <StyleNumberInput modelValue={shadowSegs.value[0]} units={["px"]} placeholder="X" on-change={(v: string) => setShadow(0, v)} />
              <StyleNumberInput modelValue={shadowSegs.value[1]} units={["px"]} placeholder="Y" on-change={(v: string) => setShadow(1, v)} />
              <StyleNumberInput modelValue={shadowSegs.value[2]} units={["px"]} placeholder="模糊" on-change={(v: string) => setShadow(2, v)} />
              <StyleNumberInput modelValue={shadowSegs.value[3]} units={["px"]} placeholder="扩展" on-change={(v: string) => setShadow(3, v)} />
            </div>
            <el-checkbox
              modelValue={shadowSegs.value[5] === "inset"}
              onUpdate:modelValue={(v: boolean) => setShadow(5, v ? "inset" : "")}
            >
              内阴影
            </el-checkbox>
          </div>
        </StyleRow>
      </div>
    );
  },
});
