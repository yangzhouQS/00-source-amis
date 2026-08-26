/**
 * 已知 renderType 清单（来源：assembox-desktop-next src/components/manifest.ts 的 COMPONENTS）
 *
 * 用途：打印变换对「不在清单里」的类型只透传 + 上报（PRINT_TRANSFORM_UNKNOWN_TYPE），
 * 保证新组件上线但规则表未更新时不丢内容（前向兼容）。
 */
export const KNOWN_RENDER_TYPES: ReadonlySet<string> = new Set([
  // layout
  'YqFlexBox', 'YqFlexLine', 'GridBox', 'GridItem',
  // container
  'YqBox', 'YqToolBar', 'TabPanel', 'YqPanel', 'YqNavigationBar',
  // lineElement 显示类
  'YqLabel', 'Tag', 'FilterSummary', 'Image', 'Icon', 'RawHtml', 'UiSkeletonBlockSlot', 'Dropdown', 'Button', 'YqAdvancedFilter',
  // lineElement 输入类
  'YqBasisCommonSelectApi', 'YqDictionarySelect', 'YqDictionaryTree', 'InputNumber', 'Switch',
  'Checkbox', 'CheckboxGroup', 'RadioGroup', 'DatePicker', 'YqDateRangePicker', 'TimePicker',
  'YqSearchSelect', 'YqSearchTreeSelect', 'Input', 'Select', 'YqOrganizationTreeSelect',
  'YqFileSimpleUpload', 'FormItem', 'YqFilterItem',
  // element 表格族
  'YqTableAsync', 'YqTableOnly', 'YqTableReport', 'YqTableTree', 'YqTableEdit',
  // element 列表族
  'YqListAsync', 'YqListOnly', 'YqListReport',
  // element 其他
  'YqSearchTreePanel', 'YqImageCardPreview', 'YqOrganizationTreePanel', 'Chart', 'Step', 'Form',
  'YqSelectComMaterial', 'YqFileTableUpload', 'YqFileImageCardUpload',
  // columnElement
  'ListElement',
  // 由 AssemViews 直渲（不经 NodeRenderer），出现在 dialogOptions/drawerOptions 数组
  'Dialog', 'Drawer',
]);

/** 打印态整树剔除的交互类组件 */
export const REMOVE_RENDER_TYPES: ReadonlySet<string> = new Set([
  'YqToolBar',
  'Button',
  'YqAdvancedFilter',
  'YqFileSimpleUpload',
  'YqFileTableUpload',
  'YqFileImageCardUpload',
  'Dropdown',
  'Switch',
]);
