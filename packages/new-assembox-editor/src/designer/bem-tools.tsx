/**
 * BemTools 覆盖层（重构：ComponentActionManager 驱动工具栏）
 * 选中高亮框 + hover 高亮框 + 动态工具栏（Tip 提示 + 智能定位）
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
import type {NodeTree} from '../simulator/node-tree';
import type {EditorStore} from '../core/store';
import type {Editor} from '../core/editor';
import type {NodeId} from '../schema/types';
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
    tree: {type: Object as PropType<NodeTree>, required: true},
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

    const computePos = (id: NodeId): BoxPos | null => {
      const el = props.tree.getEl(id);
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
                {props.tree.get(hoverId)?.type}
              </span>
            </div>
          );
        }
      }

      // 选中高亮 + 动态工具栏
      if (activeId) {
        const pos = computePos(activeId);
        if (pos) {
          const node = props.tree.get(activeId);
          const actions = toolbarActions.value;
          const ctx: ComponentActionContext = {
            nodeId: activeId,
            editor: props.editor
          };

          // 智能定位：上方空间不够时工具栏放下方
          const toolbarStyle =
            pos.top < 24
              ? {top: `${pos.height + 2}px`, right: '0px'}
              : {top: '-22px', right: '0px'};

          boxes.push(
            <div class={ns.e('select-box')} style={posStyle(pos)}>
              <span class={[ns.e('box-label'), ns.is('active')]}>
                {node?.type} #{activeId.slice(-4)}
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
                      {IconComp ? <IconComp /> : action.title}
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

function posStyle(pos: BoxPos): Record<string, string> {
  return {
    left: `${pos.left}px`,
    top: `${pos.top}px`,
    width: `${pos.width}px`,
    height: `${pos.height}px`
  };
}
