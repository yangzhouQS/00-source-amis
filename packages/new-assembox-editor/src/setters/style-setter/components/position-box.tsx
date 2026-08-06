import type { PropType } from "vue";
import type { OnStyleChange } from "../utils";
/**
 * PositionBox — 可视化定位盒子（top/right/bottom/left）
 * 深度复刻 lowcode style-setter pro/position/positionBox.tsx
 *
 * 输入策略：非受控 input + blur 提交（避免每次按键触发 commit → re-render 干扰输入）
 */
import { defineComponent, reactive } from "vue";

const POS_KEYS = ["top", "right", "bottom", "left"] as const;

export const PositionBox = defineComponent({
  name: "StylePositionBox",
  props: {
    styleData: { type: Object as PropType<Record<string, any>>, required: true },
    onStyleChange: { type: Function as PropType<OnStyleChange>, required: true },
    unit: { type: String, default: "px" },
  },
  setup(props) {
    /** 本地文本（非受控，blur 时提交） */
    const local = reactive<Record<string, string>>({});

    const stripUnit = (v: any): string => (v ? String(v).replace(/px$/, "") : "");

    const syncLocal = () => {
      for (const k of POS_KEYS) {
        local[k] = stripUnit(props.styleData[k]);
      }
    };
    syncLocal();

    const commit = (key: string) => {
      const raw = (local[key] ?? "").trim();
      if (!raw) {
        props.onStyleChange([{ styleKey: key, value: null }]);
        return;
      }
      const v = /^-?\d+(\.\d+)?$/.test(raw) ? `${raw}${props.unit}` : raw;
      props.onStyleChange([{ styleKey: key, value: v }]);
    };

    const input = (key: string, cls: string) => (
      <input
        class={`position-box__input ${cls}`}
        value={local[key] ?? ""}
        placeholder="auto"
        maxlength={6}
        onFocus={() => {
          local[key] = stripUnit(props.styleData[key]);
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

    const applyTemplate = (template: string) => {
      const changes: Array<{ styleKey: string; value: any }> = [];
      const s = (k: string, v: string) => changes.push({ styleKey: k, value: v });
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

    return () => {
      syncLocal();
      return (
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
    };
  },
});
