/**
 * Schema Leaf 类型定义
 *
 * 仅保留与具体 schema 格式无关的 leaf 类型（PropConfig / ActionSchema / AssetMeta 等）。
 * 节点结构（IBaseNode / __nodeId / __nodeOptions）由 assembox-core-next 定义，编辑器内 schema 类型为 any。
 */

/** 节点 ID 类型 */
export type NodeId = string;

/** 属性值类型描述（驱动 setter 推断） */
export type PropType
  = | "string"
    | "number"
    | "boolean"
    | "json"
    | "color"
    | "icon"
    | { type: "oneOf"; value: Array<string | number>; labels?: string[] }
    | { type: "shape"; value: PropConfig[] }
    | { type: "arrayOf"; value: PropType }
    | { type: "array"; value: PropConfig[] };

/** 属性配置（驱动设置面板） */
export interface PropConfig {
  /** 属性名 */
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
  /** 面板布局：false 时顶层不占 label 列（复合 setter 自带结构时用，如格子配置） */
  labelVisible?: boolean;
  /** 面板布局：ObjectSetter 内两列网格（半宽，布尔/短枚举类字段用） */
  halfWidth?: boolean;
  /** 是否隐藏（函数形式接收字段当前值） */
  hidden?: boolean | ((value: any) => boolean);
  /** 所属分组 */
  group?: string;
  /** 描述 */
  description?: string;
}

/** 事件配置 */
export interface EventConfig {
  /** 事件名，如 onClick / onChange */
  name: string;
  /** 事件标题 */
  title?: string;
  /** 描述 */
  description?: string;
}

/** 声明式动作 */
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

/** 面板项（设置面板 Tab） */
export interface PanelItem {
  key: string;
  title: string;
  icon?: any;
  order?: number;
  position?: "left" | "right";
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

/** 组件元信息 */
export interface ComponentMeta {
  /** 组件类型 */
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
  /** 拖入画布时的默认配置片段 */
  scaffold?: Record<string, any>;
  /** 属性 → setter 配置 */
  props?: PropConfig[];
  /** 可配置事件 */
  events?: EventConfig[];
  /** 是否容器 */
  isContainer?: boolean;
  /** 父子约束 */
  acceptParent?: string[];
  /** 实际渲染组件（可异步） */
  renderComponent?: VueComponent | (() => Promise<{ default: VueComponent }>);
  /** 允许覆盖同名 */
  override?: boolean;
  /** 优先级（越大越优先） */
  weight?: number;
  /** 是否在面板隐藏 */
  hidden?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 渲染描述 */
  description?: string;
  /** 双击原地文本编辑配置 */
  liveTextEditing?: LiveTextEditingConfig[];
}

/** 原地文本编辑配置（双击 → contenteditable → blur 保存） */
export interface LiveTextEditingConfig {
  /** 要编辑的属性名（如 'text', 'title', 'content'） */
  propTarget: string;
  /** CSS selector 定位可编辑 DOM 元素（iframe 画布内） */
  selector?: string;
  /** 编辑模式 */
  mode?: "plaintext" | "richtext";
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
  kind: "js" | "css";
  url: string;
  version?: string;
  /** 全局变量名（注入后挂到 window，便于检测是否已加载） */
  global?: string;
  /** 是否必须 */
  required?: boolean;
}
