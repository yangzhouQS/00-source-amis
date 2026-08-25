import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

function num(name: string, def: number): number {
  const v = process.env[name];
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : def;
}

function detectChromium(): string | undefined {
  if (process.env.CHROMIUM_EXECUTABLE_PATH) return process.env.CHROMIUM_EXECUTABLE_PATH;
  const candidates = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return undefined;
}

export const config = {
  port: num('PORT', 9100),
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? `http://127.0.0.1:${num('PORT', 9100)}`,
  chromiumExecutablePath: detectChromium(),
  printHostDist: resolve(process.cwd(), process.env.PRINT_HOST_DIST ?? '../print-host/dist'),
  scenesDir: resolve(process.cwd(), process.env.SCENES_DIR ?? '../json-config'),
  exportsDir: resolve(process.cwd(), process.env.EXPORTS_DIR ?? './data/exports'),
  poolContexts: num('POOL_CONTEXTS', 3),
  queueMax: num('QUEUE_MAX', 50),
  taskTimeoutMs: num('TASK_TIMEOUT_MS', 30_000),
  ticketTtlMs: num('TICKET_TTL_MS', 60_000),
  browserRecycleAfter: num('BROWSER_RECYCLE_AFTER', 500),
  syncAcquireTimeoutMs: num('SYNC_ACQUIRE_TIMEOUT_MS', 15_000),
};
export type AppConfig = typeof config;
