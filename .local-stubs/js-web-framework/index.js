// 本地占位实现：运行时真身以 UMD 全局 window.JsWebFramework 存在
// （print-host 与编辑器画布均按该全局装配 portalPinia 等，见 assets.ts / DEFAULT_PC_ASSETS）。
// 本 ESM 占位仅满足依赖解析；静态导入方（如编辑器）全部走 window 全局读取。
export const portalPinia = undefined;
export default { portalPinia };
