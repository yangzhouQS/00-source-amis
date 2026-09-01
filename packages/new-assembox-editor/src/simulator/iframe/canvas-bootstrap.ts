/**
 * iframe 画布生产入口（canvas.html 内运行的 IIFE，vite.canvas.config.ts 构建）
 *
 * 与 dev 模式（iframe-renderer-entry.ts 经 Vite serve）完全同构：
 * 等 host 注入 __ASSEM_HOST__ → 按清单顺序加载 JS/CSS →
 * 创建 IframeCanvasRenderer → 暴露 __ASSEM_RENDERER__ 供宿主直引。
 *
 * 完整资源隔离：Vue / element-plus 等全局由 canvas.html 的 CDN 脚本提供。
 * 本 IIFE 中 `vue` 为 external（→ window.Vue），即 canvas.html 加载的 CDN Vue。
 * 不 import 编辑器的 ESM Vue——iframe 与主文档各持独立 Vue 实例。
 */
import { IframeCanvasRenderer } from "./iframe-canvas-renderer";
import { HOST_GLOBAL_KEY, RENDERER_GLOBAL_KEY, type IframeAssetsManifest, type IframeHostPayload } from "./protocol";
// 设计态空槽位占位提示（body[data-design-mode] 门控，仅画布文档内生效；
// dev 模式由 iframe-renderer-entry.ts 导入，生产 canvas 由本入口携带）
import "../../scenarios/pc-desktop/slot-placeholder-style.less";

const win = window as any;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`加载失败: ${src}`));
    document.head.appendChild(s);
  });
}

function loadStyle(href: string): void {
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = href;
  document.head.appendChild(l);
}

function waitForHost(timeout = 10000): Promise<IframeHostPayload> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = win.setInterval(() => {
      const host = win[HOST_GLOBAL_KEY] as IframeHostPayload | undefined;
      if (host && typeof host.onReady === "function") {
        win.clearInterval(timer);
        resolve(host);
      } else if (Date.now() - start > timeout) {
        win.clearInterval(timer);
        reject(new Error("[canvas] 等待 host 注入 __ASSEM_HOST__ 超时"));
      }
    }, 16);
  });
}

async function bootstrap(): Promise<void> {
  // 1. 等 host 下发回调与依赖清单
  let host: IframeHostPayload;
  try {
    host = await waitForHost();
  } catch (e) {
    console.error("[canvas]", e);
    return;
  }

  // 2. Vue 已由 canvas.html CDN 脚本提供（window.Vue）——
  //    本 IIFE 的 vue external 直接读取它，无需也无法覆盖为编辑器的 ESM Vue

  // 3. 按清单顺序加载 JS（保证依赖顺序）+ CSS
  const assets: IframeAssetsManifest = host.assets ?? {};
  for (const a of assets.js ?? []) {
    try {
      await loadScript(a.src);
    } catch (e) {
      console.error("[canvas]", e);
    }
  }
  for (const href of assets.css ?? []) {
    loadStyle(href);
  }

  // 4. 创建渲染器并暴露给 host
  const renderer = new IframeCanvasRenderer(host, assets);
  win[RENDERER_GLOBAL_KEY] = renderer;

  win.addEventListener("beforeunload", () => {
    win[RENDERER_GLOBAL_KEY] = null;
    renderer.dispose();
  });
}

bootstrap();
