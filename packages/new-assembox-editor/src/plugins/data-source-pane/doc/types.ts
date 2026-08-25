/**
 * 数据源文档类型定义
 * 与 @cs/assembox-core-next 的 types/datasource 契约 1:1 对齐（编辑器侧自包含，
 * 避免渲染库版本耦合）。字段语义见 docs-lib/05-数据源配置插件调研分析与设计文档.md 第 1 章。
 */

/** 数据值类型 */
export type DsValueType = "string" | "number" | "boolean" | "list" | "object";

/** 请求参数类型 */
export type DsParamsType
  = | "kvParams"
    | "routeParams"
    | "formSaveParams"
    | "paginationParams"
    | "";

/** 数据模型类型（参数结构） */
export type DsDataModelType = "single" | "orderItems" | "items" | "";

/** 参数解析去向 */
export type DsResolveType = "routeParams" | "queryParams" | "bodyParams" | "";

/** HTTP 方法 */
export type DsHttpMethod = "get" | "post" | "put" | "delete" | "patch";

/** 请求拦截器（beforeReq / afterReq；enabled 对齐渲染层契约，读取时兼容 isOn） */
export interface DsInterceptorConfig {
  enabled: boolean;
  fn: string;
}

/** paramsModel 单字段参数定义 */
export interface DsParamsField {
  valueType?: DsValueType;
  op?: string;
  defaultValue?: unknown;
  /** 解析去向，可逗号分隔多值（兼容旧数据存储形态） */
  resolveType?: string;
  isCache?: boolean;
  /** 设计期标记：true 时保存不写 defaultValue */
  isSkipVal?: boolean;
}

/**
 * paramsConfig.paramsModel：表名 → 字段定义表 或 空数组（数组表占位）
 * 对象表 = Record<字段名, DsParamsField>；数组表 = []
 */
export type DsParamsTableModel = Record<string, DsParamsField> | [];

/** 请求参数配置 */
export interface DsParamsConfig {
  paramsType: DsParamsType;
  dataModelType?: DsDataModelType;
  /** 参数取值的数据模型名（modelName 点分路径的根） */
  dataModelName?: string;
  /** 高级筛选模型名（仅 paginationParams 场景使用） */
  advancedFilterModelName?: string;
  /** 分页参数配置 */
  paginationConfig?: Record<string, unknown>;
  paramsModel: Record<string, DsParamsTableModel>;
}

/** 服务配置项（requestConfig 条目；url/method 内联，无独立接口登记） */
export interface DsServiceItem {
  url: string;
  method: DsHttpMethod;
  /** 项级 axios 配置覆盖 */
  config?: Record<string, any>;
  groupName?: string;
  sort?: number;
  isTopUp?: boolean;
  description?: string;
  beforeReq?: DsInterceptorConfig;
  afterReq?: DsInterceptorConfig;
  paramsConfig?: DsParamsConfig;
}

/** 模型字段定义 */
export interface DsModelField {
  valueType: DsValueType;
  defaultValue?: unknown;
  isSkipVal?: boolean;
  comment?: string;
}

/** 模型表：对象表（字段映射）或 数组表（空数组占位） */
export type DsModelTable = Record<string, DsModelField> | [];

/** 模型配置项（dataModelConfig 条目；description 为保留键，builder 跳过） */
export interface DsModelItem {
  description?: string;
  [tableName: string]: DsModelTable | string | undefined;
}

/** 共享方法条目（description 为设计期字段，渲染层忽略） */
export interface DsSharedFnItem {
  enabled: boolean;
  fn: string;
  description?: string;
}

/** 数据源文档（编辑器编辑的完整 dataSource） */
export interface DsDocument {
  /** config=全局 axios 基底；list=旧版接口登记表（兼容透传，不做编辑） */
  api: { config: Record<string, any>; list: Record<string, any> | null };
  requestConfig: Record<string, DsServiceItem>;
  dataModelConfig: Record<string, DsModelItem>;
  sharedFns: Record<string, DsSharedFnItem>;
}

/** 校验问题（结构化输出，驱动 Drawer 底部错误面板） */
export interface DsIssue {
  level: "error" | "warn";
  path: string;
  message: string;
}

/** 后端导入模型（options.fetchModels 的返回契约，宿主负责对接） */
export interface DsImportedModel {
  modelCode: string;
  modelName?: string;
  tables: Array<{
    name: string;
    fields: Array<{
      code: string;
      valueType: DsValueType;
      defaultValue?: unknown;
      comment?: string;
    }>;
  }>;
}

/** 插件宿主选项 */
export interface DsHostOptions {
  /** 后端模型导入（缺省隐藏「从后端导入」入口） */
  fetchModels?: (moduleId?: string) => Promise<DsImportedModel[]>;
  /** 模型树默认过滤 moduleId */
  moduleId?: string;
}
