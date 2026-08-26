import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { TaskStore } from './task-store';

/**
 * 队列抽象（方案 A §7.2）：进程内有界实现；演进替换 BullMq 时保持同接口。
 */
export interface ExportQueue {
  enqueue(taskId: string): Promise<void>;
  dequeue(signal?: AbortSignal): Promise<string | null>;
  cancel(taskId: string): boolean;
  depth(): number;
}

/** 有界进程内队列：FIFO + 取消 + 深度指标 */
@Injectable()
export class InProcessQueue implements ExportQueue, OnModuleDestroy {
  private readonly items: string[] = [];
  private readonly cancelled = new Set<string>();
  private waiters: Array<{ resolve: (v: string | null) => void; signal?: AbortSignal }> = [];
  private closed = false;

  constructor(private readonly store: TaskStore) {}

  async enqueue(taskId: string): Promise<void> {
    if (this.closed) throw new Error('queue closed');
    this.items.push(taskId);
    this.pump();
  }

  dequeue(signal?: AbortSignal): Promise<string | null> {
    if (this.items.length > 0) {
      const id = this.items.shift()!;
      if (this.store.get(id)?.status === 'cancelled') {
        return this.dequeue(signal);
      }
      return Promise.resolve(id);
    }
    if (this.closed) return Promise.resolve(null);
    return new Promise((resolve) => {
      const waiter = { resolve, signal };
      this.waiters.push(waiter);
      signal?.addEventListener('abort', () => {
        this.waiters = this.waiters.filter((w) => w !== waiter);
        resolve(null);
      });
    });
  }

  cancel(taskId: string): boolean {
    const task = this.store.get(taskId);
    if (!task || task.status !== 'queued') return false;
    task.status = 'cancelled';
    task.finishedAt = Date.now();
    this.cancelled.add(taskId);
    // 已在队列中的项在 dequeue 时按状态跳过
    const idx = this.items.indexOf(taskId);
    if (idx >= 0) this.items.splice(idx, 1);
    return true;
  }

  depth(): number {
    return this.items.length;
  }

  private pump(): void {
    while (this.waiters.length > 0 && this.items.length > 0) {
      const id = this.items.shift()!;
      const task = this.store.get(id);
      if (!task || task.status === 'cancelled') continue;
      const waiter = this.waiters.shift()!;
      waiter.resolve(id);
    }
  }

  onModuleDestroy(): void {
    this.closed = true;
    this.waiters.forEach((w) => w.resolve(null));
    this.waiters = [];
  }
}
