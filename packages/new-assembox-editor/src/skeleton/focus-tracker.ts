/**
 * 浮动面板失焦关闭（FocusTracker）
 * 借鉴 lowcode 白名单范围判定：点击在面板内/保护范围（leftArea dock）内不关闭，
 * 点击在画布/rightArea/其它则关闭浮动面板
 */
import {onMounted, onBeforeUnmount, type Ref} from 'vue';

/**
 * @param paneEl 浮动面板根元素 ref
 * @param onClose 失焦时回调（通常 unactive 当前面板）
 * @param isProtected 判断点击目标是否属保护范围（如 leftArea dock 栏，点击切换而非关闭）
 */
export function useFocusOut(
  paneEl: Ref<HTMLElement | null>,
  onClose: () => void,
  isProtected: (target: HTMLElement) => boolean
): void {
  const onMouseDown = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target) return;
    // 1. 点击在浮动面板内 → 不关闭
    if (paneEl.value?.contains(target)) return;
    // 2. 点击在保护范围（dock 栏等）→ 不关闭
    if (isProtected(target)) return;
    // 3. 其余（画布/右侧/空白）→ 关闭
    onClose();
  };

  // capture 阶段监听，先于面板内交互处理
  onMounted(() => document.addEventListener('mousedown', onMouseDown, true));
  onBeforeUnmount(() =>
    document.removeEventListener('mousedown', onMouseDown, true)
  );
}
