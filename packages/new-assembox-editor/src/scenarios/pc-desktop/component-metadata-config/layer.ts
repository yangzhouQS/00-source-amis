import type { ComponentCatalogItem } from "../../../scenario/types";

/**
 * 视图层层组件（源码：components/layer/）
 * Plane/Dialog/Drawer 不经 NodeRenderer 注册（manifest 注释），为页面级结构：
 * - Plane 页面根（schema planeOptions）
 * - Dialog 对话框 / Drawer 抽屉（schema dialogOptions/drawerOptions，经事件打开）
 */
export const layerComponents: ComponentCatalogItem[] = [
  {
    renderType: "Plane",
    name: "页面",
    group: "view-layer",
    category: "other",
    scaffold: { renderType: "Plane", isShowNav: false, navigationOptions: null, flexBoxOptions: null },
    props: [
      { name: "isShowNav", title: "显示导航栏", propType: "boolean", defaultValue: false },
      { name: "navigationOptions", title: "导航栏配置", propType: "json", defaultValue: null },
      { name: "flexBoxOptions", title: "主区域弹性布局配置", propType: "json", defaultValue: null },
    ],
  },
  {
    renderType: "Dialog",
    name: "对话框",
    group: "view-layer",
    category: "container-item",
    scaffold: { renderType: "Dialog", title: "对话框标题", width: "600px", open: false, showClose: true, draggable: false, modal: true, closeOnClickModal: false, destroyOnClose: false, fullscreen: false, appendToBody: false, headerSlot: null, defaultSlot: null },
    props: [
      { name: "title", title: "标题", propType: "string", defaultValue: "对话框标题" },
      { name: "width", title: "宽度", propType: "string", defaultValue: "600px" },
      { name: "open", title: "打开", propType: "boolean", defaultValue: false },
      { name: "showClose", title: "显示关闭按钮", propType: "boolean", defaultValue: true },
      { name: "draggable", title: "可拖拽", propType: "boolean", defaultValue: false },
      { name: "openDelay", title: "打开延迟(ms)", propType: "number", defaultValue: 0 },
      { name: "modal", title: "遮罩", propType: "boolean", defaultValue: true },
      { name: "top", title: "距顶部", propType: "string", defaultValue: "15vh" },
      { name: "closeOnClickModal", title: "点遮罩关闭", propType: "boolean", defaultValue: false },
      { name: "destroyOnClose", title: "关闭时销毁", propType: "boolean", defaultValue: false },
      { name: "fullscreen", title: "全屏", propType: "boolean", defaultValue: false },
      { name: "appendToBody", title: "挂载到 body", propType: "boolean", defaultValue: false },
    ],
    // 单节点槽（wrapper assem-dialog-page.vue:28 直渲，对话框文档树）
    slots: [{ name: "defaultSlot", slotType: "object", description: "内容区" }],
  },
  {
    renderType: "Drawer",
    name: "抽屉",
    group: "view-layer",
    category: "container-item",
    scaffold: { renderType: "Drawer", title: "抽屉标题", size: "30%", direction: "rtl", open: false, showClose: true, modal: true, closeOnClickModal: false, destroyOnClose: false, appendToBody: false, withHeader: true, headerSlot: null, defaultSlot: null },
    props: [
      { name: "title", title: "标题", propType: "string", defaultValue: "抽屉标题" },
      { name: "size", title: "尺寸", propType: "string", defaultValue: "30%" },
      {
        name: "direction",
        title: "方向",
        propType: { type: "oneOf", value: ["rtl", "ltr", "ttb", "btt"], labels: ["右侧", "左侧", "顶部", "底部"] },
        defaultValue: "rtl",
      },
      { name: "open", title: "打开", propType: "boolean", defaultValue: false },
      { name: "showClose", title: "显示关闭按钮", propType: "boolean", defaultValue: true },
      { name: "openDelay", title: "打开延迟(ms)", propType: "number", defaultValue: 0 },
      { name: "closeDelay", title: "关闭延迟(ms)", propType: "number", defaultValue: 0 },
      { name: "modal", title: "遮罩", propType: "boolean", defaultValue: true },
      { name: "closeOnClickModal", title: "点遮罩关闭", propType: "boolean", defaultValue: false },
      { name: "destroyOnClose", title: "关闭时销毁", propType: "boolean", defaultValue: false },
      { name: "appendToBody", title: "挂载到 body", propType: "boolean", defaultValue: false },
      { name: "zIndex", title: "层级", propType: "number", defaultValue: undefined },
      { name: "withHeader", title: "带头部", propType: "boolean", defaultValue: true },
    ],
    // 单节点槽（wrapper assem-drawer-page.vue:28 直渲，抽屉文档树）
    slots: [{ name: "defaultSlot", slotType: "object", description: "内容区" }],
  },
];
