/**
 * 插件管理器（实例级）
 * - register(plugin, options) 实例级注册（同 id 按 priority 覆盖）
 * - activate: scene 过滤 → dep 拓扑排序 → setup(收集 dispose，失败标记跳过) → contributes 自动应用 → 绑钩子
 * - setup 返回的 dispose + contributes 反注册在 destroy 统一回收（根治资源泄漏）
 */
import type {EventBus, EditorEvent} from './event-bus';
import {camelize} from './event-bus';
import type {EditorPluginObject, PluginContext} from './plugin-types';

export class PluginManager {
  private registered = new Map<
    string,
    {plugin: EditorPluginObject; options?: any}
  >();
  private instances: EditorPluginObject[] = [];
  private disposes: Array<() => void | Promise<void>> = [];
  /** setup 失败的插件 id（钩子/build* 跳过） */
  private failed = new Set<string>();
  /** contributes 注册项的反注册函数（destroy 时逆序调用） */
  private contributed: Array<() => void> = [];
  private ctx: PluginContext | null = null;
  private unsubscribers: Array<() => void> = [];
  /** 是否已激活（幂等保护） */
  private activated = false;

  constructor(private readonly bus: EventBus) {}

  /** 实例级注册（携带 options）；同 id 按 priority 覆盖（new ≥ existing 才覆盖） */
  register<T>(plugin: EditorPluginObject<T>, options?: T): void {
    const existing = this.registered.get(plugin.id);
    if (existing) {
      const existPri = existing.plugin.priority ?? 0;
      const newPri = plugin.priority ?? 0;
      if (newPri < existPri) {
        console.warn(
          `[PluginManager] 插件 "${plugin.id}" priority(${newPri}) < 已注册(${existPri})，保留高优先级版本`
        );
        return;
      }
    }
    this.registered.set(plugin.id, {plugin, options});
  }

  /** 取消注册（仅 activate 前有效） */
  unregister(id: string): void {
    this.registered.delete(id);
  }

  /** 按 id 查找已激活插件（仅返回 instances 中的；未激活/scene 过滤掉的不返回） */
  getPlugin<T = any>(
    id: string
  ): {plugin: EditorPluginObject<T>; options?: T} | undefined {
    const activated = this.instances.find(p => p.id === id);
    if (!activated) return undefined;
    const options = this.registered.get(id)?.options;
    return {plugin: activated as EditorPluginObject<T>, options};
  }

  /** 激活（幂等：已激活则忽略，如需重新激活用 reload） */
  async activate(ctx: PluginContext, scene = 'desktop'): Promise<void> {
    if (this.activated) {
      console.warn(
        '[PluginManager] 已激活，重复 activate 被忽略（如需重新激活请用 reload）'
      );
      return;
    }
    this.ctx = ctx;

    // 1. 收集 + scene 过滤
    const filtered = Array.from(this.registered.values()).filter(({plugin}) => {
      const sc = plugin.scene;
      if (!sc) return true;
      const arr = Array.isArray(sc) ? sc : [sc];
      return arr.includes('global') || arr.includes(scene);
    });

    // 2. dep 拓扑排序
    this.instances = this.topoSort(filtered.map(p => p.plugin));

    // 3. 依次 setup（按拓扑顺序），收集返回的 dispose；失败标记跳过
    for (const plugin of this.instances) {
      const options = this.registered.get(plugin.id)?.options;
      try {
        const ret = plugin.setup?.(ctx, options);
        const resolved = await Promise.resolve(ret);
        if (typeof resolved === 'function') {
          this.disposes.push(resolved);
        }
      } catch (err) {
        console.error(`[PluginManager] 插件 "${plugin.id}" setup 失败:`, err);
        this.failed.add(plugin.id);
      }
    }

    // 4. contributes 自动应用（记录反注册函数）
    this.applyContributes(ctx);

    // 5. 绑钩子
    this.bindEventHooks();
    this.activated = true;
  }

  /** 重新激活（destroy 当前 + 重新 activate），用于动态增删插件后刷新 */
  async reload(ctx: PluginContext, scene?: string): Promise<void> {
    this.destroy();
    await this.activate(ctx, scene ?? 'desktop');
  }

  /** 已激活且 setup 成功的插件（钩子/build* 使用） */
  private activeInstances(): EditorPluginObject[] {
    return this.instances.filter(p => !this.failed.has(p.id));
  }

  /** dep 拓扑排序（Kahn 算法；循环依赖降级 priority 兜底） */
  private topoSort(plugins: EditorPluginObject[]): EditorPluginObject[] {
    const idSet = new Set(plugins.map(p => p.id));
    const inDeg = new Map<string, number>();
    const dependents = new Map<string, string[]>();
    for (const p of plugins) {
      inDeg.set(p.id, 0);
      dependents.set(p.id, []);
    }
    for (const p of plugins) {
      for (const dep of p.dep ?? []) {
        if (idSet.has(dep)) {
          inDeg.set(p.id, (inDeg.get(p.id) ?? 0) + 1);
          dependents.get(dep)!.push(p.id);
        }
      }
    }
    const byPriority = (a: EditorPluginObject, b: EditorPluginObject) =>
      (b.priority ?? 0) - (a.priority ?? 0);
    const queue = plugins
      .filter(p => (inDeg.get(p.id) ?? 0) === 0)
      .sort(byPriority);
    const result: EditorPluginObject[] = [];
    const visited = new Set<string>();
    const idMap = new Map(plugins.map(p => [p.id, p]));
    while (queue.length) {
      const cur = queue.shift()!;
      result.push(cur);
      visited.add(cur.id);
      for (const next of dependents.get(cur.id) ?? []) {
        inDeg.set(next, (inDeg.get(next) ?? 0) - 1);
        if (inDeg.get(next) === 0 && !visited.has(next)) {
          queue.push(idMap.get(next)!);
          queue.sort(byPriority);
        }
      }
    }
    if (result.length < plugins.length) {
      console.warn('[PluginManager] 检测到循环依赖，降级 priority 排序');
      const rest = plugins.filter(p => !visited.has(p.id)).sort(byPriority);
      return [...result, ...rest];
    }
    return result;
  }

  /** contributes 自动应用：注册到对应 registry/skeleton，并记录反注册函数 */
  private applyContributes(ctx: PluginContext): void {
    for (const plugin of this.instances) {
      const c = plugin.contributes;
      if (!c) continue;
      try {
        c.components?.forEach(m => {
          ctx.componentRegistry.register(m);
          this.contributed.push(() => ctx.componentRegistry.unregister(m.type));
        });
        c.setters?.forEach(s => {
          ctx.setterRegistry.register(s.name, s.component);
          this.contributed.push(() => ctx.setterRegistry.unregister(s.name));
        });
        c.actions?.forEach(a => {
          ctx.actionRegistry.register(a);
          this.contributed.push(() =>
            ctx.actionRegistry.unregister(a.actionType)
          );
        });
        c.assets?.forEach(a => {
          ctx.assetRegistry.register(a);
          this.contributed.push(() =>
            ctx.assetRegistry.unregister(a.id, a.version)
          );
        });
        c.skeleton?.forEach(s => {
          ctx.skeleton.add({
            ...s,
            contentProps: {...(s.contentProps ?? {}), editor: ctx.editor}
          } as any);
          this.contributed.push(() => ctx.skeleton.remove(s.name));
        });
      } catch (err) {
        console.error(
          `[PluginManager] 插件 "${plugin.id}" contributes 注册出错:`,
          err
        );
      }
    }
  }

  /** EventBus 事件名 → 插件方法 camelize 映射（跳过 failed 插件） */
  private bindEventHooks(): void {
    if (!this.ctx) return;
    const hookTypes = [
      'before-insert',
      'after-insert',
      'before-update',
      'after-update',
      'before-delete',
      'after-delete',
      'before-move',
      'after-move'
    ];
    for (const type of hookTypes) {
      const methodName = camelize(type);
      const hasAny = this.activeInstances().some(
        p => typeof (p as any)[methodName] === 'function'
      );
      if (!hasAny) continue;
      const off = this.bus.on(type, (event: EditorEvent) => {
        for (const plugin of this.activeInstances()) {
          const fn = (plugin as any)[methodName];
          if (typeof fn !== 'function') continue;
          try {
            const ret = fn.call(plugin, event.context);
            if (ret === false) {
              event.preventDefault();
              event.stopPropagation();
            } else if (ret && typeof ret.then === 'function') {
              if (!event.pending) event.pending = [];
              event.pending.push(ret);
            }
          } catch (err) {
            console.error(
              `[PluginManager] 插件 "${plugin.id}.${methodName}" 出错:`,
              err
            );
          }
          if (event.stopped) break;
        }
      });
      this.unsubscribers.push(off);
    }
  }

  /** 广播收集（跳过 failed 插件） */
  buildPanels(node: any, panels: any[]): void {
    this.activeInstances().forEach(p => {
      try {
        p.buildPanels?.(node, panels);
      } catch (err) {
        console.error(`[PluginManager] 插件 "${p.id}" buildPanels 出错:`, err);
      }
    });
  }

  buildToolbars(node: any, toolbars: any[]): void {
    this.activeInstances().forEach(p => {
      try {
        p.buildToolbars?.(node, toolbars);
      } catch (err) {
        console.error(
          `[PluginManager] 插件 "${p.id}" buildToolbars 出错:`,
          err
        );
      }
    });
  }

  buildContextMenu(node: any, menus: any[]): void {
    this.activeInstances().forEach(p => {
      try {
        p.buildContextMenu?.(node, menus);
      } catch (err) {
        console.error(
          `[PluginManager] 插件 "${p.id}" buildContextMenu 出错:`,
          err
        );
      }
    });
  }

  getPlugins(): EditorPluginObject[] {
    return this.instances;
  }

  /** 销毁：逆序 contributes 反注册 + dispose + 解绑事件 */
  destroy(): void {
    // 1. 逆序 contributes 反注册（skeleton/registry）
    for (let i = this.contributed.length - 1; i >= 0; i--) {
      try {
        this.contributed[i]();
      } catch (err) {
        console.error('[PluginManager] contributes 反注册出错:', err);
      }
    }
    // 2. 逆序 setup dispose
    for (let i = this.disposes.length - 1; i >= 0; i--) {
      try {
        this.disposes[i]();
      } catch (err) {
        console.error('[PluginManager] dispose 出错:', err);
      }
    }
    // 3. 解绑事件
    this.unsubscribers.forEach(off => off());
    this.contributed = [];
    this.disposes = [];
    this.unsubscribers = [];
    this.failed.clear();
    this.instances = [];
    this.activated = false;
    this.ctx = null;
  }
}
