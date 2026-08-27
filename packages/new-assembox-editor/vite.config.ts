import { resolve } from "node:path";
import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import { defineConfig } from "vite";
import { mockServer } from "./mock";

export default defineConfig({
  plugins: [vue(), vueJsx(), mockServer()],
  resolve: {
    alias: [
      // @cs/vue3-biz-components-library（根 node_modules 为 0.2.0 stub，真身是
      // UMD 全局 Vue3BizComponentsLibrary）——ESM 引用桥接到运行时全局，
      // 对齐 print-host src/shims/ 同款模式。desktop-next dist 仅导入
      // useTableSetting；主页面全局由 index.html CDN 脚本注入，iframe 画布由
      // 依赖清单注入。
      {
        find: /^@cs\/vue3-biz-components-library$/,
        replacement: resolve(__dirname, "src/shims/vue3-biz-components-library.ts"),
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
