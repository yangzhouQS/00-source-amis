/** 属性字段类型 */
export type FieldType = 'text' | 'textarea' | 'number' | 'select';

export interface FieldDef {
  key: string;
  label: string;
  type?: FieldType;
  options?: Array<{ label: string; value: any }>;
  placeholder?: string;
  group?: string;
}

const IDENTITY: FieldDef[] = [{ key: '$$eid', label: '节点ID', group: '基础' }];

const COMMON: FieldDef[] = [
  { key: 'name', label: '字段名', group: '基础', placeholder: '数据字段名' },
  { key: 'label', label: '标签', group: '基础' },
  { key: 'title', label: '标题', group: '基础' }
];

/** 各渲染器类型的属性字段定义（Phase 6 将与插件 propertyEditors 合并） */
const TYPE_FIELDS: Record<string, FieldDef[]> = {
  page: [
    { key: 'title', label: '页面标题', group: '基础' },
    { key: 'subTitle', label: '副标题', group: '基础' },
    { key: 'remark', label: '描述', type: 'textarea', group: '基础' }
  ],
  tpl: [
    { key: 'tpl', label: '文本内容', type: 'textarea', group: '内容' },
    {
      key: 'wrapperComponent',
      label: '标签',
      group: '内容',
      type: 'select',
      options: [
        { label: 'p', value: 'p' },
        { label: 'h1', value: 'h1' },
        { label: 'h2', value: 'h2' },
        { label: 'h3', value: 'h3' },
        { label: 'div', value: 'div' },
        { label: 'span', value: 'span' }
      ]
    }
  ],
  button: [
    { key: 'label', label: '文字', group: '基础' },
    { key: 'icon', label: '图标', group: '基础', placeholder: '图标类名' },
    {
      key: 'level',
      label: '样式',
      group: '基础',
      type: 'select',
      options: [
        { label: '默认', value: 'default' },
        { label: '主要', value: 'primary' },
        { label: '次要', value: 'secondary' },
        { label: '成功', value: 'success' },
        { label: '信息', value: 'info' },
        { label: '警告', value: 'warning' },
        { label: '危险', value: 'danger' },
        { label: '链接', value: 'link' }
      ]
    }
  ],
  alert: [
    { key: 'body', label: '内容', type: 'textarea', group: '内容' },
    {
      key: 'level',
      label: '级别',
      group: '内容',
      type: 'select',
      options: [
        { label: '信息', value: 'info' },
        { label: '成功', value: 'success' },
        { label: '警告', value: 'warning' },
        { label: '危险', value: 'danger' }
      ]
    }
  ],
  'input-text': [
    { key: 'name', label: '字段名', group: '基础' },
    { key: 'label', label: '标签', group: '基础' },
    { key: 'placeholder', label: '占位提示', group: '基础' }
  ],
  'input-number': [
    { key: 'name', label: '字段名', group: '基础' },
    { key: 'label', label: '标签', group: '基础' },
    { key: 'min', label: '最小值', type: 'number', group: '基础' },
    { key: 'max', label: '最大值', type: 'number', group: '基础' },
    { key: 'step', label: '步长', type: 'number', group: '基础' }
  ],
  'input-email': [
    { key: 'name', label: '字段名', group: '基础' },
    { key: 'label', label: '标签', group: '基础' },
    { key: 'placeholder', label: '占位提示', group: '基础' }
  ],
  select: [
    { key: 'name', label: '字段名', group: '基础' },
    { key: 'label', label: '标签', group: '基础' }
  ],
  switch: [
    { key: 'name', label: '字段名', group: '基础' },
    { key: 'label', label: '标签', group: '基础' },
    { key: 'option', label: '说明', group: '基础' }
  ],
  form: [
    { key: 'title', label: '标题', group: '基础' },
    { key: 'submitText', label: '提交按钮文字', group: '基础' }
  ],
  container: [{ key: 'className', label: '类名', group: '样式' }],
  card: [{ key: 'title', label: '标题', group: '基础' }],
  divider: [{ key: 'className', label: '类名', group: '样式' }]
};

/** 获取某节点类型应展示的属性字段（含身份/通用字段） */
export function getFields(type: string): FieldDef[] {
  const specific = TYPE_FIELDS[type] ?? [];
  const merged: FieldDef[] = [...IDENTITY, ...specific];
  return merged;
}

/** 取字段分组顺序 */
export function groupFields(fields: FieldDef[]): { group: string; fields: FieldDef[] }[] {
  const map = new Map<string, FieldDef[]>();
  for (const f of fields) {
    const g = f.group ?? '其它';
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(f);
  }
  return Array.from(map.entries()).map(([group, list]) => ({ group, fields: list }));
}
