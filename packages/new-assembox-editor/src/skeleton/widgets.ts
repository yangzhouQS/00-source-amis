/**
 * Widget / Panel / PanelDock / Dock 实现
 * 响应式驱动渲染；Panel 标题栏支持 fix/float 切换 + close
 */
import {
  reactive,
  ref,
  h,
  shallowReactive,
  shallowRef,
  inject,
  defineComponent,
  type PropType,
  type UnwrapNestedRefs
} from 'vue';
import type {WidgetConfig, WidgetLike, WidgetType, AreaName} from './types';
import type {Skeleton} from './skeleton';
import {useAssemNamespace} from '../hooks/use-assem-namespace';
import {ErrorBoundary} from './error-boundary';

// BEM 命名空间实例（模块级，骨架层共用）
const widgetNs = useAssemNamespace('widget');
const panelNs = useAssemNamespace('panel');
const dockNs = useAssemNamespace('dock');

interface WidgetState {
  active: boolean;
  disabled: boolean;
  visible: boolean;
  inited: boolean;
}

/** 基础 Widget */
export class Widget implements WidgetLike {
  readonly name: string;
  readonly type: WidgetType;
  readonly area: AreaName;
  readonly config: WidgetConfig;
  readonly state: UnwrapNestedRefs<WidgetState>;
  /** 所属区域容器引用 */
  parent: WidgetContainer | null = null;
  /** 骨架实例引用（面板操作行用，skeleton.add 时注入） */
  skeleton: Skeleton | null = null;

  constructor(config: WidgetConfig) {
    this.name = config.name;
    this.type = config.type;
    this.area = config.area ?? 'leftArea';
    this.config = config;
    this.state = reactive<WidgetState>({
      active: false,
      disabled: false,
      visible: true,
      inited: false
    });
  }

  get active(): boolean {
    return this.state.active;
  }
  get disabled(): boolean {
    return this.state.disabled;
  }
  get visible(): boolean {
    return this.state.visible;
  }
  get inited(): boolean {
    return this.state.inited;
  }

  get content(): any {
    if (!this.config.content) return null;
    if (this.state.disabled) {
      return h(
        'div',
        {
          class: [widgetNs.b(), widgetNs.is('disabled')],
          style: 'opacity:0.4;pointer-events:none'
        },
        [this.renderContent()]
      );
    }
    return this.renderContent();
  }

  protected renderContent(): any {
    const {content, contentProps = {}} = this.config;
    if (!content) return null;
    return h(ErrorBoundary, {
      content,
      contentProps: {...contentProps, widget: this}
    });
  }

  setActive(flag: boolean): void {
    this.state.active = flag;
    if (flag && !this.state.inited) this.state.inited = true;
  }
  toggle(): void {
    this.setActive(!this.state.active);
  }
  hide(): void {
    this.setActive(false);
  }
  show(): void {
    this.setActive(true);
  }
  disable(): void {
    this.state.disabled = true;
  }
  enable(): void {
    this.state.disabled = false;
  }
}

/** 面板操作行（fix/float 切换 + close） */
const PanelOps = (panel: Panel, skeleton: Skeleton | null) => {
  const cfg = panel.config;
  const floatable = cfg.panelProps?.floatable ?? true;
  const isInFloat = panel.parent?.areaName === 'leftFloatArea';
  const ops: any[] = [];
  if (floatable) {
    ops.push(
      h(
        'button',
        {
          class: panelNs.e('op'),
          title: isInFloat ? '固定' : '浮动',
          onClick: (e: Event) => {
            e.stopPropagation();
            skeleton?.toggleFloatStatus(panel);
          }
        },
        isInFloat ? '★' : '☆'
      )
    );
  }
  ops.push(
    h(
      'button',
      {
        class: panelNs.e('op'),
        title: '关闭',
        onClick: (e: Event) => {
          e.stopPropagation();
          const areaName = panel.parent?.areaName ?? 'leftFixedArea';
          skeleton?.getArea(areaName)?.container.unactive(panel);
        }
      },
      '×'
    )
  );
  return h('div', {class: panelNs.e('ops')}, ops);
};

/** 面板外壳（标题栏 + 操作行 + 内容）函数式组件 */
const PanelView = defineComponent({
  props: {panel: {type: Object as PropType<Panel>, required: true}},
  setup(props) {
    const skeleton = inject<Skeleton | null>('assem-skeleton', null);
    return () => {
      const panel = props.panel;
      const cfg = panel.config;
      const title = cfg.props?.title;
      const hideTitleBar = cfg.panelProps?.hideTitleBar;
      return h('div', {class: panelNs.b()}, [
        title && !hideTitleBar
          ? h('div', {class: panelNs.e('header')}, [
              h('span', {class: panelNs.e('title')}, title),
              PanelOps(panel, skeleton)
            ])
          : null,
        h('div', {class: panelNs.e('body')}, [panel.renderBodyContent()])
      ]);
    };
  }
});

/** 面板（带标题，激活时渲染内容） */
export class Panel extends Widget {
  constructor(config: WidgetConfig) {
    super(config);
    this.state.active = false;
  }

  get content(): any {
    const {disabledPanelCache} = this.config;
    if (!this.state.active && disabledPanelCache) {
      return null;
    }
    if (!this.state.inited && !this.state.active) {
      return null;
    }
    return h(PanelView, {panel: this});
  }

  /** 面板体内实际内容（供 PanelView 调用） */
  renderBodyContent(): any {
    const {content, contentProps = {}} = this.config;
    if (!content) return null;
    return h(ErrorBoundary, {
      content,
      contentProps: {...contentProps, panel: this}
    });
  }

  protected renderContent(): any {
    return this.content;
  }
}

/** Dock 图标渲染（PanelDock/Dock 共用） */
function renderDockIcon(config: WidgetConfig): any {
  const icon = config.props?.icon;
  const title = config.props?.title;
  return h('div', {class: dockNs.e('inner')}, [
    icon ? h(icon) : null,
    title ? h('span', {class: dockNs.e('label')}, title) : null
  ]);
}

/** PanelDock（左侧图标按钮 + 联动 Panel） */
export class PanelDock extends Widget {
  private _panel: Panel | null = null;
  /** 联动面板名（延迟查找用） */
  readonly panelName: string;

  constructor(config: WidgetConfig, onCreatePanel: (dock: PanelDock) => Panel) {
    super(config);
    this.panelName = config.panelProps?.panelName ?? `panel_${config.name}`;
    this._panel = onCreatePanel(this);
  }

  /** 联动面板（延迟查找：_panel 优先，否则按 panelName 从 skeleton 查找） */
  get panel(): Panel | null {
    return this._panel ?? this.skeleton?.getPanel(this.panelName) ?? null;
  }

  set panel(p: Panel | null) {
    this._panel = p;
  }

  get content(): any {
    if (this.state.disabled) {
      return h(
        'div',
        {
          class: [dockNs.b(), dockNs.is('disabled')],
          title: this.config.props?.description
        },
        [renderDockIcon(this.config)]
      );
    }
    return h(
      'div',
      {
        class: [dockNs.b(), this.panel?.active ? dockNs.m('active') : ''],
        title: this.config.props?.description,
        onClick: () => this.togglePanel()
      },
      [renderDockIcon(this.config)]
    );
  }

  togglePanel(): void {
    const p = this.panel;
    if (!p) return;
    const areaName = p.parent?.areaName ?? 'leftFixedArea';
    const container = p.skeleton?.getArea(areaName)?.container ?? p.parent;
    if (!container) {
      p.toggle();
      return;
    }
    // 通过容器 active/unactive 实现互斥 + current 更新
    if (p.active) container.unactive(p);
    else container.active(p);
  }
}

/** Dock（独立图标按钮，onClick/href，无联动面板） */
export class Dock extends Widget {
  get content(): any {
    const onActivate = () => {
      const {onClick, href} = this.config.props ?? {};
      if (onClick) onClick();
      else if (href) window.open(href, '_blank');
    };
    if (this.state.disabled) {
      return h(
        'div',
        {
          class: [dockNs.b(), dockNs.is('disabled')],
          title: this.config.props?.description
        },
        [renderDockIcon(this.config)]
      );
    }
    return h(
      'div',
      {
        class: dockNs.b(),
        title: this.config.props?.description,
        onClick: onActivate
      },
      [renderDockIcon(this.config)]
    );
  }
}

/** Widget 容器（管理一个区域内的 widgets） */
export class WidgetContainer {
  items = shallowReactive<Widget[]>([]);
  maps = new Map<string, Widget>();
  /** 当前激活的 widget（互斥区域用） */
  current = shallowRef<Widget | null>(null);
  exclusive: boolean;
  /** 所属区域名（面板操作行判断 fixed/float 用） */
  areaName: AreaName;
  /** 所属骨架实例（add 时注入给 widget，保证引用正确） */
  skeleton: Skeleton | null;

  constructor(
    areaName: AreaName,
    exclusive = false,
    skeleton: Skeleton | null = null
  ) {
    this.areaName = areaName;
    this.exclusive = exclusive;
    this.skeleton = skeleton;
  }

  /** 取 widget 的排序 index（越小越靠前） */
  private static idx(w: Widget): number {
    return w.config.props?.index ?? w.config.index ?? Infinity;
  }

  add(item: Widget): Widget {
    if (this.maps.has(item.name)) {
      const idx = this.items.findIndex(w => w.name === item.name);
      if (idx >= 0) this.items[idx] = item;
      else this.items.push(item);
    } else {
      // 按 index 升序插入
      const itemIdx = WidgetContainer.idx(item);
      let insertAt = this.items.length;
      for (let i = 0; i < this.items.length; i++) {
        if (itemIdx < WidgetContainer.idx(this.items[i])) {
          insertAt = i;
          break;
        }
      }
      this.items.splice(insertAt, 0, item);
    }
    this.maps.set(item.name, item);
    item.parent = this;
    item.skeleton = this.skeleton ?? item.skeleton;
    return item;
  }

  remove(nameOrItem: string | Widget): Widget | undefined {
    const name = typeof nameOrItem === 'string' ? nameOrItem : nameOrItem.name;
    const item = this.maps.get(name);
    if (!item) return undefined;
    const idx = this.items.indexOf(item);
    if (idx >= 0) this.items.splice(idx, 1);
    this.maps.delete(name);
    if (this.current.value === item) this.current.value = null;
    return item;
  }

  get(name: string): Widget | undefined {
    return this.maps.get(name);
  }

  active(item: Widget | string): void {
    const target = typeof item === 'string' ? this.maps.get(item) : item;
    if (!target) return;
    if (this.exclusive && this.current.value && this.current.value !== target) {
      this.current.value.setActive(false);
    }
    target.setActive(true);
    this.current.value = target;
  }

  unactive(item: Widget | string): void {
    const target = typeof item === 'string' ? this.maps.get(item) : item;
    if (!target) return;
    target.setActive(false);
    if (this.current.value === target) this.current.value = null;
  }

  /** 获取当前激活 widget（封装 ref.value 读取，确保 Vue 追踪依赖） */
  getCurrent(): Widget | null {
    return this.current.value;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }
}
