import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E 测试配置
 *
 * 说明：
 * - baseURL 复用 vite dev server 的 5174 端口
 * - webServer 会自动托管 vite（本地已运行则复用，避免重复启动）
 * - 仅启用 chromium 项目，与全局 playwright MCP 使用同一浏览器二进制
 *   （ms-playwright/chromium-1200，playwright 1.57.0）
 */
const APP_PORT = 5174;
const APP_URL = `http://localhost:${APP_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: APP_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // 复用项目 dev 脚本，--no-open 避免测试时弹出系统浏览器
    command: "npm run dev -- --no-open",
    url: APP_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
