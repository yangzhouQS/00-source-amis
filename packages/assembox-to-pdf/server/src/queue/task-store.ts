import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config';

export type TaskStatus = 'queued' | 'rendering' | 'done' | 'failed' | 'cancelled';

export interface ExportTask {
  id: string;
  tenantId: string;
  sceneId: string;
  printOptions: Record<string, unknown>;
  filters?: Record<string, unknown>;
  fingerprint: string;
  status: TaskStatus;
  attempts: number;
  createdAt: number;
  finishedAt?: number;
  error?: { code: string; message: string };
  result?: { file: string; bytes: number; pages: number; url: string; expiresAt: number };
  metrics?: { queuedMs?: number; renderMs?: number; pdfBytes?: number; pages?: number };
}

/**
 * 任务存储（测试环境内存实现）。
 * 演进：换成 Redis/DB 实现，接口不变（方案 A §7.2）。
 */
@Injectable()
export class TaskStore {
  private readonly tasks = new Map<string, ExportTask>();

  /** fingerprint 由调用方（ExportsService）统一计算，保证存取一致 */
  create(
    input: Pick<ExportTask, 'tenantId' | 'sceneId' | 'printOptions' | 'filters'> & { fingerprint: string },
  ): ExportTask {
    const task: ExportTask = {
      id: randomUUID(),
      tenantId: input.tenantId,
      sceneId: input.sceneId,
      printOptions: input.printOptions,
      filters: input.filters,
      fingerprint: input.fingerprint,
      status: 'queued',
      attempts: 0,
      createdAt: Date.now(),
    };
    this.tasks.set(task.id, task);
    return task;
  }

  get(id: string): ExportTask | undefined {
    return this.tasks.get(id);
  }

  update(id: string, patch: Partial<ExportTask>): ExportTask | undefined {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    Object.assign(task, patch);
    return task;
  }

  /** 幂等指纹命中：10 分钟窗口内复用已完成产物 */
  findReusable(fingerprint: string): ExportTask | undefined {
    const now = Date.now();
    for (const t of this.tasks.values()) {
      if (t.fingerprint === fingerprint && t.status === 'done' && t.finishedAt && now - t.finishedAt < 10 * 60_000) {
        return t;
      }
    }
    return undefined;
  }

  savePdf(id: string, pdf: Buffer, pages: number): { file: string; bytes: number; url: string; expiresAt: number } {
    mkdirSync(config.exportsDir, { recursive: true });
    const file = join(config.exportsDir, `${id}.pdf`);
    writeFileSync(file, pdf);
    const expiresAt = Date.now() + 24 * 3600_000;
    const result = { file, bytes: pdf.length, pages, url: `/api/v1/exports/${id}/file`, expiresAt };
    this.update(id, { result, finishedAt: Date.now() });
    return result;
  }

  /** 状态统计（/metrics 用） */
  stats(): { status: Record<string, number>; failReasons: Record<string, number> } {
    const status: Record<string, number> = {};
    const failReasons: Record<string, number> = {};
    for (const t of this.tasks.values()) {
      status[t.status] = (status[t.status] ?? 0) + 1;
      if (t.error?.code) {
        failReasons[t.error.code] = (failReasons[t.error.code] ?? 0) + 1;
      }
    }
    return { status, failReasons };
  }

  /** 过期清理（TTL 7 天，任务记录 + 产物） */
  sweep(): void {
    const now = Date.now();
    for (const [id, t] of this.tasks) {
      if (t.finishedAt && now - t.finishedAt > 7 * 24 * 3600_000) {
        this.tasks.delete(id);
      }
    }
  }
}
