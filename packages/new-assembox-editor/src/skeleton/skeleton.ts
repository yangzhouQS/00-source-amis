/**
 * 骨架布局管理器
 * - skeleton.add(config)：按 type 推断 area + 创建对应形态（Widget/Panel/PanelDock/Dock）
 * - toggleFloatStatus：面板在 leftFixedArea ↔ leftFloatArea 间迁移（浮动/固定切换）
 */
import {Widget, Panel, PanelDock, Dock, WidgetContainer} from './widgets';
import type {WidgetConfig, WidgetType, AreaName} from './types';

export interface Area {
  readonly name: AreaName;
  readonly container: WidgetContainer;
  /** 当前是否可见 */
  readonly visible: {value: boolean};
}

class AreaImpl implements Area {
  readonly name: AreaName;
  readonly container: WidgetContainer;
  readonly visible;
  constructor(skeleton: Skeleton, name: AreaName, exclusive = false) {
    this.name = name;
    this.container = new WidgetContainer(name, exclusive, skeleton);
    this.visible = {value: true};
  }
}

export class Skeleton {
  readonly topArea: AreaImpl;
  readonly leftArea: AreaImpl;
  readonly leftFixedArea: AreaImpl;
  readonly leftFloatArea: AreaImpl;
  readonly centerArea: AreaImpl;
  readonly rightArea: AreaImpl;
  readonly bottomArea: AreaImpl;

  /** 全局面板注册表（name -> panel） */
  readonly panelMap = new Map<string, Panel>();

  /** 配置转换中间件（level 升序执行，插件可创建前改写配置） */
  private configTransducers: Array<{
    fn: (config: WidgetConfig) => WidgetConfig;
    level: number;
    id: string;
  }> = [];

  constructor() {
    this.topArea = new AreaImpl(this, 'topArea');
    this.leftArea = new AreaImpl(this, 'leftArea');
    this.leftFixedArea = new AreaImpl(this, 'leftFixedArea', true); // 互斥
    this.leftFloatArea = new AreaImpl(this, 'leftFloatArea', true); // 互斥
    this.centerArea = new AreaImpl(this, 'centerArea');
    this.rightArea = new AreaImpl(this, 'rightArea');
    this.bottomArea = new AreaImpl(this, 'bottomArea');
  }

  /** 区域查找 */
  getArea(name: AreaName): AreaImpl | undefined {
    switch (name) {
      case 'topArea':
        return this.topArea;
      case 'leftArea':
        return this.leftArea;
      case 'leftFixedArea':
        return this.leftFixedArea;
      case 'leftFloatArea':
        return this.leftFloatArea;
      case 'centerArea':
        return this.centerArea;
      case 'rightArea':
        return this.rightArea;
      case 'bottomArea':
        return this.bottomArea;
      default:
        return undefined;
    }
  }

  /** 按 type 推断默认 area */
  static inferArea(type: WidgetType): AreaName {
    switch (type) {
      case 'PanelDock':
      case 'Panel':
        return 'leftFixedArea';
      case 'Dock':
        return 'leftArea';
      case 'Widget':
      default:
        return 'centerArea';
    }
  }

  /** 注册配置转换中间件（level 升序执行，允许插件在创建前改写配置） */
  registerConfigTransducer(
    fn: (config: WidgetConfig) => WidgetConfig,
    level = 100,
    id: string
  ): void {
    const idx = this.configTransducers.findIndex(t => t.level > level);
    const transducer = {fn, level, id};
    if (idx >= 0) this.configTransducers.splice(idx, 0, transducer);
    else this.configTransducers.push(transducer);
  }

  /** 执行配置管道（按 level 升序应用所有中间件） */
  private runTransducers(config: WidgetConfig): WidgetConfig {
    return this.configTransducers.reduce((c, t) => t.fn(c), config);
  }

  /** 恢复面板的浮动/固定偏好（从 localStorage） */
  private restoreFloatPreference(panelName: string): void {
    try {
      const isFloat =
        localStorage.getItem(`assem-skeleton-${panelName}-float`) === 'true';
      const panel = this.panelMap.get(panelName);
      if (panel && isFloat && panel.parent?.areaName !== 'leftFloatArea') {
        this.toggleFloatStatus(panel);
      }
    } catch {
      /* localStorage 不可用时忽略 */
    }
  }

  /**
   * 添加 widget 到区域（核心 API）
   * 未指定 area 时按 type 推断；Dock/PanelDock/Panel/Widget 四形态
   */
  add(config: WidgetConfig): Widget {
    config = this.runTransducers(config);
    const areaName = config.area ?? Skeleton.inferArea(config.type);
    const area = this.getArea(areaName);
    if (!area) throw new Error(`[Skeleton] 区域 "${areaName}" 不存在`);

    let widget: Widget;
    let dockPanelAreaName: AreaName | null = null;
    let dockPanelArea: AreaImpl | null = null;
    let dockPanelName: string | null = null;
    if (config.type === 'PanelDock') {
      dockPanelAreaName = config.panelProps?.area ?? 'leftFixedArea';
      dockPanelArea = this.getArea(dockPanelAreaName) ?? this.leftFixedArea;
      dockPanelName = config.panelProps?.panelName ?? `panel_${config.name}`;
      const panelArea = dockPanelArea;
      const panelName = dockPanelName;
      widget = new PanelDock(config, dock => {
        const panel = new Panel({
          type: 'Panel',
          name: panelName,
          area: dockPanelAreaName!,
          content: config.content,
          contentProps: config.contentProps,
          props: config.props,
          panelProps: config.panelProps,
          disabledPanelCache: config.disabledPanelCache ?? true
        });
        panel.skeleton = this;
        panel.parent = panelArea.container;
        this.panelMap.set(panelName, panel);
        panelArea.container.add(panel);
        (dock as PanelDock).panel = panel;
        return panel;
      });
    } else if (config.type === 'Panel') {
      widget = new Panel(config);
      this.panelMap.set(config.name, widget as Panel);
    } else if (config.type === 'Dock') {
      widget = new Dock(config);
    } else {
      widget = new Widget(config);
    }

    widget.skeleton = this;
    area.container.add(widget);

    // centerArea / rightArea 的面板默认激活（画布、设置面板常驻显示）
    if (areaName === 'centerArea' || areaName === 'rightArea') {
      widget.setActive(true);
    }

    // PanelDock：首个落入 leftFixedArea 的联动面板默认激活（如组件库）
    if (
      config.type === 'PanelDock' &&
      dockPanelAreaName === 'leftFixedArea' &&
      dockPanelArea &&
      dockPanelName &&
      !dockPanelArea.container.current.value
    ) {
      dockPanelArea.container.active(dockPanelName);
    }

    // PanelDock：恢复上次的浮动/固定偏好
    if (config.type === 'PanelDock' && dockPanelName) {
      this.restoreFloatPreference(dockPanelName);
    }

    return widget;
  }

  /** 浮动/固定切换（leftFixedArea ↔ leftFloatArea 迁移） */
  toggleFloatStatus(panel: Panel): void {
    const isInFloat = panel.parent?.areaName === 'leftFloatArea';
    if (isInFloat) {
      // 浮动 → 固定
      this.leftFloatArea.container.remove(panel);
      this.leftFixedArea.container.add(panel);
      this.leftFixedArea.container.active(panel);
      this.leftFloatArea.container.current.value = null;
    } else {
      // 固定 → 浮动
      this.leftFixedArea.container.remove(panel);
      this.leftFloatArea.container.add(panel);
      this.leftFloatArea.container.active(panel);
      this.leftFixedArea.container.current.value = null;
    }
    // 持久化浮动/固定偏好
    try {
      localStorage.setItem(
        `assem-skeleton-${panel.name}-float`,
        String(!isInFloat)
      );
    } catch {
      /* localStorage 不可用时忽略 */
    }
  }

  /** 按 name 获取 panel（延迟查找，解耦创建顺序） */
  getPanel(name: string): Panel | undefined {
    return this.panelMap.get(name);
  }

  /** 移除 widget */
  remove(name: string): Widget | undefined {
    const widget = this.panelMap.get(name);
    if (widget?.parent) {
      return widget.parent.remove(name);
    }
    return undefined;
  }

  /** 按 name 获取 widget */
  get(name: string): Widget | undefined {
    return this.panelMap.get(name) ?? this.findInAreas(name);
  }

  private findInAreas(name: string): Widget | undefined {
    const areas = [
      this.topArea,
      this.leftArea,
      this.leftFixedArea,
      this.leftFloatArea,
      this.centerArea,
      this.rightArea,
      this.bottomArea
    ];
    for (const area of areas) {
      const w = area.container.get(name);
      if (w) return w;
    }
    return undefined;
  }
}
