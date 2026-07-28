/**
 * 统一事件总线
 * 借鉴 amis-editor-core 的 createEvent：支持 preventDefault / stopPropagation / async
 * 替代旧版 EventEmitter2 + editor.eventBus + AssemGlobalBus 的多通道混乱
 */

/** 编辑器事件对象 */
export interface EditorEvent<C = any> {
  /** 事件类型 */
  type: string;
  /** 事件上下文（携带数据） */
  context: C;
  /** 是否被阻止默认行为 */
  prevented: boolean;
  /** 是否停止后续监听 */
  stoped: boolean;
  /** 额外数据 */
  data?: any;
  /** 异步 pending promises（等待异步监听完成） */
  pending?: Promise<any>[];
  /** 阻止默认行为 */
  preventDefault(): void;
  /** 停止冒泡（停止后续监听） */
  stopPropagation(): void;
  /** 设置数据 */
  setData(data: any): void;
  /** 等待所有异步监听完成 */
  allDone(): Promise<void>;
}

/** 监听器：可同步返回 false=阻止默认，或返回 Promise */
export type EventListener<C = any> = (
  event: EditorEvent<C>
) => void | boolean | Promise<any>;

/** 创建事件对象 */
function createEvent<C>(type: string, context: C): EditorEvent<C> {
  const event: EditorEvent<C> = {
    type,
    context,
    prevented: false,
    stoped: false,
    pending: undefined,
    preventDefault() {
      event.prevented = true;
    },
    stopPropagation() {
      event.stoped = true;
    },
    setData(data: any) {
      event.data = data;
    },
    allDone() {
      return event.pending
        ? Promise.all(event.pending).then(() => {})
        : Promise.resolve();
    }
  };
  return event;
}

/** kebab-case 转 camelCase（事件类型 → 插件方法名） */
export function camelize(str: string): string {
  return str.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
}

export class EventBus {
  private readonly listeners = new Map<string, Array<EventListener<any>>>();
  private destroyed = false;

  /** 订阅事件，返回取消订阅函数 */
  on<C = any>(type: string, fn: EventListener<C>): () => void {
    if (this.destroyed) return () => {};
    const arr = this.listeners.get(type) ?? [];
    arr.push(fn);
    this.listeners.set(type, arr);
    return () => this.off(type, fn);
  }

  /** 一次性订阅 */
  once<C = any>(type: string, fn: EventListener<C>): () => void {
    const wrapper: EventListener<C> = event => {
      this.off(type, wrapper as EventListener<any>);
      return fn(event);
    };
    return this.on(type, wrapper);
  }

  /** 退订 */
  off(type: string, fn: EventListener<any>): void {
    const arr = this.listeners.get(type);
    if (!arr) return;
    const idx = arr.indexOf(fn);
    if (idx >= 0) arr.splice(idx, 1);
    if (arr.length === 0) this.listeners.delete(type);
  }

  /** 触发事件 */
  trigger<C = any>(type: string, context: C): EditorEvent<C> {
    const event = createEvent<C>(type, context);
    if (this.destroyed) return event;
    const arr = this.listeners.get(type);
    if (!arr) return event;
    // 复制一份，避免遍历中增删
    const snapshot = arr.slice();
    for (const fn of snapshot) {
      if (event.stoped) break;
      let ret: any;
      try {
        ret = fn(event);
      } catch (err) {
        console.error(`[EventBus] 监听器 "${type}" 抛出错误:`, err);
      }
      if (ret === false) {
        event.preventDefault();
        event.stopPropagation();
      } else if (ret && typeof (ret as Promise<any>).then === 'function') {
        if (!event.pending) event.pending = [];
        event.pending.push(ret as Promise<any>);
      }
    }
    return event;
  }

  /** 是否有监听器 */
  hasListener(type: string): boolean {
    const arr = this.listeners.get(type);
    return !!arr && arr.length > 0;
  }

  /** 销毁，清空所有监听 */
  destroy(): void {
    this.destroyed = true;
    this.listeners.clear();
  }
}

/** 编辑器内置事件类型常量（声明式，避免魔法字符串） */
export const EVENT = {
  // 生命周期
  EDITOR_INIT: 'editor.init',
  EDITOR_READY: 'editor.ready',
  EDITOR_DESTROY: 'editor.destroy',
  // Schema 变更（before/after，可 preventDefault）
  BEFORE_INSERT: 'before-insert',
  AFTER_INSERT: 'after-insert',
  BEFORE_UPDATE: 'before-update',
  AFTER_UPDATE: 'after-update',
  BEFORE_DELETE: 'before-delete',
  AFTER_DELETE: 'after-delete',
  BEFORE_MOVE: 'before-move',
  AFTER_MOVE: 'after-move',
  // 选区
  SELECTION_CHANGE: 'selection-change',
  ACTIVE_CHANGE: 'active-change',
  HOVER_CHANGE: 'hover-change',
  // 构建（插件贡献）
  BUILD_PANELS: 'build-panels',
  BUILD_TOOLBARS: 'build-toolbars',
  BUILD_CONTEXT_MENU: 'build-context-menu',
  // DnD
  DND_ACCEPT: 'dnd-accept',
  // 画布
  SIMULATOR_READY: 'simulator-ready',
  SCHEMA_CHANGE: 'schema-change',
  HISTORY_CHANGE: 'history-change'
} as const;

export type EventType = (typeof EVENT)[keyof typeof EVENT];
