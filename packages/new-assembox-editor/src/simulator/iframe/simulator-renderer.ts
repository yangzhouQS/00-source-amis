/**
 * IframeSimulatorRenderer —— 运行于 iframe 内部的渲染器
 * 实现 SimulatorRendererApi：接收 schema，渲染为 Vue 组件，标记 DOM，回报事件
 *
 * 与 host 侧 SchemaRenderer 区别：
 *  - 运行在 iframe 独立 window，组件从全局注册表解析（globalName），不依赖 host 的 ComponentRegistry
 *  - 通过 hostApi 回报事件（点击/悬浮/实例树），不直接操作 host store
 */
import {
  createApp,
  h,
  defineComponent,
  reactive,
  ref,
  onMounted,
  onBeforeUnmount,
  type App,
  type VNode
} from 'vue';
import type {
  SimulatorRendererApi,
  SimulatorHostApi,
  InitPayload,
  ComponentMapping
} from './protocol';
import {markNode, ATTR_EDITOR_ID} from '../../designer/dom-marking';
import type {PageSchema, PageNode, NodeId} from '../../schema/types';
import * as ops from '../../schema/operations';
import type {NodeInstance} from '../node-tree';

export class IframeSimulatorRenderer implements SimulatorRendererApi {
  readonly isSimulatorRenderer = true as const;

  private app: App | null = null;
  private hostApi: SimulatorHostApi | null = null;
  /** 响应式 schema（驱动渲染） */
  private schema = reactive<PageSchema>({type: 'page', $$id: 'root', body: []});
  /** type → mapping */
  private componentMap = new Map<string, ComponentMapping>();
  /** 节点镜像树：$$id → NodeInstance */
  private instances = new Map<NodeId, NodeInstance>();
  private designMode: 'design' | 'preview' = 'design';
  private dragging = false;
  private mounted = false;

  /** 全局组件解析器：globalName → 组件（由 iframe entry 注入） */
  private resolveComponent: (globalName: string) => any = () => null;

  constructor(hostApi?: SimulatorHostApi) {
    this.hostApi = hostApi ?? null;
  }

  /** 注入 hostApi（entry 在读取到 host 后调用） */
  setHostApi(hostApi: SimulatorHostApi): void {
    this.hostApi = hostApi;
  }

  /** 注入组件解析器（iframe entry 注册完 Element Plus 后调用） */
  setComponentResolver(resolver: (globalName: string) => any): void {
    this.resolveComponent = resolver;
  }

  /** 初始化：设置 schema + 组件映射并挂载 */
  init(payload: InitPayload): void {
    // 同步 schema（深拷贝避免与 host 共享引用）
    const cloned = ops.cloneSchema(payload.schema);
    ops.ensureIds(cloned);
    this.schema.body = cloned.body ?? [];
    this.designMode = payload.designMode ?? 'design';

    // 组件映射
    this.componentMap.clear();
    (payload.components ?? []).forEach(m => this.componentMap.set(m.type, m));

    if (!this.mounted) {
      this.mount();
    } else {
      this.hostApi?.onInstancesUpdated(this.getInstanceTree());
    }
  }

  /** 挂载 Vue app 到 #app */
  private mount(): void {
    const el = document.getElementById('app');
    if (!el) {
      this.hostApi?.onError('canvas.html 缺少 #app 容器');
      return;
    }
    this.app = createApp(
      defineComponent({
        name: 'IframeRendererRoot',
        setup: () => {
          return () =>
            h('div', {class: 'assem-iframe-renderer'}, [
              this.schema.body?.map(node =>
                this.renderNode(node, null, 'body')
              ) ?? []
            ]);
        }
      })
    );
    this.app.mount(el);
    this.mounted = true;
    this.hostApi?.onRendererReady();
  }

  /** 递归渲染节点（与 host SchemaRenderer 同构，但用全局组件解析） */
  private renderNode(
    node: PageNode,
    parentId: NodeId | null,
    region: string
  ): VNode {
    const mapping = this.componentMap.get(node.type);
    const isContainer = mapping?.isContainer ?? Array.isArray(node.body);
    const Comp = mapping?.globalName
      ? this.resolveComponent(mapping.globalName)
      : null;

    return h(
      IframeNodeWrapper,
      {
        key: node.$$id,
        node,
        parentId,
        region,
        isContainer,
        onMountedEl: (el: HTMLElement) =>
          this.registerInstance(el, node, parentId, region, isContainer),
        onUnmount: () => this.unregisterInstance(node.$$id),
        onClick: (e: MouseEvent) => this.handleClick(node.$$id, e),
        onHover: (id: NodeId | null) => this.handleHover(id),
        dragging: () => this.dragging,
        designMode: () => this.designMode
      },
      () => this.renderInner(node, Comp)
    );
  }

  /** 渲染节点内部内容（实际组件 or 子节点） */
  private renderInner(node: PageNode, Comp: any): VNode[] {
    if (Comp) {
      const childNodes =
        Array.isArray(node.body) && node.body.length
          ? node.body!.map(child => this.renderNode(child, node.$$id, 'body'))
          : undefined;
      // 文本型组件（如按钮）：用 props.text 作为默认插槽内容
      const textContent = node.props?.text ?? node.props?.label;
      const slots = childNodes
        ? {default: () => childNodes}
        : textContent
        ? {default: () => textContent as any}
        : undefined;
      return [h(Comp, {...node.props}, slots)];
    }
    // 无组件：纯容器 or 文本
    if (Array.isArray(node.body) && node.body.length) {
      return node.body.map(child => this.renderNode(child, node.$$id, 'body'));
    }
    return [
      node.props?.text || node.props?.label || node.label || `[${node.type}]`
    ];
  }

  private registerInstance(
    el: HTMLElement,
    node: PageNode,
    parentId: NodeId | null,
    region: string,
    isContainer: boolean
  ): void {
    markNode(el, node.$$id, isContainer);
    const inst: NodeInstance = {
      $$id: node.$$id,
      type: node.type,
      parentId,
      parentRegion: region,
      node,
      meta: undefined,
      regions: isContainer ? [{key: 'body', label: '子节点'}] : [],
      el,
      isContainer,
      componentInstance: null
    };
    this.instances.set(node.$$id, inst);
    this.hostApi?.onInstancesUpdated(this.getInstanceTree());
  }

  private unregisterInstance(nodeId: NodeId): void {
    this.instances.delete(nodeId);
  }

  private handleClick(nodeId: NodeId, e: MouseEvent): void {
    if (this.dragging) return;
    this.hostApi?.onNodeClick(nodeId, e);
  }

  private handleHover(nodeId: NodeId | null): void {
    if (this.dragging) return;
    this.hostApi?.onNodeHover(nodeId);
  }

  // ══════════ SimulatorRendererApi 实现 ══════════

  renderSchema(schema: PageSchema): void {
    const cloned = ops.cloneSchema(schema);
    ops.ensureIds(cloned);
    this.schema.body = cloned.body ?? [];
    this.instances.clear();
  }

  updateNode(nodeId: NodeId, patch: Partial<PageNode>): void {
    const node = ops.getNodeById(this.schema, nodeId);
    if (!node) return;
    if (patch.props) {
      node.props = {...(node.props || {}), ...patch.props};
    }
    if (patch.style) node.style = {...(node.style || {}), ...patch.style};
    if (patch.onEvent)
      node.onEvent = {...(node.onEvent || {}), ...patch.onEvent};
    if (patch.label !== undefined) node.label = patch.label;
    // Vue 响应式驱动重渲染
  }

  insertNode(
    parentId: NodeId,
    region: string,
    node: PageNode,
    index?: number
  ): void {
    const created = ops.cloneSchema(node);
    ops.ensureIds(created);
    ops.insertNode(this.schema as PageSchema, parentId, region, created, index);
  }

  moveNode(
    nodeId: NodeId,
    toParentId: NodeId,
    region: string,
    index?: number
  ): void {
    ops.moveNode(this.schema as PageSchema, nodeId, toParentId, region, index);
  }

  removeNode(nodeId: NodeId): void {
    ops.removeNode(this.schema as PageSchema, nodeId);
  }

  setDraggingState(active: boolean): void {
    this.dragging = active;
    // 仅调整光标与选区，不能设置 pointer-events:none（否则会阻断 HTML5 拖放事件）
    document.body.style.cursor = active ? 'copy' : '';
    document.body.style.userSelect = active ? 'none' : '';
  }

  setNativeSelection(enable: boolean): void {
    document.body.style.userSelect = enable ? '' : 'none';
  }

  setDesignMode(mode: 'design' | 'preview'): void {
    this.designMode = mode;
  }

  setComponents(components: ComponentMapping[]): void {
    this.componentMap.clear();
    components.forEach(m => this.componentMap.set(m.type, m));
  }

  rerender(): void {
    // 触发响应式刷新：重新赋值 body 数组
    const body = this.schema.body;
    this.schema.body = [...(body ?? [])];
  }

  getRect(nodeId: NodeId): DOMRect | null {
    const inst = this.instances.get(nodeId);
    return inst?.el ? inst.el.getBoundingClientRect() : null;
  }

  getInstanceTree(): NodeInstance[] {
    return Array.from(this.instances.values());
  }

  dispose(): void {
    this.app?.unmount();
    this.app = null;
    this.mounted = false;
    this.instances.clear();
    this.hostApi = null;
  }
}

/**
 * 节点包装组件：标记 DOM、捕获事件、回报
 * 与 host 侧 NodeRenderer 同构
 * 回调以显式 props 声明（避免 on* 前缀被当作事件透传）
 */
const IframeNodeWrapper = defineComponent({
  name: 'IframeNodeWrapper',
  props: {
    node: {type: Object, required: true},
    parentId: {type: [String, Object] as any, default: null},
    region: {type: String, default: 'body'},
    isContainer: {type: Boolean, default: false},
    dragging: {type: Function, default: () => false},
    designMode: {type: Function, default: () => 'design'},
    onMountedEl: {type: Function, default: null},
    onUnmount: {type: Function, default: null},
    onClick: {type: Function, default: null},
    onHover: {type: Function, default: null}
  },
  setup(props, {slots}) {
    const wrapperRef = ref<HTMLElement | null>(null);

    onMounted(() => {
      if (wrapperRef.value) {
        (props.onMountedEl as any)?.(wrapperRef.value);
      }
    });
    onBeforeUnmount(() => {
      (props.onUnmount as any)?.();
    });

    return () => {
      const isDesign = (props.designMode as any)() === 'design';
      const dragging = (props.dragging as any)();
      return h(
        'div',
        {
          ref: wrapperRef,
          class: ['assem-iframe-node-wrapper'],
          style: {...(props.node.style || {})},
          onClick: (e: MouseEvent) => {
            if (!isDesign || dragging) return;
            (props.onClick as any)?.(e);
            e.stopPropagation();
          },
          onMouseover: (e: MouseEvent) => {
            if (!isDesign || dragging) return;
            (props.onHover as any)?.(props.node.$$id);
            e.stopPropagation();
          },
          onMouseleave: () => {
            if (!isDesign || dragging) return;
            (props.onHover as any)?.(null);
          }
        },
        slots.default?.()
      );
    };
  }
});
