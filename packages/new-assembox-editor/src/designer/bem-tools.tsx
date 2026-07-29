/**
 * BemTools 覆盖层
 * 借鉴 amis-editor 的兄弟层方案：独立于渲染 DOM，按 getBoundingClientRect 定位
 * 包含：选中高亮框、悬浮高亮框、节点工具栏（上移/下移/复制/删除）
 */
import {defineComponent, PropType, ref, onMounted, onBeforeUnmount} from 'vue';
import {ElIcon} from 'element-plus';
import {
  ArrowUp,
  ArrowDown,
  CopyDocument,
  Delete
} from '@element-plus/icons-vue';
import type {NodeTree} from '../simulator/node-tree';
import type {EditorStore} from '../core/store';
import type {NodeId} from '../schema/types';
import {useAssemNamespace} from '../hooks/use-assem-namespace';
import './bem-tools.less';

const ns = useAssemNamespace('bem-tools');

interface BoxPos {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const BemTools = defineComponent({
  name: 'BemTools',
  props: {
    store: {type: Object as PropType<EditorStore>, required: true},
    tree: {type: Object as PropType<NodeTree>, required: true},
    /** 画布容器 ref（坐标相对它） */
    containerRef: {type: Object as PropType<HTMLElement | null>, default: null},
    /** iframe 元素（iframe 画布模式时传入，用于坐标偏移换算） */
    iframeEl: {
      type: Object as PropType<HTMLIFrameElement | null>,
      default: null
    }
  },
  setup(props) {
    const tick = ref(0);
    let ro: ResizeObserver | null = null;
    let rafId = 0;

    const forceUpdate = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        tick.value++;
      });
    };

    onMounted(() => {
      // 监听容器与节点尺寸变化
      if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => forceUpdate());
        if (props.containerRef) ro.observe(props.containerRef);
      }
      window.addEventListener('resize', forceUpdate);
      window.addEventListener('scroll', forceUpdate, true);
    });

    onBeforeUnmount(() => {
      ro?.disconnect();
      window.removeEventListener('resize', forceUpdate);
      window.removeEventListener('scroll', forceUpdate, true);
      cancelAnimationFrame(rafId);
    });

    /** 计算节点相对容器的位置 */
    const computePos = (id: NodeId): BoxPos | null => {
      const el = props.tree.getEl(id);
      const container = props.containerRef;
      if (!el || !container) return null;
      const rect = el.getBoundingClientRect();
      const cRect = container.getBoundingClientRect();
      // iframe 模式：el 位于 iframe 内，rect 相对 iframe viewport，需叠加 iframe 元素在 host 视口的偏移
      // 注：未处理 iframe transform: scale（当前 canvas 为 1:1），缩放场景需额外补偿
      let left = rect.left;
      let top = rect.top;
      const iframe = props.iframeEl;
      if (iframe) {
        const iRect = iframe.getBoundingClientRect();
        left += iRect.left;
        top += iRect.top;
      }
      return {
        left: left - cRect.left + container.scrollLeft,
        top: top - cRect.top + container.scrollTop,
        width: rect.width,
        height: rect.height
      };
    };

    /** 触发工具栏动作 */
    const doAction = (action: string, id: NodeId) => {
      const editor = (props.store as any).__editor;
      if (!editor) return;
      switch (action) {
        case 'up':
          editor.moveUp(id);
          break;
        case 'down':
          editor.moveDown(id);
          break;
        case 'copy':
          editor.duplicate(id);
          break;
        case 'delete':
          editor.remove(id);
          break;
      }
      forceUpdate();
    };

    return () => {
      void tick.value; // 依赖
      // 预览模式隐藏覆盖层
      if (props.store.state.designMode === 'preview') return null;
      const {activeId, hoverId} = props.store.state;
      const container = props.containerRef;

      const boxes: any[] = [];

      // hover 高亮
      if (hoverId && hoverId !== activeId) {
        const pos = computePos(hoverId);
        if (pos) {
          boxes.push(
            <div class={ns.e('hover-box')} style={posStyle(pos)}>
              <span class={ns.e('box-label')}>
                {props.tree.get(hoverId)?.type}
              </span>
            </div>
          );
        }
      }

      // 选中高亮 + 工具栏
      if (activeId) {
        const pos = computePos(activeId);
        if (pos) {
          const node = props.tree.get(activeId);
          boxes.push(
            <div class={ns.e('select-box')} style={posStyle(pos)}>
              <span class={[ns.e('box-label'), ns.is('active')]}>
                {node?.type} #{activeId.slice(-4)}
              </span>
              <div class={ns.e('toolbar')}>
                <button
                  class={ns.e('toolbar-btn')}
                  title="上移"
                  onClick={() => doAction('up', activeId)}
                >
                  <ElIcon>
                    <ArrowUp />
                  </ElIcon>
                </button>
                <button
                  class={ns.e('toolbar-btn')}
                  title="下移"
                  onClick={() => doAction('down', activeId)}
                >
                  <ElIcon>
                    <ArrowDown />
                  </ElIcon>
                </button>
                <button
                  class={ns.e('toolbar-btn')}
                  title="复制"
                  onClick={() => doAction('copy', activeId)}
                >
                  <ElIcon>
                    <CopyDocument />
                  </ElIcon>
                </button>
                <button
                  class={[ns.e('toolbar-btn'), ns.is('danger')]}
                  title="删除"
                  onClick={() => doAction('delete', activeId)}
                >
                  <ElIcon>
                    <Delete />
                  </ElIcon>
                </button>
              </div>
            </div>
          );
        }
      }

      void container;
      return <div class={ns.b()}>{boxes}</div>;
    };
  }
});

function posStyle(pos: BoxPos): Record<string, string> {
  return {
    left: `${pos.left}px`,
    top: `${pos.top}px`,
    width: `${pos.width}px`,
    height: `${pos.height}px`
  };
}
