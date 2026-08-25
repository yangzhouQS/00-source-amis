import { byRegionSelectors } from "./region-contains";

/**
 * YqPanel 槽位识别（element-plus-ui panel.vue）
 *
 * DOM 结构：
 *   .yq-panel（组件根）
 *   ├── .panel-header > .header-tool > .tool-content   工具区（#tool）
 *   └── .panel-content                                  内容区（#default）
 *
 * headerType=card 时 header 结构有差异（.header-left 等），
 * 但 .tool-content 在两种形态下都存在（panel.vue:7）。
 * 类名来源 panel.vue:2/7/11；升级 UI 库改类名时同步。
 */
export const resolvePanelSlot = byRegionSelectors([
  { selector: ".panel-content", slotKey: "defaultSlot" },
  { selector: ".header-tool .tool-content", slotKey: "toolSlot" },
]);
