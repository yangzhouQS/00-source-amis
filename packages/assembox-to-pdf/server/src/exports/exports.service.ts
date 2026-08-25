import { HttpException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { InProcessQueue } from '../queue/in-process-queue';
import { TaskStore, ExportTask } from '../queue/task-store';
import { SceneService } from '../scene/scene.service';
import { CreateExportDto } from './dto';
import { RenderService } from '../render/render.service';
import { config } from '../config';

@Injectable()
export class ExportsService {
  private readonly logger = new Logger(ExportsService.name);

  constructor(
    private readonly queue: InProcessQueue,
    private readonly store: TaskStore,
    private readonly scenes: SceneService,
    private readonly render: RenderService,
  ) {}

  async create(dto: CreateExportDto, tenantId: string): Promise<ExportTask> {
    this.scenes.assemble(dto.sceneId); // 场景存在性校验（不存在抛 404）

    if (this.queue.depth() >= config.queueMax) {
      throw new ServiceUnavailableException('导出队列已满，请稍后重试');
    }

    // 幂等：10 分钟窗口内同指纹直接复用产物
    const fingerprint = fingerprintOf(dto, tenantId);
    const reusable = this.store.findReusable(fingerprint);
    if (reusable) {
      this.logger.log(`task=${reusable.id} reused (fingerprint hit)`);
      return reusable;
    }

    const task = this.store.create({
      tenantId,
      sceneId: dto.sceneId,
      printOptions: (dto.printOptions as Record<string, unknown>) ?? {},
      filters: dto.filters,
      fingerprint,
    });
    await this.queue.enqueue(task.id);
    return task;
  }

  get(id: string): ExportTask {
    const task = this.store.get(id);
    if (!task) throw new NotFoundException(`任务不存在: ${id}`);
    return task;
  }

  cancel(id: string): ExportTask {
    const task = this.get(id);
    if (!this.queue.cancel(id)) {
      throw new HttpException(`任务 ${id} 状态为 ${task.status}，不可取消`, 409);
    }
    return this.get(id);
  }

  /**
   * 同步小文档通道（方案 A §7.1）：直接渲染并返回 PDF 字节。
   * 池槽位等待超时 → 503（客户端改走异步）。
   */
  async renderSync(dto: CreateExportDto, tenantId: string): Promise<{ buffer: Buffer; pages: number; taskId: string }> {
    this.scenes.assemble(dto.sceneId);
    const task = this.store.create({
      tenantId,
      sceneId: dto.sceneId,
      printOptions: (dto.printOptions as Record<string, unknown>) ?? {},
      filters: dto.filters,
      fingerprint: fingerprintOf(dto, tenantId),
    });
    this.store.update(task.id, { status: 'rendering', attempts: 1 });
    try {
      const result = await this.render.render(task);
      this.store.savePdf(task.id, result.pdf, result.pages);
      this.store.update(task.id, { status: 'done', finishedAt: Date.now(), metrics: result.metrics });
      return { buffer: result.pdf, pages: result.pages, taskId: task.id };
    } catch (e) {
      const err = e as Error;
      this.store.update(task.id, {
        status: 'failed',
        finishedAt: Date.now(),
        error: { code: (e as any).code ?? 'RENDER_FAILED', message: err.message },
      });
      if ((e as any).code === 'POOL_EXHAUSTED' || /POOL_EXHAUSTED/.test(err.message)) {
        throw new ServiceUnavailableException('渲染槽位繁忙，请改用异步导出');
      }
      throw new HttpException(err.message, 500);
    }
  }
}

function fingerprintOf(dto: CreateExportDto, tenantId: string): string {
  return createHash('sha1')
    .update(tenantId)
    .update(dto.sceneId)
    .update(JSON.stringify(dto.printOptions ?? {}))
    .update(JSON.stringify(dto.filters ?? {}))
    .digest('hex');
}
