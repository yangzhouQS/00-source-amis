/**
 * 类型安全的依赖注入容器
 * 替代旧版 Map<string, any> + onGot/onceGot 手搓等待队列
 * - token 化：全程类型推导
 * - when() 用原生 Promise
 * - 实例级：无全局污染，支持多编辑器实例
 */

/** 注入 token（携带类型信息） */
export interface InjectionToken<T = any> {
  readonly __brand: 'InjectionToken';
  readonly name: string;
  readonly __type?: T;
}

/** 创建一个类型安全的注入 token */
export function token<T>(name: string): InjectionToken<T> {
  return {__brand: 'InjectionToken', name} as InjectionToken<T>;
}

export class DIContainer {
  private readonly store = new Map<InjectionToken<any>, any>();
  private readonly resolvers = new Map<
    InjectionToken<any>,
    Array<(value: any) => void>
  >();

  /** 注册一个值（同步） */
  register<T>(key: InjectionToken<T>, value: T): this {
    this.store.set(key, value);
    const waiters = this.resolvers.get(key);
    if (waiters) {
      this.resolvers.delete(key);
      // 异步触发，避免在 register 调用栈中同步回调
      queueMicrotask(() => waiters.forEach(fn => fn(value)));
    }
    return this;
  }

  /** 别名：set */
  set<T>(key: InjectionToken<T>, value: T): this {
    return this.register(key, value);
  }

  /** 同步获取（可能 undefined） */
  get<T>(key: InjectionToken<T>): T | undefined {
    return this.store.get(key);
  }

  /** 同步获取，不存在则抛错 */
  require<T>(key: InjectionToken<T>): T {
    const v = this.store.get(key);
    if (v === undefined) {
      throw new Error(`[DIContainer] token "${key.name}" 未注册`);
    }
    return v;
  }

  /** 是否已注册 */
  has<T>(key: InjectionToken<T>): boolean {
    return this.store.has(key);
  }

  /** 异步等待某个 token 注册完成（已注册则立即 resolve） */
  when<T>(key: InjectionToken<T>): Promise<T> {
    const v = this.store.get(key);
    if (v !== undefined) return Promise.resolve(v);
    return new Promise<T>(resolve => {
      const arr = this.resolvers.get(key) ?? [];
      arr.push(resolve as (value: any) => void);
      this.resolvers.set(key, arr);
    });
  }

  /** 取消注册 */
  unregister<T>(key: InjectionToken<T>): boolean {
    return this.store.delete(key);
  }

  /** 清空容器 */
  clear(): void {
    this.store.clear();
    this.resolvers.clear();
  }
}
