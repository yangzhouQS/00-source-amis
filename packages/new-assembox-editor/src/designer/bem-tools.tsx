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

          // ── 工具栏智能定位（参考 lowcode border-selecting.tsx 的 Toolbar）──
          // 目标：让工具栏尽量贴近选中框、又不被画布(overflow:auto)裁剪。
          // 思路：分别算「水平对齐」和「垂直对齐」，各自三选一，最后合并成 style。

          // 尺寸常量
          const BAR = 22; // 工具栏高度（与 CSS .toolbar-btn height:20 + 间隙对齐）
          const BTN_W = 22; // 单个动作按钮占地宽度（20px 按钮 + 左右各 1px margin）

          // 画布尺寸（工具栏的定位参照系，pos.left/top 都是相对画布的）
          const canvasH = props.containerRef?.clientHeight ?? 0;

          // 工具栏总宽 = 动作数 × 单按钮宽度
          const toolbarW = actions.length * BTN_W;

          // 选中框右边在画布内的 x 坐标（相对画布左边）
          const boxRightInCanvas = pos.left + pos.width;

          // ① 水平对齐：判断「向左延伸」会不会顶出画布左边
          //    - boxRightInCanvas >= toolbarW：选中框右边到画布左边的距离够放整条工具栏
          //      → right:0，工具栏右端贴选中框右边、向左铺开（视觉最自然）
          //    - 否则：选中框太靠左，向左铺会溢出画布左边被裁剪
          //      → left:0，工具栏左端贴选中框左边、向右铺开
          const hAlign =
            boxRightInCanvas >= toolbarW ? {right: '0px'} : {left: '0px'};

          // ② 垂直对齐：优先放选中框正上方，上方不够再放下方，都不够就塞进框内顶部
          //    a) pos.top >= BAR：选中框顶部到画布顶部还有 ≥22px，工具栏放上方(top:-22)不会被裁
          //    b) 选中框底部 + 22 <= 画布高：下方还有空间，工具栏放下方(top: 选中框高+2)
          //    c) 上下都不够（如选中框几乎占满画布）：塞进选中框内部顶端，至少留 2px 内边距
          const vAlign =
            pos.top >= BAR
              ? {top: `-${BAR}px`}
              : pos.top + pos.height + BAR <= canvasH
                ? {top: `${pos.height + 2}px`}
                : {top: `${Math.max(2, 2 - pos.top)}px`};

          // 合并水平+垂直对齐，作为工具栏的 inline style
          const toolbarStyle = {...hAlign, ...vAlign};

          boxes.push(
            <div class={ns.e('select-box')} style={posStyle(pos)}>
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
