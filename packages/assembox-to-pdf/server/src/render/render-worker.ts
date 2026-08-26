import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { InProcessQueue } from '../queue/in-process-queue';
import { TaskStore } from '../queue/task-store';
import { RenderService } from './render.service';
import { BrowserPool } from '../pool/browser-pool';
import { RenderError, INFRASTRUCTURE_ERROR_CODES } from '../common/render-error';
import { config } from '../config';

const MAX_ATTEMPTS = 3; // 首次 + 2 次基础设施重试（方案 A §7.2）

/**
 * 队列消费循环：每渲染槽位一条流水线（POOL_CONTEXTS 条并行 loop）。
 * 基础设施错误（浏览器崩溃/池超时）重试；页面业务失败（PAGE_REPORTED）不重试。
 */
@Injectable()
export class RenderWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(RenderWorker.name);
  private running = true;
  private loops: Promise<void>[] = [];

  constructor(
    private readonly queue: InProcessQueue,
    private readonly store: TaskStore,
    private readonly render: RenderService,
    private readonly pool: BrowserPool,
  ) {}

  onApplicationBootstrap(): void {
    for (let i = 0; i < Math.max(1, config.poolContexts); i++) {
      this.loops.push(this.loop(i));
    }
    this.logger.log(`render worker started: ${Math.max(1, config.poolContexts)} pipelines`);
  }

  private async loop(slot: number): Promise<void> {
    while (this.running) {
      const taskId = await this.queue.dequeue();
      if (!taskId) return;
      const task = this.store.get(taskId);
      if (!task || task.status === 'cancelled') continue;

      const queuedMs = Date.now() - task.createdAt;
      this.store.update(taskId, { status: 'rendering', attempts: task.attempts + 1, metrics: { ...task.metrics, queuedMs } });
      try {
        const result = await this.render.render(task);
        this.store.savePdf(taskId, result.pdf, result.pages);
        this.store.update(taskId, {
          status: 'done',
          finishedAt: Date.now(),
          metrics: { ...result.metrics, queuedMs, pages: result.pages },
        });
      } catch (e) {
        const err = e as RenderError;
        const code = err.code ?? 'RENDER_FAILED';
        this.logger.warn(`task=${taskId} slot=${slot} failed code=${code}: ${err.message}`);
        const canRetry = INFRASTRUCTURE_ERROR_CODES.has(code) && (this.store.get(taskId)?.attempts ?? 0) < MAX_ATTEMPTS;
        if (canRetry) {
          this.store.update(taskId, { status: 'queued', error: { code, message: err.message } });
          await this.queue.enqueue(taskId);
        } else {
          this.store.update(taskId, {
            status: 'failed',
            finishedAt: Date.now(),
            error: { code, message: err.message },
          });
        }
      } finally {
        // 空闲时按需轮换浏览器进程（防泄漏累积）
        await this.pool.recycleIfIdle().catch(() => undefined);
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.running = false;
    await Promise.allSettled(this.loops);
  }
}
