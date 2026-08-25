import { byRegionSelectors } from "./region-contains";

/**
 * YqToolBar 槽位识别（element-plus-ui tool-bar.vue）
 *
 * DOM 结构：
 *   .yq-tool-bar（组件根）
 *   └── .yq-filter-area
 *       ├── .yq-filter-content   筛选区（#filter，YqFilterItem 们）
 *       └── .yq-tool-func > .yq-tool-slot   工具按钮区（#tool）
 *
 * 注意：tool-bar.vue 的 #default 模板也渲染在 .yq-tool-bar-tool（:19），
 * schema 侧 Toolbar 子节点存 toolSlot/filterSlot（slot-accessors DIRECT_SLOTS），
 * .yq-tool-bar-tool 与 .yq-tool-slot 视觉相邻——defaultSlot 未在 SLOTS 门禁登记，
 * 故不为其建规则；若后续 schema 支持再补。
 * 类名来源 tool-bar.vue:3/6/7/9；升级 UI 库改类名时同步。
 */
export const resolveToolBarSlot = byRegionSelectors([
  { selector: ".yq-filter-content", slotKey: "filterSlot" },
  { selector: ".yq-tool-slot", slotKey: "toolSlot" },
]);
