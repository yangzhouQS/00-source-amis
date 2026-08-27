import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      // 同 vite.config.ts：@cs/vue3-biz-components-library 根 node_modules 为 stub，
      // ESM 引用桥接到运行时 UMD 全局（测试环境无全局时仅被调用才抛错，
      // 现有测试只调 lookupMeta/getComponentMap 不触发）
      {
        find: /^@cs\/vue3-biz-components-library$/,
        replacement: resolve(__dirname, "src/shims/vue3-biz-components-library.ts"),
      },
    ],
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    globals: false,
  },
});
