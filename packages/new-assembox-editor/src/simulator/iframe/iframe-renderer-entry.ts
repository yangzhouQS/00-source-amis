/**
 * iframe 渲染器入口（运行于 canvas.html 内部）
 *
 * 动态依赖装配流程：
 *  1. 等 host 注入 win.__ASSEM_HOST__（含回调 + assets 清单）
 *  2. 把 ESM Vue 挂到 window.Vue（供后续 CDN IIFE 包读取——保证单一 Vue 实例）
 *  3. 按 assets.js 顺序加载 JS、按 assets.css 加载样式
 *  4. 创建 IframeCanvasRenderer（传入 host 回调 + assets），由其在 app.mount 前
 *     动态 app.use 插件、registerExternal 外部组件
 *  5. 暴露 win.__ASSEM_RENDERER__ 供 host 直引
 */
import * as Vue from 'vue';
import 'element-plus/dist/index.css';
import { IframeCanvasRenderer } from './iframe-canvas-renderer';
import type { IframeHostPayload, IframeAssetsManifest } from './protocol';
import { HOST_GLOBAL_KEY, RENDERER_GLOBAL_KEY } from './protocol';

const win = window as any;

/** 动态加载一个 JS 脚本 */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`CDN 加载失败: ${src}`));
    document.head.appendChild(s);
  });
}

/** 动态加载一条 CSS（link rel=stylesheet） */
function loadStyle(href: string): void {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

/** 轮询等待 host 注入 __ASSEM_HOST__（回调 + assets 清单） */
function waitForHost(timeout = 10000): Promise<IframeHostPayload> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = win.setInterval(() => {
      const host = win[HOST_GLOBAL_KEY] as IframeHostPayload | undefined;
      if (host && typeof host.onReady === 'function') {
        win.clearInterval(timer);
        resolve(host);
      } else if (Date.now() - start > timeout) {
        win.clearInterval(timer);
        reject(new Error('等待 host 注入 __ASSEM_HOST__ 超时'));
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
    console.error('[iframe-entry]', e);
    return;
  }

  // 2. ESM Vue 先挂全局——CDN IIFE 包（element-pro 等）读取 window.Vue，
  //    使其与 assembox-desktop-next / 渲染器共用同一 Vue 实例（避免双 Vue 实例）
  win.Vue = Vue;

  // 3. 按清单顺序加载 JS（保证依赖顺序，如 element-pro 依赖 element-plus）+ CSS
  const assets: IframeAssetsManifest = host.assets ?? {};
  for (const a of assets.js ?? []) {
    try {
      await loadScript(a.src);
    } catch (e) {
      console.error('[iframe-entry]', e);
    }
  }
  for (const href of assets.css ?? []) loadStyle(href);

  // 4. 创建渲染器（host 回调 + assets），暴露给 host 直引
  const renderer = new IframeCanvasRenderer(host, assets);
  win[RENDERER_GLOBAL_KEY] = renderer;

  win.addEventListener('beforeunload', () => {
    win[RENDERER_GLOBAL_KEY] = null;
    renderer.dispose();
  });
}

bootstrap();
