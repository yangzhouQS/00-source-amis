// 本地占位实现：运行时真身以 UMD 全局 Vue3BizComponentsLibrary 存在。
// 消费方（desktop-next dist ESM 链）在各自构建中以 alias 指向运行时桥接 shim
// （print-host: src/shims/；editor: vite.config.ts 指向根 node_modules 副本）。
export const useTableSetting = () => {
  throw new Error('[stub] Vue3BizComponentsLibrary 未加载（应使用运行时 UMD 全局）');
};
export default { useTableSetting };
