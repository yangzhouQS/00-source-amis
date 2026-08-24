/**
 * 本地 mock 服务（零依赖 vite 插件）
 *
 * 原理：dev/preview server 挂 connect 中间件，按「方法 + 路径模式」匹配 mock 路由，
 * 命中则返回 mock 响应（自动包平台信封），未命中放行（vite 自身 / 代理 / 404）。
 * 画布（canvas.html iframe）与主页面同源，相对路径请求全部可达。
 *
 * 信封契约（对齐 assembox-core-next request/executor.ts）：
 *   成功 { code: 200, status: "success", message: "", result: <handler 返回值> }
 *   出错 HTTP 真实错误码 + { code, status: "error", message }
 *   handler 返回 { __raw: true, status?, headers?, body? } 可完全接管响应。
 *
 * 使用：
 *   1. mock/modules/ 下新增模块（导出 MockModule.routes）
 *   2. 在下方 allModules 注册
 *   3. mock 文件变更自动重启 dev server（server.restart()，官方 API）
 *   4. .env.development 设 VITE_MOCK=false 可整体关闭
 */
import type { Plugin } from "vite";
import type { MockModule, MockRawResponse, MockRoute } from "./types";
import { Buffer } from "node:buffer";
import { paymentModule } from "./modules/payment-module";
import { platformModule } from "./modules/platform";

/** 全部 mock 模块（新增模块在此注册） */
const allModules: MockModule[] = [
  paymentModule,
  platformModule,
];

const LOG_PREFIX = "[mock]";
/** 未命中时是否打印（排查"为什么没拦到"） */
const LOG_MISS = true;

function isRawResult(r: any): r is MockRawResponse {
  return r != null && typeof r === "object" && r.__raw === true;
}

/** 编译一条路由的匹配器：:param 段 → 捕获组正则 */
function compileRoute(route: MockRoute): { regex: RegExp; keys: string[] } {
  const keys: string[] = [];
  const pattern = route.url
    .split("/")
    .map((seg) => {
      if (seg.startsWith(":")) {
        keys.push(seg.slice(1));
        return "([^/]+)";
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return { regex: new RegExp(`^${pattern}/?$`), keys };
}

interface CompiledRoute {
  route: MockRoute;
  regex: RegExp;
  keys: string[];
}

function compileAll(routes: MockRoute[]): CompiledRoute[] {
  return routes.map(route => ({ route, ...compileRoute(route) }));
}

/** 解析 JSON body（非 JSON / 空体返回 undefined） */
function readBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > 10 * 1024 * 1024) {
        req.destroy();
        resolve(undefined);
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (!chunks.length) {
        resolve(undefined);
        return;
      }
      const text = Buffer.concat(chunks).toString("utf-8");
      try {
        resolve(JSON.parse(text));
      } catch {
        resolve(text);
      }
    });
    req.on("error", () => resolve(undefined));
  });
}

function sendJson(res: any, status: number, body: unknown, headers?: Record<string, string>): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Length", Buffer.byteLength(payload));
  for (const [k, v] of Object.entries(headers ?? {})) {
    res.setHeader(k, v);
  }
  // 跨域放开：画布 iframe 与主页面同源，但预览/调试可能跨端口调用
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,PATCH,OPTIONS");
  res.end(payload);
}

/** 中间件主体（dev 与 preview 共用） */
function createMockMiddleware(routes: MockRoute[]) {
  const compiled = compileAll(routes);

  return async (req: any, res: any, next: any) => {
    const method = String(req.method ?? "GET").toUpperCase();

    // CORS 预检直接放行（跨端口调试场景）
    if (method === "OPTIONS") {
      sendJson(res, 204, {});
      return;
    }

    const pathname = String(req.url ?? "/").split("?")[0];
    const hit = compiled.find(({ route, regex }) => {
      if (method !== String(route.method).toUpperCase()) {
        return false;
      }
      return regex.test(pathname);
    });

    if (!hit) {
      if (LOG_MISS) {
        console.log(`${LOG_PREFIX} miss ${method} ${pathname}`);
      }
      next();
      return;
    }

    const { route, regex, keys } = hit;
    const t0 = Date.now();
    const delay = route.delay ?? 200;

    try {
      const params: Record<string, string> = {};
      const m = regex.exec(pathname)!;
      keys.forEach((k, i) => {
        params[k] = decodeURIComponent(m[i + 1]);
      });

      const query: Record<string, string> = {};
      const qsIdx = String(req.url ?? "").indexOf("?");
      if (qsIdx >= 0) {
        for (const [k, v] of new URLSearchParams(String(req.url).slice(qsIdx + 1))) {
          query[k] = v;
        }
      }

      const body = method === "GET" || method === "HEAD" ? undefined : await readBody(req);
      const result = await route.handler({ params, query, body, headers: req.headers, path: pathname });

      if (delay > 0) {
        await new Promise(r => setTimeout(r, delay));
      }

      if (isRawResult(result)) {
        sendJson(res, result.status ?? 200, result.body ?? null, result.headers);
        console.log(`${LOG_PREFIX} ${method} ${pathname} → ${result.status ?? 200} (raw, ${Date.now() - t0}ms)  # ${route.description ?? ""}`);
        return;
      }

      sendJson(res, 200, {
        code: 200,
        status: "success",
        message: "",
        result: result === undefined ? null : result,
      });
      console.log(`${LOG_PREFIX} ${method} ${pathname} → 200 (${Date.now() - t0}ms)  # ${route.description ?? ""}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      sendJson(res, 500, { code: 500, status: "error", message, path: pathname, timestamp: new Date().toISOString() });
      console.error(`${LOG_PREFIX} ${method} ${pathname} → 500 handler 异常:`, e);
    }
  };
}

/**
 * vite 插件：本地 mock 服务
 * @param enabled 是否启用（默认读 VITE_MOCK，未设置视为 true）
 */
export function mockServer(enabled?: boolean): Plugin {
  let active = enabled;
  return {
    name: "local-mock-server",
    enforce: "pre",
    configResolved(config) {
      if (active === undefined) {
        const envFlag = config.env.VITE_MOCK;
        active = envFlag === undefined ? true : envFlag !== "false" && envFlag !== "0";
      }
      if (!active) {
        console.log(`${LOG_PREFIX} 已关闭（VITE_MOCK=false）`);
      }
    },
    configureServer(server) {
      if (!active) {
        return;
      }
      server.middlewares.use(createMockMiddleware(allModules.flatMap(m => m.routes)));
      console.log(`${LOG_PREFIX} 已启用，路由 ${allModules.reduce((n, m) => n + m.routes.length, 0)} 条（mock/ 目录）`);

      // mock 文件变更 → 自动重启 dev server（加载新路由；内存数据同时还原）
      const root = server.config.root;
      server.watcher.add(`${root}/mock`);
      server.watcher.on("change", (file) => {
        if (String(file).replace(/\\/g, "/").includes("/mock/") && active) {
          console.log(`${LOG_PREFIX} ${file} 变更，重启 dev server 以加载新路由…`);
          server.restart();
        }
      });
    },
    configurePreviewServer(server) {
      if (!active) {
        return;
      }
      server.middlewares.use(createMockMiddleware(allModules.flatMap(m => m.routes)));
      console.log(`${LOG_PREFIX} preview 已启用`);
    },
  };
}

export type { MockContext, MockMethod, MockModule, MockRawResponse, MockRoute } from "./types";
