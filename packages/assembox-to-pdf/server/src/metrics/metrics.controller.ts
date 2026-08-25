import { Controller, Get, Header } from '@nestjs/common';
import { BrowserPool } from '../pool/browser-pool';
import { InProcessQueue } from '../queue/in-process-queue';
import { TaskStore } from '../queue/task-store';

/** 轻量指标（文本输出，Prometheus 抓取格式；演进可换 nestjs-prometheus） */
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly pool: BrowserPool,
    private readonly queue: InProcessQueue,
    private readonly store: TaskStore,
  ) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  metrics(): string {
    const { status, failReasons } = this.store.stats();
    const lines: string[] = [
      '# HELP export_queue_depth 排队中的导出任务数',
      '# TYPE export_queue_depth gauge',
      `export_queue_depth ${this.queue.depth()}`,
      '# HELP pool_contexts_active 活跃渲染上下文数',
      '# TYPE pool_contexts_active gauge',
      `pool_contexts_active ${this.pool.activeContexts}`,
      '# HELP pool_healthy 浏览器进程健康',
      '# TYPE pool_healthy gauge',
      `pool_healthy ${this.pool.isHealthy ? 1 : 0}`,
      '# HELP pool_browser_restarts_total 浏览器进程重启次数',
      '# TYPE pool_browser_restarts_total counter',
      `pool_browser_restarts_total ${this.pool.browserRestarts}`,
      '# HELP export_tasks_total 按状态统计的任务总数',
      '# TYPE export_tasks_total counter',
      ...Object.entries(status).map(([k, v]) => `export_tasks_total{status="${k}"} ${v}`),
      '# HELP export_fail_total 按失败原因统计',
      '# TYPE export_fail_total counter',
      ...Object.entries(failReasons).map(([k, v]) => `export_fail_total{reason="${k}"} ${v}`),
    ];
    return lines.join('\n') + '\n';
  }
}
