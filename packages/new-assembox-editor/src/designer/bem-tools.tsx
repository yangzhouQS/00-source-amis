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
import './bem-tools.less';

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
    containerRef: {type: Object as PropType<HTMLElement | null>, default: null}
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
      return {
        left: rect.left - cRect.left + container.scrollLeft,
        top: rect.top - cRect.top + container.scrollTop,
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
      const {activeId, hoverId} = props.store.state;
      const container = props.containerRef;

      const boxes: any[] = [];

      // hover 高亮
      if (hoverId && hoverId !== activeId) {
        const pos = computePos(hoverId);
        if (pos) {
          boxes.push(
            <div class="assem-hover-box" style={posStyle(pos)}>
              <span class="assem-box-label">
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
            <div class="assem-select-box" style={posStyle(pos)}>
              <span class="assem-box-label assem-box-label-active">
                {node?.type} #{activeId.slice(-4)}
              </span>
              <div class="assem-toolbar">
                <button
                  class="assem-toolbar-btn"
                  title="上移"
                  onClick={() => doAction('up', activeId)}
                >
                  <ElIcon>
                    <ArrowUp />
                  </ElIcon>
                </button>
                <button
                  class="assem-toolbar-btn"
                  title="下移"
                  onClick={() => doAction('down', activeId)}
                >
                  <ElIcon>
                    <ArrowDown />
                  </ElIcon>
                </button>
                <button
                  class="assem-toolbar-btn"
                  title="复制"
                  onClick={() => doAction('copy', activeId)}
                >
                  <ElIcon>
                    <CopyDocument />
                  </ElIcon>
                </button>
                <button
                  class="assem-toolbar-btn assem-toolbar-btn-danger"
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
      return <div class="assem-bem-tools">{boxes}</div>;
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
