import { usePluginStore } from '@/store/plugin-store';
import { BUILTIN_COMPONENTS } from '@/builtin-components';
import { BUILTIN_RENDERERS } from '@/core/renderer-meta';
import type {
  ComponentLibItem,
  RendererMeta,
  AmisSchema
} from '@/types/schema';
import type { PropertyEditorDef } from '@/types/plugin';

/** 合并所有启用插件的组件贡献 + 内置组件 */
export function getMergedComponents(): ComponentLibItem[] {
  const pluginStore = usePluginStore();
  const fromPlugins = pluginStore.activePlugins.flatMap(p => p.components ?? []);
  return [...BUILTIN_COMPONENTS, ...fromPlugins];
}

/** 合并所有启用插件的渲染器元数据 + 内置 */
export function getMergedRenderers(): Record<string, RendererMeta> {
  const pluginStore = usePluginStore();
  const merged: Record<string, RendererMeta> = { ...BUILTIN_RENDERERS };
  for (const p of pluginStore.activePlugins) {
    for (const r of p.renderers ?? []) merged[r.type] = r;
  }
  return merged;
}

/** 取容器类型的主插入区域（基于合并后的元数据） */
export function getPrimaryRegion(type: string): string {
  return getMergedRenderers()[type]?.regions?.[0]?.key ?? 'body';
}

/** 是否含有可插入子区域 */
export function hasRegions(type: string): boolean {
  return !!getMergedRenderers()[type]?.regions?.length;
}

/** 取匹配某 type 的插件属性编辑器（按 order 排序） */
export function getPluginPropertyEditors(type: string): PropertyEditorDef[] {
  const pluginStore = usePluginStore();
  const result: PropertyEditorDef[] = [];
  for (const p of pluginStore.activePlugins) {
    for (const ed of p.propertyEditors ?? []) {
      const match = Array.isArray(ed.matchType)
        ? ed.matchType.includes(type) || ed.matchType.includes('*')
        : ed.matchType === type || ed.matchType === '*';
      if (match) result.push(ed);
    }
  }
  return result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** 取所有插件工具栏按钮 */
export function getPluginToolbarButtons() {
  const pluginStore = usePluginStore();
  return pluginStore.activePlugins
    .flatMap(p => p.toolbarButtons ?? [])
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export type { AmisSchema };
