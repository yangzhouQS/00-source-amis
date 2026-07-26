import type { ComponentLibItem } from '@/types/schema';
import { BUILTIN_COMPONENTS } from '@/builtin-components';
import { getMergedComponents } from '@/core/plugin-host';

/**
 * 获取当前生效的组件库条目（内置 + 已启用插件的贡献项）。
 */
export function getAvailableComponents(): ComponentLibItem[] {
  try {
    return getMergedComponents();
  } catch {
    // 插件 store 尚未初始化时回退到内置
    return BUILTIN_COMPONENTS;
  }
}

/** 按类型查找组件库条目 */
export function findComponent(type: string): ComponentLibItem | undefined {
  return getAvailableComponents().find(item => item.type === type);
}
