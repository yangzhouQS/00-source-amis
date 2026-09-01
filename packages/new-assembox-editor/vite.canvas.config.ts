import { resolve } from "node:path";
import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import { defineConfig } from "vite";

/**
 * iframe 画布独立构建（canvas.html 内运行的 IIFE）
 *
 * 产物（dist-canvas/）：
 *   canvas-renderer.iife.js   画布侧渲染器（含 Vue/桌面组件桥接/槽位样式）
 *
 * 与主 IIFE（assembox-editor-next.iife.js）的区别：
 * - 入口是 canvas-bootstrap.ts（等 host → 加载 assets → 创建 IframeCanvasRenderer）
 * - 不含编辑器面板/骨架/拖拽引擎——画布只需要渲染，不需要编辑器 UI
 * - 挂载名 AssemCanvasRenderer（不与主 IIFE 的 AssemEditor 冲突）
 *
 * canvas.html 的加载顺序：
 *   vendor 脚本（Vue/element-plus/icons 等）→ desktop-next UMD → canvas-renderer.iife.js
 *
 * 用法：npx vite build --config vite.canvas.config.ts
 */
const EXTERNALS: Record<string, string> = {
  "vue": "Vue",
  "vue-router": "VueRouter",
  "axios": "axios",
  "element-plus": "ElementPlus",
  "@element-plus/icons-vue": "ElementPlusIconsVue",
  "@cs/vue3-biz-components-library": "Vue3BizComponentsLibrary",
  // core-next 打入包内（纯函数，不需与宿主共享）
  "@cs/assembox-desktop-next": "AssemBoxDesktopNext",
};

export default defineConfig({
  plugins: [vue(), vueJsx()],
  publicDir: false,
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
      },
    },
  },
  build: {
    outDir: "dist-canvas",
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, "src/simulator/iframe/canvas-bootstrap.ts"),
      formats: ["iife"],
      name: "AssemCanvasRenderer",
      fileName: () => "canvas-renderer.iife.js",
      cssFileName: "canvas-renderer",
    },
    rollupOptions: {
      external: (id) => Object.prototype.hasOwnProperty.call(EXTERNALS, id),
      output: {
        globals: EXTERNALS,
        inlineDynamicImports: true,
      },
    },
  },
});
