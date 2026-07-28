/**
 * Demo 内置组件定义
 * 注册一组基于 Element Plus 的组件，供画布渲染与组件面板使用
 */
import {
  ElButton,
  ElInput,
  ElCard,
  ElRow,
  ElCol,
  ElDivider,
  ElTag
} from 'element-plus';
import type {ComponentMeta} from '../schema/types';
import {
  Pointer,
  EditPen,
  Postcard,
  Grid,
  Minus,
  Star
} from '@element-plus/icons-vue';

export const demoComponents: ComponentMeta[] = [
  {
    type: 'button',
    name: '按钮',
    icon: Pointer,
    category: '基础组件',
    group: '组件库',
    scaffold: {
      type: 'button',
      label: '按钮',
      props: {type: 'primary', text: '按钮'}
    },
    props: [
      {
        name: 'text',
        title: '按钮文字',
        propType: 'string',
        defaultValue: '按钮'
      },
      {
        name: 'type',
        title: '类型',
        propType: {
          type: 'oneOf',
          value: ['primary', 'success', 'warning', 'danger', 'default', '']
        },
        defaultValue: 'primary'
      },
      {
        name: 'size',
        title: '尺寸',
        propType: {type: 'oneOf', value: ['large', 'default', 'small']},
        defaultValue: 'default'
      },
      {name: 'round', title: '圆角', propType: 'boolean', defaultValue: false},
      {
        name: 'disabled',
        title: '禁用',
        propType: 'boolean',
        defaultValue: false
      }
    ],
    events: [{name: 'click', title: '点击', description: '按钮点击'}],
    renderComponent: ElButton
  },
  {
    type: 'input',
    name: '输入框',
    icon: EditPen,
    category: '表单组件',
    group: '组件库',
    scaffold: {
      type: 'input',
      props: {placeholder: '请输入'}
    },
    props: [
      {
        name: 'placeholder',
        title: '占位文本',
        propType: 'string',
        defaultValue: '请输入'
      },
      {
        name: 'disabled',
        title: '禁用',
        propType: 'boolean',
        defaultValue: false
      },
      {
        name: 'clearable',
        title: '可清空',
        propType: 'boolean',
        defaultValue: true
      }
    ],
    events: [{name: 'change', title: '值变化', description: '输入值变化'}],
    renderComponent: ElInput
  },
  {
    type: 'tag',
    name: '标签',
    icon: Star,
    category: '基础组件',
    group: '组件库',
    scaffold: {type: 'tag', props: {text: '标签'}},
    props: [
      {name: 'text', title: '文本', propType: 'string', defaultValue: '标签'},
      {
        name: 'type',
        title: '类型',
        propType: {
          type: 'oneOf',
          value: ['primary', 'success', 'info', 'warning', 'danger', '']
        },
        defaultValue: 'primary'
      }
    ],
    renderComponent: ElTag
  },
  {
    type: 'divider',
    name: '分割线',
    icon: Minus,
    category: '基础组件',
    group: '组件库',
    scaffold: {type: 'divider'},
    props: [],
    renderComponent: ElDivider
  },
  {
    type: 'card',
    name: '卡片',
    icon: Postcard,
    category: '容器组件',
    group: '组件库',
    isContainer: true,
    scaffold: {
      type: 'card',
      props: {header: '卡片标题'},
      body: []
    },
    props: [
      {
        name: 'header',
        title: '标题',
        propType: 'string',
        defaultValue: '卡片标题'
      }
    ],
    renderComponent: ElCard
  },
  {
    type: 'row',
    name: '行布局',
    icon: Grid,
    category: '布局组件',
    group: '组件库',
    isContainer: true,
    scaffold: {
      type: 'row',
      props: {gutter: 16},
      body: []
    },
    props: [
      {name: 'gutter', title: '间距', propType: 'number', defaultValue: 16}
    ],
    renderComponent: ElRow
  },
  {
    type: 'col',
    name: '列布局',
    icon: Grid,
    category: '布局组件',
    group: '组件库',
    isContainer: true,
    scaffold: {
      type: 'col',
      props: {span: 12},
      body: []
    },
    props: [
      {name: 'span', title: '跨度', propType: 'number', defaultValue: 12}
    ],
    renderComponent: ElCol
  }
];

/** 注册 demo 组件 */
export function registerDemoComponents(
  registry: import('../registry/component-registry').ComponentRegistry
): void {
  demoComponents.forEach(c => registry.register(c));
}
