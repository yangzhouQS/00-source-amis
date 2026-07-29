/**
 * 右键菜单管理器（参考 lowcode ContextMenuActions）
 * 声明式注册：register({name, title, icon, condition, disabled, action, separator})
 * 插件可通过 ctx.editor.contextMenu.register() 扩展菜单项
 */

export interface ContextMenuContext {
  nodeId: string | null;
  editor: any;
}

export interface ContextMenuAction {
  /** 唯一标识 */
  name: string;
  /** 显示文本 */
  title: string;
  /** 图标组件 */
  icon?: any;
  /** 危险操作（红色） */
  danger?: boolean;
  /** 分隔线（忽略其他字段） */
  separator?: boolean;
  /** 排序权重（越小越靠前） */
  weight?: number;
  /** 是否显示（默认 true） */
  condition?: (ctx: ContextMenuContext) => boolean;
  /** 是否禁用（灰色不可点） */
  disabled?: (ctx: ContextMenuContext) => boolean;
  /** 点击执行 */
  action?: (ctx: ContextMenuContext) => void;
}

export class ContextMenuManager {
  private actions: ContextMenuAction[] = [];

  /** 注册菜单项 */
  register(action: ContextMenuAction): void {
    const idx = this.actions.findIndex(a => a.name === action.name);
    if (idx >= 0) {
      this.actions[idx] = action;
    } else {
      this.actions.push(action);
      this.actions.sort((a, b) => (a.weight ?? 100) - (b.weight ?? 100));
    }
  }

  /** 移除菜单项 */
  unregister(name: string): void {
    const idx = this.actions.findIndex(a => a.name === name);
    if (idx >= 0) this.actions.splice(idx, 1);
  }

  /** 获取可用菜单项（已过滤 condition） */
  getAvailableActions(ctx: ContextMenuContext): ContextMenuAction[] {
    return this.actions.filter(a => !a.condition || a.condition(ctx));
  }

  /** 判断是否禁用 */
  isDisabled(action: ContextMenuAction, ctx: ContextMenuContext): boolean {
    return action.disabled?.(ctx) ?? false;
  }

  /** 清空 */
  clear(): void {
    this.actions = [];
  }
}
