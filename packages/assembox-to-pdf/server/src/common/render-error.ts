/** 渲染阶段错误分类（/metrics 与任务记录使用） */
export type RenderErrorCode =
  | 'HOST_LOAD_FAILED'
  | 'PAGE_REPORTED'
  | 'PAGE_TIMEOUT'
  | 'BROWSER_CRASH'
  | 'POOL_EXHAUSTED'
  | 'RENDER_FAILED'
  | 'SCENE_NOT_FOUND';

/** 基础设施类错误（可重试）：浏览器崩溃/池超时；页面业务失败（PAGE_REPORTED）不可重试 */
export const INFRASTRUCTURE_ERROR_CODES: ReadonlySet<string> = new Set([
  'BROWSER_CRASH',
  'POOL_EXHAUSTED',
  'PAGE_TIMEOUT',
  'RENDER_FAILED',
]);

export class RenderError extends Error {
  constructor(
    public readonly code: RenderErrorCode,
    message: string,
    public readonly detail?: unknown,
  ) {
    super(`[${code}] ${message}`);
    this.name = 'RenderError';
  }
}
