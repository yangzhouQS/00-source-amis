/**
 * DesignerHost 画布宿主组件
 * 聚合：SchemaRenderer + BemTools + DnD 容器
 * 提供 RendererContext，绑定画布点击/悬浮/拖放
 */
import {defineComponent, PropType, ref, onMounted, provide} from 'vue';
import {ElEmpty} from 'element-plus';
import type {Editor} from '../core/editor';
import {
  SchemaRenderer,
  RENDERER_CONTEXT_KEY,
  type RendererContext
} from '../simulator/renderer';
import {BemTools} from './bem-tools';
import {CanvasSensor} from './drag/canvas-sensor';
import {ref as vueRef} from 'vue';
import {useAssemNamespace} from '../hooks/use-assem-namespace';
import './designer-host.less';

const ns = useAssemNamespace('designer');

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
        // 注册拖拽感应区（同 DOM）
        const sensor = new CanvasSensor(
          {
            id: 'inline-canvas',
            getContentDocument: () => document,
            getBounds: () => el.getBoundingClientRect(),
            toGlobal: (lx, ly) => ({x: lx, y: ly}),
            elementFromPoint: (lx, ly) => document.elementFromPoint(lx, ly)
          },
          props.editor.nodeTree,
          props.editor.store
        );
        props.editor.dragon.addSensor(sensor);
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

    return () => {
      const schema = props.editor.store.schemaRef.value;
      const isEmpty = !schema.body || schema.body.length === 0;
      return (
        <div class={ns.b()}>
          <div class={ns.e('canvas')} ref={canvasRef}>
            {isEmpty ? (
              <div class={ns.e('canvas-empty')}>
                <ElEmpty description="从左侧组件库拖入组件开始搭建" />
              </div>
            ) : (
              <SchemaRenderer schema={schema} />
            )}
            <BemTools
              store={props.editor.store}
              tree={props.editor.nodeTree}
              editor={props.editor}
              containerRef={canvasRef.value}
            />
          </div>
        </div>
      );
    };
  }
});
