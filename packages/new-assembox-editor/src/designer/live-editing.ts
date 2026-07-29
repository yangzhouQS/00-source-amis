/**
 * 原地文本编辑（Live Editing）
 * 参考 lowcode-engine live-editing：双击 → contenteditable → blur 保存到 schema
 *
 * 流程：
 * 1. 双击节点 → apply(nodeId, event, doc, meta)
 * 2. 查找 data-live-edit 属性 或 selector 定位可编辑元素
 * 3. 设 contenteditable + focus + caret 定位
 * 4. blur → innerText → editor.update(nodeId, {props: {[propTarget]: text}})
 */
import type {Editor} from '../core/editor';
import type {LiveTextEditingConfig} from '../schema/types';
import * as ops from '../schema/operations';

const ATTR_LIVE_EDIT = 'data-live-edit';

export class LiveEditing {
  private editing: {
    nodeId: string;
    propTarget: string;
    el: HTMLElement;
    prevStyle: string;
    onFocusOut: () => void;
    onKeyDown: (e: KeyboardEvent) => void;
  } | null = null;

  constructor(private editor: Editor) {}

  /**
   * 尝试进入原地编辑
   * @returns true 表示已进入编辑（消费了双击事件）
   */
  apply(nodeId: string, event: MouseEvent, doc: Document): boolean {
    if (this.editing) {
      // 已在编辑 → 先保存退出
      this.saveAndDispose();
    }

    const meta = this.editor.componentRegistry.get(
      this.editor.store.schema.$$id === nodeId
        ? 'page'
        : this.getNodeType(nodeId)
    );
    if (!meta?.liveTextEditing?.length) return false;

    const target = event.target as HTMLElement;
    if (!target) return false;

    // 1. 查找 data-live-edit 属性（DOM 埋点优先）
    let editableEl = target.closest(
      `[${ATTR_LIVE_EDIT}]`
    ) as HTMLElement | null;
    let propTarget: string | undefined;

    if (editableEl) {
      propTarget = editableEl.getAttribute(ATTR_LIVE_EDIT)!;
    } else {
      // 2. 用 liveTextEditing[].selector 匹配（scope 在节点根元素内）
      const nodeRoot = doc.querySelector(
        `[data-editor-id="${nodeId}"]`
      ) as HTMLElement | null;
      if (nodeRoot) {
        for (const cfg of meta.liveTextEditing) {
          if (!cfg.selector) {
            // 无 selector → 默认整个节点根元素可编辑
            editableEl = nodeRoot;
            propTarget = cfg.propTarget;
            break;
          }
          const el =
            cfg.selector === ':root'
              ? nodeRoot
              : (nodeRoot.querySelector(cfg.selector) as HTMLElement | null);
          if (el && el.contains(target)) {
            editableEl = el;
            propTarget = cfg.propTarget;
            break;
          }
        }
      }
    }

    if (!editableEl || !propTarget) return false;

    const cfg = meta.liveTextEditing.find(c => c.propTarget === propTarget);
    const mode = cfg?.mode ?? 'plaintext';

    // 进入编辑（inline style 确保 iframe 内生效）
    const prevStyle = editableEl.style.cssText;
    editableEl.setAttribute(
      'contenteditable',
      mode === 'richtext' ? 'true' : 'plaintext-only'
    );
    editableEl.style.cssText =
      prevStyle +
      ';cursor:text;outline:none;box-shadow:0 0 0 2px rgb(102,188,92);user-select:text;border-radius:2px;';
    editableEl.focus();

    // 光标定位到双击位置
    this.setCaret(event, doc);

    // blur 保存
    const onFocusOut = () => this.saveAndDispose();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        editableEl!.blur();
      } else if (e.key === 'Enter' && mode === 'plaintext') {
        e.preventDefault();
        editableEl!.blur();
      }
    };

    editableEl.addEventListener('focusout', onFocusOut);
    editableEl.addEventListener('keydown', onKeyDown);

    this.editing = {
      nodeId,
      propTarget,
      el: editableEl,
      prevStyle,
      onFocusOut,
      onKeyDown
    };

    return true;
  }

  /** 保存当前编辑内容到 schema */
  saveAndDispose(): void {
    if (!this.editing) return;
    const {nodeId, propTarget, el, prevStyle, onFocusOut, onKeyDown} =
      this.editing;
    const text = el.innerText;

    // 移除编辑态（恢复原始 style）
    el.removeEventListener('focusout', onFocusOut);
    el.removeEventListener('keydown', onKeyDown);
    el.style.cssText = prevStyle;
    el.removeAttribute('contenteditable');

    // 保存到 schema（非空才更新）
    if (text !== '') {
      this.editor.update(nodeId, {props: {[propTarget]: text}});
    }

    this.editing = null;
  }

  get isEditing(): boolean {
    return this.editing !== null;
  }

  dispose(): void {
    if (this.editing) {
      const {el, prevStyle, onFocusOut, onKeyDown} = this.editing;
      el.removeEventListener('focusout', onFocusOut);
      el.removeEventListener('keydown', onKeyDown);
      el.style.cssText = prevStyle;
      el.removeAttribute('contenteditable');
      this.editing = null;
    }
  }

  /** 光标定位到鼠标点击位置 */
  private setCaret(event: MouseEvent, doc: Document): void {
    try {
      const range = (doc as any).caretRangeFromPoint?.(
        event.clientX,
        event.clientY
      );
      if (range) {
        const sel = doc.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    } catch {
      /* iframe 跨域或不可用时忽略 */
    }
  }

  /** 获取节点类型（从 schema） */
  private getNodeType(nodeId: string): string {
    const node = ops.getNodeById(this.editor.store.schema, nodeId);
    return node?.type ?? '';
  }
}
