import type { PropType } from "vue";
/**
 * NumberInput — 数值输入 + 单位选择
 * 参考 lowcode Number：支持 px / % 单位切换，Arrow 上下增减
 */
import { computed, defineComponent } from "vue";
import { getUnit, isCssVarBind, removeUnit } from "../utils";

export const StyleNumberInput = defineComponent({
  name: "StyleNumberInput",
  props: {
    /** CSS 原始值（如 "12px", "50%"） */
    modelValue: { type: [String, Number], default: "" },
    /** 最小值 */
    min: { type: Number, default: undefined },
    /** 最大值 */
    max: { type: Number, default: undefined },
    /** 步进 */
    step: { type: Number, default: 1 },
    /** 支持的单位列表（如 ['px','%']）；单元素或空数组=固定单位不显示选择器 */
    units: { type: Array as PropType<string[]>, default: () => ["px"] },
    /** placeholder */
    placeholder: { type: String, default: "" },
    /** 是否禁用 */
    disabled: { type: Boolean, default: false },
  },
  emits: ["update:modelValue", "change"],
  setup(props, { emit }) {
    const numericValue = computed(() => removeUnit(String(props.modelValue ?? "")));
    const currentUnit = computed(() => {
      const u = getUnit(String(props.modelValue ?? ""));
      if (u && props.units.includes(u)) {
        return u;
      }
      return props.units[0] ?? "";
    });

    const onNumber = (val: number | undefined) => {
      if (val == null || (val === 0 && !String(props.modelValue))) {
        emit("update:modelValue", "");
        emit("change", "");
        return;
      }
      const v = `${val}${currentUnit.value}`;
      emit("update:modelValue", v);
      emit("change", v);
    };

    const onUnit = (unit: string) => {
      const n = numericValue.value;
      const v = n != null ? `${n}${unit}` : "";
      emit("update:modelValue", v);
      emit("change", v);
    };

    return () => {
      const raw = String(props.modelValue ?? "");
      if (isCssVarBind(raw)) {
        return <el-input modelValue={raw} size="small" disabled title="CSS 变量绑定" />;
      }
      return (
        <div class="style-number-input">
          <el-input-number
            modelValue={numericValue.value ?? undefined}
            size="small"
            controls={false}
            min={props.min}
            max={props.max}
            step={props.step}
            placeholder={props.placeholder}
            disabled={props.disabled}
            style="width: 100%"
            onUpdate:modelValue={onNumber}
          />
          {props.units.length > 1 && (
            <el-select
              modelValue={currentUnit.value}
              size="small"
              style="width: 56px; flex-shrink: 0;"
              onUpdate:modelValue={onUnit}
            >
              {props.units.map(u => (
                <el-option key={u} value={u} label={u} />
              ))}
            </el-select>
          )}
        </div>
      );
    };
  },
});
