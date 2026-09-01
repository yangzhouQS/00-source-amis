import { byRegionSelectors } from "./region-contains";

/**
 * TabPanel 槽位识别（element-plus el-tabs DOM 结构）
 *
 * DOM 结构（el-tabs / el-tab-pane）：
 *   .el-tabs（组件根，data-editor-id 在 wrapper 外层）
 *   ├── .el-tabs__header > .el-tabs__nav > .el-tab-nav-scroll > .el-tabs__nav-wrap
 *   │     └── .el-tabs__nav [role=tablist]
 *   │           ├── #tab-{name}（页签头：labelSlot 区域）
 *   │           └── ...
 *   └── .el-tabs__content
 *         └── #pane-{name} > .el-tab-pane（各页签内容：defaultSlot 区域）
 *
 * 页签匹配策略：
 * - 内容区（defaultSlot）：命中 #pane-xxx / .el-tab-pane / .el-tab-pane 内部
 *   → 按命中元素的 pane-name 属性或 id（#pane-{name}）反查对应 tabPane 数组项
 * - 页签头（labelSlot）：命中 #tab-xxx（页签导航条目）
 *   → 同理按 name 反查
 * - 关键约束：**不能按 DOM 顺序匹配**（页签可增删/排序/隐藏，DOM 顺序≠数组顺序），
 *   必须按 name 键精确路由——否则多页签时内容会挂错页签。
 *   （反查由 insertChildIntoOpts 完成——resolveSlot 只需返回 "defaultSlot"/"labelSlot"，
 *    name 级精确路由在 insert 侧通过 activeName 偏好 + createEntry 追加实现）
 */
export const resolveTabPanelSlot = byRegionSelectors([
  { selector: ".el-tabs__content", slotKey: "defaultSlot" },
  { selector: ".el-tabs__nav", slotKey: "labelSlot" },
]);
