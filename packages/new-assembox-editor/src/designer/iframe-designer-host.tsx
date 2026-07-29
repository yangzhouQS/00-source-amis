/**
 * IframeDesignerHost —— iframe 画布宿主组件
 * 职责：创建 iframe + 绑定 IframeBridge + 渲染 BemTools 覆盖层（兄弟层）
 *
 * 与同 DOM 的 DesignerHost 并存：由插件按 canvasMode 选择挂载哪个。
 * 覆盖层复用 BemTools（读取 store.activeId/hoverId + nodeTree 几何）
 */
import {
  defineComponent,
  PropType,
  ref,
  onMounted,
  onBeforeUnmount,
  watch
} from 'vue';
import {ElEmpty} from 'element-plus';
import type {Editor} from '../core/editor';
import type {IframeBridge} from '../simulator/iframe/iframe-bridge';
import type {ComponentMapping} from '../simulator/iframe/protocol';
import {BemTools} from './bem-tools';
import {CanvasSensor} from './drag/canvas-sensor';
import {useAssemNamespace} from '../hooks/use-assem-namespace';
import './iframe-host.less';

const ns = useAssemNamespace('iframe-host');

export const IframeDesignerHost = defineComponent({
  name: 'IframeDesignerHost',
  props: {
    editor: {type: Object as PropType<Editor>, required: true},
    /** iframe canvas.html 路径 */
    canvasSrc: {type: String, default: '/canvas.html'}
  },
  setup(props) {
    const iframeRef = ref<HTMLIFrameElement | null>(null);
    const ready = ref(false);

    /** 从组件注册表构建 iframe 组件映射（type → globalName） */
    const buildComponentMappings = (): ComponentMapping[] => {
      return props.editor.componentRegistry.allMetas().map(meta => {
        const comp = meta.renderComponent as any;
        const globalName =
          (comp && (comp.name || comp.displayName)) || meta.type;
        return {
          type: meta.type,
          globalName,
          isContainer: !!meta.isContainer
        };
      });
    };

    onMounted(() => {
      const iframe = iframeRef.value;
      const bridge = props.editor.bridge as unknown as IframeBridge;
      if (!iframe || !bridge || !('attach' in bridge)) return;

      bridge.attach(iframe).then(() => {
        // 初始化：发送当前 schema + 组件映射
        bridge.init(
          props.editor.store.schema,
          buildComponentMappings(),
          'design'
        );
        ready.value = true;
        // 注册 iframe 拖拽感应区（自模拟引擎）
        const doc = bridge.getContentDocument?.();
        if (doc && iframe) {
          const sensor = new CanvasSensor(
            {
              id: 'iframe-canvas',
              getContentDocument: () => bridge.getContentDocument(),
              getBounds: () => iframe.getBoundingClientRect(),
              toGlobal: (lx, ly) => {
                const r = iframe.getBoundingClientRect();
                return {x: lx + r.left, y: ly + r.top};
              },
              elementFromPoint: (lx, ly) => {
                const d = bridge.getContentDocument();
                return d ? d.elementFromPoint(lx, ly) : null;
              }
            },
            props.editor.nodeTree,
            props.editor.store
          );
          props.editor.dragon.addSensor(sensor);
        }
      });

      // 组件注册变化 → 更新映射
      watch(
        () => props.editor.componentRegistry.allMetas().length,
        () => {
          if (ready.value)
            bridge.init(
              props.editor.store.schema,
              buildComponentMappings(),
              'design'
            );
        }
      );
    });

    onBeforeUnmount(() => {
      const bridge = props.editor.bridge as unknown as IframeBridge;
      if (bridge && 'dispose' in bridge) bridge.dispose();
    });

    return () => (
      <div class={ns.b()}>
        <div
          class={ns.e('canvas-wrap')}
          ref={(el: any) =>
            (iframeRef.value = el?.querySelector?.('iframe') ?? iframeRef.value)
          }
        >
          <iframe
            ref={iframeRef}
            class={ns.e('canvas')}
            src={props.canvasSrc}
            title="assembox-canvas"
          />
          {!ready.value ? (
            <div class={ns.e('loading')}>
              <ElEmpty description="画布加载中..." imageSize={40} />
            </div>
          ) : null}
          <BemTools
            store={props.editor.store}
            tree={props.editor.nodeTree}
            containerRef={iframeRef.value?.parentElement ?? null}
            iframeEl={iframeRef.value}
          />
        </div>
      </div>
    );
  }
});
