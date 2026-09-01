import { resolve } from "node:path";
import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import { defineConfig } from "vite";

/**
 * 库构建（宿主站点以 <script> 本地文件方式集成，如 vue-mb-output-design-website）
 *
 * 产物（dist-lib/）：
 *   assembox-editor-next.iife.js   单文件 IIFE，window 挂载名 AssemEditor
 *   assembox-editor-next.css       全部编辑器样式（less 聚合提取）
 *
 * 外部依赖 → 宿主页面 head 全局变量（与 vue-mb-output-design-website 的
 * packer-config browserVue3.externals 及 index.html 头部脚本一致）：
 *   vue→Vue  vue-router→VueRouter  axios→axios  element-plus→ElementPlus
 *   @element-plus/icons-vue→ElementPlusIconsVue
 *   @cs/vue3-biz-components-library→Vue3BizComponentsLibrary
 *   @cs/assembox-core-next→AssemboxPackage（本地 libs UMD）
 *   @cs/assembox-desktop-next→AssemBoxDesktopNext（本地 libs UMD）
 *
 * 说明：
 * - element-plus/es/locale/lang/zh-cn 为纯数据子路径，直接打进包（不打断 external）
 * - monaco（@guolao/vue-monaco-editor）打入包体；worker 缺省由运行时降级，
 *   宿主如需完整 JSON 校验可自行配置 MonacoEnvironment
 * - 用法：npx vite build --config vite.lib.config.ts
 */
const EXTERNALS: Record<string, string> = {
  "vue": "Vue",
  "vue-router": "VueRouter",
  "axios": "axios",
  "element-plus": "ElementPlus",
  "@element-plus/icons-vue": "ElementPlusIconsVue",
  "@cs/vue3-biz-components-library": "Vue3BizComponentsLibrary",
  // core-next 打入包内：编辑器仅用 adaptNodeTree（纯函数），不需要与宿主共享实例；
  // 作为 external 会要求 head 额外加载 core-next UMD（其又依赖 lodash/CryptoJS/dayjs）
  "@cs/assembox-desktop-next": "AssemBoxDesktopNext",
};

export default defineConfig({
  plugins: [vue(), vueJsx()],
  // lib 构建不拷贝 public/（那是 dev/preview 的本地 UMD 依赖，宿主集成走 libs/ 目录）
  publicDir: false,
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
      },
    },
  },
  build: {
    outDir: "dist-lib",
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["iife"],
      name: "AssemEditor",
      fileName: () => "assembox-editor-next.iife.js",
      cssFileName: "assembox-editor-next",
    },
    rollupOptions: {
      // 精确匹配 external（子路径如 element-plus/es/locale/* 不外置，直接内联）
      external: id => Object.hasOwn(EXTERNALS, id),
      output: {
        globals: EXTERNALS,
        // IIFE 单文件：内联动态 import
        inlineDynamicImports: true,
      },
    },
  },
});
