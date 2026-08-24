import type { ComponentCatalogItem } from "../../../scenario/types";
import { listEvents, listMethods } from "./shared";

/**
 * 列表族组件（源码：components/element-container/block-element/list/）
 */
export const elementListComponents: ComponentCatalogItem[] = [
  {
    renderType: "YqListAsync",
    name: "异步列表",
    group: "data",
    category: "list",
    scaffold: { renderType: "YqListAsync", requestFn: "", height: "", direction: "vertical", wrap: false, fill: false, listItemProps: null, defaultSlot: [], spaceSize: "default" },
    props: [
      { name: "requestFn", title: "请求函数", propType: "string", defaultValue: "", setter: "RequestFnSetter" },
      { name: "height", title: "高度", propType: "string", defaultValue: "" },
      {
        name: "direction",
        title: "排列方向",
        propType: { type: "oneOf", value: ["horizontal", "vertical"], labels: ["水平", "垂直"] },
        defaultValue: "vertical",
      },
      { name: "wrap", title: "自动换行", propType: "boolean", defaultValue: false },
      { name: "fill", title: "撑满父容器", propType: "boolean", defaultValue: false },
      { name: "fillRatio", title: "撑满比例", propType: "number", defaultValue: undefined },
      { name: "spaceStyle", title: "间距样式", propType: "json", defaultValue: undefined },
      { name: "spaceSize", title: "间距尺寸", propType: "string", defaultValue: "default" },
      { name: "listItemProps", title: "列表项样式配置", propType: "json", defaultValue: null },
      { name: "alignment", title: "对齐方式", propType: "string", defaultValue: undefined },
    ],
    events: listEvents(),
    methods: listMethods(),
  },
  {
    renderType: "YqListOnly",
    name: "本地列表",
    group: "data",
    category: "list",
    scaffold: { renderType: "YqListOnly", height: "", direction: "vertical", wrap: false, fill: false, listItemProps: null, defaultSlot: [], spaceSize: "default" },
    props: [
      { name: "height", title: "高度", propType: "string", defaultValue: "" },
      {
        name: "direction",
        title: "排列方向",
        propType: { type: "oneOf", value: ["horizontal", "vertical"], labels: ["水平", "垂直"] },
        defaultValue: "vertical",
      },
      { name: "wrap", title: "自动换行", propType: "boolean", defaultValue: false },
      { name: "fill", title: "撑满父容器", propType: "boolean", defaultValue: false },
      { name: "spaceSize", title: "间距尺寸", propType: "string", defaultValue: "default" },
      { name: "listItemProps", title: "列表项样式配置", propType: "json", defaultValue: null },
    ],
    events: listEvents(),
    methods: listMethods(),
  },
  {
    renderType: "YqListReport",
    name: "报表列表",
    group: "data",
    category: "list",
    scaffold: { renderType: "YqListReport", requestFn: "", height: "", direction: "vertical", wrap: false, fill: false, listItemProps: null, defaultSlot: [], spaceSize: "default", pagination: { currentSize: 20, pageSizes: [10, 20, 50, 100], layout: "total, sizes, prev, pager, next, jumper" } },
    props: [
      { name: "requestFn", title: "请求函数", propType: "string", defaultValue: "", setter: "RequestFnSetter" },
      { name: "height", title: "高度", propType: "string", defaultValue: "" },
      {
        name: "direction",
        title: "排列方向",
        propType: { type: "oneOf", value: ["horizontal", "vertical"], labels: ["水平", "垂直"] },
        defaultValue: "vertical",
      },
      { name: "wrap", title: "自动换行", propType: "boolean", defaultValue: false },
      { name: "fill", title: "撑满父容器", propType: "boolean", defaultValue: false },
      { name: "spaceSize", title: "间距尺寸", propType: "string", defaultValue: "default" },
      { name: "listItemProps", title: "列表项样式配置", propType: "json", defaultValue: null },
      { name: "pagination", title: "分页配置", propType: "json", defaultValue: { currentSize: 20, pageSizes: [10, 20, 50, 100], layout: "total, sizes, prev, pager, next, jumper" } },
    ],
    events: [
      ...listEvents(),
      { name: "onPageChange", title: "翻页" },
    ],
    methods: [
      ...listMethods(),
      { name: "setCurrentPage", title: "跳转页码", signature: "function setCurrentPage(pageNo)" },
    ],
  },
];
