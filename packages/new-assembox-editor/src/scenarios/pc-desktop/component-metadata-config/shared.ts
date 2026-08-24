import type { ComponentCatalogItem, ComponentMethodConfig, ComponentPropConfig } from "../../../scenario/types";

/**
 * 组件元数据公共配置
 *
 * 事件/方法清单提取自 assembox-desktop-next src/components/manifest.ts（权威登记表），
 * 属性默认值提取自各组件 useNodeOptions 运行时默认值 + types/ 接口定义。
 * 族级别共用的事件/方法（表格族/列表族/选项类/输入类）在此收敛维护。
 */

// ═══════════════ 事件 ═══════════════

/** 生命周期 + 值渲染（容器/布局/纯展示组件通用，manifest: BasicEvents） */
export function baseEvents() {
  return [
    { name: "onMounted", title: "挂载后" },
    { name: "onValueRender", title: "值渲染" },
  ];
}

/** 输入类通用事件（manifest: InputLikeEvents），withFocus 加上聚焦/失焦 */
export function inputEvents(withFocus = false) {
  return [
    { name: "onMounted", title: "挂载后" },
    { name: "onChange", title: "值变化" },
    { name: "onClear", title: "清空" },
    ...(withFocus
      ? [
          { name: "onFocus", title: "聚焦" },
          { name: "onBlur", title: "失焦" },
        ]
      : []),
    { name: "onValueRender", title: "值渲染" },
  ];
}

/** 表格族共用事件（manifest: TableLikeEvents） */
export function tableEvents() {
  return [
    { name: "onMounted", title: "挂载后" },
    { name: "onRowClick", title: "行点击" },
    { name: "onCurrentChange", title: "当前行变化" },
    { name: "onSelectCheckbox", title: "勾选行" },
    { name: "onSelectionChange", title: "多选变化" },
    { name: "onSortChange", title: "排序变化" },
    { name: "onExpandChange", title: "展开行变化" },
    { name: "onLoadData", title: "加载数据" },
    { name: "onPageChange", title: "翻页" },
    { name: "onValueRender", title: "值渲染" },
  ];
}

/** 列表族共用事件（manifest: ListLikeEvents） */
export function listEvents() {
  return [
    { name: "onMounted", title: "挂载后" },
    { name: "onLoadData", title: "加载数据" },
    { name: "onValueRender", title: "值渲染" },
  ];
}

/** 远端选项加载事件（Select 无 requestFn 时触发，载荷 { params, resolve }） */
export function remoteOptionsEvents() {
  return [
    { name: "onLoadData", title: "加载选项数据" },
  ];
}

// ═══════════════ 方法（defineExpose） ═══════════════

function method(name: string, title: string, signature: string, description?: string): ComponentMethodConfig {
  return { name, title, signature, description };
}

/** 表格族共用方法（manifest: TableLikeExposed） */
export function tableMethods(): ComponentMethodConfig[] {
  return [
    method("reloadData", "重新加载", "function reloadData(options)"),
    method("setData", "设置数据", "function setData(data)"),
    method("clearData", "清空数据", "function clearData()"),
    method("getData", "获取数据", "function getData()"),
    method("getPaginationParams", "取分页参数", "function getPaginationParams(isReset)"),
    method("setCurrentPage", "跳转页码", "function setCurrentPage(pageNo)"),
    method("getLoading", "取加载态", "function getLoading()"),
  ];
}

/** 表格族基础方法（YqTableOnly 暴露子集） */
export function tableBaseMethods(): ComponentMethodConfig[] {
  return [
    method("reloadData", "重新加载", "function reloadData(options)"),
    method("setData", "设置数据", "function setData(data)"),
    method("clearData", "清空数据", "function clearData()"),
    method("getData", "获取数据", "function getData()"),
  ];
}

/** 列表族共用方法（manifest: ListLikeExposed） */
export function listMethods(): ComponentMethodConfig[] {
  return [
    method("getScrollRef", "取滚动实例", "function getScrollRef()"),
    method("reloadData", "重新加载", "function reloadData(options)"),
    method("setData", "设置数据", "function setData(data)"),
    method("clearData", "清空数据", "function clearData()"),
    method("getData", "获取数据", "function getData()"),
  ];
}

/** 选项类控件共用方法（manifest: OptionsExposed，Select/RadioGroup/CheckboxGroup） */
export function optionsMethods(): ComponentMethodConfig[] {
  return [
    method("loadOptions", "加载选项", "function loadOptions()"),
    method("setOptions", "设置选项", "function setOptions(data)"),
    method("clearOptions", "清空选项", "function clearOptions()"),
    method("getOptions", "获取选项", "function getOptions()"),
  ];
}

/** 下拉刷新类共用方法（字典/组织树选择族） */
export function reloadClearMethods(): ComponentMethodConfig[] {
  return [
    method("reload", "重新加载", "function reload()"),
    method("clear", "清空", "function clear()"),
  ];
}

// ═══════════════ 属性片段 ═══════════════

/** 远端选项控件通用属性（itemData/requestFn/defaultProps） */
export function remoteOptionsProps(
  defaults: { label: string; value: string } = { label: "label", value: "value" },
): ComponentPropConfig[] {
  return [
    { name: "requestFn", title: "选项请求函数", propType: "string", defaultValue: "", setter: "RequestFnSetter" },
    { name: "itemData", title: "静态选项", propType: "json", defaultValue: [] },
    { name: "defaultProps", title: "选项字段映射", propType: "json", defaultValue: defaults },
  ];
}

/** 数据模型绑定属性 */
export function modelNameProp(defaultValue = ""): ComponentPropConfig {
  return {
    name: "modelName",
    title: "数据模型",
    propType: "string",
    defaultValue,
    setter: "ModelNameSetter",
  };
}

// ═══════════════ 常用枚举 ═══════════════

export const SIZE_ENUM = {
  type: "oneOf" as const,
  value: ["", "default", "small", "large"],
  labels: ["默认", "常规", "小", "大"],
};

export type { ComponentCatalogItem };
