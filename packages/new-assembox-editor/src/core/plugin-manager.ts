/**
 * 插件管理器
 * - 模块级注册表 + 实例级激活
 * - priority 高者覆盖（同 id）
 * - 生命周期：activate(按场景) → init(ctx) → destroy()
 * - 事件驱动：将 EventBus 事件 camelize 映射到插件方法
 */
import type {EventBus, EditorEvent} from './event-bus';
import {camelize} from './event-bus';
import type {EditorPlugin, PluginClass, PluginContext} from './plugin-types';

/** 插件提供者：类 或 实例 */
export type PluginProvider = PluginClass | EditorPlugin;

/** 判断是否为类（函数） */
function isPluginClass(p: PluginProvider): p is PluginClass {
  return typeof p === 'function';
}

/** 获取提供者的 id */
function getProviderId(p: PluginProvider): string {
  if (isPluginClass(p)) {
    return (p as any).id ?? p.name;
  }
  return p.id;
}

/** 实例化提供者 */
function instantiateProvider(p: PluginProvider): EditorPlugin {
  if (isPluginClass(p)) {
    return new p();
  }
  return p;
}

/** 模块级全局注册表（所有实例共享，用于内置插件自注册） */
const globalRegistry = new Map<string, PluginProvider>();

/** 注册插件到全局表（支持类或实例） */
export function registerPlugin(provider: PluginProvider): void {
  const id = getProviderId(provider);
  if (!id) {
    console.warn('[PluginManager] 插件缺少 id，已忽略');
    return;
  }
  globalRegistry.set(id, provider);
}

/** 取消注册 */
export function unregisterPlugin(id: string): void {
  globalRegistry.delete(id);
}

/** 列出所有已注册插件 */
export function listRegisteredPlugins(): PluginProvider[] {
  return Array.from(globalRegistry.values());
}

export class PluginManager {
  /** 激活的插件实例（按 priority 降序） */
  private instances: EditorPlugin[] = [];
  private ctx: PluginContext | null = null;
  private unsubscribers: Array<() => void> = [];
  /** 额外的实例级插件（不进全局表） */
  private localProviders: PluginProvider[] = [];

  constructor(private readonly bus: EventBus, extraPlugins?: PluginProvider[]) {
    if (extraPlugins) this.localProviders.push(...extraPlugins);
  }

  /** 添加实例级插件 */
  addLocal(provider: PluginProvider): void {
    this.localProviders.push(provider);
  }

  /**
   * 激活插件：收集所有适用插件 → 去重(priority) → init → 绑定事件钩子
   */
  async activate(ctx: PluginContext, scene = 'desktop'): Promise<void> {
    this.ctx = ctx;

    // 合并全局表 + 本地表
    const all = new Map<string, EditorPlugin>();
    const candidates: EditorPlugin[] = [];

    // 先全局，后本地（本地优先级相同时覆盖全局）
    for (const provider of [
      ...listRegisteredPlugins(),
      ...this.localProviders
    ]) {
      const id = getProviderId(provider);
      const inst = instantiateProvider(provider);
      const existing = all.get(id);
      if (!existing) {
        all.set(id, inst);
        candidates.push(inst);
      } else {
        const existPriority = existing.priority ?? 0;
        const newPriority = inst.priority ?? 0;
        if (newPriority > existPriority) {
          all.set(id, inst);
          const idx = candidates.indexOf(existing);
          if (idx >= 0) candidates[idx] = inst;
        }
      }
    }

    // 场景过滤
    this.instances = candidates.filter(p => {
      if (!p.scenes || p.scenes.length === 0) return true;
      return p.scenes.includes(scene) || p.scenes.includes('global');
    });

    // 按 priority 降序（高优先级先 init、先响应事件）
    this.instances.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    // 依次 init
    for (const plugin of this.instances) {
      try {
        const ret = plugin.init?.(ctx);
        if (ret && typeof (ret as Promise<any>).then === 'function') {
          await ret;
        }
      } catch (err) {
        console.error(`[PluginManager] 插件 "${plugin.id}" init 失败:`, err);
      }
    }

    this.bindEventHooks();
  }

  /**
   * 将 EventBus 事件 camelize 映射到插件方法
   * 例：before-insert → beforeInsert
   */
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
      const hasAny = this.instances.some(
        p => typeof (p as any)[methodName] === 'function'
      );
      if (!hasAny) continue;
      const off = this.bus.on(type, (event: EditorEvent) => {
        for (const plugin of this.instances) {
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

  /** 触发构建贡献（面板/工具栏/右键菜单） */
  buildPanels(node: any, panels: any[]): void {
    this.instances.forEach(p => {
      try {
        p.buildPanels?.(node, panels);
      } catch (err) {
        console.error(`[PluginManager] 插件 "${p.id}" buildPanels 出错:`, err);
      }
    });
  }

  buildToolbars(node: any, toolbars: any[]): void {
    this.instances.forEach(p => {
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
    this.instances.forEach(p => {
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

  /** 获取所有激活插件 */
  getPlugins(): EditorPlugin[] {
    return this.instances;
  }

  /** 按 id 获取插件 */
  getPlugin(id: string): EditorPlugin | undefined {
    return this.instances.find(p => p.id === id);
  }

  /** 销毁：逆序 destroy + 解绑事件 */
  destroy(): void {
    for (let i = this.instances.length - 1; i >= 0; i--) {
      try {
        this.instances[i].destroy?.();
      } catch (err) {
        console.error(
          `[PluginManager] 插件 "${this.instances[i].id}" destroy 出错:`,
          err
        );
      }
    }
    this.unsubscribers.forEach(off => off());
    this.unsubscribers = [];
    this.instances = [];
    this.ctx = null;
  }
}
