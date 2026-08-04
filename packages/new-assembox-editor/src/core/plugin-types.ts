/**
 * 插件契约与上下文类型定义
 * definePlugin 工厂（对象式）+ contributes(静态)/setup(动态)/钩子(事件) 三入口
 */
import type {Editor} from './editor';
import type {EditorStore} from './store';
import type {DIContainer} from './di-container';
import type {EventBus} from './event-bus';
import type {Skeleton} from '../skeleton/skeleton';
import type {SetterRegistry} from '../registry/setter-registry';
import type {AssetRegistry} from '../registry/asset-registry';
import type {ActionRegistry} from '../registry/action-registry';
import type {
  SetterMeta,
  ActionMeta,
  AssetMeta,
  PanelItem,
  ToolbarItem,
  ContextMenuItem
} from '../schema/types';

/** 插件可注入的上下文 */
export interface PluginContext {
  editor: Editor;
  store: EditorStore;
  di: DIContainer;
  bus: EventBus;
  skeleton: Skeleton;
  setterRegistry: SetterRegistry;
  assetRegistry: AssetRegistry;
  actionRegistry: ActionRegistry;
  /** 跨插件协作：按 id 查找其它插件及其 options */
  getPlugin<T = any>(
    id: string
  ): {plugin: EditorPluginObject<T>; options?: T} | undefined;
}

/** 插件声明式贡献（任选，静态自动注册） */
export interface PluginContributes {
  setters?: SetterMeta[];
  actions?: ActionMeta[];
  assets?: AssetMeta[];
  skeleton?: SkeletonContribution[];
}

/** 骨架面板贡献 */
export interface SkeletonContribution {
  area:
    | 'topArea'
    | 'leftArea'
    | 'leftFixedArea'
    | 'leftFloatArea'
    | 'centerArea'
    | 'rightArea'
    | 'bottomArea';
  type: 'Widget' | 'Panel' | 'PanelDock';
  name: string;
  content?: any;
  contentProps?: Record<string, any>;
  panelProps?: Record<string, any>;
  props?: Record<string, any>;
  disabledPanelCache?: boolean;
}

/** 插件对象契约 */
export interface EditorPluginObject<TOptions = any> {
  readonly id: string;
  name?: string;
  /** 描述（调试/文档友好） */
  description?: string;
  priority?: number;
  scene?: string | string[];
  dep?: string[];
  contributes?: PluginContributes;
  setup?(
    ctx: PluginContext,
    options?: TOptions
  ): void | Promise<void> | (() => void | Promise<void>);
  beforeInsert?(context: any): void | false | Promise<void | false>;
  afterInsert?(context: any): void;
  beforeUpdate?(context: any): void | false | Promise<void | false>;
  afterUpdate?(context: any): void;
  beforeDelete?(context: any): void | false | Promise<void | false>;
  afterDelete?(context: any): void;
  beforeMove?(context: any): void | false | Promise<void | false>;
  afterMove?(context: any): void;
  buildPanels?(node: any | null, panels: PanelItem[]): void;
  buildToolbars?(node: any | null, toolbars: ToolbarItem[]): void;
  buildContextMenu?(node: any | null, menus: ContextMenuItem[]): void;
}

/** 工厂函数：类型守卫 + 保留扩展点（默认值注入） */
export function definePlugin<TOptions = any>(
  def: EditorPluginObject<TOptions>
): EditorPluginObject<TOptions> {
  return def;
}

export type {ActionMeta};
