import type { ComponentCatalogItem } from "../../../scenario/types";
import { PC_RENDER_TYPE_ICONS } from "../../../icons";
import { blockContainerComponents } from "./block-container";
import { businessComponents } from "./business-component";
import { elementBlockComponents } from "./element-block";
import { elementListComponents } from "./element-list";
import { elementTableComponents } from "./element-table";
import { layerComponents } from "./layer";
import { layoutComponents } from "./layout";
import { lineDisplayComponents } from "./line-display";
import { lineInputComponents } from "./line-input";

/**
 * PC 组件元数据聚合出口
 *
 * 全量组件按源码目录分类维护（assembox-desktop-next src/components/）：
 * - layout.ts               布局（YqFlexBox/YqFlexLine/GridBox/GridItem）
 * - block-container.ts      块容器（YqBox/YqPanel/YqToolBar/TabPanel/YqNavigationBar）
 * - layer.ts                视图层（Plane/Dialog/Drawer）
 * - line-display.ts         行内显示（Button/Label/Tag/Image/Icon/Dropdown/高级筛选…）
 * - line-input.ts           行内输入（Input/Select/日期/时间/搜索选择/表单项…）
 * - business-component.ts   业务组件（字典/组织树/上传/预览/物资选择…）
 * - element-table.ts        表格族（异步/本地/报表/树形/可编辑）
 * - element-list.ts         列表族（异步/本地/报表）
 * - element-block.ts        其他块元素（Form/Step/Chart/搜索树面板/ListElement）
 *
 * 数据来源（单一真相源）：
 * - renderType / events / methods：manifest.ts（ComponentTypes 登记，含 Events/Exposed 签名）
 * - props 字段与默认值：types/ 接口定义 + 组件 useNodeOptions 运行时默认值
 * 修改组件属性时请同步 upstream 变更，保持三处一致。
 */

/** 注入旧版编辑器图标（renderType → 图标组件，见 src/icons/index.ts） */
function withIcons(list: ComponentCatalogItem[]): ComponentCatalogItem[] {
  return list.map((item) => {
    const icon = PC_RENDER_TYPE_ICONS[item.renderType];
    return icon ? { ...item, icon } : item;
  });
}

/** 全量组件元数据（含视图层） */
export const PC_COMPONENTS_ALL: ComponentCatalogItem[] = withIcons([
  ...layoutComponents,
  ...blockContainerComponents,
  ...layerComponents,
  ...lineDisplayComponents,
  ...lineInputComponents,
  ...businessComponents,
  ...elementTableComponents,
  ...elementListComponents,
  ...elementBlockComponents,
]);

/** 拖拽组件面板用（排除视图层 Plane，页面根节点不可拖入） */
export const PC_COMPONENTS_PANEL: ComponentCatalogItem[] = PC_COMPONENTS_ALL.filter(
  c => c.renderType !== "Plane",
);

export {
  blockContainerComponents,
  businessComponents,
  elementBlockComponents,
  elementListComponents,
  elementTableComponents,
  layerComponents,
  layoutComponents,
  lineDisplayComponents,
  lineInputComponents,
};
