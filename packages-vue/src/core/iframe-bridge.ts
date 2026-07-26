import type { AmisSchema } from '@/types/schema';

const SOURCE = 'amis-editor-vue';

type PreviewMessage =
  | { source: 'amis-preview'; type: 'ready' }
  | { source: 'amis-preview'; type: 'select'; eid: string }
  | { source: 'amis-preview'; type: 'error'; message: string };

/**
 * Vue 编辑器与预览 iframe 之间的 postMessage 桥。
 * 负责 render（下发 schema）、ready 等消息。
 */
export class IframeBridge {
  private iframe: HTMLIFrameElement | null = null;
  private ready = false;
  private pending: Array<{ type: string; schema?: AmisSchema }> = [];
  private messageHandler = (ev: MessageEvent) => this.onMessage(ev);

  onReady?: () => void;
  onSelect?: (eid: string) => void;

  constructor(private readonly srcdoc: string) {}

  /** 将 iframe 挂载到容器 */
  mount(container: HTMLElement): HTMLIFrameElement {
    const iframe = document.createElement('iframe');
    iframe.className = 'amis-canvas__iframe';
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'auto');
    iframe.srcdoc = this.srcdoc;
    container.appendChild(iframe);
    this.iframe = iframe;
    window.addEventListener('message', this.messageHandler);
    return iframe;
  }

  private onMessage(ev: MessageEvent) {
    const data = ev.data as PreviewMessage;
    if (!data || data.source !== 'amis-preview') return;
    if (data.type === 'ready') {
      this.ready = true;
      this.flush();
      this.onReady?.();
    } else if (data.type === 'select') {
      this.onSelect?.(data.eid);
    }
  }

  private flush() {
    while (this.pending.length) {
      const msg = this.pending.shift()!;
      this.post(msg.type, msg.schema);
    }
  }

  private post(type: string, schema?: AmisSchema) {
    if (!this.iframe || !this.iframe.contentWindow) return;
    this.iframe.contentWindow.postMessage({ source: SOURCE, type, schema }, '*');
  }

  /** 下发 schema 渲染 */
  render(schema: AmisSchema) {
    if (this.ready) {
      this.post('render', schema);
    } else {
      this.pending.push({ type: 'render', schema });
    }
  }

  destroy() {
    window.removeEventListener('message', this.messageHandler);
    this.iframe?.remove();
    this.iframe = null;
    this.ready = false;
  }
}
