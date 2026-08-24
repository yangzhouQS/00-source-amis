/**
 * @file use-portal-context/index.ts
 * @description Portal 全局上下文桥接 Hook 模块入口（barrel export）
 *
 * 编辑器 / 渲染器双运行环境兼容：主页面 JsWebFramework、iframe 画布或看板站点
 * JsKanbanFramework，统一由此 Hook 桥接获取 portalStore / $http / portalPinia。
 *
 * 使用方式：
 * ```ts
 * import { usePortalContext } from "../hooks/use-portal-context";
 *
 * const { getPortalStore, getHttp, getPortalPinia } = usePortalContext();
 * ```
 */

export type { PortalPiniaUtils, UsePortalContextReturn } from "./use-portal-context";

export { usePortalContext } from "./use-portal-context";
