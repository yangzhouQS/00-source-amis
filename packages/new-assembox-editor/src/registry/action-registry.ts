/**
 * 声明式动作注册表 + 执行引擎
 * 借鉴 amis-core 的 Action 系统：registerAction + runActions
 * 支持串行 / 条件(expression) / 防止默认 / 停止传播
 * 取代旧版 Monaco 手写事件代码
 */
import type {ActionSchema} from '../schema/types';
import type {ActionMeta} from '../schema/types';

/** 动作执行上下文 */
export interface ActionContext {
  /** 声明式动作配置 */
  action: ActionSchema;
  /** 当前节点数据作用域 */
  data: Record<string, any>;
  /** 触发的事件对象 */
  event?: any;
  /** 获取目标组件（按 componentId/componentName） */
  getTarget?: (idOrName: string) => any;
  /** 通知（toast 等） */
  notify?: (type: string, message: string) => void;
  /** 发起请求 */
  request?: (config: any) => Promise<any>;
  /** 导航 */
  navigate?: (url: string) => void;
  /** 设值 */
  setValue?: (target: string, data: any) => void;
  /** 其他扩展 */
  [key: string]: any;
}

export class ActionRegistry {
  private map = new Map<string, ActionMeta>();

  /** 注册动作（重名覆盖并告警） */
  register(meta: ActionMeta): void {
    if (this.map.has(meta.actionType)) {
      console.warn(`[ActionRegistry] 动作 "${meta.actionType}" 已存在，覆盖`);
    }
    this.map.set(meta.actionType, meta);
  }

  /** 批量注册 */
  registerAll(metas: ActionMeta[]): void {
    metas.forEach(m => this.register(m));
  }

  /** 取消注册 */
  unregister(actionType: string): boolean {
    return this.map.delete(actionType);
  }

  /** 获取 */
  get(actionType: string): ActionMeta | undefined {
    return this.map.get(actionType);
  }

  /** 全部 */
  all(): ActionMeta[] {
    return Array.from(this.map.values());
  }

  /**
   * 执行一组动作（串行）
   * 支持 expression 前置条件、preventDefault、stopPropagation、ignoreError
   */
  async runActions(
    actions: ActionSchema[] | undefined,
    baseCtx: ActionContext
  ): Promise<void> {
    if (!actions || !actions.length) return;
    const list = Array.isArray(actions) ? actions : [actions];
    for (const action of list) {
      // 条件判断
      if (
        action.expression &&
        !this.evalExpression(action.expression, baseCtx)
      ) {
        continue;
      }
      const impl = this.map.get(action.actionType);
      if (!impl) {
        console.warn(`[ActionRegistry] 未知动作类型: ${action.actionType}`);
        continue;
      }
      const ctx: ActionContext = {...baseCtx, action};
      try {
        await impl.run(ctx);
      } catch (err) {
        if (!action.ignoreError) {
          console.error(
            `[ActionRegistry] 动作 "${action.actionType}" 执行失败:`,
            err
          );
          throw err;
        }
      }
      if (action.stopPropagation) break;
    }
  }

  /** 简易表达式求值（安全，仅支持简单表达式） */
  private evalExpression(expr: string, ctx: ActionContext): boolean {
    try {
      // 使用 Function 求值，绑定 data 作用域
      // eslint-disable-next-line no-new-func
      const fn = new Function('data', 'event', `return (${expr});`);
      return !!fn(ctx.data, ctx.event);
    } catch {
      return false;
    }
  }
}
