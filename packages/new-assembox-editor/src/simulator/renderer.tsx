/**
 * 同 DOM 渲染器（SchemaRenderer）
 * - 递归渲染 schema 为 Vue 组件
 * - 用 data-* 属性标记 DOM（取代旧版 Symbol 属性）
 * - 渲染期构建节点镜像树（取代旧版独立渲染包 + 直接引用）
 * - 处理点击/悬浮 → bridge 回调
 */
import {
  defineComponent,
  h,
  onMounted,
  onBeforeUnmount,
  inject,
  ref,
  type VNode
} from 'vue';
import type {PageNode, NodeId, PageSchema} from '../schema/types';
import {markNode, markRegion, ATTR_EDITOR_ID} from '../designer/dom-marking';
import type {NodeTree, NodeInstance} from './node-tree';
import type {ComponentRegistry} from '../registry/component-registry';
import {getNodeLabel} from '../schema/operations';

/** 渲染器上下文（通过 provide/inject 注入） */
export interface RendererContext {
  registry: ComponentRegistry;
  tree: NodeTree;
  onClick: (nodeId: NodeId | null, e: MouseEvent) => void;
  onHover: (nodeId: NodeId | null) => void;
  dragging: {value: boolean};
}

export const RENDERER_CONTEXT_KEY = Symbol('assem-renderer-context');

/** 注入渲染器上下文 */
function useRendererCtx(): RendererContext {
  const ctx = inject<RendererContext>(RENDERER_CONTEXT_KEY);
  if (!ctx)
    throw new Error(
      '[Renderer] 缺少 RendererContext，请确保被 SchemaRenderer 包裹'
    );
  return ctx;
}

/** 渲染节点内部内容（提取为独立函数避免递归类型推断问题） */
function renderNodeInner(
  node: PageNode,
  ctx: RendererContext
): VNode | VNode[] | string {
  const meta = ctx.registry.get(node.type);
  const renderComponent = meta?.renderComponent;

  const eventHandlers: Record<string, any> = {};
  if (node.onEvent?.click) {
    eventHandlers.onClick = (e: MouseEvent) => {
      e.stopPropagation();
    };
  }

  if (renderComponent) {
    const slots: Record<string, () => VNode[]> = {};
    if (Array.isArray(node.body) && node.body.length) {
      slots.default = () =>
        node.body!.map(child =>
          h(NodeRenderer, {
            key: child.$$id,
            node: child,
            parentId: node.$$id,
            region: 'body'
          })
        );
    }
    return h(renderComponent, {...node.props, ...eventHandlers}, slots);
  } else if (Array.isArray(node.body) && node.body.length) {
    return node.body.map(child =>
      h(NodeRenderer, {
        key: child.$$id,
        node: child,
        parentId: node.$$id,
        region: 'body'
      })
    );
  }
  return node.props?.label || node.label || `[${node.type}]`;
}

/**
 * 节点渲染器：渲染单个 schema 节点
 * 用一个 wrapper div 标记 data-editor-id，捕获 DOM 与事件
 */
export const NodeRenderer = defineComponent({
  name: 'NodeRenderer',
  props: {
    node: {type: Object as () => PageNode, required: true},
    parentId: {type: String as unknown as () => NodeId | null, default: null},
    region: {type: String, default: 'body'}
  },
  setup(props) {
    const ctx = useRendererCtx();
    const wrapperRef = ref<HTMLElement | null>(null);

    function registerNode(el: HTMLElement | null) {
      if (!el) return;
      const meta = ctx.registry.get(props.node.type);
      const isContainer = !!meta?.isContainer || Array.isArray(props.node.body);
      markNode(el, props.node.$$id, isContainer);
      const inst: NodeInstance = {
        $$id: props.node.$$id,
        type: props.node.type,
        parentId: props.parentId,
        parentRegion: props.region,
        node: props.node,
        meta,
        regions:
          meta?.regions ??
          (isContainer ? [{key: 'body', label: '子节点'}] : []),
        el,
        isContainer,
        componentInstance: null
      };
      ctx.tree.register(inst);
    }

    onMounted(() => {
      const el = wrapperRef.value;
      registerNode(el);
      if (el) {
        const meta = ctx.registry.get(props.node.type);
        if (meta?.isContainer || Array.isArray(props.node.body)) {
          const bodyEl = el.querySelector(`[${ATTR_EDITOR_ID}]`)?.parentElement;
          if (bodyEl) markRegion(bodyEl, 'body', props.node.$$id);
        }
      }
    });

    onBeforeUnmount(() => {
      ctx.tree.unregister(props.node.$$id);
    });

    return (): VNode => {
      const {node} = props;
      const inner = renderNodeInner(node, ctx);
      return h(
        'div',
        {
          ref: wrapperRef,
          class: ['assem-node-wrapper'],
          style: {...(node.style || {})},
          onClick: (e: MouseEvent) => {
            if (ctx.dragging.value) return;
            ctx.onClick(props.node.$$id, e);
            e.stopPropagation();
          },
          onMouseover: (e: MouseEvent) => {
            if (ctx.dragging.value) return;
            ctx.onHover(props.node.$$id);
            e.stopPropagation();
          },
          onMouseleave: () => {
            if (ctx.dragging.value) return;
            ctx.onHover(null);
          }
        },
        [inner]
      );
    };
  }
});

/**
 * SchemaRenderer：渲染整棵 schema
 */
export const SchemaRenderer = defineComponent({
  name: 'SchemaRenderer',
  props: {
    schema: {type: Object as () => PageSchema, required: true}
  },
  setup(props) {
    return (): VNode => {
      return h(
        'div',
        {class: 'assem-schema-renderer'},
        props.schema.body?.map(node =>
          h(NodeRenderer, {
            key: node.$$id,
            node,
            parentId: props.schema.$$id,
            region: 'body'
          })
        ) ?? []
      );
    };
  }
});

/** 生成节点显示标签（大纲等用，导出复用） */
export {getNodeLabel};
