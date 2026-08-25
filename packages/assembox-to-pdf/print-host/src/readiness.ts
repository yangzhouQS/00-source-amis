/**
 * 就绪信号协议（§5）
 *
 * LOADING ──请求计数归零──▶ SETTLING(两帧+字体+图片) ──▶ READY   → window.__ASSEM_PDF_READY__ = true
 *    └────────── 任一请求失败且不容忍 ──────────────────▶ ERROR  → window.__ASSEM_PDF_ERROR__ = {...}
 *
 * 关键实现事实：
 * - core-next 请求函数失败时**返回** status:'error' 而非抛异常（request/executor.ts:61-67），
 *   判定失败必须检查返回值，否则会静默导出残缺 PDF；
 * - wrapFns 逐键替换 core.$requestFns 上的函数（同一对象引用），组件侧 useRemoteData
 *   取 ctx.$requestFns[fnName] 时拿到的即包装版，零侵入 core-next。
 */

declare global {
  interface Window {
    __ASSEM_PDF_READY__?: boolean;
    __ASSEM_PDF_ERROR__?: { code: string; message: string; requestFn?: string };
  }
}

export interface Readiness {
  /** 包装 core.$requestFns（须在 app.mount 之前调用） */
  wrapFns: (core: { $requestFns: Record<string, (params?: any) => Promise<any>> }) => void;
  /** 无请求场景的兜底：mount 后手动触发一次就绪检查 */
  idleCheck: () => void;
}

function doubleRaf(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

async function waitForImages(): Promise<void> {
  const imgs = Array.from(document.images);
  await Promise.allSettled(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }),
    ),
  );
}

/**
 * 图表就绪探测（方案 A §5.3）：G2Plot 渲染是 onMounted 后的异步过程，请求计数覆盖不到。
 * - 前 mountGraceMs 内等 canvas 元素出现（图表挂载）
 * - 出现后轮询所有 canvas「落墨」（alpha 通道非全透明）再放行，总上限 deadlineMs
 * - webgl/不可读 canvas 视为已绘制（只防白屏截取，不追求精确）
 */
function canvasHasInk(c: HTMLCanvasElement): boolean {
  try {
    const ctx = c.getContext('2d');
    if (!ctx) return true;
    const { width, height } = c;
    if (!width || !height) return false;
    const data = ctx.getImageData(0, 0, width, height).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] !== 0) return true;
    }
    return false;
  } catch {
    return true;
  }
}

async function waitForCharts(mountGraceMs = 600, deadlineMs = 4000): Promise<void> {
  const start = performance.now();
  for (;;) {
    const canvases = Array.from(document.querySelectorAll('canvas'));
    if (canvases.length === 0) {
      // 无图表场景：宽限期内可能还没挂载，超时即放行
      if (performance.now() - start > mountGraceMs) return;
    } else if (canvases.every(canvasHasInk) || performance.now() - start > deadlineMs) {
      return;
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

/**
 * 表格打印重排：Element Plus / table-pro 的双表 + scrollbar 包装链结构导致三个打印缺陷：
 *   ① body 表无 thead → table-header-group 跨页重复失效（页 2+ 无表头）
 *   ② header 表孤悬当前页尾，数据从下一页开始（孤行表头）
 *   ③ 包装链（.el-table__body-wrapper > .el-scrollbar > …）阻断 Chromium 的 thead
 *      跨页重复（二分实验实证：同表移出链外即恢复重复），且链内分页行为异常（空白页/劈行）
 * 修复：header 表的 colgroup+thead 合并进 body 表后，把 body 表整体移出包装链、
 * 直挂打印根（保留表上全部类名样式），隐藏原 .el-table 组件壳。
 */
function reparentTablesForPrint(root: HTMLElement): number {
  let merged = 0;
  const tables = Array.from(root.querySelectorAll<HTMLElement>('.el-table'));
  tables.forEach((elTable) => {
    const headerWrap = elTable.querySelector<HTMLElement>('.el-table__header-wrapper');
    const bodyWrap = elTable.querySelector<HTMLElement>('.el-table__body-wrapper');
    const headerTable = headerWrap?.querySelector('table');
    const bodyTable = bodyWrap?.querySelector('table');
    if (!headerTable || !bodyTable) return;

    const headerThead = headerTable.querySelector('thead');
    if (!headerThead) return;

    // ① colgroup + thead 合并进 body 表（列宽对齐 + 跨页重复的载体）
    const headerColgroup = headerTable.querySelector('colgroup');
    if (headerColgroup && !bodyTable.querySelector('colgroup')) {
      bodyTable.insertBefore(headerColgroup.cloneNode(true), bodyTable.firstChild);
    }
    if (!bodyTable.querySelector('thead')) {
      bodyTable.insertBefore(headerThead.cloneNode(true), bodyTable.firstChild);
    }

    // ② 移出包装链，直挂打印根。slot 继承原组件壳的全部类名（--fit/--striped/--border
    //    等视觉变体都靠 .el-table 祖先选择器生效，缺失会导致斑马纹/边框丢失）
    const slot = document.createElement('div');
    slot.setAttribute('data-print-table-slot', '');
    slot.className = `${elTable.className} assem-print-table`;
    elTable.parentElement?.insertBefore(slot, elTable.nextSibling);
    slot.appendChild(bodyTable);

    // ③ 隐藏原组件壳（含空掉的 wrapper 链，避免占位/空白页）
    elTable.style.display = 'none';
    merged++;
  });
  return merged;
}

/**
 * 打印布局规整：剥离 biz 组件（table-pro 等）以 JS 内联方式写入的 height:100%。
 * 打印布局按纸高解析百分比高度 → 表格被截断在首屏；改为 auto 后表格按自然高度
 * 参与文档流分页（thead 跨页重复由 print.css 的 table-header-group 保障）。
 */
function normalizePrintLayout(): void {
  // html/body：vendored 主题的全高规则（height:100% / overflow:hidden）会让打印布局
  // 只产出一页 —— 内联样式覆盖一切样式表规则，最稳
  const docEl = document.documentElement;
  docEl.style.height = 'auto';
  docEl.style.minHeight = '0';
  docEl.style.overflow = 'visible';
  document.body.style.height = 'auto';
  document.body.style.minHeight = '0';
  document.body.style.overflow = 'visible';

  const root = document.querySelector('[data-print-root]') as HTMLElement | null;
  if (!root) return;
  const targets = root.querySelectorAll<HTMLElement>(
    ['.el-table', '.yq-table-async-wrap', '.yq-table-only-wrap', '.yq-list-async-wrap'].join(','),
  );
  targets.forEach((el) => {
    if (el.style.height) el.style.height = 'auto';
    if (el.style.maxHeight) el.style.maxHeight = 'none';
  });

  // 表格打印重排：合并 thead + 移出包装链（须在高度剥离后执行：表格已达自然高度）
  reparentTablesForPrint(root);
}

export function installReadiness(options: { tolerant?: boolean } = {}): Readiness {
  let pending = 0;
  let mounted = false;
  let settled = false;

  const win = window as any;

  const settle = async (): Promise<void> => {
    if (settled || win.__ASSEM_PDF_ERROR__) return;
    settled = true;
    try {
      await doubleRaf();
      if (document.fonts?.ready) await document.fonts.ready;
      await waitForImages();
      await waitForCharts(); // 图表 canvas 落墨（无图表场景宽限后直接放行）
      normalizePrintLayout(); // 剥离内联百分比高度后再等两帧，让重排完成
      await doubleRaf();
    } finally {
      if (!win.__ASSEM_PDF_ERROR__) {
        win.__ASSEM_PDF_READY__ = true;
      }
    }
  };

  const maybeSettle = (): void => {
    if (mounted && pending === 0 && !settled) {
      void settle();
    }
  };

  return {
    wrapFns(core) {
      for (const key of Object.keys(core.$requestFns)) {
        const orig = core.$requestFns[key];
        core.$requestFns[key] = async (...args: any[]) => {
          pending++;
          try {
            const result = await orig(...args);
            if (result && typeof result === 'object' && result.status === 'error' && !options.tolerant) {
              win.__ASSEM_PDF_ERROR__ = {
                code: 'PAGE_REQUEST_FAILED',
                message: String(result.error ?? '页面请求失败'),
                requestFn: key,
              };
            }
            return result;
          } finally {
            pending--;
            maybeSettle();
          }
        };
      }
    },
    idleCheck() {
      mounted = true;
      maybeSettle();
    },
  };
}

/** claim 阶段即失败：直接置错误信号（导出服务 waitForFunction 尽早失败） */
export function failFast(code: string, message: string): void {
  const win = window as any;
  win.__ASSEM_PDF_ERROR__ = { code, message };
}
