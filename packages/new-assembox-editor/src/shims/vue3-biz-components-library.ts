/**
 * biz 组件库 ESM 桥接 shim（对齐 print-host src/shims/ 同款模式）
 *
 * 背景：desktop-next dist 以 ESM `import { useTableSetting } from
 * '@cs/vue3-biz-components-library'` 引用该库；根 node_modules 中该包已替换为
 * 0.2.0 stub（运行时真身以 UMD 全局 Vue3BizComponentsLibrary 存在——主页面由
 * index.html CDN 脚本注入，iframe 画布由依赖清单注入）。本 shim 把 ESM 导出
 * 转发到运行时全局，vite.config.ts / vitest.config.ts 的 alias 指向此处。
 */
const g = (): any => (globalThis as any).Vue3BizComponentsLibrary;

export const useTableSetting: (...args: any[]) => any = (...args: any[]) => {
  const fn = g()?.useTableSetting;
  if (typeof fn !== "function") {
    // 与 biz 库自身报错口径一致：找不到宿主框架时明确抛错而非静默
    throw new Error("[editor] Vue3BizComponentsLibrary 未加载（useTableSetting 不可用）");
  }
  return fn(...args);
};

const passthrough = (prop: string): any => (...args: any[]) => {
  const fn = g()?.[prop];
  return typeof fn === "function" ? fn(...args) : undefined;
};

// desktop-next dist 当前仅导入 useTableSetting；其余导出按需透传（防御性）
export const useTablePersistConfig = passthrough("useTablePersistConfig");
export default { useTableSetting, useTablePersistConfig };
