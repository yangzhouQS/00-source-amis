/**
 * 内置动作（声明式动作注册表）
 * 取代旧版 Monaco 手写事件代码：动作可声明式编排
 */
import type {ActionMeta} from '../schema/types';
import type {ActionContext} from '../registry/action-registry';

export const builtinActions: ActionMeta[] = [
  {
    actionType: 'setValue',
    title: '设置变量',
    description: '设置数据作用域中的变量值',
    run: (ctx: ActionContext) => {
      const {action, data} = ctx;
      if (action.args?.values) {
        Object.assign(data, action.args.values);
      }
      if (action.componentId && ctx.setValue) {
        ctx.setValue(
          action.componentId,
          action.args?.values ?? action.data ?? {}
        );
      }
    }
  },
  {
    actionType: 'toast',
    title: '消息提示',
    description: '弹出消息提示',
    run: (ctx: ActionContext) => {
      const msg = ctx.action.args?.message ?? '提示';
      ctx.notify?.('info', msg);
      if (typeof (window as any).ElMessage?.success === 'function') {
        (window as any).ElMessage(ctx.action.args?.type ?? 'success', msg);
      }
    }
  },
  {
    actionType: 'navigate',
    title: '页面跳转',
    description: '跳转到指定 URL',
    run: (ctx: ActionContext) => {
      const url = ctx.action.args?.url;
      if (url) {
        ctx.navigate?.(url);
        if (typeof window !== 'undefined') window.location.href = url;
      }
    }
  },
  {
    actionType: 'ajax',
    title: '发送请求',
    description: '发起 API 请求',
    run: async (ctx: ActionContext) => {
      const config = ctx.action.args?.api;
      if (config && ctx.request) {
        const res = await ctx.request(config);
        if (ctx.action.outputVar) {
          ctx.data[ctx.action.outputVar] = res;
        }
      }
    }
  },
  {
    actionType: 'console',
    title: '控制台输出',
    description: '打印日志（调试用）',
    run: (ctx: ActionContext) => {
      // eslint-disable-next-line no-console
      console.log('[Action:console]', ctx.action.args?.message, ctx.data);
    }
  }
];

/** 注册内置动作 */
export function registerBuiltinActions(
  registry: import('../registry/action-registry').ActionRegistry
): void {
  registry.registerAll(builtinActions);
}
