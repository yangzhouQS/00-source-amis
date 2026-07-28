import { test, expect, type Page } from "@playwright/test";

/**
 * 编辑器冒烟测试
 * 验证 demo 入口可正常加载并渲染初始 schema 内容
 *
 * 注意：编辑器画布通过 iframe 隔离渲染 schema，
 * 因此画布内的元素需要用 frameLocator 进入 iframe 后再定位。
 */

// 编辑器画布 iframe（渲染 demo schema 的容器）
const canvasFrame = (page: Page) => page.frameLocator("iframe").first();

test("编辑器加载并渲染 demo 内容", async ({ page }) => {
  await page.goto("/");

  // 1. 主文档：编辑器骨架加载完成（左侧"组件库"面板可见）
  await expect(page.getByText("组件库").first()).toBeVisible({
    timeout: 15_000,
  });

  // 2. 画布 iframe 内：demo schema 渲染的卡片标题
  const canvas = canvasFrame(page);
  await expect(
    canvas.getByText("欢迎使用新版 assembox 编辑器")
  ).toBeVisible();

  // 3. 画布 iframe 内：demo schema 渲染的按钮
  await expect(canvas.getByRole("button", { name: "点击我" })).toBeVisible();
});

test("页面无致命控制台错误", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");

  // 等待编辑器骨架加载完成
  await expect(page.getByText("组件库").first()).toBeVisible({
    timeout: 15_000,
  });
  // 等待画布渲染稳定
  await expect(
    canvasFrame(page).getByText("欢迎使用新版 assembox 编辑器")
  ).toBeVisible();

  // 过滤掉已知的第三方库无害告警，仅关注真正的运行时错误
  const fatal = errors.filter(
    (msg) => !msg.includes("ResizeObserver") && !msg.includes("element-plus")
  );
  expect(fatal).toEqual([]);
});
