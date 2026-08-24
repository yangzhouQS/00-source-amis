/**
 * Mock 服务类型定义
 *
 * 信封契约对齐 assembox-core-next request/executor.ts：
 *   成功：{ code: 200, status: "success", message: "", result: <数据> }
 *   分页：result = { count: 总数, result: 行数组 }（toPaged 消费）
 *   失败：HTTP 真实错误码 + { code, status: "error", message }
 */

export type MockMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

/** 请求上下文（handler 入参） */
export interface MockContext {
  /** 路径参数（url 中 :param 段），如 /update/:orgId/:id → { orgId, id } */
  params: Record<string, string>;
  /** 查询参数（URLSearchParams 转对象） */
  query: Record<string, string>;
  /** 请求体（JSON 已解析；非 JSON 为 undefined） */
  body: any;
  /** 原始请求头（小写键） */
  headers: Record<string, string | string[] | undefined>;
  /** 完整路径（含 query 前部分） */
  path: string;
}

/**
 * handler 返回值：
 * - 普通对象/数组/null → 自动包成功信封（result = 该值）
 * - MockRawResponse → 完全接管响应（不包信封，可自定义 status/headers/body）
 */
export type MockResult = any | MockRawResponse;

export interface MockRawResponse {
  /** 不自动包信封 */
  __raw: true;
  status?: number;
  headers?: Record<string, string>;
  body?: any;
}

export interface MockRoute {
  /** HTTP 方法（大小写不敏感） */
  method: MockMethod;
  /**
   * 路径。支持 :param 段（与 requestConfig 路由式 URL 一致，如
   * /demo/payment-module/update/:orgId/:id）；非 : 开头的段精确匹配。
   * 查询串不参与匹配。
   */
  url: string;
  /** 业务说明（日志与文档用） */
  description?: string;
  /** 模拟延迟 ms（默认 200，让 loading 态可见） */
  delay?: number;
  handler: (ctx: MockContext) => MockResult | Promise<MockResult>;
}

/** mock 模块标准形态：导出 routes 数组 */
export interface MockModule {
  routes: MockRoute[];
}
