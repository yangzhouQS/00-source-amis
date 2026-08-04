/**
 * 右键上下文菜单覆盖层（v3）
 * - 自包含轮询：自行查找画布容器 + iframe doc，不依赖外部 ref 传入
 * - 仅画布容器 + iframe doc 上的 contextmenu 生效
 * - nodeId 为 null 时仍显示菜单（粘贴可用）
 * - iframe load 后自动重绑
 */
import {
  defineComponent,
  PropType,
  ref,
  computed,
  onMounted,
  onBeforeUnmount,
} from 'vue';
import type {Editor} from '../../core/editor';
import type {ContextMenuContext} from '../../designer/context-menu-manager';
import {useAssemNamespace} from '../../hooks/use-assem-namespace';

const ns = useAssemNamespace('context-menu');

/** 查找画布容器（lc-assem-designer__canvas） */
function findCanvasEl(): HTMLElement | null {
  return document.querySelector('.lc-assem-designer__canvas') as HTMLElement | null;
}

export const ContextMenu = defineComponent({
  name: 'ContextMenu',
  props: {
    editor: {type: Object as PropType<Editor>, required: true},
  },
  setup(props) {
    const visible = ref(false);
    const x = ref(0);
    const y = ref(0);
    const nodeId = ref<string | null>(null);

    // 绑定状态跟踪（防止重复绑定）
    let boundHostEl: HTMLElement | null = null;
    let boundIframeDoc: Document | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const ctx = computed<ContextMenuContext>(() => ({
      nodeId: nodeId.value,
      editor: props.editor,
    }));

    const actions = computed(() => {
      if (!visible.value) return [];
      return props.editor.contextMenu.getAvailableActions(ctx.value);
    });

    const show = (gx: number, gy: number, id: string | null) => {
      x.value = gx;
      y.value = gy;
      nodeId.value = id;
      visible.value = true;
    };

    const hide = () => {
      visible.value = false;
      nodeId.value = null;
    };

    const resolveNodeId = (el: HTMLElement | null): string | null => {
      if (!el) return null;
      const marked = el.closest('[data-editor-id]');
      if (marked) return marked.getAttribute('data-editor-id');
      const nodeEl = el.closest('[__nodeid]');
      if (nodeEl) return nodeEl.getAttribute('__nodeid');
      return null;
    };

    // ── 事件处理器（保持引用以便 removeEventListener）──
    const hostCtxHandler = (e: Event) => {
      const me = e as MouseEvent;
      // 只处理画布容器内的事件（host 同 DOM 模式）
      me.preventDefault();
      me.stopPropagation();
      const id = resolveNodeId(me.target as HTMLElement | null);
      show(me.clientX, me.clientY, id);
    };

    const iframeCtxHandler = (e: Event) => {
      const me = e as MouseEvent;
      me.preventDefault();
      me.stopPropagation();
      const id = resolveNodeId(me.target as HTMLElement | null);
      // iframe 内坐标 → host 视口坐标
      const iframe = boundIframeDoc?.defaultView?.frameElement as HTMLIFrameElement | null;
      let gx = me.clientX;
      let gy = me.clientY;
      if (iframe) {
        const rect = iframe.getBoundingClientRect();
        gx += rect.left;
        gy += rect.top;
      }
      show(gx, gy, id);
    };

    const clickHideHandler = () => hide();

    // ── 绑定/解绑 ──

    const bindHost = (el: HTMLElement) => {
      el.addEventListener('contextmenu', hostCtxHandler, true);
      boundHostEl = el;
    };

    const unbindHost = () => {
      if (boundHostEl) {
        boundHostEl.removeEventListener('contextmenu', hostCtxHandler, true);
        boundHostEl = null;
      }
    };

    const bindIframe = (doc: Document) => {
      doc.addEventListener('contextmenu', iframeCtxHandler, true);
      doc.addEventListener('click', clickHideHandler, true);
      boundIframeDoc = doc;
    };

    const unbindIframe = () => {
      if (boundIframeDoc) {
        boundIframeDoc.removeEventListener('contextmenu', iframeCtxHandler, true);
        boundIframeDoc.removeEventListener('click', clickHideHandler, true);
        boundIframeDoc = null;
      }
    };

    /** 轮询检查画布容器 + iframe 是否就绪 */
    const startPolling = () => {
      let attempts = 0;
      pollTimer = setInterval(() => {
        attempts++;

        // 1. 绑定 host 画布容器（只绑一次）
        if (!boundHostEl) {
          const canvas = findCanvasEl();
          if (canvas) bindHost(canvas);
        }

        // 2. 绑定 iframe doc（如果画布内有 iframe 且已 load）
        if (!boundIframeDoc && boundHostEl) {
          const iframe = boundHostEl.querySelector('iframe') as HTMLIFrameElement | null;
          if (iframe?.contentDocument && iframe.contentDocument.readyState === 'complete') {
            bindIframe(iframe.contentDocument);
          }
        }

        // 两个都绑上了就停止轮询
        if (boundHostEl && (boundIframeDoc || attempts > 60)) {
          // 如果没有 iframe（同 DOM 模式），轮询 60 次（30s）后也停止
          if (!boundHostEl.querySelector('iframe') && attempts > 20) {
            stopPolling();
          }
          // 有 iframe 且已绑定 → 停止
          if (boundIframeDoc) {
            stopPolling();
          }
        }
      }, 500);
    };

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    onMounted(() => {
      startPolling();
      // host doc 全局 click 关闭（点画布外也关闭菜单）
      document.addEventListener('click', clickHideHandler, true);
    });

    onBeforeUnmount(() => {
      stopPolling();
      unbindHost();
      unbindIframe();
      document.removeEventListener('click', clickHideHandler, true);
    });

    const handleAction = (actionName: string, isDisabled: boolean) => {
      if (isDisabled) return;
      const action = actions.value.find((a) => a.name === actionName);
      const capturedCtx = ctx.value;
      hide();
      if (action?.action) {
        action.action(capturedCtx);
      }
    };

    return () => {
      if (!visible.value) return null;
      const list = actions.value;
      return (
        <div
          class={ns.b()}
          style={{
            position: 'fixed',
            left: `${x.value}px`,
            top: `${y.value}px`,
            zIndex: 99999,
          }}
        >
          {list.length === 0 ? (
            <div class={ns.e('empty')}>无可用操作</div>
          ) : (
            list.map((action) => {
              if (action.separator) {
                return <div class={ns.e('separator')} key={action.name} />;
              }
              const disabled = props.editor.contextMenu.isDisabled(action, ctx.value);
              return (
                <div
                  key={action.name}
                  class={[
                    ns.e('item'),
                    action.danger ? ns.is('danger') : '',
                    disabled ? ns.is('disabled') : '',
                  ]}
                  onClick={() => handleAction(action.name, disabled)}
                >
                  <span>{action.title}</span>
                </div>
              );
            })
          )}
        </div>
      );
    };
  },
});
