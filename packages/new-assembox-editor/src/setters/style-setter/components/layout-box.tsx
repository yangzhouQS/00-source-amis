import type { PropType } from "vue";
import type { OnStyleChange } from "../utils";
/**
 * LayoutBox — 可视化 margin/padding 盒子模型
 * 深度复刻 lowcode style-setter pro/layout/layoutBox.tsx
 *
 * 一个 150px 高的 CSS 三角形盒子：
 * - 外层 4 个三角形 = margin（top/right/bottom/left）
 * - 内层 4 个三角形 = padding（top/right/bottom/left）
 * - 每个三角形上叠加一个透明背景输入框
 * - 三角形 hover 变色，有值时蓝框
 */
import { defineComponent } from "vue";
import { isCssVarBind } from "../utils";

export const LayoutBox = defineComponent({
  name: "StyleLayoutBox",
  props: {
    styleData: { type: Object as PropType<Record<string, any>>, required: true },
    onStyleChange: { type: Function as PropType<OnStyleChange>, required: true },
    unit: { type: String, default: "px" },
    isShowMargin: { type: Boolean, default: true },
    isShowPadding: { type: Boolean, default: true },
  },
  setup(props) {
    const emit = (styleKey: string, raw: string) => {
      if (!raw) {
        props.onStyleChange([{ styleKey, value: null }]);
        return;
      }
      props.onStyleChange([{ styleKey, value: /^-?\d+(\.\d+)?$/.test(raw) ? `${raw}${props.unit}` : raw }]);
    };

    const stripUnit = (v: any): string => {
      if (!v) {
        return "";
      }
      const s = String(v);
      return s.replace(/px$/, "");
    };

    const renderInput = (key: string, cls: string, val: any) => {
      if (isCssVarBind(val)) {
        return <span class="layout-box__var-bind">{String(val).slice(0, 6)}</span>;
      }
      return (
        <input
          class={`layout-box__input ${cls}`}
          value={stripUnit(val)}
          placeholder="auto"
          onInput={(e: Event) => emit(key, (e.target as HTMLInputElement).value)}
        />
      );
    };

    return () => (
      <div class="layout-box">
        {props.isShowMargin && (
          <>
            <div class={`layout-box__margin-top ${isCssVarBind(props.styleData.marginTop) ? "is-var" : ""}`}>
              {renderInput("marginTop", "", props.styleData.marginTop)}
              <span class="layout-box__label">M</span>
            </div>
            <div class={`layout-box__margin-right ${isCssVarBind(props.styleData.marginRight) ? "is-var" : ""}`}>
              {renderInput("marginRight", "layout-box__input--vertical", props.styleData.marginRight)}
            </div>
            <div class={`layout-box__margin-bottom ${isCssVarBind(props.styleData.marginBottom) ? "is-var" : ""}`}>
              {renderInput("marginBottom", "", props.styleData.marginBottom)}
            </div>
            <div class={`layout-box__margin-left ${isCssVarBind(props.styleData.marginLeft) ? "is-var" : ""}`}>
              {renderInput("marginLeft", "layout-box__input--vertical", props.styleData.marginLeft)}
            </div>
          </>
        )}
        {props.isShowPadding && (
          <>
            <div class={`layout-box__padding-top ${isCssVarBind(props.styleData.paddingTop) ? "is-var" : ""}`}>
              {renderInput("paddingTop", "", props.styleData.paddingTop)}
              <span class="layout-box__label">P</span>
            </div>
            <div class={`layout-box__padding-right ${isCssVarBind(props.styleData.paddingRight) ? "is-var" : ""}`}>
              {renderInput("paddingRight", "layout-box__input--vertical", props.styleData.paddingRight)}
            </div>
            <div class={`layout-box__padding-bottom ${isCssVarBind(props.styleData.paddingBottom) ? "is-var" : ""}`}>
              {renderInput("paddingBottom", "", props.styleData.paddingBottom)}
            </div>
            <div class={`layout-box__padding-left ${isCssVarBind(props.styleData.paddingLeft) ? "is-var" : ""}`}>
              {renderInput("paddingLeft", "layout-box__input--vertical", props.styleData.paddingLeft)}
            </div>
          </>
        )}
        <div class="layout-box__center" />
      </div>
    );
  },
});
