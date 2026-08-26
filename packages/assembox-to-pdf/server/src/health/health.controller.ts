import { Controller, Get } from '@nestjs/common';
import { BrowserPool } from '../pool/browser-pool';
import { InProcessQueue } from '../queue/in-process-queue';
import { TaskStore } from '../queue/task-store';
import { config } from '../config';

/** 健康检查（演进可换 @nestjs/terminus；测试环境直接实现） */
@Controller('health')
export class HealthController {
  constructor(
    private readonly pool: BrowserPool,
    private readonly queue: InProcessQueue,
    private readonly store: TaskStore,
  ) {}

  @Get('live')
  live(): Record<string, string> {
    return { status: 'ok' };
  }

  /** 就绪 = 池健康 + 队列未满（负载均衡摘流依据） */
  @Get('ready')
  ready(): { status: string; details: Record<string, unknown> } {
    const depth = this.queue.depth();
    const healthy = this.pool.isHealthy && depth < config.queueMax;
    return {
      status: healthy ? 'ok' : 'unavailable',
      details: {
        poolHealthy: this.pool.isHealthy,
        activeContexts: this.pool.activeContexts,
        queueDepth: depth,
        queueMax: config.queueMax,
      },
    };
  }
}
