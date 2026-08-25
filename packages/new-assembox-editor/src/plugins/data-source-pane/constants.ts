/**
 * 数据源配置选项常量（对齐 core-next request/constants.ts 与旧版 global-config 选项表）
 */
import type {
  DsDataModelType,
  DsHttpMethod,
  DsParamsType,
  DsResolveType,
  DsValueType,
} from "./doc/types";

/** 请求参数类型 */
export const PARAMS_TYPE_OPTIONS: Array<{ value: DsParamsType; label: string }> = [
  { value: "kvParams", label: "问号传参" },
  { value: "routeParams", label: "路由位置参数" },
  { value: "formSaveParams", label: "body体参数" },
  { value: "paginationParams", label: "分页body体参数" },
  { value: "", label: "[空]" },
];

/** 数据模型类型（参数结构） */
export const DATA_MODEL_TYPE_OPTIONS: Array<{ value: DsDataModelType; label: string }> = [
  { value: "single", label: "对象" },
  { value: "orderItems", label: "主从对象" },
  { value: "items", label: "数组" },
];

/** 值类型 */
export const VALUE_TYPE_OPTIONS: Array<{ value: DsValueType; label: string }> = [
  { value: "string", label: "字符串" },
  { value: "number", label: "数字" },
  { value: "boolean", label: "布尔值" },
  { value: "list", label: "数组" },
  { value: "object", label: "对象" },
];

/** 查询操作符（core-next OP_TYPE 全集 + 旧数据 equals/contains 兼容项） */
export const OP_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "eq", label: "等于" },
  { value: "ne", label: "不等于" },
  { value: "gt", label: "大于" },
  { value: "gte", label: "大于等于" },
  { value: "lt", label: "小于" },
  { value: "lte", label: "小于等于" },
  { value: "like", label: "模糊" },
  { value: "notLike", label: "不相似" },
  { value: "in", label: "子查询(in)" },
  { value: "notIn", label: "排除子查询(notIn)" },
  { value: "between", label: "范围" },
  { value: "notBetween", label: "排除边界值" },
  { value: "isNull", label: "为空" },
  { value: "isNotNull", label: "不为空" },
  { value: "equals", label: "等于(旧)" },
  { value: "contains", label: "包含(旧)" },
];

/** 参数解析去向 */
export const RESOLVE_TYPE_OPTIONS: Array<{ value: DsResolveType; label: string }> = [
  { value: "queryParams", label: "queryParams" },
  { value: "routeParams", label: "routeParams" },
  { value: "bodyParams", label: "bodyParams" },
];

/** HTTP 方法 */
export const METHOD_OPTIONS: DsHttpMethod[] = ["get", "post", "put", "delete", "patch"];

/** HTTP 方法徽标色 */
export const METHOD_BADGE_COLORS: Record<string, string> = {
  get: "#67c23a",
  post: "#409eff",
  put: "#e6a23c",
  delete: "#f56c6c",
  patch: "#909399",
};

/** 默认拦截器代码模板 */
export function defaultInterceptorCode(type: "beforeReq" | "afterReq"): string {
  const param = type === "beforeReq" ? "requestConfig" : "responseResult";
  return `async function ${type}(${param}){\n\n  return ${param};\n}`;
}

/** 默认共享函数模板 */
export function defaultSharedFnCode(name = "fnName"): string {
  return `async function ${name}(ctx, payload){\n\n\n}`;
}

/** paramsType → 默认解析类型（对齐渲染层 getDefaultResolveType） */
export function defaultResolveTypeOf(paramsType: DsParamsType): string {
  switch (paramsType) {
    case "kvParams":
      return "queryParams";
    case "routeParams":
      return "routeParams";
    case "formSaveParams":
    case "paginationParams":
      return "bodyParams";
    default:
      return "";
  }
}
