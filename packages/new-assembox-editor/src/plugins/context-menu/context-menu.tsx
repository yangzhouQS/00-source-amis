/**
 * 右键上下文菜单覆盖层
 * 绑定 iframe doc contextmenu 事件，在 host 文档定位显示菜单
 */
import {defineComponent, PropType, ref, onMounted, onBeforeUnmount} from 'vue';
import {ElButton} from 'element-plus';
import {
  CopyDocument,
  Delete,
  ArrowUp,
  ArrowDown,
  Back as PasteIcon
} from '@element-plus/icons-vue';
import type {Editor} from '../../core/editor';
import {useAssemNamespace} from '../../hooks/use-assem-namespace';

const ns = useAssemNamespace('context-menu');

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
        // iframe 事件：clientX/Y 是 iframe 局部坐标，需加上 iframe 在 host 的偏移
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
      // iframe 模式：轮询绑定 iframe doc（iframe 有独立事件，host 收不到 contextmenu）
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

    const doAction = (action: string) => {
      const id = nodeId.value;
      hide();
      if (!id) return;
      const ed = props.editor;
      switch (action) {
        case 'copy':
          ed.duplicate(id);
          break;
        case 'delete':
          ed.remove(id);
          break;
        case 'up':
          ed.moveUp(id);
          break;
        case 'down':
          ed.moveDown(id);
          break;
      }
    };

    return () => {
      if (!visible.value || !nodeId.value) return null;
      const items = [
        {key: 'copy', label: '复制', icon: CopyDocument},
        {key: 'up', label: '上移', icon: ArrowUp},
        {key: 'down', label: '下移', icon: ArrowDown},
        {key: 'delete', label: '删除', icon: Delete, danger: true}
      ];
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
          {items.map(item => (
            <div
              key={item.key}
              class={[ns.e('item'), item.danger ? ns.is('danger') : '']}
              onClick={() => doAction(item.key)}
            >
              <el-icon size={14}>
                <item.icon />
              </el-icon>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      );
    };
  }
});
