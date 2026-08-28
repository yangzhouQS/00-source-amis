import type { ComponentCatalogItem, ComponentPropConfig } from "../../../scenario/types";
import { tableEvents, tableMethods } from "./shared";

/** 表格列 attr 字段声明（对齐旧版 defaultColumnConfig + demo schema 实际字段；
 *  结构 {attr: {...}} 嵌套，经嵌套 ObjectSetter 编辑——Q2 决策） */
const columnAttrItems = [
  { name: "prop", title: "绑定字段", propType: "string", defaultValue: "" },
  { name: "label", title: "列标题", propType: "string", defaultValue: "" },
  { name: "width", title: "列宽(px)", propType: "number", defaultValue: undefined, halfWidth: true },
  {
    name: "align", title: "对齐", propType: { type: "oneOf", value: ["left", "center", "right"], labels: ["左", "中", "右"] },
    defaultValue: "left", halfWidth: true,
  },
  {
    name: "headerAlign", title: "表头对齐", propType: { type: "oneOf", value: ["left", "center", "right"], labels: ["左", "中", "右"] },
    defaultValue: "center", halfWidth: true,
  },
  { name: "sortable", title: "可排序", propType: "boolean", defaultValue: false, halfWidth: true },
  { name: "cannotHide", title: "不可隐藏", propType: "boolean", defaultValue: false, halfWidth: true },
  { name: "type", title: "特殊列", propType: { type: "oneOf", value: ["", "index", "selection"], labels: ["普通", "序号", "多选"] }, defaultValue: "" },
  { name: "scopedSlot", title: "自定义列编码", propType: "string", defaultValue: "" },
  { name: "decimalCode", title: "精度字典编码", propType: "string", defaultValue: "" },
];

/** 列配置（可视化，V1 平铺列；结构 {attr} 嵌套经两层 ObjectSetter 编辑） */
const columnConfigsProp: ComponentPropConfig = {
  name: "columnConfigs",
  title: "列配置",
  propType: "json",
  labelVisible: false,
  setter: "ArraySetter",
  setterProps: {
    collapsible: true,
    itemTitle: (item: any, index: number) => item?.attr?.label || item?.attr?.prop || `列 ${index + 1}`,
    confirmRemove: "删除该列将同时清除其列配置（可通过撤销恢复），确认删除？",
    itemSetter: { setter: "ObjectSetter", props: { labelWidth: "0px" } },
    itemConfig: {
      items: [
        {
          name: "attr",
          title: "列属性",
          labelVisible: false,
          setter: "ObjectSetter",
          setterProps: { config: { items: columnAttrItems }, labelWidth: "68px", grid: true },
        },
      ],
    },
    // 函数形式初值（Q5）：prop 唯一键自增（重复 prop = 数据错列）；label 附序号便于折叠行头区分
    initialValue: (index: number) => ({
      attr: {
        prop: `col-${index + 1}`,
        label: `列标题${index + 1}`,
        width: 150,
        headerAlign: "center",
        align: "left",
        sortable: false,
        cannotHide: false,
        scopedSlot: "",
      },
    }),
  },
};

/** 表格族公共属性片段（columnConfigs 可视化；columnSlots/headerSlots/汇总 V1 留 json——
 *  columRender 是节点子树，随 V2 画布自定义列管理一起设计） */
const tableCommonProps: ComponentPropConfig[] = [
  { name: "tableCode", title: "表格编码（列配置持久化键）", propType: "string", defaultValue: "" },
  columnConfigsProp,
  { name: "columnHeaderSlots", title: "表头插槽配置", propType: "json", defaultValue: [] },
  { name: "columnSlots", title: "单元格插槽配置", propType: "json", defaultValue: [] },
  { name: "showSummary", title: "显示合计行", propType: "boolean", defaultValue: false },
  { name: "sumText", title: "合计文案", propType: "string", defaultValue: "合计" },
  { name: "summaryTargetProps", title: "合计字段", propType: "json", defaultValue: [] },
];

/** 分页配置属性（可视化：ObjectSetter + 嵌套数字数组） */
const paginationProp: ComponentPropConfig = {
  name: "pagination",
  title: "分页配置",
  propType: "json",
  labelVisible: false,
  setter: "ObjectSetter",
  setterProps: {
    labelWidth: "68px",
    config: {
      items: [
        { name: "currentSize", title: "每页条数", propType: "number", defaultValue: 20, halfWidth: true },
        {
          name: "pageSizes", title: "可选条数", propType: { type: "arrayOf", value: "number" },
          setter: "ArraySetter", setterProps: { initialValue: 20 },
        },
        { name: "layout", title: "布局组件", propType: "string", defaultValue: "total, sizes, prev, pager, next, jumper" },
      ],
    },
  },
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
    scaffold: { renderType: "YqTableTree", requestFn: "", autoLoad: true, height: "100%", isCustom: false, tableCode: "", treeConfig: {}, checkboxConfig: {}, rowConfig: {}, columnConfigs: [], columnHeaderSlots: [], columnSlots: [] },
    props: [
      { name: "requestFn", title: "请求函数", propType: "string", defaultValue: "", setter: "RequestFnSetter" },
      { name: "autoLoad", title: "自动加载", propType: "boolean", defaultValue: true },
      { name: "height", title: "高度", propType: "string", defaultValue: "100%" },
      { name: "isCustom", title: "自定义加载", propType: "boolean", defaultValue: false },
      { name: "treeConfig", title: "树形配置", propType: "json", defaultValue: {} },
      { name: "checkboxConfig", title: "复选框配置", propType: "json", defaultValue: {} },
      { name: "rowConfig", title: "行配置", propType: "json", defaultValue: {} },
      // 列配置三件套走共享可视化片段（tableCommonProps 的 columnConfigsProp）
      ...tableCommonProps.filter(p => p.name !== "showSummary" && p.name !== "sumText" && p.name !== "summaryTargetProps"),
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
      // 列配置三件套走共享可视化片段
      ...tableCommonProps,
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
