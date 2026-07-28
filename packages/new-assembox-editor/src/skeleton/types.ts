/**
 * 骨架类型定义
 */
import type {VueComponent} from '../schema/types';

export type AreaName =
  | 'topArea'
  | 'leftArea'
  | 'leftFixedArea'
  | 'leftFloatArea'
  | 'centerArea'
  | 'rightArea'
  | 'bottomArea';

export type WidgetType = 'Widget' | 'Panel' | 'PanelDock';

export interface WidgetConfig {
  type: WidgetType;
  name: string;
  area?: AreaName;
  /** 渲染内容 */
  content?: VueComponent;
  /** 内容 props */
  contentProps?: Record<string, any>;
  /** 面板附加配置（PanelDock 的联动面板用） */
  panelProps?: {
    panelName?: string;
    area?: AreaName;
  };
  /** 显示配置（标题/图标/对齐） */
  props?: {
    title?: string;
    icon?: any;
    align?: 'top' | 'bottom';
    description?: string;
  };
  /** 是否禁用面板缓存（非激活时卸载内容） */
  disabledPanelCache?: boolean;
  /** 排序 */
  index?: number;
}

/** Widget 能力接口 */
export interface WidgetLike {
  readonly name: string;
  readonly type: WidgetType;
  readonly area: AreaName;
  /** 是否激活 */
  active: boolean;
  /** 是否禁用 */
  disabled: boolean;
  /** 是否可见 */
  visible: boolean;
  /** 内容已初始化 */
  inited: boolean;
  /** VNode 内容 */
  readonly content: any;
  /** 激活/取消 */
  setActive(flag: boolean): void;
  toggle(): void;
  hide(): void;
  show(): void;
  disable(): void;
  enable(): void;
}
