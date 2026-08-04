import type { ComponentCatalogItem } from '../../scenario/types';

export const PC_GROUPS = [
  { name: 'basic', title: '基础组件' },
  { name: 'form', title: '表单组件' },
  { name: 'layout', title: '布局组件' },
  { name: 'container', title: '容器组件' },
  { name: 'data', title: '数据组件' },
];

export const PC_CATEGORIES = [
  { name: 'display', title: '显示类' },
  { name: 'input', title: '输入类' },
  { name: 'button', title: '按钮类' },
  { name: 'select', title: '选择类' },
  { name: 'date', title: '日期类' },
  { name: 'layout-item', title: '布局项' },
  { name: 'container-item', title: '容器项' },
  { name: 'table', title: '表格类' },
  { name: 'list', title: '列表类' },
  { name: 'other', title: '其他' },
];

export const PC_COMPONENTS: ComponentCatalogItem[] = [
  {
    renderType: 'Button', name: '按钮', group: 'basic', category: 'button',
    scaffold: { renderType: 'Button', content: '按钮', type: 'primary', plain: false },
    props: [
      { name: 'content', title: '按钮文字', propType: 'string', defaultValue: '按钮' },
      { name: 'type', title: '类型', propType: 'select', defaultValue: 'primary', setterProps: { options: [
        { label: '主要', value: 'primary' }, { label: '成功', value: 'success' },
        { label: '警告', value: 'warning' }, { label: '危险', value: 'danger' }, { label: '默认', value: '' }] } },
      { name: 'plain', title: '朴素', propType: 'boolean', defaultValue: false },
      { name: 'icon', title: '图标', propType: 'string', defaultValue: '' },
    ],
    events: [{ name: 'onClick', title: '点击' }],
  },
  {
    renderType: 'Input', name: '输入框', group: 'form', category: 'input',
    scaffold: { renderType: 'Input', placeholder: '请输入', clearable: true },
    props: [
      { name: 'placeholder', title: '占位文本', propType: 'string', defaultValue: '请输入' },
      { name: 'clearable', title: '可清空', propType: 'boolean', defaultValue: true },
      { name: 'disabled', title: '禁用', propType: 'boolean', defaultValue: false },
    ],
    events: [{ name: 'onChange', title: '值变化' }, { name: 'onClear', title: '清空' }],
  },
  {
    renderType: 'Select', name: '下拉选择', group: 'form', category: 'select',
    scaffold: { renderType: 'Select', placeholder: '请选择', clearable: true },
    props: [
      { name: 'placeholder', title: '占位文本', propType: 'string', defaultValue: '请选择' },
      { name: 'clearable', title: '可清空', propType: 'boolean', defaultValue: true },
      { name: 'disabled', title: '禁用', propType: 'boolean', defaultValue: false },
    ],
    events: [{ name: 'onChange', title: '值变化' }, { name: 'onClear', title: '清空' }],
  },
  {
    renderType: 'Label', name: '标签', group: 'basic', category: 'display',
    scaffold: { renderType: 'Label', content: '标签文字' },
    props: [{ name: 'content', title: '文本', propType: 'string', defaultValue: '标签文字' }],
  },
  {
    renderType: 'Tag', name: '标记', group: 'basic', category: 'display',
    scaffold: { renderType: 'Tag', content: '标记' },
  },
  {
    renderType: 'Image', name: '图片', group: 'basic', category: 'display',
    scaffold: { renderType: 'Image' },
  },
  {
    renderType: 'Icon', name: '图标', group: 'basic', category: 'display',
    scaffold: { renderType: 'Icon' },
  },
  {
    renderType: 'Statistic', name: '统计', group: 'basic', category: 'display',
    scaffold: { renderType: 'Statistic' },
  },
  {
    renderType: 'Panel', name: '面板', group: 'container', category: 'container-item',
    scaffold: { renderType: 'Panel', showHeader: true, title: '面板标题', border: true, paddingSize: 'base', defaultSlot: null },
    props: [
      { name: 'title', title: '标题', propType: 'string', defaultValue: '面板标题' },
      { name: 'showHeader', title: '显示头部', propType: 'boolean', defaultValue: true },
      { name: 'border', title: '边框', propType: 'boolean', defaultValue: true },
    ],
  },
  {
    renderType: 'Box', name: '盒子', group: 'container', category: 'container-item',
    scaffold: { renderType: 'Box', border: true, background: false, paddingSize: 'base', defaultSlot: null },
    props: [
      { name: 'border', title: '边框', propType: 'boolean', defaultValue: true },
      { name: 'background', title: '背景', propType: 'boolean', defaultValue: false },
    ],
  },
  {
    renderType: 'Toolbar', name: '工具栏', group: 'container', category: 'container-item',
    scaffold: { renderType: 'Toolbar', border: false, divider: false, toolSlot: [], filterSlot: [] },
    props: [
      { name: 'border', title: '边框', propType: 'boolean', defaultValue: false },
      { name: 'divider', title: '分割线', propType: 'boolean', defaultValue: false },
    ],
  },
  {
    renderType: 'FlexBox', name: '弹性布局', group: 'layout', category: 'layout-item',
    scaffold: { renderType: 'FlexBox', isRow: true, itemNum: 1,
      itemConfig: [{ isFixed: false, paddingSize: 'base', clearPadding: [], isHidden: false, contentType: 'container', defaultSlot: null }] },
    props: [
      { name: 'isRow', title: '水平排列', propType: 'boolean', defaultValue: true },
      { name: 'itemNum', title: '列数', propType: 'number', defaultValue: 1 },
    ],
  },
  {
    renderType: 'FlexLine', name: '弹性行', group: 'layout', category: 'layout-item',
    scaffold: { renderType: 'FlexLine', leftWidth: '50%', defaultSlot: [], rightSlot: [] },
  },
  {
    renderType: 'GridBox', name: '网格布局', group: 'layout', category: 'layout-item',
    scaffold: { renderType: 'GridBox' },
  },
  {
    renderType: 'GridItem', name: '网格项', group: 'layout', category: 'layout-item',
    scaffold: { renderType: 'GridItem', defaultSlot: null },
  },
  {
    renderType: 'Form', name: '表单', group: 'form', category: 'other',
    scaffold: { renderType: 'Form', defaultSlot: null },
  },
  {
    renderType: 'FormItem', name: '表单项', group: 'form', category: 'other',
    scaffold: { renderType: 'FormItem', label: '标签', defaultSlot: null },
    props: [{ name: 'label', title: '标签', propType: 'string', defaultValue: '标签' }],
  },
  {
    renderType: 'FilterItem', name: '筛选项', group: 'form', category: 'other',
    scaffold: { renderType: 'FilterItem', label: '筛选',
      layout: { xs: 24, sm: 12, md: 8, lg: 6, xl: 4 }, defaultSlot: null },
    props: [{ name: 'label', title: '标签', propType: 'string', defaultValue: '筛选' }],
  },
  {
    renderType: 'Card', name: '卡片', group: 'data', category: 'other',
    scaffold: { renderType: 'Card', header: '', defaultSlot: null },
    props: [{ name: 'header', title: '标题', propType: 'string', defaultValue: '' }],
  },
  {
    renderType: 'InputNumber', name: '数字输入', group: 'form', category: 'input',
    scaffold: { renderType: 'InputNumber' },
  },
  {
    renderType: 'Switch', name: '开关', group: 'form', category: 'input',
    scaffold: { renderType: 'Switch' },
  },
  {
    renderType: 'RadioGroup', name: '单选组', group: 'form', category: 'select',
    scaffold: { renderType: 'RadioGroup' },
  },
  {
    renderType: 'CheckboxGroup', name: '多选组', group: 'form', category: 'select',
    scaffold: { renderType: 'CheckboxGroup' },
  },
  {
    renderType: 'DatePicker', name: '日期选择', group: 'form', category: 'date',
    scaffold: { renderType: 'DatePicker' },
  },
  {
    renderType: 'TabPanel', name: '选项卡', group: 'container', category: 'container-item',
    scaffold: { renderType: 'TabPanel' },
  },
  {
    renderType: 'NavigationBar', name: '导航栏', group: 'container', category: 'container-item',
    scaffold: { renderType: 'NavigationBar' },
  },
  {
    renderType: 'Dropdown', name: '下拉菜单', group: 'basic', category: 'display',
    scaffold: { renderType: 'Dropdown' },
  },
];
