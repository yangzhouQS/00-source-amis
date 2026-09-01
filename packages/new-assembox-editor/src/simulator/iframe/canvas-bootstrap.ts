/**
 * iframe 画布生产入口（canvas.html 内运行的 IIFE，vite.canvas.config.ts 构建）
 *
 * 与 dev 模式（iframe-renderer-entry.ts 经 Vite serve）完全同构：
 * 等 host 注入 __ASSEM_HOST__ → 挂 win.Vue → 按清单顺序加载 JS/CSS →
 * 创建 IframeCanvasRenderer → 暴露 __ASSEM_RENDERER__ 供宿主直引。
 *
 * 区别：本入口以独立 IIFE 打包，canvas.html 直接 <script src> 加载，
 * 不依赖 Vite dev server 模块服务。Vue 经 external→全局由 canvas.html vendor 提供。
 */
import * as Vue from "vue";
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

  // 2. Vue 先挂全局——CDN IIFE 包读取 window.Vue 共用同一实例
  win.Vue = Vue;

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
