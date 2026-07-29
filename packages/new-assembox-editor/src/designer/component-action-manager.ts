/**
 * 组件工具栏动作管理器（参考 lowcode ComponentActions）
 * 声明式注册：register({name, title, icon, condition, disabled, action, weight, danger})
 * BemTools 选中节点时在工具栏动态渲染所有可用动作
 * 插件可通过 ctx.editor.componentActions.register() 扩展
 */

export interface ComponentActionContext {
  nodeId: string;
  editor: any;
}

export interface ComponentAction {
  /** 唯一标识 */
  name: string;
  /** 显示文本（Tip 提示） */
  title: string;
  /** 图标组件（Vue 组件） */
  icon?: any;
  /** 危险操作（红色） */
  danger?: boolean;
  /** 排序权重（越小越靠前） */
  weight?: number;
  /** 是否显示（默认 true） */
  condition?: (ctx: ComponentActionContext) => boolean;
  /** 是否禁用（灰色不可点） */
  disabled?: (ctx: ComponentActionContext) => boolean;
  /** 点击执行 */
  action?: (ctx: ComponentActionContext) => void;
}

export class ComponentActionManager {
  private actions: ComponentAction[] = [];

  /** 注册工具栏动作 */
  register(action: ComponentAction): void {
    const idx = this.actions.findIndex(a => a.name === action.name);
    if (idx >= 0) {
      this.actions[idx] = action;
    } else {
      this.actions.push(action);
      this.actions.sort((a, b) => (a.weight ?? 100) - (b.weight ?? 100));
    }
  }

  /** 移除 */
  unregister(name: string): void {
    const idx = this.actions.findIndex(a => a.name === name);
    if (idx >= 0) this.actions.splice(idx, 1);
  }

  /** 获取可用动作（已过滤 condition） */
  getAvailableActions(ctx: ComponentActionContext): ComponentAction[] {
    return this.actions.filter(a => !a.condition || a.condition(ctx));
  }

  /** 判断是否禁用 */
  isDisabled(action: ComponentAction, ctx: ComponentActionContext): boolean {
    return action.disabled?.(ctx) ?? false;
  }

  clear(): void {
    this.actions = [];
  }
}
