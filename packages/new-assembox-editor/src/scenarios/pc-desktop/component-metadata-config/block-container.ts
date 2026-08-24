import type { ComponentCatalogItem } from "../../../scenario/types";
import { baseEvents } from "./shared";

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
      { name: "clearPadding", title: "清除内边距方向", propType: "json", defaultValue: [] },
      { name: "height", title: "高度", propType: "string", defaultValue: "" },
      { name: "clearBorder", title: "清除边框方向", propType: "json", defaultValue: [] },
    ],
    events: baseEvents(),
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
      { name: "clearPadding", title: "清除内边距方向", propType: "json", defaultValue: [] },
      { name: "height", title: "高度", propType: "string", defaultValue: "" },
    ],
    events: baseEvents(),
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
      { name: "clearPadding", title: "清除内边距方向", propType: "json", defaultValue: [] },
      { name: "border", title: "边框", propType: "boolean", defaultValue: false },
      { name: "filterGutter", title: "筛选项间距", propType: "number", defaultValue: undefined },
      { name: "toolMaxWidth", title: "工具区最大宽度", propType: "string", defaultValue: "" },
    ],
    events: baseEvents(),
  },
  {
    renderType: "TabPanel",
    name: "选项卡",
    group: "container",
    category: "container-item",
    scaffold: { renderType: "TabPanel", activeName: "1", type: "", stretch: false, tabPosition: "top", tabPane: [{ name: "1", label: "选项卡1", lazy: false, disabled: false, isHidden: false, defaultSlot: null }] },
    props: [
      { name: "activeName", title: "激活页签", propType: "string", defaultValue: "1" },
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
      { name: "tabPane", title: "页签配置", propType: "json", defaultValue: [] },
    ],
    events: [
      { name: "onMounted", title: "挂载后" },
      { name: "onTabClick", title: "页签点击" },
      { name: "onBeforeTabLeave", title: "切换页签前" },
      { name: "onValueRender", title: "值渲染" },
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
  },
];
