/**
 * 插件契约与上下文类型定义
 * 借鉴 amis-editor-core 的 PluginInterface + BasePlugin：声明式字段 + 可选生命周期钩子
 */
import type {Editor} from './editor';
import type {EditorStore} from './store';
import type {DIContainer} from './di-container';
import type {EventBus} from './event-bus';
import type {ComponentRegistry} from '../registry/component-registry';
import type {SetterRegistry} from '../registry/setter-registry';
import type {AssetRegistry} from '../registry/asset-registry';
import type {ActionRegistry} from '../registry/action-registry';
import type {
  ComponentMeta,
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
  componentRegistry: ComponentRegistry;
  setterRegistry: SetterRegistry;
  assetRegistry: AssetRegistry;
  actionRegistry: ActionRegistry;
}

/** 插件声明式贡献（任选） */
export interface PluginContributes {
  /** 贡献组件库项 */
  components?: ComponentMeta[];
  /** 贡献 setter */
  setters?: SetterMeta[];
  /** 贡献动作 */
  actions?: ActionMeta[];
  /** 贡献第三方依赖 */
  assets?: AssetMeta[];
  /** 贡献骨架面板（leftArea/rightArea/centerArea 等） */
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
  /** 是否禁用面板缓存（非激活时卸载内容） */
  disabledPanelCache?: boolean;
}

/** 插件契约 */
export interface EditorPlugin {
  /** 唯一标识（用于覆盖/去重） */
  readonly id: string;
  /** 显示名 */
  name?: string;
  /** 优先级（越大越优先，可覆盖内置） */
  priority?: number;
  /** 适用场景 */
  scenes?: string[];
  /** 声明式贡献 */
  contributes?: PluginContributes;

  /** 初始化（激活时调用） */
  init?(ctx: PluginContext): void | Promise<void>;
  /** 销毁 */
  destroy?(): void;

  // ---- 生命周期事件钩子（由 EventBus camelize 映射调用） ----
  beforeInsert?(context: any): void;
  afterInsert?(context: any): void;
  beforeUpdate?(context: any): void;
  afterUpdate?(context: any): void;
  beforeDelete?(context: any): void;
  afterDelete?(context: any): void;
  beforeMove?(context: any): void;
  afterMove?(context: any): void;

  // ---- 构建贡献（插件驱动的 UI 构建） ----
  buildPanels?(node: any, panels: PanelItem[]): void;
  buildToolbars?(node: any, toolbars: ToolbarItem[]): void;
  buildContextMenu?(node: any, menus: ContextMenuItem[]): void;
}

/** 插件类构造器 */
export interface PluginClass {
  new (): EditorPlugin;
  /** 静态 id（可选，优先于实例 id） */
  readonly id?: string;
}

/** 动作元信息（插件贡献动作用） */
export type {ActionMeta};
