/**
 * Dragon —— 自模拟拖拽引擎
 * 参考 lowcode-engine Dragon，用 mousedown→mousemove→mouseup 替代 HTML5 drag
 *
 * 关键能力：
 *  - from(shell, boost)：在拖源（组件面板项）上绑定 mousedown
 *  - boost(dragObject, e)：发射拖拽，注册 move/up 到 host doc + 所有感应区文档
 *  - 抖动判定（移动 > 4px 才真正开始，区分点击）
 *  - ESC 取消、Alt/Ctrl 复制态
 *  - chooseSensor：按全局坐标命中感应区，交由 sensor 定位
 *  - 事件：dragstart / drag / dragend / drop
 */
import {getLogger} from '../../core/logger';
import type {
  DragObject,
  LocateEvent,
  DropLocation,
  DragSensor,
  DragonCallbacks
} from './types';

/** 抖动阈值（px），小于此距离视为点击 */
const SHAKE_DISTANCE = 4;

/** 判断是否抖动（开始真正拖拽） */
export function isShaken(e1: MouseEvent, e2: MouseEvent): boolean {
  return (
    Math.pow(e1.clientX - e2.clientX, 2) +
      Math.pow(e1.clientY - e2.clientY, 2) >
    SHAKE_DISTANCE * SHAKE_DISTANCE
  );
}

const logger = getLogger('dragon');
export class Dragon {
  /** 已注册的感应区 */
  private sensors: DragSensor[] = [];
  /** 当前拖拽对象 */
  private dragObject: DragObject | null = null;
  /** 是否正在拖拽 */
  private _dragging = false;
  /** 上一次定位（供 drop 使用） */
  private lastLocation: DropLocation | null = null;
  /** 当前激活感应区 */
  private activeSensor: DragSensor | null = null;
  /** 事件回调（多订阅：每个事件类型独立数组，支持多个监听器） */
  private readonly listenerSets: Record<
    keyof DragonCallbacks,
    Array<Function>
  > = {
    onDragstart: [],
    onDrag: [],
    onDragend: [],
    onDrop: []
  };
  /** 清理函数（每次 boost 注册的监听器移除） */
  private cleanupMove: Array<() => void> = [];
  /** 拖拽态外部副作用清理 */
  private dragStateCleanup: (() => void) | null = null;

  get dragging(): boolean {
    return this._dragging;
  }

  /** 注册回调（支持多订阅，返回取消订阅函数） */
  on(callbacks: DragonCallbacks): () => void {
    const added: Array<[keyof DragonCallbacks, Function]> = [];
    (Object.keys(callbacks) as Array<keyof DragonCallbacks>).forEach(key => {
      const fn = callbacks[key] as unknown as Function;
      if (typeof fn === 'function') {
        this.listenerSets[key].push(fn);
        added.push([key, fn]);
      }
    });
    return () => {
      added.forEach(([key, fn]) => {
        const set = this.listenerSets[key];
        const idx = set.indexOf(fn);
        if (idx >= 0) set.splice(idx, 1);
      });
    };
  }

  /** 触发事件（遍历所有订阅者，单个出错不影响其它） */
  private emit<K extends keyof DragonCallbacks>(
    key: K,
    ...args: Parameters<NonNullable<DragonCallbacks[K]>>
  ): void {
    this.listenerSets[key].slice().forEach(fn => {
      try {
        (fn as Function)(...args);
      } catch (err) {
        console.error(`[Dragon] "${String(key)}" 回调出错:`, err);
      }
    });
  }

  /** 添加感应区 */
  addSensor(sensor: DragSensor): void {
    if (!this.sensors.find(s => s.id === sensor.id)) {
      this.sensors.push(sensor);
    }
  }

  /** 移除感应区 */
  removeSensor(sensorId: string): void {
    const idx = this.sensors.findIndex(s => s.id === sensorId);
    if (idx >= 0) this.sensors.splice(idx, 1);
  }

  /**
   * 在拖源元素上绑定 mousedown（便捷 API）
   * @param shell 拖源元素
   * @param boost 返回拖拽对象的工厂（返回 null 取消）
   */
  from(
    shell: Element,
    boost: (e: MouseEvent) => DragObject | null
  ): () => void {
    const onMousedown = (e: MouseEvent) => {
      if (e.button !== 0) return; // 仅左键
      const obj = boost(e);
      if (!obj) return;
      this.boost(obj, e);
    };
    shell.addEventListener('mousedown', onMousedown as EventListener);
    return () =>
      shell.removeEventListener('mousedown', onMousedown as EventListener);
  }

  /**
   * 发射拖拽
   * @param dragObject 拖拽对象
   * @param boostEvent 触发事件（mousedown）
   */
  boost(dragObject: DragObject, boostEvent: MouseEvent): void {
    if (this._dragging) return;
    this.dragObject = dragObject;
    this._dragging = false;
    this.lastLocation = null;
    this.activeSensor = null;

    let copy = false;

    const checkEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.keyCode === 27) {
        // ESC 取消
        this.lastLocation = null;
        this.activeSensor?.deactiveSensor();
        over();
      }
    };

    const checkCopy = (e: KeyboardEvent) => {
      copy = e.altKey || e.ctrlKey;
    };

    /** 创建定位事件（解析坐标 + 源感应区） */
    const createLocateEvent = (e: MouseEvent): LocateEvent => {
      // 通过事件 target 的 ownerDocument 判定来源文档（兼容合成事件/跨帧）
      const sourceDoc: Document =
        ((e.target as any)?.ownerDocument as Document) ||
        (e.view as any)?.document ||
        document;
      // 找到事件来源对应的感应区
      const srcSensor = this.sensors.find(s => s.contentDocument === sourceDoc);
      const evt: LocateEvent = {
        type: 'LocateEvent',
        originalEvent: e,
        globalX: 0,
        globalY: 0,
        canvasX: 0,
        canvasY: 0,
        target: null,
        dragObject
      };
      if (srcSensor) {
        // 来自画布文档（含 iframe）：局部坐标 = clientX/Y，全局坐标经 sensor 转换
        evt.canvasX = e.clientX;
        evt.canvasY = e.clientY;
        const g = srcSensor.toGlobal(e.clientX, e.clientY);
        evt.globalX = g.x;
        evt.globalY = g.y;
        evt.target = srcSensor.elementFromPoint(e.clientX, e.clientY);
        evt.sensor = srcSensor;
      } else {
        // 来自 host 文档（面板等）
        evt.globalX = e.clientX;
        evt.globalY = e.clientY;
        evt.canvasX = e.clientX;
        evt.canvasY = e.clientY;
        evt.target = e.target as Element;
      }
      return evt;
    };

    /** 选择命中的感应区 */
    const chooseSensor = (e: LocateEvent): DragSensor | null => {
      // 优先事件来源感应区（鼠标在画布内时）
      if (
        e.sensor &&
        e.sensor.sensorAvailable &&
        e.sensor.isEnter(e.globalX, e.globalY)
      ) {
        return e.sensor;
      }
      // 按全局坐标命中
      const found = this.sensors.find(
        s => s.sensorAvailable && s.isEnter(e.globalX, e.globalY)
      );
      return found ?? null;
    };

    /** 处理拖拽移动（已开始拖拽后） */
    const drag = (e: MouseEvent) => {
      const locateEvent = createLocateEvent(e);
      const sensor = chooseSensor(locateEvent);
      if (sensor !== this.activeSensor) {
        this.activeSensor?.deactiveSensor();
        this.activeSensor = sensor;
      }
      let location: DropLocation | null = null;
      if (sensor) {
        locateEvent.sensor = sensor;
        location = sensor.locate(
          locateEvent.target,
          locateEvent.canvasX,
          locateEvent.canvasY
        );
      }
      this.lastLocation = location;
      this.emit('onDrag', locateEvent, location);
    };

    /** 真正进入拖拽态 */
    const dragstart = () => {
      this._dragging = true;
      this.dragStateCleanup = this.setDraggingState(true) ?? null;
      const locateEvent = createLocateEvent(boostEvent);
      this.emit('onDragstart', locateEvent);
    };

    /** mousemove：首次抖动 → dragstart，之后 → drag */
    const move = (e: MouseEvent) => {
      if (this._dragging) {
        drag(e);
        return;
      }
      if (isShaken(boostEvent, e)) {
        dragstart();
        drag(e);
      }
    };

    /** mouseup：结束 */
    const over = () => {
      if (this.dragStateCleanup) {
        this.dragStateCleanup();
        this.dragStateCleanup = null;
      }
      if (this.activeSensor) {
        // 不立即 deactive（保留指示线直到 drop 完成）；drop 后清理
      }
      const dragObj = this.dragObject;
      const loc = this.lastLocation;
      if (this._dragging) {
        this._dragging = false;
        // 执行投放
        if (dragObj && loc) {
          this.emit('onDrop', dragObj, loc);
        }
        if (dragObj) {
          this.emit('onDragend', dragObj, loc);
        }
      }
      this.activeSensor?.deactiveSensor();
      this.activeSensor = null;
      this.dragObject = null;
      this.lastLocation = null;
      this.removeAllListeners();
    };

    /** 注册监听到多个文档（host + 所有感应区文档） */
    const bind = () => {
      const docs = new Set<Document>();
      docs.add(document);
      this.sensors.forEach(s => {
        if (s.contentDocument) docs.add(s.contentDocument);
      });
      docs.forEach(doc => {
        const onMove = (e: MouseEvent) => move(e);
        const onUp = () => over();
        const onEsc = (e: KeyboardEvent) => checkEsc(e);
        const onKey = (e: KeyboardEvent) => checkCopy(e);
        doc.addEventListener('mousemove', onMove, true);
        doc.addEventListener('mouseup', onUp, true);
        doc.addEventListener('keydown', onEsc, false);
        doc.addEventListener('keydown', onKey, false);
        doc.addEventListener('keyup', onKey, false);
        this.cleanupMove.push(() => {
          doc.removeEventListener('mousemove', onMove, true);
          doc.removeEventListener('mouseup', onUp, true);
          doc.removeEventListener('keydown', onEsc, false);
          doc.removeEventListener('keydown', onKey, false);
          doc.removeEventListener('keyup', onKey, false);
        });
      });
    };

    bind();
    // 阻止原生选区
    this.setNativeSelection(false);
  }

  /** 移除本次拖拽注册的所有监听器 */
  private removeAllListeners(): void {
    this.cleanupMove.forEach(fn => fn());
    this.cleanupMove = [];
    this.setNativeSelection(true);
  }

  /** 设置拖拽态（返回清理函数） */
  private setDraggingState(active: boolean): (() => void) | null {
    return this.dragStateSetter ? this.dragStateSetter(active) : null;
  }

  private dragStateSetter: ((active: boolean) => () => void) | null = null;
  /** 注入拖拽态副作用设置器（如光标、iframe renderer 拖拽态） */
  setDragStateSetter(setter: (active: boolean) => () => void): void {
    this.dragStateSetter = setter;
  }

  private setNativeSelection(enable: boolean): void {
    try {
      document.body.style.userSelect = enable ? '' : 'none';
    } catch {
      /* ignore */
    }
  }

  /** 销毁：终止活跃拖拽 + 清理感应区 + 释放回调 */
  destroy(): void {
    if (this._dragging) {
      this.removeAllListeners();
      this._dragging = false;
    }
    this.sensors.forEach(s => s.destroy?.());
    this.sensors = [];
    (Object.keys(this.listenerSets) as Array<keyof DragonCallbacks>).forEach(
      k => {
        this.listenerSets[k] = [];
      }
    );
    this.dragObject = null;
    this.activeSensor = null;
    this.lastLocation = null;
  }
}
