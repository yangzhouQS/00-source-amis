/**
 * DesignerHost 画布宿主组件
 * 聚合：IRenderer + BemTools + DnD 容器
 * inline 模式：renderer 挂载到 div 容器（同 DOM）
 * iframe 模式：renderer 创建 iframe 到容器内，BemTools 用 iframe rect 偏移，
 *             拖拽坐标按 iframe 局部坐标系换算（mouse 事件源于 iframe 文档）
 */
import {defineComponent, PropType, ref, onMounted, onBeforeUnmount, computed} from 'vue';
import {ElEmpty} from 'element-plus';
import type {Editor} from '../core/editor';
import {BemTools} from './bem-tools';
import {CanvasSensor} from './drag/canvas-sensor';
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
    const iframeRef = ref<HTMLIFrameElement | null>(null);

    const isIframe = computed(
      () => (props.editor.store.state as any).canvasMode === 'iframe'
    );

    onMounted(async () => {
      const el = canvasRef.value;
      const renderer = props.editor.renderer;
      if (!el || !renderer) return;

      // 1. 挂载渲染器（iframe 模式下 PcIframeRenderer 会创建 iframe 到 el 内）
      await renderer.mount(el, props.editor.store.schema, {isEditor: true});

      // 2. iframe 模式下获取 renderer 创建的 iframe（元素已立即入 DOM，contentDocument 异步 load）
      if (isIframe.value) {
        iframeRef.value = el.querySelector('iframe') as HTMLIFrameElement | null;
      }

      // 3. 注册拖拽感应区
      //    inline/iframe 坐标系不同：
      //    - inline：mouse 事件源于 host 文档，clientX/Y 即 host 视口坐标
      //    - iframe：mouse 事件源于 iframe 文档，clientX/Y 为 iframe 局部坐标，
      //              需叠加 iframe 偏移转 host 视口坐标；元素查询走 iframe contentDocument
      const sensor = new CanvasSensor(
        {
          id: isIframe.value ? 'pc-iframe' : 'pc-canvas',
          getContentDocument: () =>
            (iframeRef.value?.contentDocument as Document | null) ?? document,
          getBounds: () => el.getBoundingClientRect(),
          toGlobal: isIframe.value
            ? (lx, ly) => {
                const r =
                  iframeRef.value?.getBoundingClientRect() ??
                  el.getBoundingClientRect();
                return {x: lx + r.left, y: ly + r.top};
              }
            : (lx, ly) => ({x: lx, y: ly}),
          elementFromPoint: isIframe.value
            ? (lx, ly) => {
                const doc = iframeRef.value?.contentDocument;
                return doc ? doc.elementFromPoint(lx, ly) : null;
              }
            : (lx, ly) => document.elementFromPoint(lx, ly)
        },
        props.editor
      );
      props.editor.dragon.addSensor(sensor);

      // 4. 点击空白处取消选中
      if (isIframe.value) {
        // iframe 内点击已由 IframeCanvasRenderer 经 onClick 回报；
        // 此处为 contentDocument body/html 空白点击兜底（惰性等待 load）
        const bindEmpty = () => {
          const cdoc = iframeRef.value?.contentDocument;
          if (!cdoc) {
            iframeRef.value?.addEventListener('load', bindEmpty, {once: true});
            return;
          }
          cdoc.addEventListener('click', (e: MouseEvent) => {
            const t = e.target as HTMLElement;
            if (t === cdoc.body || t === cdoc.documentElement) {
              props.editor.select(null);
            }
          });
        };
        bindEmpty();
      } else {
        el.addEventListener('click', (e: MouseEvent) => {
          if (e.target === el) {
            props.editor.select(null);
          }
        });
      }
    });

    onBeforeUnmount(() => {
      props.editor.renderer?.dispose();
    });

    return () => {
      const schema = props.editor.store.schemaRef.value;
      const isEmpty = !schema;
      return (
        <div class={ns.b()}>
          <div class={ns.e('canvas')} ref={canvasRef}>
            {isEmpty ? (
              <div class={ns.e('canvas-empty')}>
                <ElEmpty description="从左侧组件库拖入组件开始搭建" />
              </div>
            ) : null}
            <BemTools
              store={props.editor.store}
              editor={props.editor}
              containerRef={canvasRef.value}
              iframeEl={iframeRef.value}
            />
          </div>
        </div>
      );
    };
  }
});
