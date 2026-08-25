import { resolve } from 'node:path';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue()],
  base: '/print-assets/',
  resolve: {
    alias: [
      // @cs/vue3-biz-components-library 本仓库为 stub，desktop-next dist ESM 引用其
      // useTableSetting —— 运行时真身在 UMD 全局 Vue3BizComponentsLibrary（assets.ts 按序加载）。
      // 同编辑器 vite.config.ts 的 alias 思路（绕开坏 package.json），这里指向运行时桥接 shim。
      {
        find: /^@cs\/vue3-biz-components-library$/,
        replacement: resolve(__dirname, 'src/shims/vue3-biz-components-library.ts'),
      },
      // desktop-next 的 exports 仅开放 "."，CSS 子路径需直连文件（构建产物 dist/index.css）
      {
        find: /^@cs\/assembox-desktop-next\/dist\/index\.css$/,
        replacement: resolve(
          __dirname,
          '../../../assembox-packages-project/libs/assembox-desktop-next/dist/index.css',
        ),
      },
    ],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
