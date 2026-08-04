/**
 * BemTools 覆盖层（重构：ComponentActionManager 驱动工具栏）
 * 选中高亮框 + hover 高亮框 + 动态工具栏（Tip 提示 + 智能定位）
 *
 * DOM 元素通过场景渲染器（renderer.getNodeElement）获取，不再依赖 NodeTree。
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
  ArrowUp,
  ArrowDown,
  CopyDocument,
  Delete
} from '@element-plus/icons-vue';
import type {EditorStore} from '../core/store';
import type {Editor} from '../core/editor';
import type {ComponentActionContext} from './component-action-manager';
import {useAssemNamespace} from '../hooks/use-assem-namespace';
import {Tip} from '../skeleton/widgets/tip';
import './bem-tools.less';

const ns = useAssemNamespace('bem-tools');

/** 内置动作图标映射 */
const iconMap: Record<string, any> = {
  moveUp: ArrowUp,
  moveDown: ArrowDown,
  copy: CopyDocument,
  delete: Delete
};

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
    editor: {type: Object as PropType<Editor>, default: null},
    containerRef: {type: Object as PropType<HTMLElement | null>, default: null},
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

    /** 通过渲染器查询节点 DOM 元素 */
    const computePos = (id: string): BoxPos | null => {
      const el = props.editor?.renderer?.getNodeElement(id) ?? null;
      const container = props.containerRef;
      if (!el || !container) return null;
      const rect = el.getBoundingClientRect();
      const cRect = container.getBoundingClientRect();
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

    /** 取节点 renderType（从 schema 读取） */
    const nodeRenderType = (id: string | null): string => {
      if (!id || !props.editor) return '';
      const node = props.editor.schemaOps.getNodeById(
        props.editor.store.schema,
        id
      );
      return node?.__nodeOptions?.renderType ?? node?.__nodeName ?? '';
    };

    /** 选中节点的可用工具栏动作 */
    const toolbarActions = computed(() => {
      void tick.value;
      const activeId = props.store.state.activeId;
      if (!activeId || !props.editor) return [];
      const ctx: ComponentActionContext = {
        nodeId: activeId,
        editor: props.editor
      };
      return props.editor.componentActions.getAvailableActions(ctx);
    });

    const handleAction = (actionName: string, nodeId: string) => {
      if (!props.editor) return;
      const ctx: ComponentActionContext = {nodeId, editor: props.editor};
      const action = toolbarActions.value.find(a => a.name === actionName);
      if (action && !props.editor.componentActions.isDisabled(action, ctx)) {
        action.action?.(ctx);
        forceUpdate();
      }
    };

    return () => {
      void tick.value;
      if (props.store.state.designMode === 'preview') return null;
      const {activeId, hoverId} = props.store.state;
      const boxes: any[] = [];

      // hover 高亮
      if (hoverId && hoverId !== activeId) {
        const pos = computePos(hoverId);
        if (pos) {
          boxes.push(
            <div class={ns.e('hover-box')} style={posStyle(pos)}>
              <span class={ns.e('box-label')}>
                {nodeRenderType(hoverId)}
              </span>
            </div>
          );
        }
      }

      // 选中高亮 + 动态工具栏
      if (activeId) {
        const pos = computePos(activeId);
        if (pos) {
          const actions = toolbarActions.value;
          const ctx: ComponentActionContext = {
            nodeId: activeId,
            editor: props.editor
          };

          // 工具栏三段智能定位（参考 lowcode border-selecting Toolbar）：
          //   上方空间够 → 放上方；下方空间够 → 放下方；都不够 → 回退到框内顶部
          //   避免满页/顶部组件时 toolbar 被容器裁剪
          const BAR = 22;
          const canvasH = props.containerRef?.clientHeight ?? 0;
          const toolbarStyle =
            pos.top >= BAR
              ? {top: `-${BAR}px`, right: '0px'}
              : pos.top + pos.height + BAR <= canvasH
                ? {top: `${pos.height + 2}px`, right: '0px'}
                : {top: `${Math.max(2, 2 - pos.top)}px`, right: '0px'};

          boxes.push(
            <div class={ns.e('select-box')} style={posStyle(pos)}>
              <span class={[ns.e('box-label'), ns.is('active')]}>
                {nodeRenderType(activeId)} #{activeId.slice(-4)}
              </span>
              <div class={ns.e('toolbar')} style={toolbarStyle}>
                {actions.map(action => {
                  const disabled = props.editor
                    ? props.editor.componentActions.isDisabled(action, ctx)
                    : false;
                  const IconComp = action.icon || iconMap[action.name];

                  const btn = (
                    <button
                      class={[
                        ns.e('toolbar-btn'),
                        action.danger ? ns.is('danger') : '',
                        disabled ? ns.is('disabled') : ''
                      ]}
                      onClick={(e: MouseEvent) => {
                        e.stopPropagation();
                        handleAction(action.name, activeId);
                      }}
                    >
                      <el-icon size={16}>
                        {IconComp ? <IconComp size={16} /> : action.title}
                      </el-icon>
                    </button>
                  );

                  // 有 icon 时用 Tip 包裹显示 title
                  if (IconComp && action.title) {
                    return (
                      <Tip content={action.title} placement="top" delay={400}>
                        {() => btn}
                      </Tip>
                    );
                  }
                  return btn;
                })}
              </div>
            </div>
          );
        }
      }

      return <div class={ns.b()}>{boxes}</div>;
    };
  }
});

/**
 * border 定位样式：用 transform 而非 left/top。
 * 关键：transform 是视觉变换，不参与父级 scrollWidth/scrollHeight 计算，
 * 即使 border 移到容器外也不会撑高滚动容器（参考 lowcode lc-borders）。
 */
function posStyle(pos: BoxPos): Record<string, string> {
  return {
    transform: `translate3d(${pos.left}px, ${pos.top}px, 0)`,
    width: `${pos.width}px`,
    height: `${pos.height}px`,
  };
}
