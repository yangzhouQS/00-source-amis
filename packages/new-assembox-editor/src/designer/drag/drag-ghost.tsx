/**
 * DragGhost —— 拖拽跟随提示（fixed 定位在 host 文档，跟随鼠标）
 * 参考 lowcode drag-ghost + assembox drag-ghost
 */
import {defineComponent, PropType, ref, onMounted, onBeforeUnmount} from 'vue';
import type {Dragon} from './dragon';
import type {DragObject} from './types';
import './drag-ghost.less';

export const DragGhost = defineComponent({
  name: 'DragGhost',
  props: {
    dragon: {type: Object as PropType<Dragon>, required: true}
  },
  setup(props) {
    const x = ref(0);
    const y = ref(0);
    const visible = ref(false);
    const title = ref('');

    let off: (() => void) | null = null;

    onMounted(() => {
      off = props.dragon.on({
        onDragstart: e => {
          const titles = getTitles(e.dragObject);
          title.value = titles;
          x.value = e.globalX;
          y.value = e.globalY;
          visible.value = true;
        },
        onDrag: e => {
          x.value = e.globalX;
          y.value = e.globalY;
        },
        onDragend: () => {
          visible.value = false;
          title.value = '';
        }
      });
    });

    onBeforeUnmount(() => {
      off?.();
    });

    return () => (
      <div
        class="assem-drag-ghost-group"
        style={{
          display: visible.value ? 'flex' : 'none',
          left: `${x.value}px`,
          top: `${y.value}px`
        }}
      >
        <div class="assem-drag-ghost">
          <span class="assem-drag-ghost-title">{title.value || '拖拽中'}</span>
        </div>
      </div>
    );
  }
});

function getTitles(dragObject: DragObject): string {
  if (dragObject.type === 'nodeData' && dragObject.data) {
    return dragObject.data.name || dragObject.data.title || '组件';
  }
  return dragObject.title || '节点';
}
