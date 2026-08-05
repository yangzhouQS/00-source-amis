import type { PropType } from "vue";
import type { OnStyleChange } from "../utils";
/**
 * Layout 面板 — 深度复刻 lowcode pro/layout
 * display / flex 属性 / LayoutBox(可视化 margin/padding) / width / height
 */
import { computed, defineComponent } from "vue";
import { StyleRow } from "../components";
import { LayoutBox } from "../components/layout-box";
import { StyleNumberInput } from "../components/number-input";

interface LayoutConfig {
  isShowPadding?: boolean;
  isShowMargin?: boolean;
  isShowWidthHeight?: boolean;
}

export const LayoutPanel = defineComponent({
  name: "StyleLayoutPanel",
  props: {
    styleData: { type: Object as PropType<Record<string, any>>, required: true },
    onStyleChange: { type: Function as PropType<OnStyleChange>, required: true },
    config: { type: Object as PropType<LayoutConfig>, default: () => ({}) },
  },
  setup(props) {
    const sd = computed(() => props.styleData);
    const isFlex = computed(() => sd.value.display === "flex");

    const emit = (styleKey: string, value: any) => {
      props.onStyleChange([{ styleKey, value: value || null }]);
    };

    return () => {
      const cfg = { isShowPadding: true, isShowMargin: true, isShowWidthHeight: true, ...props.config };
      return (
        <div class="layout-style-container">
          <StyleRow title="显示" hasValue={!!sd.value.display}>
            <el-select modelValue={sd.value.display ?? ""} size="small" style="width: 100%" onChange={(v: string) => emit("display", v)}>
              <el-option value="" label="默认" />
              <el-option value="block" label="block" />
              <el-option value="inline" label="inline" />
              <el-option value="inline-block" label="inline-block" />
              <el-option value="flex" label="flex" />
              <el-option value="grid" label="grid" />
              <el-option value="none" label="none" />
            </el-select>
          </StyleRow>

          {isFlex.value && (
            <>
              <StyleRow title="主轴" hasValue={!!sd.value.flexDirection}>
                <el-select modelValue={sd.value.flexDirection ?? ""} size="small" style="width: 100%" onChange={(v: string) => emit("flexDirection", v)}>
                  <el-option value="" label="默认" />
                  <el-option value="row" label="row →" />
                  <el-option value="column" label="column ↓" />
                  <el-option value="row-reverse" label="← row-reverse" />
                  <el-option value="column-reverse" label="↑ column-reverse" />
                </el-select>
              </StyleRow>
              <StyleRow title="主轴对齐" hasValue={!!sd.value.justifyContent}>
                <el-select modelValue={sd.value.justifyContent ?? ""} size="small" style="width: 100%" onChange={(v: string) => emit("justifyContent", v)}>
                  <el-option value="" label="默认" />
                  <el-option value="flex-start" label="flex-start" />
                  <el-option value="center" label="center" />
                  <el-option value="flex-end" label="flex-end" />
                  <el-option value="space-between" label="space-between" />
                  <el-option value="space-around" label="space-around" />
                </el-select>
              </StyleRow>
              <StyleRow title="交叉对齐" hasValue={!!sd.value.alignItems}>
                <el-select modelValue={sd.value.alignItems ?? ""} size="small" style="width: 100%" onChange={(v: string) => emit("alignItems", v)}>
                  <el-option value="" label="默认" />
                  <el-option value="flex-start" label="flex-start" />
                  <el-option value="center" label="center" />
                  <el-option value="flex-end" label="flex-end" />
                  <el-option value="stretch" label="stretch" />
                </el-select>
              </StyleRow>
              <StyleRow title="换行" hasValue={!!sd.value.flexWrap}>
                <el-select modelValue={sd.value.flexWrap ?? ""} size="small" style="width: 100%" onChange={(v: string) => emit("flexWrap", v)}>
                  <el-option value="" label="默认" />
                  <el-option value="nowrap" label="nowrap" />
                  <el-option value="wrap" label="wrap" />
                  <el-option value="wrap-reverse" label="wrap-reverse" />
                </el-select>
              </StyleRow>
            </>
          )}

          {cfg.isShowWidthHeight && (
            <StyleRow title="宽高">
              <div class="layout-style-container__pair">
                <StyleNumberInput modelValue={sd.value.width ?? ""} units={["px", "%"]} placeholder="width" on-change={(v: string) => emit("width", v)} />
                <StyleNumberInput modelValue={sd.value.height ?? ""} units={["px", "%"]} placeholder="height" on-change={(v: string) => emit("height", v)} />
              </div>
            </StyleRow>
          )}

          <LayoutBox
            styleData={sd.value}
            onStyleChange={props.onStyleChange}
            isShowMargin={cfg.isShowMargin}
            isShowPadding={cfg.isShowPadding}
          />
        </div>
      );
    };
  },
});
