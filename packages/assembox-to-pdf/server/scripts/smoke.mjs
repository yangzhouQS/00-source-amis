/**
 * 端到端 smoke：同步导出 + 异步导出 + 状态轮询 + 产物下载 + 页数校验
 * 用法：先启动服务（pnpm --filter @cs/assembox-pdf-server start），再 node scripts/smoke.mjs
 */
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const BASE = process.env.SMOKE_BASE ?? 'http://127.0.0.1:9100';
const OUT = process.env.SMOKE_OUT ?? '/tmp/kilo/assembox-pdf-smoke';

async function main() {
  const results = [];
  const runTag = `#${Date.now().toString(36)}`;

  // 0. 环境
  const env = await (await fetch(`${BASE}/print/_env`)).json();
  console.log('[env]', JSON.stringify(env));
  results.push(['env scenes', env.scenes.includes('single-table-scene')]);

  const ready = await (await fetch(`${BASE}/health/ready`)).json();
  console.log('[health/ready]', JSON.stringify(ready));
  results.push(['pool healthy', ready.status === 'ok']);

  // 1. 同步导出（横向：15 列宽表 ~2200px，横纸 1123px 需多页全尺寸分页）
  const syncResp = await fetch(`${BASE}/api/v1/exports/sync`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sceneId: 'single-table-scene',
      printOptions: { title: `smoke 同步导出 ${runTag}`, rowLimit: 1000, orientation: 'landscape' },
    }),
  });
  const syncPdf = Buffer.from(await syncResp.arrayBuffer());
  const syncOk = syncResp.ok && syncPdf.subarray(0, 4).toString() === '%PDF';
  console.log(`[sync] http=${syncResp.status} bytes=${syncPdf.length} magic=${syncPdf.subarray(0, 4)} task=${syncResp.headers.get('x-task-id')}`);
  results.push(['sync export PDF', syncOk]);
  if (syncOk) writeFileSync(`${OUT}-sync.pdf`, syncPdf);
  const syncPages = countPages(syncPdf);
  console.log(`[sync] pages≈${syncPages}`);
  results.push(['sync pages > 1 (跨页表格)', syncPages > 1]);
  const syncFile = `${OUT}-sync.pdf`;
  if (syncOk) {
    const n = countText(syncFile, 'Sf-1987');
    console.log(`[sync] rows(Sf-1987)=${n}`);
    if (n >= 0) results.push(['sync all 42 rows rendered', n === 42]);
  } else {
    results.push(['sync all 42 rows rendered', false]);
  }

  // 2. 异步导出 → 轮询 → 下载
  const createResp = await (await fetch(`${BASE}/api/v1/exports`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sceneId: 'single-table-scene',
      printOptions: { title: `smoke 异步导出 ${runTag}`, orientation: 'landscape' },
    }),
  })).json();
  console.log('[async] created', JSON.stringify(createResp));
  results.push(['async created (202 task)', !!createResp.taskId]);

  let status;
  const deadline = Date.now() + 60_000;
  do {
    await sleep(500);
    status = await (await fetch(`${BASE}/api/v1/exports/${createResp.taskId}`)).json();
    process.stdout.write(`[poll] ${status.status}\r`);
  } while (!['done', 'failed'].includes(status.status) && Date.now() < deadline);
  console.log('\n[async] final', JSON.stringify(status));
  results.push(['async done', status.status === 'done']);

  if (status.status === 'done') {
    const fileResp = await fetch(`${BASE}${status.result.url}`);
    const filePdf = Buffer.from(await fileResp.arrayBuffer());
    const fileOk = fileResp.ok && filePdf.subarray(0, 4).toString() === '%PDF';
    console.log(`[file] http=${fileResp.status} bytes=${filePdf.length}`);
    results.push(['download PDF', fileOk]);
    if (fileOk) {
      writeFileSync(`${OUT}-async.pdf`, filePdf);
      const n = countText(`${OUT}-async.pdf`, 'Sf-1987');
      console.log(`[file] rows(Sf-1987)=${n}`);
      if (n >= 0) results.push(['async all 42 rows rendered', n === 42]);
    }
  } else {
    results.push(['download PDF', false]);
    results.push(['async all 42 rows rendered', false]);
  }

  // 3. 幂等：同指纹二次创建应复用产物
  const again = await (await fetch(`${BASE}/api/v1/exports`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sceneId: 'single-table-scene',
      printOptions: { title: `smoke 异步导出 ${runTag}`, orientation: 'landscape' },
    }),
  })).json();
  console.log('[idempotent] reused task =', again.taskId === createResp.taskId);
  results.push(['fingerprint reuse', again.taskId === createResp.taskId]);

  // 4. 无效票据 claim 被拒
  const badClaim = await fetch(`${BASE}/internal/task/claim`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ticket: 'not-a-ticket' }),
  });
  results.push(['invalid ticket rejected', badClaim.status === 401]);

  // 5. 指标
  const metrics = await (await fetch(`${BASE}/metrics`)).text();
  results.push(['metrics exposed', metrics.includes('export_queue_depth')]);

  // 6. 图表+长表场景：G2Plot 图表 canvas 光栅化 + 200 行跨页
  const ctResp = await fetch(`${BASE}/api/v1/exports/sync`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sceneId: 'chart-table-scene',
      printOptions: { title: `smoke 图表长表 ${runTag}`, orientation: 'landscape' },
    }),
  });
  const ctPdf = Buffer.from(await ctResp.arrayBuffer());
  const ctOk = ctResp.ok && ctPdf.subarray(0, 4).toString() === '%PDF';
  console.log(`[charts] http=${ctResp.status} bytes=${ctPdf.length} pages=${countPages(ctPdf)}`);
  results.push(['chart-table sync export PDF', ctOk]);
  results.push(['chart-table pages > 3 (200行长表跨页)', countPages(ctPdf) > 3]);
  const ctLatin = ctPdf.toString('latin1');
  const imageCount = (ctLatin.match(/\/Subtype\s*\/Image/g) ?? []).length;
  console.log(`[charts] embedded images(canvas)=${imageCount}`);
  results.push(['chart canvases rasterized (>=3 images)', imageCount >= 3]);
  if (ctOk) {
    writeFileSync(`${OUT}-chart-table.pdf`, ctPdf);
    const n = countText(`${OUT}-chart-table.pdf`, 'Sf-1987-L');
    console.log(`[charts] long-table rows=${n}`);
    if (n >= 0) results.push(['chart-table all 200 rows rendered', n === 200]);
    // 表头跨页重复：页数与表头出现次数应一致（每页一次）
    const pages = countPages(ctPdf);
    const headers = countTextLines(`${OUT}-chart-table.pdf`, /序号\s+提交状态\s+组织机构/);
    console.log(`[charts] header repeats=${headers} on ${pages} pages`);
    results.push(['table header repeats on every page', pages > 1 && headers >= pages - 1]);
  }

  // 汇总
  console.log('\n========== SMOKE RESULTS ==========');
  let pass = 0;
  for (const [name, ok] of results) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (ok) pass++;
  }
  console.log(`=================================== ${pass}/${results.length} passed`);
  if (pass !== results.length) process.exit(1);
}

function countPages(buf) {
  const s = buf.toString('latin1');
  const m = s.match(/\/Type\s*\/Pages[\s\S]{0,200}?\/Count\s+(\d+)/);
  return m ? Number(m[1]) : 0;
}

/** PDF 文本中出现次数（行完整性校验）。依赖 pdftotext；缺失时返回 -1 并由调用方跳过断言 */
function countText(pdfPath, needle) {
  try {
    const text = execFileSync('pdftotext', [pdfPath, '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return text.split(needle).length - 1;
  } catch {
    return -1;
  }
}

/** 匹配正则的行数（表头重复检测）。依赖 pdftotext -layout；缺失时返回 -1 */
function countTextLines(pdfPath, re) {
  try {
    const text = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return text.split('\n').filter((l) => re.test(l)).length;
  } catch {
    return -1;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((e) => {
  console.error('smoke failed', e);
  process.exit(1);
});
