/**
 * DesignerHost 画布宿主组件
 * 聚合：SchemaRenderer + BemTools + DnD 容器
 * 提供 RendererContext，绑定画布点击/悬浮/拖放
 */
import {
  defineComponent,
  PropType,
  ref,
  onMounted,
  onBeforeUnmount,
  provide,
  watch
} from 'vue';
import {ElEmpty} from 'element-plus';
import type {Editor} from '../core/editor';
import {
  SchemaRenderer,
  RENDERER_CONTEXT_KEY,
  type RendererContext
} from '../simulator/renderer';
import {BemTools} from './bem-tools';
import {ref as vueRef} from 'vue';
import './designer-host.less';

export const DesignerHost = defineComponent({
  name: 'DesignerHost',
  props: {
    editor: {type: Object as PropType<Editor>, required: true}
  },
  setup(props) {
    const canvasRef = ref<HTMLElement | null>(null);
    const draggingRef = vueRef(false);

    // 构建 RendererContext
    const rendererCtx: RendererContext = {
      registry: props.editor.componentRegistry,
      tree: props.editor.nodeTree,
      onClick: (id, e) => props.editor.bridge.onNodeClick(id, e),
      onHover: id => props.editor.bridge.onNodeHover(id),
      dragging: draggingRef
    };
    provide(RENDERER_CONTEXT_KEY, rendererCtx);

    onMounted(() => {
      const el = canvasRef.value;
      if (el) {
        // 挂载 DnD
        props.editor.dnd.attach(el);
        // 点击空白处取消选中
        el.addEventListener('click', (e: MouseEvent) => {
          if (e.target === el) {
            props.editor.select(null);
          }
        });
      }
      // 通知 ready
      props.editor.bridge.renderSchema(props.editor.store.schema);
    });

    onBeforeUnmount(() => {
      props.editor.dnd.destroy();
    });

    // 拖拽态联动
    const origSetDragging = props.editor.dnd['setDragging'].bind(
      props.editor.dnd
    );
    // 通过事件桥接 draggingRef
    watch(
      () => props.editor.store.state.ready,
      () => {
        /* noop */
      }
    );

    return () => {
      const schema = props.editor.store.schemaRef.value;
      const isEmpty = !schema.body || schema.body.length === 0;
      return (
        <div class="assem-designer-host">
          <div class="assem-canvas" ref={canvasRef}>
            {isEmpty ? (
              <div class="assem-canvas-empty">
                <ElEmpty description="从左侧组件库拖入组件开始搭建" />
              </div>
            ) : (
              <SchemaRenderer schema={schema} />
            )}
            <BemTools
              store={props.editor.store}
              tree={props.editor.nodeTree}
              containerRef={canvasRef.value}
            />
          </div>
        </div>
      );
    };
  }
});
