import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      // 同 vite.config.ts：绕过 @cs/vue3-biz-components-library@0.1.8 坏 package.json
      // （"module": "src/index.ts" 指向未发布源码目录）。对齐守护测试
      // （nesting-categories.test.ts）加载 @cs/assembox-desktop-next dist 时
      // 其外部依赖需解析到根 node_modules 0.1.3 的 ESM 构建。
      {
        find: /^@cs\/vue3-biz-components-library$/,
        replacement: resolve(
          __dirname,
          "../../node_modules/@cs/vue3-biz-components-library/dist/vue3-biz-components-library.js",
        ),
      },
    ],
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    globals: false,
  },
});
