/**
 * 打印选项（print-transform 消费的子集；完整 printOptions 由导出服务 DTO 定义）
 */
export interface PrintTransformOptions {
  /** 表格全量取数行上限（写入 YqTableAsync 分页 currentSize），默认 1000 */
  rowLimit?: number;
  /** 是否保留导航条（YqNavigationBar），默认 false（剔除） */
  keepNav?: boolean;
}

/** 变换统计（供任务记录/日志观测） */
export interface TransformStats {
  /** 按 renderType 统计被剔除的节点数 */
  removed: Record<string, number>;
  /** 改写分页配置的表格数 */
  tableRewrites: number;
  /** 注入 animation:false 的图表数 */
  chartRewrites: number;
  /** 场景中出现但不在已知清单里的 renderType（透传处理，仅上报） */
  unknownRenderTypes: string[];
}

export interface TransformResult<T> {
  scene: T;
  stats: TransformStats;
}
