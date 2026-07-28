/**
 * Schema 类型定义
 * 采用 amis 风格：type + $$id 标识节点，props/style/onEvent 分离
 * 取代旧版 __nodeOptions/__nodeEvent/__nodeStyle 魔法键
 */

/** 节点 ID 类型 */
export type NodeId = string;

/** 属性值类型描述（驱动 setter 推断） */
export type PropType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'json'
  | 'color'
  | 'icon'
  | {type: 'oneOf'; value: Array<string | number>; labels?: string[]}
  | {type: 'shape'; value: PropConfig[]}
  | {type: 'arrayOf'; value: PropType}
  | {type: 'array'; value: PropConfig[]};

/** 属性配置（驱动设置面板） */
export interface PropConfig {
  /** 属性名，对应 schema.props 的 key */
  name: string;
  /** 标题 */
  title?: string;
  /** 属性类型 */
  propType: PropType;
  /** 默认值 */
  defaultValue?: any;
  /** 显式指定 setter 名（覆盖 propType 推断） */
  setter?: string;
  /** setter 附加参数 */
  setterProps?: Record<string, any>;
  /** 是否隐藏 */
  hidden?: boolean | ((schema: PageNode) => boolean);
  /** 所属分组 */
  group?: string;
  /** 描述 */
  description?: string;
}

/** 事件配置 */
export interface EventConfig {
  /** 事件名，如 click / change */
  name: string;
  /** 事件标题 */
  title?: string;
  /** 描述 */
  description?: string;
  /** 默认动作（声明式） */
  defaultActions?: ActionSchema[];
}

/** 容器可投放区域配置 */
export interface RegionConfig {
  /** 对应 schema 中的子节点字段，默认 body */
  key: string;
  /** 区域标题 */
  label?: string;
  /** 占位提示 */
  placeholder?: string;
  /** 拖拽模式 */
  dndMode?: 'default' | 'position-h' | 'position-v' | 'flex';
  /** 子节点合法性校验 */
  accept?: (child: PageNode, parent: PageNode) => boolean;
  /** 是否可选 */
  optional?: boolean;
}

/** 声明式动作（amis 风格） */
export interface ActionSchema {
  /** 动作类型，如 setValue / ajax / toast */
  actionType: string;
  /** 目标节点 id */
  componentId?: NodeId;
  /** 目标节点 name */
  componentName?: string;
  /** 动作参数 */
  args?: Record<string, any>;
  /** 数据合并 */
  data?: Record<string, any>;
  /** 执行条件表达式 */
  expression?: string;
  /** 是否阻止默认行为 */
  preventDefault?: boolean;
  /** 是否停止后续动作 */
  stopPropagation?: boolean;
  /** 忽略错误 */
  ignoreError?: boolean;
  /** 子动作（loop/switch/parallel 用） */
  children?: ActionSchema[];
  /** 其他扩展字段 */
  [key: string]: any;
}

/** 事件配置（运行时，存在 schema.onEvent） */
export interface OnEventConfig {
  [eventName: string]: {
    /** 该事件的动作列表 */
    actions: ActionSchema[];
    /** 权重 */
    weight?: number;
  };
}

/** 页面节点（统一 schema 节点结构） */
export interface PageNode {
  /** 组件类型，对应 ComponentMeta.type */
  type: string;
  /** 节点唯一 ID */
  $$id: NodeId;
  /** 节点标题（大纲显示用） */
  label?: string;
  /** 属性 */
  props?: Record<string, any>;
  /** 样式 */
  style?: Record<string, any>;
  /** 事件 + 动作（声明式） */
  onEvent?: OnEventConfig;
  /** 子节点（容器） */
  body?: PageNode[];
  /** 额外的命名子区域（复杂容器） */
  [region: string]: any;
}

/** 页面 schema（根节点） */
export interface PageSchema extends PageNode {
  type: 'page';
  $$id: NodeId;
  body?: PageNode[];
}

/** 面板项（设置面板 Tab） */
export interface PanelItem {
  key: string;
  title: string;
  icon?: any;
  order?: number;
  position?: 'left' | 'right';
  component?: any;
  render?: (props: any) => any;
}

/** 工具栏项（节点浮动工具栏） */
export interface ToolbarItem {
  key: string;
  title?: string;
  icon?: any;
  order?: number;
  onClick?: (nodeId: NodeId) => void;
  disabled?: (nodeId: NodeId) => boolean;
}

/** 右键菜单项 */
export interface ContextMenuItem {
  key: string;
  label: string;
  icon?: any;
  order?: number;
  onClick?: (nodeId: NodeId) => void;
  disabled?: (nodeId: NodeId) => boolean;
}

/** Vue 组件类型（兼容函数式/定义式） */
export type VueComponent = any;

/** 组件元信息（组件注册表条目） */
export interface ComponentMeta {
  /** 组件类型，对应 schema.type */
  type: string;
  /** 显示名 */
  name: string;
  /** 图标 */
  icon?: any;
  /** 分类 */
  category?: string;
  /** 分组（面板 Tab） */
  group?: string;
  /** 标签 */
  tags?: string[];
  /** 拖入画布时的默认 schema 片段 */
  scaffold?: Partial<PageNode>;
  /** 属性 → setter 配置 */
  props?: PropConfig[];
  /** 可配置事件 */
  events?: EventConfig[];
  /** 容器可投放区域 */
  regions?: RegionConfig[];
  /** 是否容器 */
  isContainer?: boolean;
  /** 父子约束（更细粒度，补充 regions.accept） */
  acceptParent?: string[];
  /** 实际渲染组件（可异步） */
  renderComponent?: VueComponent | (() => Promise<{default: VueComponent}>);
  /** 允许覆盖同名 */
  override?: boolean;
  /** 优先级（越大越优先） */
  weight?: number;
  /** 是否在面板隐藏（如内部渲染器） */
  hidden?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 渲染描述 */
  description?: string;
}

/** Setter 元信息 */
export interface SetterMeta {
  name: string;
  component: VueComponent;
}

/** 动作元信息（运行时注册） */
export interface ActionMeta {
  actionType: string;
  title?: string;
  description?: string;
  /** 默认参数 schema（动作编排器表单用） */
  argsConfig?: PropConfig[];
  run: (ctx: any) => void | Promise<void>;
}

/** 资产（第三方 JS/CSS 依赖） */
export interface AssetMeta {
  id: string;
  kind: 'js' | 'css';
  url: string;
  version?: string;
  /** 全局变量名（注入后挂到 window，便于检测是否已加载） */
  global?: string;
  /** 是否必须 */
  required?: boolean;
}
