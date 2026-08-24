import type { ComponentCatalogItem, ComponentPropConfig } from "../../../scenario/types";
import { tableEvents, tableMethods } from "./shared";

/** 表格族公共属性片段（columnConfigs/columnSlots/汇总等） */
const tableCommonProps: ComponentPropConfig[] = [
  { name: "tableCode", title: "表格编码（列配置持久化键）", propType: "string", defaultValue: "" },
  { name: "columnConfigs", title: "列配置", propType: "json", defaultValue: [] },
  { name: "columnHeaderSlots", title: "表头插槽配置", propType: "json", defaultValue: [] },
  { name: "columnSlots", title: "单元格插槽配置", propType: "json", defaultValue: [] },
  { name: "showSummary", title: "显示合计行", propType: "boolean", defaultValue: false },
  { name: "sumText", title: "合计文案", propType: "string", defaultValue: "合计" },
  { name: "summaryTargetProps", title: "合计字段", propType: "json", defaultValue: [] },
];

/** 分页配置属性 */
const paginationProp: ComponentPropConfig = {
  name: "pagination",
  title: "分页配置",
  propType: "json",
  defaultValue: { currentSize: 20, pageSizes: [10, 20, 50, 100], layout: "total, sizes, prev, pager, next, jumper" },
};

/**
 * 表格族组件（源码：components/element-container/block-element/table/）
 */
export const elementTableComponents: ComponentCatalogItem[] = [
  {
    renderType: "YqTableAsync",
    name: "异步表格",
    group: "data",
    category: "table",
    scaffold: { renderType: "YqTableAsync", requestFn: "", autoLoad: true, stripe: false, columnConfigs: [], columnHeaderSlots: [], columnSlots: [], showSummary: false, sumText: "合计", summaryTargetProps: [], pagination: { currentSize: 20, pageSizes: [10, 20, 50, 100], layout: "total, sizes, prev, pager, next, jumper" }, bottomSlot: null, tableCode: "" },
    props: [
      { name: "requestFn", title: "请求函数", propType: "string", defaultValue: "", setter: "RequestFnSetter" },
      { name: "autoLoad", title: "自动加载", propType: "boolean", defaultValue: true },
      { name: "stripe", title: "斑马纹", propType: "boolean", defaultValue: false },
      ...tableCommonProps,
      paginationProp,
    ],
    events: tableEvents(),
    methods: tableMethods(),
  },
  {
    renderType: "YqTableOnly",
    name: "本地表格",
    group: "data",
    category: "table",
    scaffold: { renderType: "YqTableOnly", stripe: false, columnConfigs: [], columnHeaderSlots: [], columnSlots: [], showSummary: false, sumText: "合计", summaryTargetProps: [], tableCode: "" },
    props: tableCommonProps,
    events: tableEvents(),
    methods: [
      { name: "reloadData", title: "重新加载", signature: "function reloadData(options)" },
      { name: "setData", title: "设置数据", signature: "function setData(data)" },
      { name: "clearData", title: "清空数据", signature: "function clearData()" },
      { name: "getData", title: "获取数据", signature: "function getData()" },
    ],
  },
  {
    renderType: "YqTableReport",
    name: "报表表格",
    group: "data",
    category: "table",
    scaffold: { renderType: "YqTableReport", requestFn: "", autoLoad: true, stripe: false, columnConfigs: [], columnHeaderSlots: [], columnSlots: [], showSummary: false, sumText: "合计", summaryTargetProps: [], pagination: { currentSize: 20, pageSizes: [10, 20, 50, 100], layout: "total, sizes, prev, pager, next, jumper" }, tableCode: "" },
    props: [
      { name: "requestFn", title: "请求函数", propType: "string", defaultValue: "", setter: "RequestFnSetter" },
      { name: "autoLoad", title: "自动加载", propType: "boolean", defaultValue: true },
      { name: "stripe", title: "斑马纹", propType: "boolean", defaultValue: false },
      ...tableCommonProps,
      paginationProp,
    ],
    events: tableEvents(),
    methods: [
      { name: "getNativeRefs", title: "取原生引用", signature: "function getNativeRefs()" },
      { name: "reloadData", title: "重新加载", signature: "function reloadData(options)" },
      { name: "clearData", title: "清空数据", signature: "function clearData()" },
      { name: "setData", title: "设置数据", signature: "function setData(data)" },
      { name: "setCurrentPage", title: "跳转页码", signature: "function setCurrentPage(pageNo)" },
    ],
  },
  {
    renderType: "YqTableTree",
    name: "树形表格",
    group: "data",
    category: "table",
    scaffold: { renderType: "YqTableTree", requestFn: "", autoLoad: true, height: "", isCustom: false, tableCode: "", treeConfig: {}, checkboxConfig: {}, rowConfig: {}, columnConfigs: [], columnHeaderSlots: [], columnSlots: [] },
    props: [
      { name: "requestFn", title: "请求函数", propType: "string", defaultValue: "", setter: "RequestFnSetter" },
      { name: "autoLoad", title: "自动加载", propType: "boolean", defaultValue: true },
      { name: "height", title: "高度", propType: "string", defaultValue: "" },
      { name: "isCustom", title: "自定义加载", propType: "boolean", defaultValue: false },
      { name: "tableCode", title: "表格编码", propType: "string", defaultValue: "" },
      { name: "treeConfig", title: "树形配置", propType: "json", defaultValue: {} },
      { name: "checkboxConfig", title: "复选框配置", propType: "json", defaultValue: {} },
      { name: "rowConfig", title: "行配置", propType: "json", defaultValue: {} },
      { name: "columnConfigs", title: "列配置", propType: "json", defaultValue: [] },
      { name: "columnHeaderSlots", title: "表头插槽配置", propType: "json", defaultValue: [] },
      { name: "columnSlots", title: "单元格插槽配置", propType: "json", defaultValue: [] },
      { name: "modelName", title: "绑定数据模型", propType: "string", defaultValue: "", setter: "ModelNameSetter" },
    ],
    events: [
      { name: "onMounted", title: "挂载后" },
      { name: "onTreeLoad", title: "子节点懒加载" },
      { name: "onSelectionChange", title: "多选变化" },
      { name: "onCurrentChange", title: "当前行变化" },
      { name: "onSummaryMethod", title: "自定义合计" },
      { name: "onLoadData", title: "加载数据" },
    ],
    methods: [
      { name: "reloadData", title: "重新加载", signature: "function reloadData(params)" },
      { name: "clearData", title: "清空数据", signature: "function clearData()" },
      { name: "getNativeRefs", title: "取原生引用", signature: "function getNativeRefs()" },
      { name: "setData", title: "设置数据", signature: "function setData(data)" },
    ],
  },
  {
    renderType: "YqTableEdit",
    name: "可编辑表格",
    group: "data",
    category: "table",
    scaffold: { renderType: "YqTableEdit", modelName: "", tableCode: "", columnConfigs: [], columnSlots: [], columnHeaderSlots: [], mapConfig: {}, rules: {}, notRepeatFiled: "", editConfig: {}, keyboardConfig: {}, validConfig: {}, showFooter: false, summaryMode: "auto", sumText: "合计", summaryTargetProps: [], rowConfig: { isCurrent: true }, stripe: false, rowsLimit: 1000 },
    props: [
      { name: "modelName", title: "绑定数据模型（必填）", propType: "string", defaultValue: "", setter: "ModelNameSetter" },
      { name: "tableCode", title: "表格编码", propType: "string", defaultValue: "" },
      { name: "columnConfigs", title: "列配置", propType: "json", defaultValue: [] },
      { name: "columnSlots", title: "单元格插槽配置", propType: "json", defaultValue: [] },
      { name: "columnHeaderSlots", title: "表头插槽配置", propType: "json", defaultValue: [] },
      { name: "mapConfig", title: "数据映射配置", propType: "json", defaultValue: {} },
      { name: "rules", title: "校验规则", propType: "json", defaultValue: {} },
      { name: "notRepeatFiled", title: "不可重复字段", propType: "string", defaultValue: "" },
      { name: "editConfig", title: "编辑配置", propType: "json", defaultValue: {} },
      { name: "keyboardConfig", title: "键盘操作配置", propType: "json", defaultValue: {} },
      { name: "validConfig", title: "校验配置", propType: "json", defaultValue: {} },
      { name: "rowConfig", title: "行配置", propType: "json", defaultValue: { isCurrent: true } },
      { name: "showFooter", title: "显示合计行", propType: "boolean", defaultValue: false },
      {
        name: "summaryMode",
        title: "合计模式",
        propType: { type: "oneOf", value: ["auto", "custom"], labels: ["自动", "自定义"] },
        defaultValue: "auto",
      },
      { name: "sumText", title: "合计文案", propType: "string", defaultValue: "合计" },
      { name: "summaryTargetProps", title: "合计字段", propType: "json", defaultValue: [] },
      { name: "stripe", title: "斑马纹", propType: "boolean", defaultValue: false },
      { name: "rowsLimit", title: "行数上限", propType: "number", defaultValue: 1000 },
    ],
    events: [
      { name: "onMounted", title: "挂载后" },
      { name: "onRowClick", title: "行点击" },
      { name: "onCurrentChange", title: "当前行变化" },
    ],
    methods: [
      { name: "growData", title: "批量追加数据", signature: "function growData(mapName, rows)" },
      { name: "getNativeRefs", title: "取原生引用", signature: "function getNativeRefs()" },
      { name: "deleteData", title: "删除行", signature: "function deleteData(rowData)" },
      { name: "deleteAllData", title: "清空全部行", signature: "function deleteAllData()" },
      { name: "sumRow", title: "触发合计", signature: "function sumRow()" },
    ],
  },
];
