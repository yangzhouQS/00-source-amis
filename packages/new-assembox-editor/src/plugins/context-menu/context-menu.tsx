/**
 * 右键上下文菜单覆盖层（重构：声明式 ContextMenuManager 驱动）
 * 绑定 iframe doc contextmenu 事件，在 host 文档定位显示菜单
 * 菜单项由 editor.contextMenu（ContextMenuManager）动态提供，插件可扩展
 */
import {
  defineComponent,
  PropType,
  ref,
  computed,
  onMounted,
  onBeforeUnmount
} from 'vue';
import {
  CopyDocument,
  Delete,
  ArrowUp,
  ArrowDown,
  Back as PasteIcon
} from '@element-plus/icons-vue';
import type {Editor} from '../../core/editor';
import type {ContextMenuContext} from '../../designer/context-menu-manager';
import {useAssemNamespace} from '../../hooks/use-assem-namespace';

const ns = useAssemNamespace('context-menu');

/** 内置菜单项的图标映射 */
const iconMap: Record<string, any> = {
  copy: CopyDocument,
  paste: PasteIcon,
  moveUp: ArrowUp,
  moveDown: ArrowDown,
  delete: Delete
};

export const ContextMenu = defineComponent({
  name: 'ContextMenu',
  props: {
    editor: {type: Object as PropType<Editor>, required: true}
  },
  setup(props) {
    const visible = ref(false);
    const x = ref(0);
    const y = ref(0);
    const nodeId = ref<string | null>(null);
    let cleanupFns: Array<() => void> = [];

    const ctx = computed<ContextMenuContext>(() => ({
      nodeId: nodeId.value,
      editor: props.editor
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

    const bindContext = (doc: Document) => {
      const onCtx = (e: MouseEvent) => {
        e.preventDefault();
        const target = e.target as HTMLElement | null;
        const id =
          target?.closest('[data-editor-id]')?.getAttribute('data-editor-id') ??
          null;
        let gx = e.clientX;
        let gy = e.clientY;
        if (doc !== document) {
          const iframe = doc.defaultView
            ?.frameElement as HTMLIFrameElement | null;
          if (iframe) {
            const rect = iframe.getBoundingClientRect();
            gx += rect.left;
            gy += rect.top;
          }
        }
        show(gx, gy, id);
      };
      const onClick = () => hide();
      doc.addEventListener('contextmenu', onCtx, true);
      doc.addEventListener('click', onClick, true);
      cleanupFns.push(() => {
        doc.removeEventListener('contextmenu', onCtx, true);
        doc.removeEventListener('click', onClick, true);
      });
    };

    onMounted(() => {
      bindContext(document);
      const poll = setInterval(() => {
        const iframe = document.querySelector(
          'iframe[class*="canvas"]'
        ) as HTMLIFrameElement | null;
        const iDoc = iframe?.contentDocument;
        if (iDoc && !cleanupFns.some(fn => fn.toString().includes('iframe'))) {
          bindContext(iDoc);
        }
      }, 500);
      cleanupFns.push(() => clearInterval(poll));
    });

    onBeforeUnmount(() => {
      cleanupFns.forEach(fn => fn());
      cleanupFns = [];
    });

    const handleAction = (actionName: string, isDisabled: boolean) => {
      if (isDisabled) return;
      const action = actions.value.find(a => a.name === actionName);
      const capturedCtx = ctx.value;
      hide();
      if (action?.action) {
        action.action(capturedCtx);
      }
    };

    return () => {
      if (!visible.value) return null;
      const list = actions.value;
      if (!list.length) return null;

      return (
        <div
          class={ns.b()}
          style={{
            position: 'fixed',
            left: `${x.value}px`,
            top: `${y.value}px`,
            zIndex: 99999
          }}
        >
          {list.map(action => {
            if (action.separator) {
              return <div class={ns.e('separator')} key={action.name} />;
            }
            const disabled = props.editor.contextMenu.isDisabled(
              action,
              ctx.value
            );
            const IconComp = action.icon || iconMap[action.name];
            return (
              <div
                key={action.name}
                class={[
                  ns.e('item'),
                  action.danger ? ns.is('danger') : '',
                  disabled ? ns.is('disabled') : ''
                ]}
                onClick={() => handleAction(action.name, disabled)}
              >
                {IconComp ? (
                  <el-icon size={14}>
                    <IconComp />
                  </el-icon>
                ) : null}
                <span>{action.title}</span>
              </div>
            );
          })}
        </div>
      );
    };
  }
});
