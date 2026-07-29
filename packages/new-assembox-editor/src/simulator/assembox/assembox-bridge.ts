/**
 * AssemboxBridge —— 实现 assembox-desktop 的 AssemVueRenderer 契约
 * assembox-desktop 在 isEditorEnv 时调用 onMountedInstance/onUpdatedInstance/onUnmountedInstance
 * 本桥把实例交给 EidRegistry 匹配+盖标记，并回调 host（选中/几何等）
 */
import {EidRegistry} from './eid-registry';

export interface AssemboxBridgeCallbacks {
  onNodeMounted?(eid: string, el: HTMLElement): void;
  onNodeUnmounted?(eid: string): void;
}

export class AssemboxBridge {
  readonly registry = new EidRegistry();
  private cbs: AssemboxBridgeCallbacks;

  constructor(cbs: AssemboxBridgeCallbacks = {}) {
    this.cbs = cbs;
  }

  // ===== AssemVueRenderer 契约（assembox-desktop 调用） =====
  onMountedInstance(instance: any): void {
    const info = this.registry.matchAndRegister(instance);
    if (info && info.el) this.cbs.onNodeMounted?.(info.$$eid, info.el);
  }
  onUpdatedInstance(_instance: any): void {
    // P0 暂不处理（差异化更新在 P1）
  }
  onUnmountedInstance(instance: any): void {
    const el: HTMLElement | null =
      instance?.proxy?.$el ?? instance?.$el ?? null;
    const eid = el ? el.getAttribute?.('data-editor-id') : undefined;
    this.registry.unregisterByInstance(instance);
    if (eid) this.cbs.onNodeUnmounted?.(eid);
  }

  /** host 侧：按 $$eid 取 DOM 几何 */
  getRect(eid: string): DOMRect | null {
    return this.registry.get(eid)?.el?.getBoundingClientRect() ?? null;
  }
  /** host 侧：按 DOM 元素取 $$eid */
  eidFromEl(el: HTMLElement | null): string | null {
    if (!el) return null;
    return (
      el.closest('[data-editor-id]')?.getAttribute('data-editor-id') ?? null
    );
  }
}
