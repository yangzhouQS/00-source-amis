import type { PropType } from "vue";
/**
 * NumberInput — 数值输入 + 单位选择
 * 用 el-input 替代 el-input-number（避免 blur 时 update:modelValue 重触发导致值被清空）
 */
import { computed, defineComponent, ref, watch } from "vue";
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
    /** 支持的单位列表（如 ['px','%']）；单元素或空数组=固定单位不显示选择器 */
    units: { type: Array as PropType<string[]>, default: () => ["px"] },
    /** placeholder */
    placeholder: { type: String, default: "" },
    /** 是否禁用 */
    disabled: { type: Boolean, default: false },
  },
  emits: ["update:modelValue", "change"],
  setup(props, { emit }) {
    /** 内部文本值（输入过程中保持原始文本，blur 时才提交） */
    const textValue = ref("");
    const focused = ref(false);

    /** 从 modelValue 解析数值部分 */
    const numericValue = computed(() => removeUnit(String(props.modelValue ?? "")));
    const currentUnit = computed(() => {
      const u = getUnit(String(props.modelValue ?? ""));
      return u && props.units.includes(u) ? u : (props.units[0] ?? "");
    });

    /** 外部 modelValue 变化时同步到 textValue（非聚焦态） */
    watch(
      () => props.modelValue,
      (v) => {
        if (!focused.value) {
          textValue.value = v != null ? String(v).replace(/px$/, "") : "";
        }
      },
      { immediate: true },
    );

    const onFocus = () => {
      focused.value = true;
      textValue.value = numericValue.value != null ? String(numericValue.value) : "";
    };

    const onInput = (val: string) => {
      textValue.value = val;
    };

    /** blur 时提交值（数值 + 当前单位） */
    const onBlur = () => {
      focused.value = false;
      const raw = textValue.value.trim();
      if (raw === "") {
        emit("update:modelValue", "");
        emit("change", "");
        return;
      }
      const n = Number.parseFloat(raw);
      if (Number.isNaN(n)) {
        textValue.value = numericValue.value != null ? String(numericValue.value) : "";
        return;
      }
      let clamped = n;
      if (props.min != null && clamped < props.min) {
        clamped = props.min;
      }
      if (props.max != null && clamped > props.max) {
        clamped = props.max;
      }
      const v = `${clamped}${currentUnit.value}`;
      emit("update:modelValue", v);
      emit("change", v);
      textValue.value = String(clamped);
    };

    /** 键盘 Enter 提前提交 */
    const onKeyup = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        (e.target as HTMLInputElement).blur();
      }
    };

    const onUnit = (unit: string) => {
      const n = numericValue.value;
      if (n == null) {
        return;
      }
      const v = `${n}${unit}`;
      emit("update:modelValue", v);
      emit("change", v);
    };

    return () => {
      const raw = String(props.modelValue ?? "");
      if (isCssVarBind(raw)) {
        return <el-input modelValue={raw} disabled title="CSS 变量绑定" />;
      }
      return (
        <div class="style-number-input">
          <el-input
            modelValue={focused.value ? textValue.value : (numericValue.value != null ? String(numericValue.value) : "")}
            placeholder={props.placeholder}
            disabled={props.disabled}
            onFocus={onFocus}
            onBlur={onBlur}
            onInput={onInput}
            onKeyup={onKeyup}
            style="flex: 1; min-width: 0"
          />
          {props.units.length > 1 && (
            <el-select
              modelValue={currentUnit.value}
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
