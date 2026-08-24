import { resolve } from "node:path";
import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue(), vueJsx()],
  resolve: {
    alias: {
      // "@": resolve(__dirname, "src")
    },
  },
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
      },
    },
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
      ],
      output: {
        globals: {
          "vue": "Vue",
          "axios": "axios",
          "element-plus": "ElementPlus",
          "@element-plus/icons-vue": "ElementPlusIconsVue",
          "@cs/vue3-biz-components-library": "Vue3BizComponentsLibrary",
        },
      },
    },
  },
  server: {
    port: 5174,
    // open: "/index.html"
  },
});
