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
  constructor(name: AreaName, exclusive = false) {
    this.name = name;
    this.container = new WidgetContainer(name, exclusive);
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

  constructor() {
    this.topArea = new AreaImpl('topArea');
    this.leftArea = new AreaImpl('leftArea');
    this.leftFixedArea = new AreaImpl('leftFixedArea', true); // 互斥
    this.leftFloatArea = new AreaImpl('leftFloatArea', true); // 互斥
    this.centerArea = new AreaImpl('centerArea');
    this.rightArea = new AreaImpl('rightArea');
    this.bottomArea = new AreaImpl('bottomArea');
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

  /**
   * 添加 widget 到区域（核心 API）
   * 未指定 area 时按 type 推断；Dock/PanelDock/Panel/Widget 四形态
   */
  add(config: WidgetConfig): Widget {
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
