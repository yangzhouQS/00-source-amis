/**
 * DataScope —— Vue3 版数据作用域（参考 amis __super 原型链设计）
 *
 * 核心机制：
 * - 读继承：Object.create(superData) 让子 scope 自动读取父级变量
 * - 写隔离：JS 赋值自动遮蔽原型属性，只写自身层，不污染父级
 * - 响应式：shallowRef 桥接（引用替换触发更新），不破坏原型链
 */

import {shallowRef, computed, type ShallowRef} from 'vue';

// ═══════════════ 工具函数（从 amis 迁移，适配 TS）═══════════════

/**
 * 创建带原型链的数据域
 * superProps 成为新对象的 [[Prototype]]，子读取自动向上查找
 */
export function createObject<T extends Record<string, any>>(
  superProps?: T | null,
  props?: Record<string, any>,
  properties?: PropertyDescriptors
): Record<string, any> {
  // 冻结防御
  if (superProps && Object.isFrozen(superProps)) {
    superProps = cloneObject(superProps) as T;
  }

  const obj = superProps
    ? Object.create(superProps, {
        ...properties,
        __super: {
          value: superProps,
          writable: false,
          enumerable: false,
          configurable: true
        }
      })
    : Object.create(Object.prototype, properties);

  if (props && typeof props === 'object') {
    Object.keys(props).forEach(key => {
      obj[key] = props[key];
    });
  }

  return obj;
}

/**
 * 沿原型链提取为链数组（自身 → 顶层）
 */
export function extractObjectChain(value: any): any[] {
  const result = value ? [value] : [];
  while (value?.__super) {
    result.unshift(value.__super);
    value = value.__super;
  }
  return result;
}

/**
 * 链数组折叠为嵌套原型对象
 */
export function createObjectFromChain(chain: any[]): Record<string, any> {
  return chain
    .filter(item => item)
    .reduce((proto: any, value: any) => {
      proto = proto || Object.prototype;
      if (Object.isFrozen(proto)) proto = cloneObject(proto);
      return Object.assign(
        Object.create(proto, {
          __super: {
            value: proto,
            writable: false,
            enumerable: false,
            configurable: true
          }
        }),
        value
      );
    }, null);
}

/**
 * 克隆自身层（保留 __super 原型链不变）
 */
export function cloneObject(
  target: Record<string, any>,
  persistOwnProps = true
): Record<string, any> {
  if (!target) return target;
  const obj = createObject(target.__super || null);
  if (persistOwnProps) {
    Object.keys(target).forEach(key => {
      obj[key] = target[key];
    });
  }
  return obj;
}

/**
 * 克隆 + 浅合并（保留原型链）
 */
export function extendObject(
  target: Record<string, any>,
  src?: Record<string, any>,
  persistOwnProps = true
): Record<string, any> {
  const obj = cloneObject(target, persistOwnProps);
  if (src && typeof src === 'object') {
    Object.keys(src).forEach(key => {
      obj[key] = src[key];
    });
  }
  return obj;
}

/**
 * 在链中插入一层（插在自身层前面）
 */
export function injectObjectChain(
  obj: Record<string, any>,
  value: Record<string, any>
): Record<string, any> {
  const chain = extractObjectChain(obj);
  chain.splice(chain.length - 1, 0, value);
  return createObjectFromChain(chain);
}

// ═══════════════ 变量读写（原型链穿透 / 写隔离）═══════════════

/**
 * 读取变量（canAccessSuper=true 沿原型链穿透）
 */
export function getVariable(
  data: Record<string, any>,
  key: string,
  canAccessSuper = true
): any {
  if (!data || !key || typeof data !== 'object') return undefined;

  // 点号路径 a.b.c
  if (key.includes('.')) {
    return keyToPath(key).reduce(
      (obj: any, k: string) =>
        obj &&
        typeof obj === 'object' &&
        (canAccessSuper ? k in obj : Object.prototype.hasOwnProperty.call(obj, k))
          ? obj[k]
          : undefined,
      data
    );
  }

  // 单层
  if (canAccessSuper ? key in data : Object.prototype.hasOwnProperty.call(data, key)) {
    return data[key];
  }
  return undefined;
}

/**
 * 写入变量（只写自身层，赋值即遮蔽原型属性）
 */
export function setVariable(
  data: Record<string, any>,
  key: string,
  value: any
): void {
  if (!data) return;

  // 嵌套路径
  if (key.includes('.')) {
    const parts = keyToPath(key);
    const last = parts.pop()!;
    let current = data;
    for (const part of parts) {
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
    current[last] = value;
    return;
  }

  // 单层：赋值即遮蔽（JS 原型特性）
  data[key] = value;
}

/**
 * 删除变量（只删自身层）
 */
export function deleteVariable(data: Record<string, any>, key: string): void {
  if (!data) return;
  if (key.includes('.')) {
    const parts = keyToPath(key);
    const last = parts.pop()!;
    let current = data;
    for (const part of parts) {
      if (!current[part]) return;
      current = current[part];
    }
    delete current[last];
    return;
  }
  if (Object.prototype.hasOwnProperty.call(data, key)) {
    delete data[key];
  }
}

/**
 * 路径解析 'a.b[1].c' → ['a','b','1','c']
 */
function keyToPath(path: string): string[] {
  return path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
}

// ═══════════════ 浅比较（参考 amis isObjectShallowModified）═══════════════

/**
 * 自身层浅比较（不穿透原型链）
 */
export function isObjectShallowModified(
  prev: any,
  next: any,
  ignoreKeys: string[] = []
): boolean {
  if (prev === next) return false;
  if (!prev || !next || typeof prev !== 'object' || typeof next !== 'object') {
    return prev !== next;
  }

  const prevKeys = Object.keys(prev).filter(k => !ignoreKeys.includes(k));
  const nextKeys = Object.keys(next).filter(k => !ignoreKeys.includes(k));

  if (prevKeys.length !== nextKeys.length) return true;

  for (const key of nextKeys) {
    if (prev[key] !== next[key]) return true;
  }
  return false;
}

// ═══════════════ DataScope 类（Vue3 响应式桥接）═══════════════

/**
 * 数据作用域（Vue3 版）
 * - 保留 Object.create 原型链（读继承 + 写隔离）
 * - shallowRef 桥接响应式（引用替换触发更新）
 */
export class DataScope {
  /** 数据引用（shallowRef：只追踪引用替换） */
  readonly data: ShallowRef<Record<string, any>>;

  constructor(initialData: Record<string, any> = {}, parentScope?: DataScope | null) {
    const data = parentScope
      ? createObject(parentScope.data.value, initialData)
      : createObject(null, initialData);
    this.data = shallowRef(data);
  }

  /** 读取变量（沿原型链穿透） */
  get(name: string): any {
    return getVariable(this.data.value, name, true);
  }

  /** 仅读取自身层（不穿透原型链） */
  getOwn(name: string): any {
    return getVariable(this.data.value, name, false);
  }

  /** 写入变量（只写自身层，触发 shallowRef 更新） */
  set(name: string, value: any): void {
    const next = cloneObject(this.data.value);
    setVariable(next, name, value);
    this.data.value = next; // ★ 引用替换 → 触发响应式
  }

  /** 删除变量（只删自身层） */
  delete(name: string): void {
    const next = cloneObject(this.data.value);
    deleteVariable(next, name);
    this.data.value = next;
  }

  /** 批量更新（浅合并到自身层） */
  update(values: Record<string, any>): void {
    this.data.value = extendObject(this.data.value, values);
  }

  /** 创建子作用域（继承当前数据域） */
  createChild(childData: Record<string, any> = {}): DataScope {
    return new DataScope(childData, this);
  }

  /** 获取完整数据链（顶到底） */
  getChain(): any[] {
    return extractObjectChain(this.data.value);
  }

  /** 从链重建（dialog/drawer 数据拼接场景） */
  static fromChain(chain: any[]): DataScope {
    const scope = Object.create(DataScope.prototype);
    scope.data = shallowRef(createObjectFromChain(chain));
    return scope;
  }
}

// ═══════════════ syncDataFromSuper — 父→子按 key 同步（Section 6）═══════════════

/**
 * 父→子数据同步（按 key 复制，非链共享）
 * 参考 amis syncDataFromSuper：父级数据变化时，把变化的字段"抄"到子自身层
 *
 * @param childData    子级当前 data（会被浅拷贝）
 * @param superData    新的父级 data
 * @param prevSuperData 上一次的父级 data
 * @param syncKeys     指定同步的 key 白名单（FormStore 场景：只同步表单项 name）
 * @returns 新的子级 data（浅拷贝 + 同步变化）
 */
export function syncDataFromSuper(
  childData: Record<string, any>,
  superData: Record<string, any> | null,
  prevSuperData: Record<string, any> | null,
  syncKeys?: string[]
): Record<string, any> {
  const obj = {...childData}; // 浅拷贝自身层

  // 决定要检查的 keys
  let keys: string[];
  if (syncKeys) {
    // FormStore 场景：只同步白名单 + 自身 keys
    keys = [...new Set([...syncKeys, ...Object.keys(obj)])];
  } else {
    // 非 Form 场景：同步所有自身 keys
    keys = Object.keys(obj);
  }

  if (superData || prevSuperData) {
    keys.forEach(key => {
      if (!key) return;
      const newSuperVal = superData ? superData[key] : undefined;
      const oldSuperVal = prevSuperData ? prevSuperData[key] : undefined;
      // 仅当父级值确实变化时才覆盖
      if (
        ((superData && typeof newSuperVal !== 'undefined') ||
         (prevSuperData && typeof oldSuperVal !== 'undefined')) &&
        newSuperVal !== oldSuperVal
      ) {
        obj[key] = newSuperVal;
      }
    });
  }
  return obj;
}

// ═══════════════ RootScope — 全局变量注入到链顶（Section 7）═══════════════

/**
 * 根作用域（参考 amis RootStore.downStream）
 * 把全局变量、context、query 注入到数据链顶部
 * 子 scope 通过原型链自动读取到全局变量
 */
export class RootScope extends DataScope {
  /** 全局变量（正式态） */
  globalVars: Record<string, any> = {};
  /** 上下文（如 __page / appVariables） */
  context: Record<string, any> = {};
  /** URL query / params */
  query: Record<string, any> = {};

  constructor(initialData: Record<string, any> = {}) {
    super(initialData);
  }

  /**
   * 计算 downStream（参考 amis RootStore.downStream view）
   * 链形态：[context] → [globalVars] → [query/params] → [自身 data]
   * 越靠下优先级越高（原型链就近覆盖）
   */
  get downStream(): Record<string, any> {
    const chain: any[] = [];

    // context 在最顶（优先级最低）
    if (Object.keys(this.context).length) {
      chain.push(this.context);
    }

    // 全局变量层
    if (Object.keys(this.globalVars).length) {
      chain.push({global: this.globalVars});
    }

    // query/params（倒数第二位）
    if (Object.keys(this.query).length) {
      chain.push({...this.query, __query: this.query});
    }

    // 自身 data（优先级最高）
    chain.push(this.data.value);

    return createObjectFromChain(chain);
  }

  /** 设置全局变量 */
  setGlobalVar(name: string, value: any): void {
    this.globalVars[name] = value;
    // 重建 downStream 作为新 data（触发响应式）
    this.data.value = this.downStream;
  }

  /** 设置上下文 */
  setContext(key: string, value: any): void {
    this.context[key] = value;
    this.data.value = this.downStream;
  }

  /** 设置 query */
  setQuery(query: Record<string, any>): void {
    this.query = {...this.query, ...query};
    this.data.value = this.downStream;
  }

  /**
   * 创建子作用域，子 scope 自动继承 downStream（含全局变量）
   */
  override createChild(childData: Record<string, any> = {}): DataScope {
    const scope = new DataScope(childData);
    // 子的原型链指向 root 的 downStream
    scope.data.value = createObject(this.downStream, childData);
    return scope;
  }
}
