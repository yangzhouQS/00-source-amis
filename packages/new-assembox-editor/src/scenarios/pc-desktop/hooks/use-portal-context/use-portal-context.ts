/**
 * @file use-portal-context.ts
 * @description Portal 全局上下文桥接 Hook（编辑器 / 渲染器双运行环境兼容）
 *
 * 编辑器内核（@cs/assembox-editor-next）会在两个不同运行环境执行，且宿主注入的
 * 上下文工具包可能不同：
 * - 编辑器主页面：宿主 head 加载 @cs/js-web-framework UMD → window.JsWebFramework
 * - 渲染器环境（iframe 画布 / 看板站点）：可能是 @cs/js-kanban-framework UMD
 *   → window.JsKanbanFramework（iframe 内父页面全局不可见，须画布清单自行加载）
 *
 * 因此本 hook 只做 window 运行时查找（JsWebFramework 优先，JsKanbanFramework 兜底），
 * **禁止静态 import @cs/js-web-framework** —— 那会把主页面版本的框架打进编辑器包，
 * 在渲染器环境形成双实例（portalPinia.getActivePinia() 返回 undefined）。
 *
 * 使用方式：
 * ```ts
 * const { getPortalStore, getHttp, getPortalPinia } = usePortalContext();
 *
 * // 获取 portalStore（门户用户/组织/租户上下文）
 * const store = await getPortalStore();
 *
 * // 获取 http 客户端
 * const http = getHttp();
 *
 * // 获取框架内联 Pinia 工具集（画布 app.use(createPinia()) 用）
 * const pinia = getPortalPinia();
 * ```
 */

/**
 * window 全局对象（SSR 安全：服务端无 window 时回退为空对象，
 * 后续通过可选链访问全局框架字段会优雅返回 undefined）
 */
const win = typeof window !== "undefined" ? (window as any) : ({} as any);

/**
 * 宿主框架（@cs/js-web-framework / @cs/js-kanban-framework）暴露的 Pinia 工具集类型
 *
 * 复用框架内联的同一份 Pinia，避免组件库二次打包造成 Pinia 双实例冲突
 * （详见 file-simple-upload/docs/faq.md Q7）。
 */
export interface PortalPiniaUtils {
  defineStore: (...args: any[]) => any;
  createPinia: () => any;
  getActivePinia: () => any;
  [key: string]: any;
}

/** 宿主框架全局对象形态（按需扩展字段） */
interface PortalFrameworkGlobal {
  portalStore?: () => any;
  $http?: any;
  portalPinia?: PortalPiniaUtils;
  [key: string]: any;
}

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
  getPortalStore: () => Promise<any>;

  /**
   * 获取 HTTP 客户端实例
   *
   * 优先使用全局框架注入的 `$http`，若不存在则回退到页面全局 `axios`
   * （head CDN/local 脚本注入）。两者皆无返回 null。
   *
   * @returns HTTP 客户端实例 | null
   */
  getHttp: () => any;

  /**
   * 获取宿主框架（@cs/js-web-framework / @cs/js-kanban-framework）暴露的 Pinia 工具集
   *
   * 用于复用框架内联的同一份 Pinia（defineStore / createPinia / getActivePinia ...），
   * 避免组件库二次打包 Pinia 造成双实例冲突（getActivePinia 返回 undefined）。
   * 若全局未注入则打印警告并返回 `null`。
   *
   * @returns PortalPiniaUtils | null
   */
  getPortalPinia: () => PortalPiniaUtils | null;

  /**
   * 取原始框架全局对象（JsWebFramework 优先 / JsKanbanFramework 兜底）
   *
   * 供需要框架其他能力（router 注入、插件注册等）的场景；
   * 未注入返回 null。
   */
  getFramework: () => PortalFrameworkGlobal | null;
}

/** 取宿主框架全局（双环境桥接核心：JsWebFramework 优先，JsKanbanFramework 兜底） */
function resolveFramework(): PortalFrameworkGlobal | null {
  return (win.JsWebFramework || win.JsKanbanFramework || null) as PortalFrameworkGlobal | null;
}

/**
 * Portal 全局上下文复用 Hook（编辑器 / 渲染器双运行环境）
 */
export function usePortalContext(): UsePortalContextReturn {
  /**
   * 懒加载 portalStore
   */
  const getPortalStore = async (): Promise<any> => {
    const framework = resolveFramework();
    const portalStore = framework?.portalStore;

    if (!portalStore) {
      console.warn("[usePortalContext] portalStore not found（JsWebFramework / JsKanbanFramework 均未注入）");
      return null;
    }

    return portalStore();
  };

  /**
   * 获取 HTTP 客户端
   */
  const getHttp = (): any => {
    const framework = resolveFramework();
    return framework?.$http || win.axios || null;
  };

  /**
   * 获取宿主框架暴露的 Pinia 工具集（复用同一份 Pinia 实例，避免双实例冲突）
   */
  const getPortalPinia = (): PortalPiniaUtils | null => {
    const framework = resolveFramework();
    const portalPinia = framework?.portalPinia;

    if (!portalPinia) {
      console.warn("[usePortalContext] portalPinia not found（JsWebFramework / JsKanbanFramework 均未注入）");
      return null;
    }

    return portalPinia as PortalPiniaUtils;
  };

  /**
   * 取原始框架全局对象
   */
  const getFramework = (): PortalFrameworkGlobal | null => resolveFramework();

  return {
    getPortalStore,
    getHttp,
    getPortalPinia,
    getFramework,
  };
}
