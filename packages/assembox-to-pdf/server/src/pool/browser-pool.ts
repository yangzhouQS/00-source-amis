import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { chromium, type Browser, type BrowserContext } from 'playwright-core';
import { config } from '../config';

/**
 * 浏览器池（方案 A §7.4）：进程（Browser）× 上下文（BrowserContext）两级模型。
 *
 * - 生命周期挂 Nest 模块钩子：onModuleInit 启动 / onModuleDestroy 优雅停机
 * - acquireContext 信号量并发控制 + FIFO 排队 + 超时（POOL_EXHAUSTED）
 * - 自愈：disconnected → 标记不健康 → 下一次 acquire 前重建
 * - 轮换：累计 RENDER 任务超过阈值后在下一次空闲时重启进程（防 Vue/G2Plot 泄漏累积）
 */
@Injectable()
export class BrowserPool implements OnModuleInit, OnModuleDestroy {
  private browser?: Browser;
  private healthy = false;
  private launching?: Promise<Browser>;

  private active = 0;
  private readonly waiters: Array<{
    resolve: (v: BrowserContext) => void;
    reject: (e: Error) => void;
    timer: NodeJS.Timeout;
  }> = [];

  /** 使用计数（轮换依据）与指标 */
  private servedTasks = 0;
  browserRestarts = 0;

  get isHealthy(): boolean {
    return this.healthy;
  }

  get activeContexts(): number {
    return this.active;
  }

  async onModuleInit(): Promise<void> {
    await this.launch();
  }

  async onModuleDestroy(): Promise<void> {
    this.healthy = false;
    this.waiters.forEach((w) => {
      clearTimeout(w.timer);
      w.reject(new Error('browser pool shutting down'));
    });
    this.waiters.length = 0;
    if (this.browser) {
      await this.browser.close().catch(() => undefined);
      this.browser = undefined;
    }
  }

  private async launch(): Promise<Browser> {
    if (this.launching) return this.launching;
    this.launching = (async () => {
      if (!config.chromiumExecutablePath) {
        throw new Error(
          '未找到 Chromium 可执行文件：设置 CHROMIUM_EXECUTABLE_PATH 或安装 /usr/bin/google-chrome',
        );
      }
      const browser = await chromium.launch({
        executablePath: config.chromiumExecutablePath,
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--font-render-hinting=none',
          '--disable-dev-tools',
        ],
      });
      browser.on('disconnected', () => {
        if (this.browser === browser) {
          this.healthy = false;
          this.browser = undefined;
          this.browserRestarts++;
        }
      });
      this.browser = browser;
      this.healthy = true;
      this.servedTasks = 0;
      return browser;
    })();
    try {
      return await this.launching;
    } finally {
      this.launching = undefined;
    }
  }

  private async ensureBrowser(): Promise<Browser> {
    if (this.healthy && this.browser) return this.browser;
    return this.launch();
  }

  /**
   * 槽位排队获取上下文；finally 自动释放槽位并销毁上下文
   * （上下文即隔离边界：cookie/localStorage/凭证全清，方案 A §9 任务间隔离）
   *
   * 视口高度 30000px：biz 底表（table-pro）为虚拟滚动表格，仅渲染视口内行；
   * 打印前给足高度让全量行进入渲染区，page.pdf() 按 A4 分页不受视口影响。
   */
  private async newPrintContext(browser: Browser): Promise<BrowserContext> {
    return browser.newContext({
      viewport: { width: 794, height: 30_000 },
      deviceScaleFactor: 1,
    });
  }
  async withContext<T>(fn: (ctx: BrowserContext) => Promise<T>, timeoutMs = config.taskTimeoutMs): Promise<T> {
    const ctx = await this.acquire(timeoutMs);
    try {
      const result = await fn(ctx);
      this.servedTasks++;
      return result;
    } finally {
      await ctx.close().catch(() => undefined);
      this.active--;
      this.pump();
    }
  }

  private acquire(timeoutMs: number): Promise<BrowserContext> {
    return new Promise<BrowserContext>((resolve, reject) => {
      const tryAcquire = async (): Promise<void> => {
        if (!this.healthy && !this.launching) {
          try {
            await this.ensureBrowser();
          } catch (e) {
            reject(e as Error);
            return;
          }
        }
        if (this.active < config.poolContexts) {
          this.active++;
          try {
            const browser = await this.ensureBrowser();
            // 屏幕态即按纸宽布局（print.css 约定 A4=794px）
            const ctx = await this.newPrintContext(browser);
            resolve(ctx);
          } catch (e) {
            this.active--;
            reject(e as Error);
          }
          return;
        }
        // 槽位满：FIFO 排队 + 超时
        const waiter = {
          resolve,
          reject,
          timer: setTimeout(() => {
            const idx = this.waiters.indexOf(waiter);
            if (idx >= 0) this.waiters.splice(idx, 1);
            reject(new Error(`POOL_EXHAUSTED: 等待渲染槽位超时 ${timeoutMs}ms`));
          }, timeoutMs),
        };
        this.waiters.push(waiter);
      };
      void tryAcquire();
    });
  }

  private pump(): void {
    while (this.waiters.length > 0 && this.active < config.poolContexts) {
      const waiter = this.waiters.shift()!;
      clearTimeout(waiter.timer);
      this.active++;
      void (async () => {
        try {
          const browser = await this.ensureBrowser();
          const ctx = await this.newPrintContext(browser);
          waiter.resolve(ctx);
        } catch (e) {
          this.active--;
          waiter.reject(e as Error);
          this.pump();
        }
      })();
    }
  }

  /** 是否应当轮换（空闲时由 worker 调用 recycleIfIdle） */
  shouldRecycle(): boolean {
    return this.servedTasks >= config.browserRecycleAfter && this.active === 0;
  }

  async recycleIfIdle(): Promise<boolean> {
    if (!this.shouldRecycle()) return false;
    await this.browser?.close().catch(() => undefined);
    this.browser = undefined;
    this.healthy = false;
    await this.launch();
    return true;
  }
}

export const BROWSER_POOL = Symbol('BROWSER_POOL');
export const InjectBrowserPool = (): ParameterDecorator => Inject(BROWSER_POOL);
