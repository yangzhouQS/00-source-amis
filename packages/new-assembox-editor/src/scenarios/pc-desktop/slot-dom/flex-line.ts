import { byRegionSelectors } from "./region-contains";

/**
 * YqFlexLine 槽位识别（element-plus-ui flex-line.vue）
 *
 * DOM 结构：
 *   .yq-flex-line（组件根，data-editor-id）
 *   ├── .yq-flex_line_left   默认插槽区（#default，el-space 包子项）
 *   └── .yq-flex_line_right  右插槽区（#right）
 *
 * 左右区宽度由 leftWidth 控制，命中哪区即投哪个槽。
 * 类名来源 flex-line.vue:3/6；升级 UI 库改类名时同步。
 */
export const resolveFlexLineSlot = byRegionSelectors([
  { selector: ".yq-flex_line_left", slotKey: "defaultSlot" },
  { selector: ".yq-flex_line_right", slotKey: "rightSlot" },
]);
