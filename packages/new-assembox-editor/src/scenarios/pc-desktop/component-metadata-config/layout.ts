import type { ComponentCatalogItem } from "../../../scenario/types";
import { baseEvents, clearDirectionProp } from "./shared";

/**
 * 布局组件（源码：components/layout/）
 * - YqFlexBox 弹性布局 / YqFlexLine 弹性行 / GridBox 网格布局 / GridItem 网格项
 */
export const layoutComponents: ComponentCatalogItem[] = [
  {
    renderType: "YqFlexBox",
    name: "弹性布局",
    group: "layout",
    category: "layout-item",
    scaffold: {
      renderType: "YqFlexBox",
      isRow: true,
      itemNum: 1,
      itemConfig: [{ isFixed: false, paddingSize: "base", clearPadding: [], isHidden: false, contentType: "container", defaultSlot: null }],
    },
    props: [
      { name: "isRow", title: "水平排列", propType: "boolean", defaultValue: true },
      { name: "itemNum", title: "子项数量", propType: "number", defaultValue: 1 },
      { name: "itemConfig", title: "子项配置", propType: "json", defaultValue: [] },
      { name: "width", title: "宽度", propType: "string", defaultValue: "" },
      { name: "height", title: "高度", propType: "string", defaultValue: "" },
    ],
    events: baseEvents(),
  },
  {
    renderType: "YqFlexLine",
    name: "弹性行",
    group: "layout",
    category: "layout-item",
    // scaffold 与 lib 运行时默认值（assem-yq-flex-line.vue useNodeOptions）严格对齐：
    // padding=false（无内边距，由外层容器控制）、spaceSize=8（el-space 数值间距）
    scaffold: {
      renderType: "YqFlexLine",
      leftWidth: "50%",
      leftPadding: true,
      leftClearPadding: [],
      rightPadding: true,
      rightClearPadding: [],
      leftSpaceSize: 8,
      rightSpaceSize: 8,
      defaultSlot: [],
      rightSlot: [],
    },
    props: [
      { name: "leftWidth", title: "左侧宽度", propType: "string", defaultValue: "50%" },
      { name: "leftPadding", title: "左侧内边距", propType: "boolean", defaultValue: true },
      // 方向枚举（UI 库映射 padding-clear-${dir} 类，flex-line.vue:39/49）
      clearDirectionProp("leftClearPadding", "左侧清除边距方向"),
      { name: "rightPadding", title: "右侧内边距", propType: "boolean", defaultValue: true },
      clearDirectionProp("rightClearPadding", "右侧清除边距方向"),
      { name: "leftSpaceSize", title: "左子项间距", propType: "number", defaultValue: 8 },
      { name: "rightSpaceSize", title: "右子项间距", propType: "number", defaultValue: 8 },
    ],
    events: baseEvents(),
    // 数组槽（左右区 v-for 消费）
    slots: [
      { name: "defaultSlot", slotType: "array", description: "左侧内容区" },
      { name: "rightSlot", slotType: "array", description: "右侧内容区" },
    ],
  },
  {
    renderType: "GridBox",
    name: "网格布局",
    group: "layout",
    category: "layout-item",
    scaffold: { renderType: "GridBox", gutter: 0, divider: false, title: "", contentPosition: "left", defaultExpand: true, defaultSlot: [] },
    props: [
      { name: "gutter", title: "栅格间隔", propType: "number", defaultValue: 0 },
      {
        name: "justify",
        title: "水平排列",
        propType: { type: "oneOf", value: ["start", "center", "end", "space-around", "space-between", "space-evenly"], labels: ["起始", "居中", "末尾", "环绕", "两端", "等距"] },
        defaultValue: "start",
      },
      {
        name: "align",
        title: "垂直对齐",
        propType: { type: "oneOf", value: ["top", "middle", "bottom"], labels: ["顶部", "居中", "底部"] },
        defaultValue: "top",
      },
      { name: "divider", title: "显示分割线", propType: "boolean", defaultValue: false },
      { name: "title", title: "分割线标题", propType: "string", defaultValue: "" },
      { name: "disableFold", title: "禁用折叠", propType: "boolean", defaultValue: false },
      {
        name: "contentPosition",
        title: "标题位置",
        propType: { type: "oneOf", value: ["left", "center", "right"], labels: ["左", "中", "右"] },
        defaultValue: "left",
      },
      { name: "defaultExpand", title: "默认展开", propType: "boolean", defaultValue: true },
    ],
    events: baseEvents(),
    // 数组槽（v-for 消费；子项应为 GridItem——category 门禁 ['layout'] 收口）
    slots: [{ name: "defaultSlot", slotType: "array", description: "内容区" }],
  },
  {
    renderType: "GridItem",
    name: "网格项",
    group: "layout",
    category: "layout-item",
    scaffold: { renderType: "GridItem", span: 24, defaultSlot: null },
    props: [
      { name: "span", title: "占据列数", propType: "number", defaultValue: 24 },
      { name: "offset", title: "左侧偏移列数", propType: "number", defaultValue: 0 },
      { name: "push", title: "右移列数", propType: "number", defaultValue: 0 },
      { name: "pull", title: "左移列数", propType: "number", defaultValue: 0 },
      { name: "xs", title: "<768px 列数", propType: "number", defaultValue: undefined },
      { name: "sm", title: "≥768px 列数", propType: "number", defaultValue: undefined },
      { name: "md", title: "≥992px 列数", propType: "number", defaultValue: undefined },
      { name: "lg", title: "≥1200px 列数", propType: "number", defaultValue: undefined },
      { name: "xl", title: "≥1920px 列数", propType: "number", defaultValue: undefined },
    ],
    events: baseEvents(),
    // 单节点槽（wrapper assem-grid-item.vue:17 直渲单个子项）
    slots: [{ name: "defaultSlot", slotType: "object", description: "内容区" }],
  },
];
