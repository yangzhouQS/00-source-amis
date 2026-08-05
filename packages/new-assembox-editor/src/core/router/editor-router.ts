/**
 * EditorRouter —— 编辑器侧路由封装
 *
 * 封装 vue-router 实例，管理"当前编辑哪个场景"的路由状态。
 * 用 createMemoryHistory（不污染地址栏）。
 *
 * 与 iframe 内侧渲染路由的关系：
 *   host 编辑器侧用 EditorRouter 管理编辑态；
 *   iframe 内侧独立 buildSceneRouter（memory history）；
 *   两者通过协议同步场景名，不共享实例。
 */
import type { Router } from "vue-router";
import type { RouterConfig, RouterSceneConfig } from "./build-router";
import { h } from "vue";
import { buildSceneRouter } from "./build-router";

export class EditorRouter {
  readonly instance: Router;
  private sceneMap: Map<string, RouterSceneConfig>;
  private routerConfig: RouterConfig;

  constructor(routerConfig: RouterConfig | undefined = {}, scenes: string[] = []) {
    this.routerConfig = routerConfig;
    this.sceneMap = new Map(Object.entries(routerConfig));
    this.instance = buildSceneRouter(routerConfig, scenes, scenes[0] ?? "");
  }

  getSceneConfig(name: string): RouterSceneConfig | undefined {
    return this.sceneMap.get(name);
  }

  getScenes(): RouterSceneConfig[] {
    return [...this.sceneMap.values()];
  }

  getRouterConfig(): RouterConfig {
    return this.routerConfig;
  }

  getPath(name: string): string | undefined {
    return this.sceneMap.get(name)?.path;
  }

  /** 动态新增场景路由（vue-router addRoute） */
  addScene(name: string, config: RouterSceneConfig): void {
    if (this.sceneMap.has(name)) {
      return;
    }
    this.sceneMap.set(name, config);
    this.routerConfig[name] = config;
    this.instance.addRoute({
      path: config.path,
      name,
      component: { render: () => h("div") },
      meta: config.meta ?? {},
    } as any);
  }

  /** 动态移除场景路由（vue-router removeRoute） */
  removeScene(name: string): void {
    if (!this.sceneMap.has(name)) {
      return;
    }
    this.sceneMap.delete(name);
    delete this.routerConfig[name];
    this.instance.removeRoute(name);
  }

  /** 切换到指定场景（路由跳转） */
  async pushScene(name: string): Promise<void> {
    if (this.sceneMap.has(name)) {
      await this.instance.push({ name });
    }
  }
}
