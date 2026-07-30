/**
 * ScopedContext 核心 —— Vue3 版组件通信系统
 * 参考 amis Scoped 设计，用 provide/inject + 闭包私有注册表实现
 */

import {inject, provide, type InjectionKey} from 'vue';

// ═══════════════ 类型定义 ═══════════════

export interface ScopedComponent {
  /** 组件名（唯一标识，用于 getByName） */
  name?: string;
  /** 组件 id（全局唯一，用于 getById） */
  id?: string;
  /** 组件类型 */
  type?: string;
  /** 是否显示（弹窗用） */
  show?: boolean;
  /** reload 方法（刷新数据） */
  reload?: (subPath?: string, query?: Record<string, any>, ctx?: any) => void;
  /** receive 方法（接收外部数据） */
  receive?: (values: Record<string, any>, subPath?: string) => void;
  /** getData 方法（获取组件数据） */
  getData?: () => Record<string, any>;
  /** setData 方法（设置组件数据） */
  setData?: (data: Record<string, any>) => void;
  /** doAction 方法（执行组件动作） */
  doAction?: (action: string, data?: any) => void;
  /** onClose 方法（关闭回调） */
  onClose?: () => void;
  /** 自身 scope（isolateScope 组件才有） */
  context?: ScopedContext;
}

export interface ScopedContext {
  /** 创建该 scope 的组件类型标识 */
  rendererType?: string;
  /** 父 scope */
  parent: ScopedContext | null;
  /** 子 scope 列表 */
  children: ScopedContext[];
  /** 创建该 scope 的组件自身引用 */
  component: ScopedComponent | null;

  // ── 注册/注销 ──
  register(component: ScopedComponent): void;
  unregister(component: ScopedComponent): void;

  // ── 查找 ──
  getByName(name: string): ScopedComponent | undefined;
  getById(id: string): ScopedComponent | undefined;
  getByIdUnderCurrentScope(id: string): ScopedComponent | undefined;
  getComponents(): ScopedComponent[];

  // ── 通信 ──
  reload(target: string, ctx?: Record<string, any>): void;
  send(target: string, values: Record<string, any>): void;
  close(target: string): void;
  doAction(actions: Array<{actionType: string; args?: any}>, ctx?: any): void;
}

export const SCOPED_KEY: InjectionKey<ScopedContext> = Symbol('scoped');

// ═══════════════ splitTarget ─────────────────

/**
 * 解析 target 字符串（支持逗号分隔多目标 + ?query + .subPath）
 * 简化版：按逗号拆分（不做 AST 解析，足够验证场景）
 */
export function splitTarget(target: string): string[] {
  return target.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * 解析单个 target 为 { name, query, subPath }
 */
export function parseTarget(name: string, ctx?: Record<string, any>): {
  name: string;
  query: Record<string, any> | null;
  subPath: string;
} {
  let query: Record<string, any> | null = null;
  let subPath = '';

  // 解析 ?query
  const qIdx = name.indexOf('?');
  if (~qIdx) {
    const queryStr = name.substring(qIdx + 1);
    query = {};
    queryStr.split('&').forEach(pair => {
      const [k, v] = pair.split('=');
      // 支持 ${var} 变量替换（简化版）
      let val = v ?? '';
      if (val.startsWith('${') && val.endsWith('}')) {
        const varName = val.slice(2, -1);
        val = ctx?.[varName] ?? '';
      }
      query![k] = val;
    });
    name = name.substring(0, qIdx);
  }

  // 解析 .subPath
  const sIdx = name.indexOf('.');
  if (~sIdx) {
    subPath = name.substring(sIdx + 1);
    name = name.substring(0, sIdx);
  }

  return {name, query, subPath};
}

// ═══════════════ createScopedContext ─────────────────

let scopeIdCounter = 0;

export function createScopedContext(
  parent: ScopedContext | null = null,
  rendererType?: string
): ScopedContext {
  const components: ScopedComponent[] = [];
  const scopeId = `scope_${++scopeIdCounter}`;

  const self: ScopedContext = {
    rendererType,
    parent,
    children: [],
    component: null,

    // ═══ 注册 ═══
    register(component: ScopedComponent) {
      // 如果是 scope 创建者自身 → 记录到 self.component + 注册到父级
      if (component.type === rendererType && parent) {
        self.component = component;
        parent.register(component);
        return;
      }
      // 子组件 → 存入本地注册表
      if (!components.includes(component)) {
        components.push(component);
      }
    },

    // ═══ 注销 ═══
    unregister(component: ScopedComponent) {
      if (component.type === rendererType && parent) {
        const childIdx = parent.children.indexOf(self);
        if (~childIdx) parent.children.splice(childIdx, 1);
        parent.unregister(component);
        return;
      }
      const idx = components.indexOf(component);
      if (~idx) components.splice(idx, 1);
    },

    // ═══ getByName（本地 → 向上冒泡，支持点号路径） ═══
    getByName(name: string): ScopedComponent | undefined {
      // 点号路径 "formA.fieldB"
      if (name.includes('.')) {
        const paths = name.split('.');
        let current: ScopedContext | null = self;
        for (let i = 0; i < paths.length; i++) {
          if (!current) return undefined;
          const found = current.getByName(paths[i]);
          if (!found) return undefined;
          if (i < paths.length - 1) {
            current = found.context ?? null;
          } else {
            return found;
          }
        }
      }
      // 单段查找
      const found = components.find(c => c.name === name || c.id === name);
      if (found) return found;
      // 向上冒泡
      return parent?.getByName(name);
    },

    // ═══ getByIdUnderCurrentScope（当前子树遍历） ═══
    getByIdUnderCurrentScope(id: string): ScopedComponent | undefined {
      // 本地查找
      const local = components.find(c => c.id === id);
      if (local) return local;
      // 子 scope 递归
      for (const child of self.children) {
        const found = child.getByIdUnderCurrentScope(id);
        if (found) return found;
      }
      return undefined;
    },

    // ═══ getById（自底向上逐层扩大，就近优先） ═══
    getById(id: string): ScopedComponent | undefined {
      let root: ScopedContext = self;
      let ignore: ScopedContext | null = null;
      while (root) {
        // 在 root 子树内查找（排除 ignore 子树）
        const found = findByIdInTree(root, id, ignore);
        if (found) return found;
        if (!root.parent) break;
        ignore = root;
        root = root.parent;
      }
      return undefined;
    },

    // ═══ getComponents ═══
    getComponents(): ScopedComponent[] {
      return [...components];
    },

    // ═══ reload ═══
    reload(target: string, ctx?: Record<string, any>): void {
      const targets = splitTarget(target);
      for (const raw of targets) {
        const {name, query, subPath} = parseTarget(raw, ctx);
        const component = self.getByName(name) || self.getById(name);
        component?.reload?.(subPath, query ?? undefined, ctx);
      }
    },

    // ═══ send ═══
    send(target: string, values: Record<string, any>): void {
      const targets = splitTarget(target);
      for (const raw of targets) {
        const {name, subPath} = parseTarget(raw, values);
        const component = self.getByName(name);
        component?.receive?.(values, subPath);
      }
    },

    // ═══ close ═══
    close(target: string): void {
      const targets = splitTarget(target);
      for (const name of targets) {
        const component = self.getByName(name);
        if (component && component.show) {
          closeDialogRecursive(component);
        }
      }
    },

    // ═══ doAction ═══
    doAction(actions: Array<{actionType: string; args?: any}>, ctx?: any): void {
      const renderer = components[0];
      for (const action of actions) {
        if (action.actionType === 'setValue') {
          renderer?.setData?.(action.args || {});
        } else if (action.actionType === 'reload') {
          renderer?.reload?.('', undefined, ctx);
        }
      }
    }
  };

  if (parent) parent.children.push(self);
  return self;
}

// ═══════════════ 辅助函数 ═══════════════

function findByIdInTree(
  scope: ScopedContext,
  id: string,
  ignore: ScopedContext | null
): ScopedComponent | undefined {
  if (scope === ignore) return undefined;
  const local = scope.getComponents().find(c => c.id === id);
  if (local) return local;
  for (const child of scope.children) {
    if (child === ignore) continue;
    const found = findByIdInTree(child, id, ignore);
    if (found) return found;
  }
  return undefined;
}

function closeDialogRecursive(component: ScopedComponent): void {
  // 先递归关闭子级弹窗
  const childScope = component.context;
  if (childScope) {
    childScope
      .getComponents()
      .filter(c => c.type === 'dialog' || c.type === 'drawer')
      .filter(c => c.show)
      .forEach(closeDialogRecursive);
  }
  // 最后关闭自己
  component.onClose?.();
}

// ═══════════════ 根 scope ═══════════════

export const rootScopedContext = createScopedContext(null, 'root');
