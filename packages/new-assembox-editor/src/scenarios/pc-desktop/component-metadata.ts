import type { ComponentCatalogItem } from "../../scenario/types";
import { PC_COMPONENTS_ALL } from "./component-metadata-config";

/**
 * PC 组件元数据（属性/事件/方法）
 *
 * 完整定义已按源码目录拆分至 component-metadata-config/ 分类维护：
 * layout / block-container / layer / line-display / line-input /
 * business-component / element-table / element-list / element-block
 * 本文件仅保留分组与类目字典并聚合导出。
 */

export const PC_GROUPS = [
  { name: "basic", title: "基础组件" },
  { name: "form", title: "表单组件" },
  { name: "layout", title: "布局组件" },
  { name: "container", title: "容器组件" },
  { name: "data", title: "数据组件" },
  { name: "business", title: "业务组件" },
  { name: "view-layer", title: "视图层" },
];

export const PC_CATEGORIES = [
  { name: "display", title: "显示类" },
  { name: "input", title: "输入类" },
  { name: "button", title: "按钮类" },
  { name: "select", title: "选择类" },
  { name: "date", title: "日期类" },
  { name: "layout-item", title: "布局项" },
  { name: "container-item", title: "容器项" },
  { name: "table", title: "表格类" },
  { name: "list", title: "列表类" },
  { name: "other", title: "其他" },
];

/**
 * 全量组件（含视图层 Dialog/Drawer；Plane 经 catalog 过滤不出现在面板）
 * @deprecated 别名，请逐步改用 component-metadata-config 的 PC_COMPONENTS_ALL/PANEL
 */
export const PC_COMPONENTS: ComponentCatalogItem[] = PC_COMPONENTS_ALL;
