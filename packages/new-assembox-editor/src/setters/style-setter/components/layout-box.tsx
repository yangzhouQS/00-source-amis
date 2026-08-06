import type { PropType } from "vue";
import type { OnStyleChange } from "../utils";
/**
 * LayoutBox — 可视化 margin/padding 盒子模型
 * 深度复刻 lowcode style-setter pro/layout/layoutBox.tsx
 *
 * 输入策略：非受控 input + blur 提交（避免每次按键触发 commit → re-render 干扰输入）
 */
import { defineComponent, reactive } from "vue";
import { isCssVarBind } from "../utils";

const KEYS = [
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
] as const;

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
    /** 各输入框的本地文本（非受控，输入过程中不触发外部更新） */
    const local = reactive<Record<string, string>>({});

    const stripUnit = (v: any): string => {
      if (!v) {
        return "";
      }
      return String(v).replace(/px$/, "");
    };

    /** 初始化 / 外部值变化时同步本地 */
    const syncLocal = () => {
      for (const k of KEYS) {
        local[k] = stripUnit(props.styleData[k]);
      }
    };
    syncLocal();

    /** blur 时提交值 */
    const commit = (key: string) => {
      const raw = (local[key] ?? "").trim();
      if (!raw) {
        props.onStyleChange([{ styleKey: key, value: null }]);
        return;
      }
      const v = /^-?\d+(\.\d+)?$/.test(raw) ? `${raw}${props.unit}` : raw;
      props.onStyleChange([{ styleKey: key, value: v }]);
    };

    const renderInput = (key: string, cls: string) => {
      const val = props.styleData[key];
      if (isCssVarBind(val)) {
        return <span class="layout-box__var-bind">{String(val).slice(0, 6)}</span>;
      }
      return (
        <input
          class={`layout-box__input ${cls}`}
          value={local[key] ?? ""}
          placeholder="auto"
          onFocus={() => {
            local[key] = stripUnit(val);
          }}
          onInput={(e: Event) => {
            local[key] = (e.target as HTMLInputElement).value;
          }}
          onBlur={() => commit(key)}
          onKeyup={(e: KeyboardEvent) => {
            if (e.key === "Enter") {
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
      );
    };

    return () => {
      // 每次渲染同步外部值到本地（非聚焦时）
      syncLocal();
      return (
        <div class="layout-box">
          {props.isShowMargin && (
            <>
              <div class={`layout-box__margin-top ${isCssVarBind(props.styleData.marginTop) ? "is-var" : ""}`}>
                {renderInput("marginTop", "")}
                <span class="layout-box__label">M</span>
              </div>
              <div class={`layout-box__margin-right ${isCssVarBind(props.styleData.marginRight) ? "is-var" : ""}`}>
                {renderInput("marginRight", "layout-box__input--vertical")}
              </div>
              <div class={`layout-box__margin-bottom ${isCssVarBind(props.styleData.marginBottom) ? "is-var" : ""}`}>
                {renderInput("marginBottom", "")}
              </div>
              <div class={`layout-box__margin-left ${isCssVarBind(props.styleData.marginLeft) ? "is-var" : ""}`}>
                {renderInput("marginLeft", "layout-box__input--vertical")}
              </div>
            </>
          )}
          {props.isShowPadding && (
            <>
              <div class={`layout-box__padding-top ${isCssVarBind(props.styleData.paddingTop) ? "is-var" : ""}`}>
                {renderInput("paddingTop", "")}
                <span class="layout-box__label">P</span>
              </div>
              <div class={`layout-box__padding-right ${isCssVarBind(props.styleData.paddingRight) ? "is-var" : ""}`}>
                {renderInput("paddingRight", "layout-box__input--vertical")}
              </div>
              <div class={`layout-box__padding-bottom ${isCssVarBind(props.styleData.paddingBottom) ? "is-var" : ""}`}>
                {renderInput("paddingBottom", "")}
              </div>
              <div class={`layout-box__padding-left ${isCssVarBind(props.styleData.paddingLeft) ? "is-var" : ""}`}>
                {renderInput("paddingLeft", "layout-box__input--vertical")}
              </div>
            </>
          )}
          <div class="layout-box__center" />
        </div>
      );
    };
  },
});
