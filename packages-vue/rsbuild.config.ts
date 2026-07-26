import { defineConfig } from '@rsbuild/core';
import { pluginVue } from '@rsbuild/plugin-vue';
import { pluginBabel } from '@rsbuild/plugin-babel';
import { pluginVueJsx } from '@rsbuild/plugin-vue-jsx';
import path from 'node:path';

export default defineConfig({
  plugins: [pluginVue(), pluginBabel(), pluginVueJsx()],
  source: {
    entry: { index: './src/main.ts' },
    alias: { '@': path.resolve(__dirname, 'src') }
  },
  html: {
    template: './index.html',
    title: 'amis 编辑器 (Vue)'
  },
  server: {
    port: 8900
  }
});
