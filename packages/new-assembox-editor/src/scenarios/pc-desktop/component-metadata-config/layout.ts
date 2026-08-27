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
    // scaffold 与 lib 运行时默认值（assem-yq-flex-box.vue useNodeOptions）严格对齐：
    // width/height "100%"（渲染层默认，显式快照）；格子 defaultSlot null（空槽占位引导拖入，
    // insertChildIntoOpts 间接容器分支空壳优先填充）；contentType 为旧版遗留（新版
    // wrapper/UI 库均不消费），不再生成
    scaffold: {
      renderType: "YqFlexBox",
      isRow: true,
      itemNum: 1,
      width: "100%",
      height: "100%",
      itemConfig: [
        { isFixed: false, size: "", paddingSize: "base", clearPadding: [], showDragButton: false, dragButtonPosition: "", isHidden: false, defaultSlot: null },
      ],
    },
    props: [
      { name: "isRow", title: "水平排列", propType: "boolean", defaultValue: true },
      { name: "width", title: "宽度", propType: "string", defaultValue: "100%" },
      { name: "height", title: "高度", propType: "string", defaultValue: "100%" },
      // itemNum 不提供编辑（Q2）：长度由 itemConfig 增删驱动，syncLengthField 回写
      // 维持 schema 双字段一致（渲染层按 itemNum 循环读 itemConfig，不同步即崩）
      {
        name: "itemConfig",
        title: "格子配置",
        propType: "json",
        // labelVisible=false：面板窄，不占顶层 label 列让格子编辑区全宽
        labelVisible: false,
        setter: "ArraySetter",
        setterProps: {
          itemSetter: {
            setter: "ObjectSetter",
            // 紧凑布局：内层 label 列收窄 + halfWidth 两列网格（窄面板给控件留宽）
            props: { labelWidth: "68px", grid: true },
          },
          itemConfig: {
            items: [
              { name: "tag", title: "子项标识", propType: "string", setter: "LabelSetter", halfWidth: true },
              { name: "isFixed", title: "固定区域", propType: "boolean", defaultValue: false, halfWidth: true },
              { name: "size", title: "固定大小", propType: "string", defaultValue: "" },
              { name: "paddingSize", title: "内边距", propType: { type: "oneOf", value: ["large", "base", "small"], labels: ["大", "常规", "小"] }, defaultValue: "base" },
              clearDirectionProp("clearPadding", "清除内边距"),
              { name: "showDragButton", title: "缩放按钮", propType: "boolean", defaultValue: false, halfWidth: true },
              { name: "dragButtonPosition", title: "缩放位置", propType: { type: "oneOf", value: ["left", "right", "top", "bottom"], labels: ["左", "右", "上", "下"] } },
              { name: "isFold", title: "默认折叠", propType: "boolean", defaultValue: false, halfWidth: true },
              { name: "expandSize", title: "展开大小", propType: "string", defaultValue: "" },
              { name: "isHidden", title: "隐藏区域", propType: "boolean", defaultValue: false, halfWidth: true },
            ],
          },
          // 新格子初值（Q6）：ArraySetter initialValue 是**单项初值**（非数组）——
          // defaultSlot null 走空槽占位；tag 由 rekey 补 item-N
          initialValue: { isFixed: false, size: "", paddingSize: "base", clearPadding: [], showDragButton: false, dragButtonPosition: "", isHidden: false, defaultSlot: null },
          // 折叠模式（窄面板空间优化）：子项默认收起，行头显示 tag，点击展开编辑
          collapsible: true,
          itemTitle: (item: any, index: number) => item?.tag || `格子 ${index + 1}`,
          // 删除保护（对齐旧版）：二次确认（删格子连带格内子树，undo 可恢复）+ 至少保留 1 格
          confirmRemove: "删除该格子将同时删除格子内的全部内容（可通过撤销恢复），确认删除？",
          itemMinLength: 1,
          // tag 是 UI 库 slot 命名键（item-N），增删/排序后按新 index 重排，
          // 数据源头正确（UI 库 watchEffect 修正退化为双保险）
          rekey: (item: any, index: number) => ({ ...item, tag: `item-${index + 1}` }),
          // 长度回写兄弟字段（Q2：itemNum 单一事实源 = itemConfig.length）
          syncLengthField: "itemNum",
        },
      },
    ],
    events: baseEvents(),
    // 间接容器槽位（slot-accessors INDIRECT_CONTAINERS itemConfig[].defaultSlot，
    // removeMode set-null 删子留壳）
    slots: [{ name: "defaultSlot", slotType: "array", description: "格子内容" }],
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
