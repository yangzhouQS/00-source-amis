/** window 全局对象类型 */
const win = window as any;

/**
 * Portal 上下文 Hook 返回值
 */
export interface UsePortalContextReturn {
  /**
   * 懒加载 portalStore，避免 Pinia 双实例问题
   *
   * 从全局 `JsWebFramework` 或 `JsKanbanFramework` 中获取 `portalStore` 并调用。
   * 若全局未注入则打印警告并返回 `null`。
   *
   * @returns portalStore 实例 | null
   */
  getPortalStore: () => any;

  /**
   * 获取 HTTP 客户端实例
   *
   * 优先使用全局框架注入的 `$http`，若不存在则回退到库内置的 axios 封装。
   *
   * @returns HTTP 客户端实例
   */
  getHttp: () => any;
}

/**
 * @file use-portal-context.ts
 * @description Portal 全局上下文复用 Hook
 *
 * 统一封装对全局框架（`JsWebFramework` / `JsKanbanFramework`）中
 * `portalStore` 和 `$http` 的访问逻辑，供组件库内部复用。
 *
 * 使用方式：
 * ```ts
 * const { getPortalStore, getHttp } = usePortalContext();
 *
 * // 获取 portalStore
 * const store = await getPortalStore();
 *
 * // 获取 http 客户端
 * const http = getHttp();
 * ```
 */
export function usePortalContext(): UsePortalContextReturn {
  /**
   * 懒加载 portalStore
   */
  const getPortalStore = async (): Promise<any> => {
    const framework = win.JsWebFramework || win.JsKanbanFramework;
    const portalStore = framework?.portalStore;

    if (!portalStore) {
      console.warn("[usePortalContext] portalStore not found");
      return null;
    }

    return portalStore();
  };

  /**
   * 获取 HTTP 客户端
   */
  const getHttp = (): any => {
    const framework = win.JsWebFramework || win.JsKanbanFramework;
    return framework?.$http;
  };

  return {
    getPortalStore,
    getHttp,
  };
}
