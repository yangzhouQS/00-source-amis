/**
 * UMD 运行时资产装配（vendor 本地化，导出服务不依赖外部 CDN）
 *
 * 装配顺序与 new-assembox-editor 的 DEFAULT_PC_ASSETS 完全一致（该清单已在本仓库
 * 画布环境中验证）：element-plus → icons → vue-router → axios → element-plus-ui
 * → table-pro → js-web-framework → vue3-biz-components-library。
 * 前置条件：window.Vue 必须先挂 ESM Vue（main.ts 第一步），保证单 Vue 实例。
 */
import type { App, Component } from 'vue';
import zhCn from 'element-plus/es/locale/lang/zh-cn';

const V = (path: string): string => `${import.meta.env.BASE_URL}vendor/${path}`;

interface VendorJs {
  file: string;
  global: string;
  asPlugin?: boolean;
  asIcons?: boolean;
}

export const VENDOR_JS: VendorJs[] = [
  { file: 'element-plus.js', global: 'ElementPlus', asPlugin: true },
  { file: 'icons-vue.js', global: 'ElementPlusIconsVue', asIcons: true },
  { file: 'vue-router.js', global: 'VueRouter' },
  { file: 'axios.js', global: 'axios' },
  { file: 'element-plus-ui.js', global: 'ElementPlusUi', asPlugin: true },
  { file: 'table-pro.js', global: 'TablePro', asPlugin: true },
  { file: 'js-web-framework.js', global: 'JsWebFramework' },
  { file: 'vue3-biz-components-library.js', global: 'Vue3BizComponentsLibrary', asPlugin: true },
  // G2Plot：UMD 全局即 window.G2Plot（Chart 组件直接引用，assem-g2plot-chart.vue:70-76）
  { file: 'g2plot.js', global: 'G2Plot' },
];

export const VENDOR_CSS: string[] = ['element-plus-ui-yun-que.css', 'table-pro.css'];

export function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`vendor 加载失败: ${src}`));
    document.head.appendChild(s);
  });
}

export function loadStyle(href: string): void {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

/** 按清单顺序加载全部 vendor 资产 */
export async function loadVendorAssets(): Promise<void> {
  for (const a of VENDOR_JS) {
    await loadScript(V(a.file));
  }
  for (const css of VENDOR_CSS) {
    loadStyle(V(css));
  }
}

/**
 * 安装全局插件（对应编辑器 iframe-canvas-renderer 的 app.use 循环）：
 * - portalPinia（js-web-framework 内联 pinia，tableCode 表格硬依赖）
 * - asPlugin 的 UMD 包 + ElementPlus 中文 locale
 * - 图标库逐个注册全局组件
 */
export function installVendorPlugins(app: App): void {
  const w = window as any;

  // ① 宿主框架 pinia：对齐 renderer.ts:117-124（不装则 tableCode 表格抛
  //    "[table-setting] 未找到宿主框架 portalPinia.defineStore"）
  const portalPinia = w.JsWebFramework?.portalPinia;
  if (portalPinia?.createPinia) {
    app.use(portalPinia.createPinia());
  }

  for (const a of VENDOR_JS) {
    const target = w[a.global];
    if (target == null) continue;

    if (a.asPlugin) {
      let options: Record<string, unknown> | undefined;
      if (a.global === 'ElementPlus') options = { locale: zhCn };
      try {
        app.use(target, options);
      } catch (e) {
        console.warn(`[print-host] app.use(${a.global}) 失败`, e);
      }
    }
    if (a.asIcons && typeof target === 'object') {
      for (const [key, comp] of Object.entries(target)) {
        if (comp) app.component(key, comp as Component);
      }
    }
  }
}
