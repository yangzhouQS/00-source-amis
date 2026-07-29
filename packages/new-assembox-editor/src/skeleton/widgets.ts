/**
 * Widget / Panel / PanelDock 实现
 * 响应式驱动渲染（修复旧版 editor.skeleton.refresh 全量重渲染的问题）
 */
import {reactive, ref, h, type UnwrapNestedRefs} from 'vue';
import type {WidgetConfig, WidgetLike, WidgetType, AreaName} from './types';
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
  /** 联动面板（PanelDock 用） */
  panel: Panel | null = null;
  /** 所属区域容器引用 */
  parent: WidgetContainer | null = null;

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

/** 面板外壳（标题栏 + 内容）函数式组件 */
const PanelView = (props: {panel: Panel}) => {
  const panel = props.panel;
  const title = panel.config.props?.title;
  return h('div', {class: panelNs.b()}, [
    title
      ? h('div', {class: panelNs.e('header')}, [
          h('span', {class: panelNs.e('title')}, title)
        ])
      : null,
    h('div', {class: panelNs.e('body')}, [panel.renderBodyContent()])
  ]);
};

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

/** PanelDock（左侧图标按钮 + 联动 Panel） */
export class PanelDock extends Widget {
  panel: Panel | null = null;

  constructor(config: WidgetConfig, onCreatePanel: (dock: PanelDock) => Panel) {
    super(config);
    this.panel = onCreatePanel(this);
  }

  get content(): any {
    if (this.state.disabled) {
      return h(
        'div',
        {
          class: [dockNs.b(), dockNs.is('disabled')],
          title: this.config.props?.description
        },
        [this.renderIcon()]
      );
    }
    return h(
      'div',
      {
        class: [dockNs.b(), this.panel?.active ? dockNs.m('active') : ''],
        title: this.config.props?.description,
        onClick: () => this.togglePanel()
      },
      [this.renderIcon()]
    );
  }

  protected renderIcon(): any {
    const icon = this.config.props?.icon;
    const title = this.config.props?.title;
    return h('div', {class: dockNs.e('inner')}, [
      icon ? h(icon) : null,
      title ? h('span', {class: dockNs.e('label')}, title) : null
    ]);
  }

  togglePanel(): void {
    this.panel?.toggle();
  }
}

/** Widget 容器（管理一个区域内的 widgets） */
export class WidgetContainer {
  items: Widget[] = [];
  maps = new Map<string, Widget>();
  /** 当前激活的 widget（互斥区域用） */
  current = ref<Widget | null>(null);
  exclusive: boolean;

  constructor(exclusive = false) {
    this.exclusive = exclusive;
  }

  add(item: Widget): Widget {
    if (this.maps.has(item.name)) {
      const idx = this.items.findIndex(w => w.name === item.name);
      if (idx >= 0) this.items[idx] = item;
    } else {
      this.items.push(item);
    }
    this.maps.set(item.name, item);
    item.parent = this;
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

  isEmpty(): boolean {
    return this.items.length === 0;
  }
}
