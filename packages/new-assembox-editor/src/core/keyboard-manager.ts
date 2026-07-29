/**
 * 快捷键管理器
 * 全局 keydown 监听；输入框/文本域聚焦时自动跳过
 * 默认绑定：复制/粘贴/删除/上移/下移/撤销/重做/保存
 */
import type {Editor} from './editor';

export class KeyboardManager {
  constructor(private readonly editor: Editor) {}

  attach(): void {
    document.addEventListener('keydown', this.onKeydown);
  }

  detach(): void {
    document.removeEventListener('keydown', this.onKeydown);
  }

  /** 输入框/文本域/下拉/可编辑元素聚焦时不触发快捷键 */
  private isInputFocused(): boolean {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName;
    return (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      el.isContentEditable
    );
  }

  private onKeydown = (e: KeyboardEvent): void => {
    if (this.isInputFocused()) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    const id = this.editor.store.state.activeId;
    let handled = false;

    if (ctrl && !e.shiftKey && key === 'c' && id) {
      this.editor.copy(id);
      handled = true;
    } else if (ctrl && !e.shiftKey && key === 'v' && id) {
      this.editor.paste(id);
      handled = true;
    } else if (ctrl && !e.shiftKey && key === 'z') {
      this.editor.undo();
      handled = true;
    } else if (ctrl && (key === 'y' || (e.shiftKey && key === 'z'))) {
      this.editor.redo();
      handled = true;
    } else if (ctrl && key === 's') {
      this.editor.save();
      handled = true;
    } else if (ctrl && e.key === 'ArrowUp' && id) {
      this.editor.moveUp(id);
      handled = true;
    } else if (ctrl && e.key === 'ArrowDown' && id) {
      this.editor.moveDown(id);
      handled = true;
    } else if (!ctrl && (e.key === 'Delete' || e.key === 'Backspace') && id) {
      this.editor.remove(id);
      handled = true;
    }

    if (handled) e.preventDefault();
  };
}
