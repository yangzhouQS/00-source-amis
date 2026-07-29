/**
 * 编辑器键盘快捷键
 * Ctrl+Z 撤销 / Ctrl+Shift+Z,Ctrl+Y 重做 / Ctrl+C 复制 / Ctrl+V 粘贴
 * Ctrl+D 复制节点 / Delete 删除 / ArrowUp/Down 移动 / Esc 取消选中
 * 同时绑定 host doc + iframe doc（iframe 有独立焦点，host 收不到键盘事件）
 */
import type {Editor} from '../core/editor';

const CLIPBOARD_KEY = '__assem_clipboard';

function isTyping(doc: Document): boolean {
  const el = doc.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

export function useEditorShortcuts(editor: Editor): () => void {
  const cleanups: Array<() => void> = [];

  const createHandler = (doc: Document) => (e: KeyboardEvent) => {
    if (isTyping(doc)) return;
    const activeId = editor.store.state.activeId;
    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      editor.undo();
      return;
    }
    if ((ctrl && e.key === 'z' && e.shiftKey) || (ctrl && e.key === 'y')) {
      e.preventDefault();
      editor.redo();
      return;
    }

    if (ctrl && e.key === 'c' && activeId) {
      e.preventDefault();
      const node = editor.store.activeNode;
      if (node)
        (window as any)[CLIPBOARD_KEY] = JSON.parse(JSON.stringify(node));
      return;
    }
    if (ctrl && e.key === 'v') {
      e.preventDefault();
      const clip = (window as any)[CLIPBOARD_KEY];
      if (clip && activeId) {
        editor.duplicate(clip.$$id);
      } else if (clip) {
        editor.insert(editor.store.schema.$$id, 'body', clip);
      }
      return;
    }
    if (ctrl && e.key === 'd' && activeId) {
      e.preventDefault();
      editor.duplicate(activeId);
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && activeId) {
      e.preventDefault();
      editor.remove(activeId);
      return;
    }
    if (e.key === 'ArrowUp' && activeId) {
      e.preventDefault();
      editor.moveUp(activeId);
      return;
    }
    if (e.key === 'ArrowDown' && activeId) {
      e.preventDefault();
      editor.moveDown(activeId);
      return;
    }
    if (e.key === 'Escape') {
      editor.select(null);
      return;
    }
  };

  // 绑定 host doc
  const hostHandler = createHandler(document);
  document.addEventListener('keydown', hostHandler, true);
  cleanups.push(() =>
    document.removeEventListener('keydown', hostHandler, true)
  );

  // 绑定 iframe doc（轮询等待 iframe 加载）
  let iframeHandler: ((e: KeyboardEvent) => void) | null = null;
  const pollIframe = setInterval(() => {
    const iframe = document.querySelector(
      'iframe[class*="canvas"]'
    ) as HTMLIFrameElement | null;
    const iDoc = iframe?.contentDocument;
    if (iDoc && !iframeHandler) {
      iframeHandler = createHandler(iDoc);
      iDoc.addEventListener('keydown', iframeHandler, true);
      cleanups.push(() => {
        if (iframeHandler)
          iDoc.removeEventListener('keydown', iframeHandler, true);
      });
    }
  }, 500);

  return () => {
    clearInterval(pollIframe);
    cleanups.forEach(fn => fn());
  };
}
