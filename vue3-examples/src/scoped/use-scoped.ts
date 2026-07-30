/**
 * useScoped —— Vue3 composable，组件注册到 scope 树
 * 参考 amis HocScoped + registerComponent 设计
 */
import {inject, provide, onMounted, onBeforeUnmount, reactive} from 'vue';
import {
  SCOPED_KEY,
  createScopedContext,
  type ScopedContext,
  type ScopedComponent
} from './scoped-context';

export interface UseScopedOptions {
  /** 组件名（用于 getByName） */
  name?: string;
  /** 组件 id（用于 getById） */
  id?: string;
  /** 组件类型 */
  type?: string;
  /** 是否建立独立作用域（隔离子组件注册表） */
  isolateScope?: boolean;
  /** 组件方法实现 */
  reload?: ScopedComponent['reload'];
  receive?: ScopedComponent['receive'];
  getData?: ScopedComponent['getData'];
  setData?: ScopedComponent['setData'];
  doAction?: ScopedComponent['doAction'];
  onClose?: ScopedComponent['onClose'];
}

export function useScoped(options: UseScopedOptions = {}) {
  const parentScope = inject(SCOPED_KEY, null);

  // 如果 isolateScope，创建子 scope
  const ownScope: ScopedContext | null = options.isolateScope
    ? createScopedContext(parentScope, options.type)
    : null;

  // 组件描述符
  const component: ScopedComponent = reactive({
    name: options.name,
    id: options.id,
    type: options.type,
    show: true,
    reload: options.reload,
    receive: options.receive,
    getData: options.getData,
    setData: options.setData,
    doAction: options.doAction,
    onClose: options.onClose,
    context: ownScope ?? undefined
  });

  onMounted(() => {
    if (parentScope) {
      parentScope.register(component);
    }
  });

  onBeforeUnmount(() => {
    if (parentScope) {
      parentScope.unregister(component);
    }
  });

  // 如果有独立 scope，provide 给子组件
  if (ownScope) {
    provide(SCOPED_KEY, ownScope);
  }

  // 返回当前 scope（用于组件内调用 reload/send/close）
  const currentScope = ownScope ?? parentScope;

  return {
    /** 当前 scope（调用 reload/send/close 用） */
    scope: currentScope,
    /** 组件描述符（可动态修改 name/show 等） */
    component,
    /** 暴露给父级 scope 的方法集合 */
    expose: {
      reload: options.reload,
      receive: options.receive,
      getData: options.getData,
      setData: options.setData
    }
  };
}

/**
 * useComponentRef —— 获取其他组件实例并调用其方法
 */
export function useComponentRef() {
  const scope = inject(SCOPED_KEY, null);

  return {
    /** 按名字查找组件 */
    getByName(name: string) {
      return scope?.getByName(name);
    },
    /** 按 id 查找组件 */
    getById(id: string) {
      return scope?.getById(id);
    },
    /** 获取当前 scope 所有组件 */
    getComponents() {
      return scope?.getComponents() ?? [];
    },
    /** 刷新目标组件 */
    reload(target: string, ctx?: Record<string, any>) {
      scope?.reload(target, ctx);
    },
    /** 向目标组件发送数据 */
    send(target: string, values: Record<string, any>) {
      scope?.send(target, values);
    },
    /** 关闭目标弹窗 */
    close(target: string) {
      scope?.close(target);
    }
  };
}
