import type { ComponentLibItem } from '@/types/schema';

/** 内置组件库目录（Phase 6 将与插件贡献项合并） */
export const BUILTIN_COMPONENTS: ComponentLibItem[] = [
  // 容器
  {
    type: 'container',
    name: '容器',
    group: '容器',
    schema: () => ({ type: 'container', body: [] })
  },
  {
    type: 'grid',
    name: '栅格',
    group: '容器',
    schema: () => ({
      type: 'grid',
      columns: [{ body: [] }, { body: [] }]
    })
  },
  {
    type: 'hbox',
    name: '水平布局',
    group: '容器',
    schema: () => ({ type: 'flex', direction: 'row', items: [] })
  },
  {
    type: 'wrapper',
    name: '包裹容器',
    group: '容器',
    schema: () => ({ type: 'wrapper', body: [] })
  },
  // 表单
  {
    type: 'form',
    name: '表单',
    group: '表单',
    schema: () => ({
      type: 'form',
      title: '表单',
      body: [{ type: 'input-text', name: 'field1', label: '字段1' }]
    })
  },
  {
    type: 'input-text',
    name: '文本输入',
    group: '表单',
    schema: () => ({ type: 'input-text', name: 'text', label: '文本' })
  },
  {
    type: 'input-number',
    name: '数字输入',
    group: '表单',
    schema: () => ({ type: 'input-number', name: 'num', label: '数字' })
  },
  {
    type: 'input-email',
    name: '邮箱输入',
    group: '表单',
    schema: () => ({ type: 'input-email', name: 'email', label: '邮箱' })
  },
  {
    type: 'select',
    name: '下拉选择',
    group: '表单',
    schema: () => ({
      type: 'select',
      name: 'sel',
      label: '选择',
      options: [{ label: '选项A', value: 'a' }, { label: '选项B', value: 'b' }]
    })
  },
  {
    type: 'switch',
    name: '开关',
    group: '表单',
    schema: () => ({ type: 'switch', name: 'on', label: '开关' })
  },
  {
    type: 'button',
    name: '按钮',
    group: '表单',
    schema: () => ({ type: 'button', label: '按钮' })
  },
  // 展示
  {
    type: 'tpl',
    name: '文本',
    group: '展示',
    schema: () => ({ type: 'tpl', tpl: '这是一段文本' })
  },
  {
    type: 'alert',
    name: '提示',
    group: '展示',
    schema: () => ({ type: 'alert', body: '提示内容', level: 'info' })
  },
  {
    type: 'divider',
    name: '分隔线',
    group: '展示',
    schema: () => ({ type: 'divider' })
  },
  {
    type: 'card',
    name: '卡片',
    group: '展示',
    schema: () => ({ type: 'card', header: { title: '卡片标题' }, body: [] })
  },
  {
    type: 'table',
    name: '表格',
    group: '展示',
    schema: () => ({
      type: 'table',
      columns: [{ name: 'id', label: 'ID' }],
      source: '${rows}',
      data: { rows: [{ id: 1 }] }
    })
  }
];

/** 按 group 分组 */
export function groupComponents(
  items: ComponentLibItem[]
): { group: string; items: ComponentLibItem[] }[] {
  const map = new Map<string, ComponentLibItem[]>();
  for (const item of items) {
    if (!map.has(item.group)) map.set(item.group, []);
    map.get(item.group)!.push(item);
  }
  return Array.from(map.entries()).map(([group, list]) => ({ group, items: list }));
}
