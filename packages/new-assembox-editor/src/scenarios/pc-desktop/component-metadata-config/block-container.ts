import type { ComponentCatalogItem } from '../../../scenario';
import { baseEvents, clearDirectionProp } from "./shared";

/**
 * 块容器组件（源码：components/block-contanier/ + block-element/assem-yq-navigation.vue）
 * - YqBox 盒子 / YqPanel 面板 / YqToolBar 工具栏 / TabPanel 选项卡 / YqNavigationBar 导航栏
 */
export const blockContainerComponents: ComponentCatalogItem[] = [
  {
    renderType: "YqBox",
    name: "盒子",
    group: "container",
    category: "container-item",
    scaffold: { renderType: "YqBox", border: true, shadow: false, background: false, paddingSize: "base", clearPadding: [], height: "", clearBorder: [], defaultSlot: null },
    props: [
      { name: "border", title: "边框", propType: "boolean", defaultValue: true },
      { name: "shadow", title: "阴影", propType: "boolean", defaultValue: false },
      { name: "background", title: "背景", propType: "boolean", defaultValue: false },
      {
        name: "paddingSize",
        title: "内边距",
        propType: { type: "oneOf", value: ["base", "small", "large"], labels: ["常规", "小", "大"] },
        defaultValue: "base",
      },
      clearDirectionProp("clearPadding", "清除内边距"),
      { name: "height", title: "高度", propType: "string", defaultValue: "" },
      clearDirectionProp("clearBorder", "清除边框"),
    ],
    events: baseEvents(),
    // 数组槽（v-for 消费）
    slots: [{ name: "defaultSlot", slotType: "array", description: "内容区" }],
  },
  {
    renderType: "YqPanel",
    name: "面板",
    group: "container",
    category: "container-item",
    scaffold: { renderType: "YqPanel", showHeader: true, headerType: "base", title: "面板标题", border: true, paddingSize: "base", clearPadding: [], height: "", toolSlot: null, defaultSlot: null },
    props: [
      { name: "showHeader", title: "显示头部", propType: "boolean", defaultValue: true },
      {
        name: "headerType",
        title: "头部类型",
        propType: { type: "oneOf", value: ["base", "card"], labels: ["常规", "卡片"] },
        defaultValue: "base",
      },
      { name: "title", title: "标题", propType: "string", defaultValue: "面板标题" },
      { name: "border", title: "边框", propType: "boolean", defaultValue: true },
      {
        name: "paddingSize",
        title: "内边距",
        propType: { type: "oneOf", value: ["base", "small", "large"], labels: ["常规", "小", "大"] },
        defaultValue: "base",
      },
      clearDirectionProp("clearPadding", "清除内边距"),
      { name: "height", title: "高度", propType: "string", defaultValue: "" },
    ],
    events: baseEvents(),
    // 数组槽（v-for 消费）
    slots: [
      { name: "defaultSlot", slotType: "array", description: "内容区" },
      { name: "toolSlot", slotType: "array", description: "头部工具区" },
    ],
  },
  {
    renderType: "YqToolBar",
    name: "工具栏",
    group: "container",
    category: "container-item",
    scaffold: { renderType: "YqToolBar", divider: false, showMore: false, paddingSize: "base", clearPadding: [], border: false, toolMaxWidth: "", toolSlot: [], filterSlot: [] },
    props: [
      { name: "divider", title: "分割线", propType: "boolean", defaultValue: false },
      { name: "showMore", title: "显示更多", propType: "boolean", defaultValue: false },
      {
        name: "paddingSize",
        title: "内边距",
        propType: { type: "oneOf", value: ["base", "small", "large"], labels: ["常规", "小", "大"] },
        defaultValue: "base",
      },
      clearDirectionProp("clearPadding", "清除内边距"),
      { name: "border", title: "边框", propType: "boolean", defaultValue: false },
      { name: "filterGutter", title: "筛选项间距", propType: "number", defaultValue: undefined },
      { name: "toolMaxWidth", title: "工具区最大宽度", propType: "string", defaultValue: "" },
      // 插槽启停切换（SlotToggleSetter 从下方 slots 声明反查槽位语义，无需重复配置）
      { name: "defaultSlot", title: "默认插槽", propType: "json", setter: "SlotToggleSetter" },
      { name: "toolSlot", title: "工具栏插槽", propType: "json", setter: "SlotToggleSetter" },
      { name: "filterSlot", title: "过滤器插槽", propType: "json", setter: "SlotToggleSetter" },
    ],
    events: baseEvents(),
    // 槽位语义声明（docs/19）：defaultSlot 单节点（wrapper assem-yq-tool-bar.vue:31
    // 直渲单个 AssemYqFlexLine）+ 组件级白名单（精确到 YqFlexLine，修复 category
    // 门禁放行 GridBox/FlexBox 的粒度缺口）；toolSlot/filterSlot 数组（v-for，
    // 未声明 slotRender 走 category 门禁，先宽后收）
    slots: [
      { name: "defaultSlot", slotType: "object", slotRender: ["YqFlexLine"], description: "默认插槽" },
      { name: "toolSlot", slotType: "array", description: "工具栏插槽" },
      { name: "filterSlot", slotType: "array", description: "过滤器插槽" },
    ],
  },
  {
    renderType: "TabPanel",
    name: "选项卡",
    group: "container",
    category: "container-item",
    scaffold: { renderType: "TabPanel", activeName: "1", type: "", stretch: false, tabPosition: "top", tabPane: [{ name: "1", label: "选项卡1", lazy: false, disabled: false, isHidden: false, defaultSlot: null }] },
    props: [
      { name: "activeName", title: "激活页签", propType: "string", defaultValue: "1", setter: "ModelNameSetter" },
      {
        name: "type",
        title: "风格",
        propType: { type: "oneOf", value: ["", "card", "border-card"], labels: ["默认", "卡片", "带边框卡片"] },
        defaultValue: "",
      },
      { name: "stretch", title: "页签撑满", propType: "boolean", defaultValue: false },
      {
        name: "tabPosition",
        title: "页签位置",
        propType: { type: "oneOf", value: ["top", "right", "bottom", "left"], labels: ["上", "右", "下", "左"] },
        defaultValue: "top",
      },
      {
        name: "tabPane",
        title: "页签配置",
        propType: "json",
        labelVisible: false,
        setter: "ArraySetter",
        setterProps: {
          collapsible: true,
          itemTitle: (item: any, index: number) => item?.label || item?.name || `页签 ${index + 1}`,
          confirmRemove: "删除该页签将同时删除页签内的全部内容（可通过撤销恢复），确认删除？",
          itemMinLength: 1,
          itemSetter: {
            setter: "ObjectSetter",
            props: { labelWidth: "68px", grid: true },
          },
          itemConfig: {
            items: [
              { name: "name", title: "页签标识", propType: "string", defaultValue: "" },
              { name: "label", title: "页签标题", propType: "string", defaultValue: "" },
              { name: "lazy", title: "懒加载", propType: "boolean", defaultValue: false, halfWidth: true },
              { name: "disabled", title: "禁用", propType: "boolean", defaultValue: false, halfWidth: true },
              { name: "isHidden", title: "隐藏", propType: "boolean", defaultValue: false, halfWidth: true },
            ],
          },
          // 新页签初值：name 唯一（tab-N，activeName 引用它）；label 带序号便于折叠行头区分。
          // 注意：name 不参与 rekey —— activeName/事件可能引用它，排序后不应改名。
          initialValue: (index: number) => ({
            name: `tab-${index + 1}`,
            label: `页签${index + 1}`,
            lazy: false,
            disabled: false,
            isHidden: false,
            defaultSlot: null,
          }),
        },
      },
    ],
    events: [
      { name: "onMounted", title: "挂载后" },
      { name: "onTabClick", title: "页签点击" },
      { name: "onBeforeTabLeave", title: "切换页签前" },
      { name: "onValueRender", title: "值渲染" },
    ],
    // 数组槽（tabPane 间接容器 + 页签标签槽）
    slots: [
      { name: "defaultSlot", slotType: "array", description: "页签内容" },
      { name: "labelSlot", slotType: "array", description: "页签标签" },
    ],
  },
  {
    renderType: "YqNavigationBar",
    name: "导航栏",
    group: "container",
    category: "container-item",
    scaffold: { renderType: "YqNavigationBar", routers: [], height: "" },
    props: [
      { name: "routers", title: "路由配置", propType: "json", defaultValue: [] },
      { name: "height", title: "高度", propType: "string", defaultValue: "" },
    ],
    events: [
      { name: "onMounted", title: "挂载后" },
      { name: "onRouteChange", title: "路由变化" },
      { name: "onValueRender", title: "值渲染" },
    ],
    // 单节点槽（wrapper assem-yq-navigation.vue:10 直渲进 #tool）
    slots: [{ name: "defaultSlot", slotType: "object", description: "工具区" }],
  },
];
