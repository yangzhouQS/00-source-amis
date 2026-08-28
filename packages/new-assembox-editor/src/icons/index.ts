/**
 * PC 组件图标（拷贝自旧版编辑器，先直接复用）
 * - pc/*.tsx：图标组件（源：assembox-editor src/plugins/common/inner-common-icon
 *   与 components-config-business-pc/icon，SVG path 原样保留）
 * - 本文件：renderType → 图标组件 映射，供 component-metadata-config 聚合时注入
 *
 * 未覆盖的 renderType（YqFlexBox/GridBox/GridItem/YqLabel/Plane/YqImageCardPreview/
 * UiSkeletonBlockSlot）旧版为外链 alicdn 图标或无图标，暂走面板默认占位，
 * 后续设计出图后在此补齐。
 */
import type { Component } from "vue";
import { IconFilterSummary } from "./pc/icon-filter-summary";
import { IconFlexBox } from "./pc/icon-flex-box";
import { IconGridBox } from "./pc/icon-grid-box";
import { IconGridItem } from "./pc/icon-grid-item";
import { IconImageCardPreview } from "./pc/icon-image-card-preview";
import { IconLabel } from "./pc/icon-label";
import { IconBaseSelect } from "./pc/icon-base-select";
import { IconBox } from "./pc/icon-box";
import { IconButton } from "./pc/icon-button";
import { IconChart } from "./pc/icon-chart";
import { IconCheckbox } from "./pc/icon-checkbox";
import { IconCheckboxGroup } from "./pc/icon-checkbox-group";
import { IconDatePicker } from "./pc/icon-date-picker";
import { IconDatePickerRange } from "./pc/icon-date-picker-range";
import { IconDialog } from "./pc/icon-dialog";
import { IconDictionary } from "./pc/icon-dictionary";
import { IconDictionaryTree } from "./pc/icon-dictionary-tree";
import { IconDrawer } from "./pc/icon-drawer";
import { IconDropdown } from "./pc/icon-dropdown";
import { IconDynamicFilter } from "./pc/icon-dynamic-filter";
import { IconFileUpload } from "./pc/icon-file-upload";
import { IconFilterItem } from "./pc/icon-filter-item";
import { IconFlexLine } from "./pc/icon-flex-line";
import { IconForm } from "./pc/icon-form";
import { IconFormItem } from "./pc/icon-form-item";
import { IconHtml } from "./pc/icon-html";
import { IconIcon } from "./pc/icon-icon";
import { IconImage } from "./pc/icon-image";
import { IconInput } from "./pc/icon-input";
import { IconInputNumber } from "./pc/icon-input-number";
import { IconListAsync } from "./pc/icon-list-async";
import { IconListElement } from "./pc/icon-list-element";
import { IconListOnly } from "./pc/icon-list-only";
import { IconListReport } from "./pc/icon-list-report";
import { IconMaterial } from "./pc/icon-material";
import { IconNavigationBar } from "./pc/icon-navigation-bar";
import { IconOrgPanel } from "./pc/icon-org-panel";
import { IconOrgSelect } from "./pc/icon-org-select";
import { IconPanel } from "./pc/icon-panel";
import { IconRadioGroup } from "./pc/icon-radio-group";
import { IconSearchSelect } from "./pc/icon-search-select";
import { IconSelect } from "./pc/icon-select";
import { IconStep } from "./pc/icon-step";
import { IconSwitch } from "./pc/icon-switch";
import { IconTableAsync } from "./pc/icon-table-async";
import { IconTableEdit } from "./pc/icon-table-edit";
import { IconFileTableUpload } from "./pc/icon-file-table-upload";
import { IconTableOnly } from "./pc/icon-table-only";
import { IconTableReport } from "./pc/icon-table-report";
import { IconTableTree } from "./pc/icon-table-tree";
import { IconTabs } from "./pc/icon-tabs";
import { IconTag } from "./pc/icon-tag";
import { IconTimePicker } from "./pc/icon-time-picker";
import { IconToolbar } from "./pc/icon-toolbar";
import { IconTree } from "./pc/icon-tree";
import { IconTreeSelect } from "./pc/icon-tree-select";
import { IconUpload } from "./pc/icon-upload";
import { IconUploadComp } from "./pc/icon-upload-comp";

/** renderType → 图标组件 */
export const PC_RENDER_TYPE_ICONS: Record<string, Component> = {
  // 容器/布局
  YqBox: IconBox,
  YqPanel: IconPanel,
  YqToolBar: IconToolbar,
  TabPanel: IconTabs,
  YqNavigationBar: IconNavigationBar,
  YqFlexLine: IconFlexLine,
  // 视图层
  Dialog: IconDialog,
  Drawer: IconDrawer,
  // 显示类
  Button: IconButton,
  Tag: IconTag,
  Image: IconImage,
  Icon: IconIcon,
  RawHtml: IconHtml,
  Dropdown: IconDropdown,
  YqAdvancedFilter: IconDynamicFilter,
  // 输入类
  Input: IconInput,
  InputNumber: IconInputNumber,
  Switch: IconSwitch,
  Checkbox: IconCheckbox,
  CheckboxGroup: IconCheckboxGroup,
  RadioGroup: IconRadioGroup,
  Select: IconSelect,
  DatePicker: IconDatePicker,
  YqDateRangePicker: IconDatePickerRange,
  TimePicker: IconTimePicker,
  YqSearchSelect: IconSearchSelect,
  YqSearchTreeSelect: IconTreeSelect,
  FormItem: IconFormItem,
  YqFilterItem: IconFilterItem,
  // 业务组件
  // 布局
  YqFlexBox: IconFlexBox,
  GridBox: IconGridBox,
  GridItem: IconGridItem,
  // 显示类
  YqLabel: IconLabel,
  FilterSummary: IconFilterSummary,
  YqImageCardPreview: IconImageCardPreview,
  // 业务组件
  YqBasisCommonSelectApi: IconBaseSelect,
  YqDictionarySelect: IconDictionary,
  YqDictionaryTree: IconDictionaryTree,
  YqOrganizationTreePanel: IconOrgPanel,
  YqOrganizationTreeSelect: IconOrgSelect,
  YqSelectComMaterial: IconMaterial,
  YqFileSimpleUpload: IconUpload,
  // 表格式多文件上传：新设计的表格+上传按钮图标（非旧版回形针 upload-comp）
  YqFileTableUpload: IconFileTableUpload,
  YqFileImageCardUpload: IconFileUpload,
  // 表格/列表/其他块元素
  Form: IconForm,
  Chart: IconChart,
  Step: IconStep,
  YqTableAsync: IconTableAsync,
  YqTableOnly: IconTableOnly,
  YqTableReport: IconTableReport,
  YqTableTree: IconTableTree,
  YqTableEdit: IconTableEdit,
  YqListAsync: IconListAsync,
  YqListOnly: IconListOnly,
  YqListReport: IconListReport,
  YqSearchTreePanel: IconTree,
  ListElement: IconListElement,
};

export { SvgIcon } from "./svg-icon";
