import type { VNode } from 'vue';
import type { ComponentLibItem, RendererMeta } from './schema';
import type { EditorContext } from './editor-context';
import type { AmisSchema } from './schema';

/** 工具栏按钮贡献 */
export interface ToolbarButtonDef {
  id: string;
  label: string;
  icon?: string;
  order?: number;
  onClick?: (ctx: EditorContext) => void;
}

/** 属性面板编辑器贡献 */
export interface PropertyEditorDef {
  /** 匹配的渲染器 type，'*' 表示所有节点 */
  matchType: string | string[];
  /** 所属右侧面板 tab：property / events / 自定义 */
  tab?: string;
  order?: number;
  /** 渲染函数：根据当前节点返回 vue 节点 */
  render: (node: AmisSchema, ctx: EditorContext) => VNode | VNode[] | string;
}

/** 编辑器插件契约 */
export interface EditorPlugin {
  id: string;
  name: string;
  description?: string;
  version?: string;
  author?: string;
  /** 组件库贡献项 */
  components?: ComponentLibItem[];
  /** 渲染器元数据贡献 */
  renderers?: RendererMeta[];
  /** 自定义属性编辑器贡献 */
  propertyEditors?: PropertyEditorDef[];
  /** 工具栏按钮贡献 */
  toolbarButtons?: ToolbarButtonDef[];
  /** 插件激活 */
  activate?: (ctx: EditorContext) => void | Promise<void>;
  /** 插件停用 */
  deactivate?: () => void;
}

/** 插件清单（用于插件管理面板的安装/启停记录） */
export interface PluginManifest {
  id: string;
  name: string;
  description?: string;
  version?: string;
  author?: string;
  /** 动态插件加载地址（UMD，window 上挂载 __amisPlugin__） */
  url?: string;
  /** 是否启用 */
  enabled: boolean;
  /** 是否为内置插件 */
  builtin: boolean;
}
