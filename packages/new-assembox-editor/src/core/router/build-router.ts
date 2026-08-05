import type { RouteRecordRaw } from "vue-router";
/**
 * 场景路由构建工具（host + iframe 渲染器共用）
 *
 * 从 routerConfig 构建 vue-router 实例：
 * - createMemoryHistory（不污染地址栏，支持多实例）
 * - 每条路由映射一个场景（占位组件，实际渲染由渲染器负责）
 * - 默认首页重定向到第一个场景路径
 */
import { h } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";

export interface RouterSceneConfig {
  name: string;
  path: string;
  title?: string;
  description?: string;
  meta?: Record<string, any>;
  pageSet?: { isForceFlush?: boolean };
}

export type RouterConfig = Record<string, RouterSceneConfig>;

/**
 * 构建 vue-router 实例（memory history）。
 * @param routerConfig 路由配置（sceneName → config）
 * @param scenes 所有场景名（取自 uiSkeleton 的 key）
 * @param activeScene 初始激活场景名
 */
export function buildSceneRouter(
  routerConfig: RouterConfig | undefined,
  scenes: string[],
  activeScene: string,
) {
  const cfg: RouterConfig = routerConfig ?? {};
  const routes: RouteRecordRaw[] = scenes.map((name) => {
    const c = cfg[name];
    return {
      path: c?.path ?? `/${name}`,
      name,
      component: { render: () => h("div") },
      meta: c?.meta ?? {},
    };
  });

  // 默认首页重定向到第一个场景（或当前激活场景）
  if (routes.length > 0) {
    const firstPath = cfg[activeScene]?.path
      ?? cfg[scenes[0]]?.path
      ?? routes[0].path;
    routes.push({ path: "/", redirect: firstPath });
  }

  return createRouter({
    history: createMemoryHistory(),
    routes,
  });
}

/**
 * 根据 path 反查场景名（routerConfig 中 path → sceneName）。
 */
export function getSceneNameByPath(
  routerConfig: RouterConfig | undefined,
  path: string,
): string | undefined {
  if (!routerConfig) {
    return undefined;
  }
  for (const [name, cfg] of Object.entries(routerConfig)) {
    if (cfg.path === path) {
      return name;
    }
  }
  return undefined;
}
