import { Injectable, Logger } from '@nestjs/common';
import { config } from '../config';

export interface PdfParams {
  format: 'A4' | 'A3' | 'Letter';
  landscape: boolean;
  printBackground: boolean;
  scale: number;
  margin: { top: string; bottom: string; left: string; right: string };
  displayHeaderFooter: boolean;
  headerTemplate: string;
  footerTemplate: string;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** printOptions（DTO 已收敛白名单）→ Playwright page.pdf() 参数 */
export function pdfParamsOf(printOptions: Record<string, any> = {}): PdfParams {
  const format = printOptions.format ?? 'A4';
  const orientation = printOptions.orientation ?? 'portrait';
  const mm = printOptions.marginsMm ?? { top: 12, bottom: 16, left: 12, right: 12 };
  const title = esc(String(printOptions.title ?? ''));
  const exportedAt = esc(
    new Date().toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' }),
  );
  const showPageNumber = printOptions.showPageNumber !== false;

  return {
    format,
    landscape: orientation === 'landscape',
    printBackground: true, // Element Plus 表头底色/斑马纹必需
    scale: Number(printOptions.scale ?? 1),
    margin: {
      top: `${mm.top}mm`,
      bottom: `${mm.bottom}mm`,
      left: `${mm.left}mm`,
      right: `${mm.right}mm`,
    },
    displayHeaderFooter: true,
    // Chromium 页眉页脚模板仅支持 inline style（方案 A §8 已知差异清单）
    headerTemplate:
      `<div style="width:100%;font-size:8px;color:#909399;padding:0 12mm;display:flex;justify-content:space-between;">` +
      `<span>${title}</span><span>导出时间 ${exportedAt}</span></div>`,
    footerTemplate: showPageNumber
      ? `<div style="width:100%;font-size:8px;color:#909399;text-align:center;">` +
        `<span class="pageNumber"></span> / <span class="totalPages"></span></div>`
      : '<span></span>',
  };
}

/**
 * 从 PDF 字节流解析页数（Chromium 产物含未压缩的 /Type /Pages /Count N）。
 * Pages 树是嵌套结构：子树也有 /Count，且可能排在根节点之前 —— 取最大值（= 根节点总数）。
 */
export function countPdfPages(buf: Buffer): number {
  const s = buf.toString('latin1');
  const counts = [...s.matchAll(/\/Count\s+(\d+)/g)].map((m) => Number(m[1]));
  if (counts.length > 0) return Math.max(...counts);
  const pages = s.match(/\/Type\s*\/Page[^s]/g);
  return pages ? pages.length : 0;
}

@Injectable()
export class PdfOptionsHelper {
  private readonly logger = new Logger(PdfOptionsHelper.name);

  paramsFor(printOptions: Record<string, any>): PdfParams {
    return pdfParamsOf(printOptions);
  }

  countPages(buf: Buffer): number {
    return countPdfPages(buf);
  }

  printUrl(ticket: string): string {
    return `${config.publicBaseUrl}/print?ticket=${encodeURIComponent(ticket)}`;
  }
}
