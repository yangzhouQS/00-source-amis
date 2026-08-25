/**
 * biz 组件库 ESM 桥接 shim
 *
 * desktop-next dist 以 ESM `import { useTableSetting } from '@cs/vue3-biz-components-library'`
 * 引用该库；本仓库内该包是 stub，真身以 UMD 全局 Vue3BizComponentsLibrary 存在
 * （assets.ts 在 app 创建前完成加载）。此处把 ESM 导出转发到运行时全局。
 */
const g = (): any => (globalThis as any).Vue3BizComponentsLibrary;

export const useTableSetting: (...args: any[]) => any = (...args: any[]) => {
  const fn = g()?.useTableSetting;
  if (typeof fn !== 'function') {
    // 与 biz 库自身报错口径一致：找不到宿主框架时明确抛错而非静默
    throw new Error('[print-host] Vue3BizComponentsLibrary 未加载（useTableSetting 不可用）');
  }
  return fn(...args);
};

const passthrough = (prop: string): any => (...args: any[]) => {
  const fn = g()?.[prop];
  return typeof fn === 'function' ? fn(...args) : undefined;
};

// desktop-next dist 当前仅导入 useTableSetting；其余导出按需透传（防御性）
export const useTablePersistConfig = passthrough('useTablePersistConfig');
export default { useTableSetting, useTablePersistConfig };
