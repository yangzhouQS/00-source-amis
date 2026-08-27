import { byRegionSelectors } from "./region-contains";

/**
 * YqToolBar 槽位识别（element-plus-ui tool-bar.vue）
 *
 * DOM 结构：
 *   .yq-tool-bar（组件根）
 *   ├── .yq-filter-area
 *   │   ├── .yq-filter-content   筛选区（#filter，YqFilterItem 们）
 *   │   └── .yq-tool-func > .yq-tool-slot   工具按钮区（#tool）
 *   └── .yq-tool-bar-tool        默认区（#default，wrapper 单节点 FlexLine）
 *
 * defaultSlot 说明（assem-yq-tool-bar.vue:31-41）：wrapper 硬编码以
 * AssemYqFlexLine 渲染 defaultSlot 单节点；nesting 门禁收紧为 layout 类。
 * `.yq-tool-bar-tool` 由 v-if="slots.default" 控制（defaultSlot 为空时
 * 该区域不渲染，本规则查不到自动回退 defaultSlot，行为一致无害）。
 *
 * toolSlot 双区域：`.yq-tool-slot`（精确）+ `.yq-tool-func`（容器兜底）——
 * 空槽时 .yq-tool-slot 宽度坍缩，悬停常落在其容器间隙上，整个函数区
 * （含被注释的 more 展开位）均归 toolSlot，避免命中穿透回退 defaultSlot。
 * 类名来源 tool-bar.vue:3/6/7/9/33；升级 UI 库改类名时同步。
 */
export const resolveToolBarSlot = byRegionSelectors([
  { selector: ".yq-filter-content", slotKey: "filterSlot" },
  { selector: ".yq-tool-slot", slotKey: "toolSlot" },
  { selector: ".yq-tool-func", slotKey: "toolSlot" },
  { selector: ".yq-tool-bar-tool", slotKey: "defaultSlot" },
]);
