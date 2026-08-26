/**
 * 任务票据 claim 客户端（§4.1 加载协议）
 *
 * URL 只携带一次性 ticket，宿主页持票向导出服务换取完整任务描述：
 * { taskId, sceneName, uiSkeleton, dataSource, routerConfig, printOptions }
 */
export interface ClaimResponse {
  taskId: string;
  sceneName: string;
  /** 原始 uiSkeleton JSON（事件仍是字符串，需经 deserializeScene 适配） */
  uiSkeleton: Record<string, unknown>;
  dataSource: Record<string, unknown>;
  routerConfig: Record<string, unknown>;
  printOptions: {
    format?: 'A4' | 'A3' | 'Letter';
    orientation?: 'portrait' | 'landscape';
    rowLimit?: number;
    keepNav?: boolean;
    tolerant?: boolean;
    dataMode?: 'browser' | 'prefetch';
    scale?: number;
  };
}

export function getTicketFromUrl(): string | null {
  const ticket = new URLSearchParams(location.search).get('ticket');
  return ticket && ticket.length > 0 ? ticket : null;
}

export async function claimTask(ticket: string): Promise<ClaimResponse> {
  const res = await fetch('/internal/task/claim', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ticket }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`claim 失败 (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as ClaimResponse;
}
