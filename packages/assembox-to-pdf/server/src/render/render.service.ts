import { Injectable, Logger } from '@nestjs/common';
import type { Page } from 'playwright-core';
import { BrowserPool } from '../pool/browser-pool';
import { TicketService } from '../ticket/ticket.service';
import { TaskStore, ExportTask } from '../queue/task-store';
import { RenderError } from '../common/render-error';
import { PdfOptionsHelper, countPdfPages } from './pdf-options';
import { config } from '../config';

export interface PdfResult {
  pdf: Buffer;
  pages: number;
  metrics: { renderMs: number; pdfBytes: number };
}

/**
 * 单任务渲染编排（方案 A §7.3）：
 * 签发票据 → 池取上下文 → 加载打印宿主页 → 竞速等待 READY/ERROR → page.pdf()
 */
@Injectable()
export class RenderService {
  private readonly logger = new Logger(RenderService.name);

  constructor(
    private readonly pool: BrowserPool,
    private readonly tickets: TicketService,
    private readonly store: TaskStore,
    private readonly pdf: PdfOptionsHelper,
  ) {}

  async render(task: ExportTask): Promise<PdfResult> {
    const started = Date.now();
    const ticket = this.tickets.issue(task.id, task.sceneId);
    const url = this.pdf.printUrl(ticket);
    const timeoutMs = config.taskTimeoutMs;

    const result = await this.pool.withContext(async (ctx): Promise<PdfResult> => {
      const page = await ctx.newPage();
      // 页面诊断：bootstrap/渲染期错误直接进服务日志（测试环境排障关键）
      page.on('pageerror', (e) => this.logger.warn(`task=${task.id} pageerror: ${e.message}`));
      page.on('console', (msg) => {
        if (msg.type() === 'error' || msg.type() === 'warning') {
          this.logger.log(`task=${task.id} console.${msg.type()}: ${msg.text().slice(0, 500)}`);
        }
      });
      try {
        await page.emulateMedia({ media: 'print' }); // 激活 @media print 规则
        const loadResp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
        if (loadResp && !loadResp.ok()) {
          throw new RenderError('HOST_LOAD_FAILED', `打印宿主页加载失败 HTTP ${loadResp.status()}`);
        }

        // 竞速：就绪 / 页面显式报错 / 总超时。networkidle 不可靠（轮询/埋点长连接会挂死）
        // 错误谓词须返回错误对象本身（真值即触发，jsonValue 取回内容）
        const winner = await Promise.race([
          page
            .waitForFunction(() => (globalThis as any).__ASSEM_PDF_READY__ === true, null, { timeout: timeoutMs })
            .then(() => 'ready' as const),
          page
            .waitForFunction(() => (globalThis as any).__ASSEM_PDF_ERROR__ ?? false, null, { timeout: timeoutMs })
            .then(async (h) => {
              const err = await h.jsonValue().catch(() => null);
              return new RenderError('PAGE_REPORTED', `页面报错: ${JSON.stringify(err)}`);
            }),
          new Promise<never>((_, reject) => {
            const t = setTimeout(
              () => reject(new RenderError('PAGE_TIMEOUT', `渲染超时 ${timeoutMs}ms`)),
              timeoutMs + 2_000,
            );
            t.unref?.();
          }),
        ]);
        if (winner instanceof RenderError) throw winner;

        // 布局诊断：表格行高（无样式竞态时会跌到 ~16px，正常 ~32-40px）
        const rowH = await page
          .evaluate(
            `(() => {
              const tr = document.querySelector('.el-table__body-wrapper tbody tr, table tbody tr');
              return tr ? Math.round(tr.getBoundingClientRect().height) : -1;
            })()`,
          )
          .catch(() => -1);
        this.logger.log(`task=${task.id} layout: firstRowHeight=${rowH}px`);
        const pdfBuf: Buffer = await page.pdf(this.pdf.paramsFor(task.printOptions) as any);
        const pages = countPdfPages(pdfBuf);
        const renderMs = Date.now() - started;
        return { pdf: pdfBuf, pages, metrics: { renderMs, pdfBytes: pdfBuf.length } };
      } finally {
        await page.close().catch(() => undefined);
      }
    }, timeoutMs);

    this.logger.log(
      `task=${task.id} scene=${task.sceneId} renderMs=${result.metrics.renderMs} pages=${result.pages} bytes=${result.metrics.pdfBytes}`,
    );
    return result;
  }
}
