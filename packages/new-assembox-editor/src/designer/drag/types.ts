/**
 * 拖拽引擎类型定义
 * 参考 lowcode-engine Dragon + Sensor 模型，适配 Vue3 + data-editor-id
 *
 * 核心：mousedown → mousemove → mouseup（自模拟，非 HTML5 drag）
 *  - 监听器注册到 host doc + 所有画布感应区文档（含 iframe contentDocument），跨帧可靠
 *  - Sensor 抽象：每个画布（同 DOM 容器 / iframe）是一个感应区，负责命中、坐标换算、定位
 */

/** 拖拽对象类型 */
export type DragObjectType = 'nodeData' | 'node';

/** 拖拽对象 */
export interface DragObject {
  type: DragObjectType;
  /** nodeData：组件元信息（从面板拖入）；node：已有节点 id（画布内移动） */
  data?: any;
  nodeId?: import('../../schema/types').NodeId;
  /** 拖拽源标题（ghost 显示） */
  title?: string;
}

/** 定位事件（拖拽过程中产生） */
export interface LocateEvent {
  type: 'LocateEvent';
  /** 原始事件 */
  originalEvent: MouseEvent;
  /** 全局坐标（host 视口，用于 ghost 定位与感应区命中） */
  globalX: number;
  globalY: number;
  /** 画布局部坐标（感应区文档坐标系，用于 elementFromPoint / 定位） */
  canvasX: number;
  canvasY: number;
  /** 鼠标下的元素 */
  target: Element | null;
  /** 拖拽对象 */
  dragObject: DragObject;
  /** 当前命中的感应区 */
  sensor?: DragSensor;
}

/** 投放位置 */
export interface DropLocation {
  /** 目标容器节点 id */
  containerId: import('../../schema/types').NodeId;
  /** region key（默认 body） */
  region: string;
  /** 插入索引 */
  index: number;
  /** 指示线位置（感应区文档坐标，供指示器渲染） */
  indicator?: {x: number; y: number; width: number; horizontal: boolean};
}

/** 拖拽感应区接口（同 DOM 容器 / iframe 各实现一个） */
export interface DragSensor {
  /** 唯一标识 */
  readonly id: string;
  /** 感应区文档（用于事件绑定） */
  readonly contentDocument: Document | null;
  /** 是否可用 */
  sensorAvailable: boolean;
  /** 命中测试：全局坐标是否在感应区内 */
  isEnter(globalX: number, globalY: number): boolean;
  /** 局部坐标 → 全局坐标 */
  toGlobal(localX: number, localY: number): {x: number; y: number};
  /** 取感应区内局部坐标下的元素 */
  elementFromPoint(localX: number, localY: number): Element | null;
  /** 计算投放位置（并渲染指示线） */
  locate(
    target: Element | null,
    canvasX: number,
    canvasY: number
  ): DropLocation | null;
  /** 取消激活（清除指示线） */
  deactiveSensor(): void;
}

/** Dragon 事件回调 */
export interface DragonCallbacks {
  onDragstart?: (e: LocateEvent) => void;
  onDrag?: (e: LocateEvent, location: DropLocation | null) => void;
  onDragend?: (dragObject: DragObject, location: DropLocation | null) => void;
  /** 投放确认（执行 insert/move） */
  onDrop?: (dragObject: DragObject, location: DropLocation) => void;
}
