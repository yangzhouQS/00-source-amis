import { resolve } from "node:path";
import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import { defineConfig } from "vite";
import { mockServer } from "./mock";

export default defineConfig({
  plugins: [vue(), vueJsx(), mockServer()],
  resolve: {
    alias: [
      // 绕过 @cs/vue3-biz-components-library@0.1.8 坏 package.json：
      // 其 "module": "src/index.ts" 指向未发布的源码目录，Vite dev 解析失败
      // （"Failed to resolve entry"）。精确匹配（exact regex）指向根 node_modules
      // 0.1.3 的 ESM 构建；运行时画布优先 UMD 全局，此路径仅 dev 静态导入链兜底。
      {
        find: /^@cs\/vue3-biz-components-library$/,
        replacement: resolve(
          __dirname,
          "../../node_modules/@cs/vue3-biz-components-library/dist/vue3-biz-components-library.js",
        ),
      },
    ],
  },

  // 多页应用：main（编辑器主窗口）+ canvas（iframe 隔离画布）
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        canvas: resolve(__dirname, "canvas.html"),
      },
      external: [
        "vue",
        "axios",
        "element-plus",
        "@element-plus/icons-vue",
        "@cs/vue3-biz-components-library",
        // 本地 UMD 包（public/@cs，index.html 头部引入）：构建产物按 globals 读取 window 全局
        "@cs/assembox-core-next",
        "@cs/assembox-desktop-next",
      ],
      output: {
        globals: {
          "vue": "Vue",
          "axios": "axios",
          "element-plus": "ElementPlus",
          "@element-plus/icons-vue": "ElementPlusIconsVue",
          "@cs/vue3-biz-components-library": "Vue3BizComponentsLibrary",
          "@cs/assembox-core-next": "AssemboxPackage",
          "@cs/assembox-desktop-next": "AssemBoxDesktopNext",
        },
      },
    },
  },
  server: {
    port: 5174,
    // open: "/index.html"
  },
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
      },
    },
  },
});
