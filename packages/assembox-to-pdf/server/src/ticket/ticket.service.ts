import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { config } from '../config';

interface TicketRecord {
  taskId: string;
  sceneId: string;
  expiresAt: number;
  consumed: boolean;
}

/**
 * 一次性任务票据（方案 A §4.1/§9）：
 * - 签发即绑定 taskId，60s TTL
 * - claim 一次性消费（防同一票据并发渲染两份）
 */
@Injectable()
export class TicketService implements OnModuleInit, OnModuleDestroy {
  private readonly tickets = new Map<string, TicketRecord>();
  private sweeper?: NodeJS.Timeout;

  onModuleInit(): void {
    this.sweeper = setInterval(() => this.sweep(), 5_000);
    this.sweeper.unref?.();
  }

  onModuleDestroy(): void {
    if (this.sweeper) clearInterval(this.sweeper);
  }

  issue(taskId: string, sceneId: string): string {
    const token = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    this.tickets.set(token, { taskId, sceneId, expiresAt: Date.now() + config.ticketTtlMs, consumed: false });
    return token;
  }

  /** 一次性消费：不存在 / 已消费 / 过期 均视为无效 */
  consume(token: string): TicketRecord | null {
    const record = this.tickets.get(token);
    if (!record || record.consumed || record.expiresAt < Date.now()) return null;
    record.consumed = true;
    this.tickets.delete(token); // 立即移除，同 token 二次 claim 必失败
    return record;
  }

  private sweep(): void {
    const now = Date.now();
    for (const [token, rec] of this.tickets) {
      if (rec.expiresAt < now) this.tickets.delete(token);
    }
  }
}
