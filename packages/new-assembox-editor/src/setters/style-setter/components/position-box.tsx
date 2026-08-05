import type { PropType } from "vue";
import type { OnStyleChange } from "../utils";
/**
 * PositionBox — 可视化定位盒子（top/right/bottom/left）
 * 深度复刻 lowcode style-setter pro/position/positionBox.tsx
 *
 * 150px 高的 CSS 三角形盒子，4 个方向三角形叠加输入框。
 * position=absolute 时额外支持快速模板（四角定位）。
 */
import { defineComponent } from "vue";

export const PositionBox = defineComponent({
  name: "StylePositionBox",
  props: {
    styleData: { type: Object as PropType<Record<string, any>>, required: true },
    onStyleChange: { type: Function as PropType<OnStyleChange>, required: true },
    unit: { type: String, default: "px" },
  },
  setup(props) {
    const emit = (styleKey: string, raw: string) => {
      if (!raw) {
        props.onStyleChange([{ styleKey, value: null }]);
        return;
      }
      props.onStyleChange([{ styleKey, value: /^-?\d+(\.\d+)?$/.test(raw) ? `${raw}${props.unit}` : raw }]);
    };

    const stripUnit = (v: any): string => (v ? String(v).replace(/px$/, "") : "");

    const input = (key: string, cls: string) => (
      <input
        class={`position-box__input ${cls}`}
        value={stripUnit(props.styleData[key])}
        placeholder="auto"
        maxlength={6}
        onInput={(e: Event) => emit(key, (e.target as HTMLInputElement).value)}
      />
    );

    const applyTemplate = (template: string) => {
      const changes: Array<{ styleKey: string; value: any }> = [];
      const s = (k: string, v: string) => changes.push({ styleKey: k, value: v });
      // 重置全部
      s("top", "");
      s("right", "");
      s("bottom", "");
      s("left", "");
      if (template === "topLeft") {
        s("top", "0px");
        s("left", "0px");
      } else if (template === "topRight") {
        s("top", "0px");
        s("right", "0px");
      } else if (template === "bottomLeft") {
        s("bottom", "0px");
        s("left", "0px");
      } else if (template === "bottomRight") {
        s("bottom", "0px");
        s("right", "0px");
      }
      props.onStyleChange(changes);
    };

    const isAbsolute = props.styleData.position === "absolute";

    return () => (
      <div class="position-box">
        {isAbsolute && (
          <div class="position-box__templates">
            <el-button text size="small" onClick={() => applyTemplate("topLeft")}>↖ 左上</el-button>
            <el-button text size="small" onClick={() => applyTemplate("topRight")}>↗ 右上</el-button>
            <el-button text size="small" onClick={() => applyTemplate("bottomLeft")}>↙ 左下</el-button>
            <el-button text size="small" onClick={() => applyTemplate("bottomRight")}>↘ 右下</el-button>
          </div>
        )}
        <div class="position-box__visual">
          <div class="position-box__top">
            {input("top", "")}
          </div>
          <div class="position-box__right">
            {input("right", "position-box__input--vertical")}
          </div>
          <div class="position-box__bottom">
            {input("bottom", "")}
          </div>
          <div class="position-box__left">
            {input("left", "position-box__input--vertical")}
          </div>
        </div>
      </div>
    );
  },
});
