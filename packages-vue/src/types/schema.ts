/**
 * amis Schema 节点类型。
 * amis 的 schema 是松散的 JSON，这里用宽松类型 + 索引签名描述。
 * $$eid 为编辑器内部注入的节点唯一标识，不参与渲染，导出源码时会被剥离。
 */
export interface AmisSchema {
  type: string;
  $$eid?: string;
  name?: string;
  id?: string;
  body?: AmisSchema[];
  controls?: AmisSchema[];
  tabs?: AmisSchema[];
  items?: AmisSchema[];
  columns?: AmisSchema[];
  options?: AmisSchema[];
  buttons?: AmisSchema[];
  actions?: AmisSchema[];
  toolbar?: AmisSchema[];
  definitions?: Record<string, AmisSchema>;
  [key: string]: any;
}

/** 容器内可插入子节点的区域定义 */
export interface RegionDef {
  /** 区域对应的 schema 字段名，例如 body / controls */
  key: string;
  /** 区域显示名 */
  label: string;
  /** 是否为数组型区域（绝大多数为 true） */
  isArray?: boolean;
}

/** amis 渲染器在编辑器中的元数据 */
export interface RendererMeta {
  /** amis 的 type，例如 page / form */
  type: string;
  /** 显示名 */
  name: string;
  /** 可插入区域 */
  regions?: RegionDef[];
  /** 创建该类型节点时的默认 schema 片段 */
  defaultProps?: Partial<AmisSchema>;
  /** 组件库分组 */
  group?: string;
  /** 图标（EP 图标组件名或 URL） */
  icon?: string;
  order?: number;
}

/** 组件库中可拖拽的一个条目 */
export interface ComponentLibItem {
  /** 对应 amis type */
  type: string;
  /** 显示名 */
  name: string;
  /** 分组 */
  group: string;
  icon?: string;
  /** 生成一个新的 schema 节点 */
  schema: () => AmisSchema;
}
