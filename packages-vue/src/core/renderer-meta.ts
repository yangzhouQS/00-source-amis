import type { RendererMeta, RegionDef } from '@/types/schema';

const BODY: RegionDef = { key: 'body', label: '内容', isArray: true };

/** 内置渲染器元数据（Phase 6 将与插件 renderers 贡献项合并） */
export const BUILTIN_RENDERERS: Record<string, RendererMeta> = {
  page: { type: 'page', name: '页面', regions: [BODY], group: '容器' },
  container: { type: 'container', name: '容器', regions: [BODY], group: '容器' },
  wrapper: { type: 'wrapper', name: '包裹容器', regions: [BODY], group: '容器' },
  card: { type: 'card', name: '卡片', regions: [BODY], group: '展示' },
  form: {
    type: 'form',
    name: '表单',
    regions: [{ key: 'body', label: '表单项', isArray: true }],
    group: '表单'
  },
  grid: {
    type: 'grid',
    name: '栅格',
    regions: [{ key: 'columns', label: '列', isArray: true }],
    group: '容器'
  },
  flex: {
    type: 'flex',
    name: '弹性布局',
    regions: [{ key: 'items', label: '子项', isArray: true }],
    group: '容器'
  },
  table: {
    type: 'table',
    name: '表格',
    regions: [{ key: 'columns', label: '列', isArray: true }],
    group: '展示'
  },
  // 叶子渲染器（无子区域）
  tpl: { type: 'tpl', name: '文本', group: '展示' },
  button: { type: 'button', name: '按钮', group: '表单' },
  alert: { type: 'alert', name: '提示', group: '展示' },
  divider: { type: 'divider', name: '分隔线', group: '展示' },
  'input-text': { type: 'input-text', name: '文本输入', group: '表单' },
  'input-number': { type: 'input-number', name: '数字输入', group: '表单' },
  'input-email': { type: 'input-email', name: '邮箱输入', group: '表单' },
  select: { type: 'select', name: '下拉选择', group: '表单' },
  switch: { type: 'switch', name: '开关', group: '表单' }
};

export function getRendererMeta(type: string): RendererMeta | undefined {
  return BUILTIN_RENDERERS[type];
}

/** 取容器类型的主插入区域 */
export function getPrimaryRegion(type: string): string {
  return BUILTIN_RENDERERS[type]?.regions?.[0]?.key ?? 'body';
}

/** 是否含有可插入子区域 */
export function hasRegions(type: string): boolean {
  return !!BUILTIN_RENDERERS[type]?.regions?.length;
}
