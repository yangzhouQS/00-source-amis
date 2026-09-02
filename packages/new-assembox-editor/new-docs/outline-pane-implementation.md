# 大纲树插件（plugin-outline-pane）实现解析

> 分析对象：`packages/plugin-outline-pane`
> 关联模块：`packages/designer`（Dragon 拖拽引擎 / DropLocation / Scroller）、`packages/editor-skeleton`（骨架屏 Panel 体系）、`packages/shell`（插件 API 代理层）、`packages/engine`（默认面板注册）
>
> 本文回答两个核心问题：
> 1. **从组件面板拖拽组件进入画布时，右侧"属性配置面板"如何动态切换为"大纲树"面板？**
> 2. **大纲树上如何支持组件的拖出（作为拖拽源）与接收（作为投放目标）？**

---

## 目录

1. [功能概述](#1-功能概述)
2. [整体架构](#2-整体架构)
3. [机制一：属性面板 ⇄ 大纲树的动态切换](#3-机制一属性面板--大纲树的动态切换)
4. [机制二：拖拽引擎 Dragon 与 Sensor 协议](#4-机制二拖拽引擎-dragon-与-sensor-协议)
5. [机制三：大纲树作为拖拽源](#5-机制三大纲树作为拖拽源)
6. [机制四：大纲树作为投放目标（locate 算法）](#6-机制四大纲树作为投放目标locate-算法)
7. [视觉反馈渲染](#7-视觉反馈渲染)
8. [数据层：TreeMaster / Tree / TreeNode](#8-数据层treemaster--tree--treenode)
9. [端到端时序图](#9-端到端时序图)
10. [关键源码索引](#10-关键源码索引)

---

## 1. 功能概述

大纲树插件向编辑器提供两块 UI：

| 面板 | 注册区域 | 形态 | 说明 |
|---|---|---|---|
| **master pane**（`outline-master-pane`） | `leftArea` | `PanelDock`（图标 + 弹出面板，可在 leftFloatArea / leftFixedArea 间切换） | 常驻的大纲树入口，用户手动开关 |
| **backup pane**（`outline-backup-pane`） | `rightArea` | `Panel`（`hiddenWhenInit: true`，`index: 1`） | **拖拽期间临时顶替右侧属性面板的大纲树**，拖拽结束自动还原 |

两个 pane 渲染同一个组件 `OutlinePaneContext`，共享同一个 `TreeMaster`（即共享同一份树模型与 TreeNode 缓存），只是各自持有独立的 `PaneController`（独立的 Sensor/滚动实例）。

插件还提供：

- 树节点搜索 / 条件过滤（关键字 + 条件渲染/循环/锁定/隐藏）
- 节点操作：重命名、隐藏、锁定、删除、展开/折叠
- 选中联动（画布选中 → 树高亮并展开祖先；树选中 → 画布选中）
- 悬停高亮（detecting 联动）
- **树内拖拽排序 / 跨层拖入拖出、缩进进/出容器、悬停自动展开、边缘自动滚动**
- 插槽（slots）与模态（Modal）节点、条件分支分组（conditionGroup）的专门处理

---

## 2. 整体架构

```
┌───────────────────────────── plugin-outline-pane ─────────────────────────────┐
│                                                                                │
│  index.tsx (OutlinePlugin)                                                     │
│    ├─ 注册 master pane (leftArea / PanelDock)                                  │
│    ├─ 注册 backup pane  (rightArea / Panel, hiddenWhenInit)                    │
│    ├─ switchPanes()：监听 dragon.onDragstart/onDragend → showPanel/hidePanel    │
│    └─ 选中联动：selection.onSelectionChange → expandAllAncestors                │
│                                                                                │
│  controllers/                          views/                                  │
│    ├─ TreeMaster  (每文档一棵树)         ├─ pane.tsx        (面板外壳+Filter)   │
│    ├─ Tree        (TreeNode 缓存表)      ├─ tree.tsx        (交互事件层)       │
│    ├─ TreeNode    (节点模型代理)          ├─ tree-node.tsx   (单节点视图)       │
│    └─ PaneController (Sensor 实现)       ├─ tree-branches.tsx(子级/插槽/插入线)│
│                                          ├─ tree-title.tsx (标题/操作按钮)    │
│  helper/                                 └─ filter.tsx / filter-tree.ts      │
│    ├─ consts.ts (两个 pane 名)                                               │
│    ├─ dwell-timer.ts  (悬停 500ms 计时)                                      │
│    └─ indent-track.ts (水平缩进跟踪)                                          │
└────────────────────────────────────────────────────────────────────────────────┘
                    │ 依赖（经 shell API 代理）
┌───────────────────▼────────────────────────────────────────────────────────────┐
│ designer: Dragon(拖拽引擎) / DropLocation(投放位置) / Scroller(自动滚动)        │
│           ActiveTracker(激活跟踪) / insertChildren(落点插入)                    │
│ editor-skeleton: Panel / PanelDock / Area / RightArea 渲染与显隐               │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 机制一：属性面板 ⇄ 大纲树的动态切换

这是用户最直观的感受：**从组件面板（材料区）按住一个组件拖入画布的那一刻，右侧属性配置面板"变成"了大纲树；松手后大纲树消失，属性面板恢复。**

### 3.1 两个面板的注册（src/index.tsx）

```ts
// 1) 左侧常驻大纲树（PanelDock）
skeleton.add({
  area: 'leftArea',
  name: 'outlinePane',
  type: 'PanelDock',
  index: -1,
  content: { name: MasterPaneName, props: { icon, description }, content: OutlinePaneContext },
  panelProps: {
    area: isInFloatArea ? 'leftFloatArea' : 'leftFixedArea',
    keepVisibleWhileDragging: true,   // ★ 关键：拖拽经过本面板时不自动收起
  },
  contentProps: { treeTitleExtra, treeMaster, paneName: MasterPaneName },
});

// 2) 右侧备份大纲树（普通 Panel，初始隐藏，排在 settingsPane 之后）
skeleton.add({
  area: 'rightArea',
  name: BackupPaneName,          // 'outline-backup-pane'
  type: 'Panel',
  props: { hiddenWhenInit: true },  // ★ 初始化不激活（不抢占 settingsPane）
  content: OutlinePaneContext,
  contentProps: { paneName: BackupPaneName, treeMaster },  // ★ 共享同一个 TreeMaster
  index: 1,                         // ★ DOM 顺序排在 settingsPane(index 0) 之后
});
```

右侧属性面板本身由引擎注册（`packages/engine/src/inner-plugins/default-panel-registry.tsx`）：

```ts
skeleton.add({
  area: 'rightArea',
  name: 'settingsPane',
  type: 'Panel',
  content: <SettingsPrimaryPane engineEditor={editor} />,
  ...
});
```

### 3.2 切换核心：switchPanes 状态机（src/index.tsx:98-132）

```ts
const showingPanes = { masterPane: false, backupPane: false };

const switchPanes = () => {
  const isDragging = canvas.dragon?.dragging;                       // 拖拽引擎是否处于拖拽中
  const hasVisibleTreeBoard = showingPanes.backupPane || showingPanes.masterPane;
  const shouldShowBackupPane = isDragging && !hasVisibleTreeBoard;  // 拖拽中 且 当前没有任何可见大纲树

  if (shouldShowBackupPane) {
    skeleton.showPanel(BackupPaneName);   // 右侧 backup pane 激活
  } else {
    skeleton.hidePanel(BackupPaneName);   // 恢复隐藏
  }
};

canvas.dragon?.onDragstart(() => switchPanes());  // 拖拽开始（含抖动判定通过后）
canvas.dragon?.onDragend(() => switchPanes());    // 拖拽结束/取消（含 ESC）

// 跟踪两个大纲树面板自身的显隐，作为 hasVisibleTreeBoard 的依据
skeleton.onShowPanel((key) => {
  if (key === MasterPaneName) showingPanes.masterPane = true;
  if (key === BackupPaneName) showingPanes.backupPane = true;
});
skeleton.onHidePanel((key) => {
  if (key === MasterPaneName) { showingPanes.masterPane = false; switchPanes(); } // 用户关掉左侧树 → 若仍在拖拽，立即补开 backup
  if (key === BackupPaneName) showingPanes.backupPane = false;
});
```

设计意图：

- **左侧大纲树已经打开时，拖拽期间不再弹右侧 backup pane**（避免重复展示两棵树）。
- **拖拽过程中用户手动关闭左侧树**，`onHidePanel` 回调里再调一次 `switchPanes()`，backup pane 会立刻补位，保证"拖拽时始终有一棵树可用"。
- `dragon.dragging` 只有在拖拽真正启动（鼠标位移超过 4px 抖动阈值 `SHAKE_DISTANCE`）后才为 true，因此**普通点击组件面板不会触发切换**。

### 3.3 底层实现：Panel 显隐如何工作（editor-skeleton）

调用链：

```
skeleton.showPanel('outline-backup-pane')                    // shell/src/api/skeleton.ts:92
  → Skeleton.getPanel(name).show()
    → Panel.setActive(true)                                  // widget/panel.ts:175
       ├─ this._actived = true
       ├─ this.parent?.active(this)   // rightArea 容器为非互斥(exclusive=false)，不会挤掉 settingsPane
       └─ emitter.emit('activechange', true)
  → (MobX 响应) PanelView/TitledPanelView 重渲染             // components/widget-views/index.tsx
       ├─ className 不再带 'hidden'（.hidden { display:none }）
       └─ checkVisible() 检测到可见性变化
            → skeleton.postEvent(PANEL_SHOW / PANEL_HIDE)    // 供 onShowPanel/onHidePanel 订阅
```

要点：

1. **rightArea 是"非互斥 + 全量渲染"区域**（`skeleton.ts:211`，`exclusive=false`）。`RightArea` 组件把区域内所有 Panel 按 `config.index` 排序后全部渲染（`layouts/right-area.tsx`），每个 Panel 通过 `hidden` class（`display:none`）控制显隐。
2. **两个面板始终同时挂载**。backup pane 激活时 settingsPane 并未被卸载或反激活，只是两者都被 `position:absolute; z-index:1` 铺满右侧（`workbench.less:400-406`），**DOM 顺序靠后的 backup pane（index:1）层叠在上层，视觉上"替换"了属性面板**。
   - 这样做的收益：拖拽结束后 `hidePanel` 移除 `hidden`，属性面板**原样恢复（内部状态、滚动位置均不丢失）**；backup pane 自身也保持挂载，树模型与 DOM 缓存（Sensor 依赖的 `getTreeNodeRect` 等）持续有效。
3. `hiddenWhenInit: true` 通过 `WidgetContainer.add` 中的 `defaultSetCurrent` 逻辑（`widget-container.ts:103-108`）阻止 backup pane 在注册时抢默认激活位。

### 3.4 左侧浮动面板在拖拽时不收起：keepVisibleWhileDragging

`leftFloatArea`（浮动面板区）默认行为是：拖拽事件发生时自动收起自己（点击别处/拖走即失焦关闭，`layouts/left-float-pane.tsx:18-28`）：

```ts
const triggerClose = (e: any) => {
  if (!area.visible) return;
  if (e.originalEvent?.target?.classList.contains('insertion')) return;      // 拖到"插入占位线"上不关闭
  const panelElem = e.originalEvent?.target.closest('div[data-keep-visible-while-dragging="true"]');
  if (panelElem) return;                                                      // ★ 命中声明了 keepVisible 的面板则不关闭
  area.setVisible(false);
};
area.skeleton.editor.eventBus.on('designer.drag', triggerClose);
```

而 `PanelView/TitledPanelView` 会把 panelProps 里的 `keepVisibleWhileDragging` 输出为 DOM 属性：

```tsx
<div className={...} data-keep-visible-while-dragging={panel.config.props?.keepVisibleWhileDragging}>
```

大纲树 master pane 注册时带了 `keepVisibleWhileDragging: true`，因此**用户把节点拖进左侧大纲树区域时，浮动面板不会被失焦逻辑收起**，可以持续完成树内投放。

---

## 4. 机制二：拖拽引擎 Dragon 与 Sensor 协议

大纲树的拖入/拖出不是自己实现的一套 mouse 事件，而是接入引擎统一的 **Drag-on 拖拽引擎**（`packages/designer/src/designer/dragon.ts`）。

### 4.1 Sensor 协议（IPublicModelSensor）

任何想"接收投放"的区域（画布 simulator、大纲树、其它自定义面板）都实现该协议并注册到 dragon：

```ts
interface IPublicModelSensor {
  sensorAvailable: boolean;                 // 是否可用（DOM 已挂载）
  isEnter(e: LocateEvent): boolean;         // 指针是否进入感应区
  fixEvent(e: LocateEvent): LocateEvent;    // 订正事件（跨 iframe 坐标、target 兜底）
  locate(e: LocateEvent): DropLocation | undefined | null;  // ★ 计算投放位置
  deactiveSensor(): void;                   // 离开感应区时复位
}
// 注册/注销：canvas.dragon.addSensor(sensor) / removeSensor(sensor)
```

### 4.2 Dragon 的拖拽主循环（dragon.ts `boost()`）

```
boost(dragObject, boostEvent)          // 发射一个拖拽对象（来源：组件面板/画布节点/大纲树节点）
  ├─ 注册 document 级 mousemove/mouseup（或原生 dragover/drop）捕获监听
  ├─ move(e):
  │    ├─ 未启动且位移 > 4px（isShaken）→ dragstart()
  │    │     ├─ dragon._dragging = true  ← switchPanes 依赖的正是这个状态
  │    │     └─ emitter.emit('dragstart', locateEvent)
  │    └─ drag(e):
  │         ├─ createLocateEvent(e)      // 统一换算 globalX/globalY（含 iframe 逆变换）
  │         ├─ chooseSensor(locateEvent) // ★ 依次问每个 sensor: sensorAvailable && isEnter(e)
  │         │     ├─ 命中新 sensor → 旧 sensor.deactiveSensor()
  │         │     └─ sensor.fixEvent(e)
  │         └─ sensor.locate(e)          // ★ 由 sensor 计算并"落"一个 DropLocation
  └─ over(e)（mouseup / drop / ESC / mousedown 中断）
       ├─ lastSensor.deactiveSensor()
       ├─ emitter.emit('dragend', { dragObject, copy })
       └─ designer.clearLocation()
```

chooseSensor 的候选集 = `dragon.sensors`（`addSensor` 注册的，如大纲树 PaneController）+ 各文档的 simulator（画布）。**鼠标从画布移到右侧大纲树上时，PaneController 的 `isEnter` 命中，投放计算权即交给大纲树**——这就是"大纲树接收组件"的引擎级原理。

### 4.3 DropLocation（投放位置模型）

`sensor.locate()` 的产出。大纲树通过 `canvas.createLocation()`（shell 代理 → `designer.createLocation`）创建：

```ts
// packages/types/src/shell/type/location.ts
interface IPublicTypeLocationChildrenDetail {
  type: 'Children';
  index?: number | null;   // 插入到 target 子节点的第 index 位
  valid?: boolean;         // 位置是否合法（checkNesting 校验）
  near?: { node; pos: 'before' | 'after' | 'replace' };  // 视觉贴近哪个节点
  focus?: { type: 'slots' } | { type: 'node'; node };    // 悬停聚焦（slots 区/折叠容器）
}
interface IPublicTypeLocationData {
  target: Node;            // 投放目标容器
  detail: LocationDetail;
  source: string;          // 哪个 sensor 产生的（PaneController.id）
  event: LocateEvent;
}
```

`designer.createLocation()` 内部（`designer/designer.ts:314-326`）：

```ts
createLocation(locationData) {
  const loc = new DropLocation(locationData);
  ...
  this.postEvent('dropLocation.change', loc);
  loc.document.dropLocation = loc;   // → setter 触发 'document.dropLocation.changed' 事件
  this.activeTracker.track({ node: loc.target, detail: loc.detail });  // ★ 激活跟踪（联动展开/滚动）
  return loc;
}
```

树视图通过 `project.currentDocument.onDropLocationChanged(...)` 订阅变化来渲染插入线（见第 7 节）。

---

## 5. 机制三：大纲树作为拖拽源

入口在视图层 `views/tree.tsx` 的 `onMouseDown`（捕获阶段）：

```ts
private onMouseDown = (e: ReactMouseEvent) => {
  if (isFormEvent(e.nativeEvent)) return;             // 表单控件内不拖
  const treeNode = this.getTreeNodeFromEvent(e);      // e.target.closest('[data-id]') → tree.getTreeNodeById
  if (!treeNode) return;
  const { node } = treeNode;
  if (!canClickNode(node, e)) return;                 // 锁定/禁止点击等校验

  const isMulti = e.metaKey || e.ctrlKey || e.shiftKey;
  const isLeftButton = e.button === 0;

  if (isLeftButton && focusNode && !node.contains(focusNode)) {
    let nodes = [node];
    this.ignoreUpSelected = false;
    if (isMulti) {                                    // 多选模式：按下即累加选中
      if (!selection?.has(node.id)) {
        canvas.activeTracker?.track(node);
        selection?.add(node.id);
        this.ignoreUpSelected = true;                 // 抑制随后的 click 再选中一次
      }
      selection?.remove(focusNode.id);
      nodes = selection.getTopNodes();                // 取顶层节点集合参与拖拽
    } else if (selection?.has(node.id)) {
      nodes = selection.getTopNodes();                // 按在已选中节点上 → 拖整个选中集
    }
    this.boostEvent = e.nativeEvent;
    canvas.dragon?.boost(                             // ★ 发射 Node 型拖拽对象给拖拽引擎
      { type: IPublicEnumDragObjectType.Node, nodes },
      this.boostEvent,
    );
  }
};
```

细节：

- **boost 只记录起点**，真正进入拖拽要等 mousemove 超过抖动阈值（dragon 内 `isShaken`）；没超过阈值就松手则视为点击，由 `onClick` 完成选中（含 `isShaken(boostEvent, e)` 二次确认防止拖完误选）。
- 拖拽对象类型为 `Node`（已有节点移动）；组件面板拖出的是 `NodeData`（schema 数据，新建节点）。两种类型走同一条 Dragon → Sensor → DropLocation → `insertChildren` 流水线。
- `onDoubleClick`：双击标题 → 展开或折叠全部后代（`expandAllDecendants / collapseAllDecendants`）。
- `onMouseOver/onMouseLeave` → `document.detecting.capture(node.id) / leave()`，实现"树内悬停 → 画布对应节点高亮"。

---

## 6. 机制四：大纲树作为投放目标（locate 算法）

`PaneController`（`controllers/pane-controller.ts`）同时实现三个角色：

| 角色 | 用途 |
|---|---|
| `IPublicModelSensor` | 作为 dragon 的投放感应区 |
| `ITreeBoard` | 被 TreeMaster 收录，响应 scrollToNode（选中/激活时滚动到节点） |
| `IPublicTypeScrollable` | 提供 Bounds/ScrollTarget，配合 Scroller 实现边缘自动滚动 |

### 6.1 挂载与注册

```ts
constructor(at, treeMaster) {
  ...
  this.treeMaster?.addBoard(this);            // 注册为树板（可被滚动定位）
  canvas.dragon?.addSensor(this);             // ★ 注册为投放感应区
  this.scroller = canvas.createScroller(this);// 自动滚动器
}

// Pane.tsx 中把容器 DOM 交给 controller（ref 回调）
<div ref={(shell) => this.controller.mount(shell)} className="lc-outline-tree-container">
  <TreeView key={tree.id} tree={tree} />
</div>
```

`mount(shell)`（pane-controller.ts:576-605）：

- shell 非空：`_scrollTarget = canvas.createScrollTarget(shell)`，`_sensorAvailable = true`；若当前有选中节点，延迟一帧滚动定位到它。
- shell 为空（面板卸载/隐藏重建）：`_sensorAvailable = false`，locate/isEnter 直接失效。

### 6.2 isEnter 与 fixEvent

```ts
isEnter(e): boolean {   // 指针坐标是否落在本面板 DOM 矩形内
  const rect = this._shell.getBoundingClientRect();
  return e.globalY >= rect.top && e.globalY <= rect.bottom
      && e.globalX >= rect.left && e.globalX <= rect.right;
}

fixEvent(e) {           // 订正事件：target 兜底（elementFromPoint） + 绑定目标文档
  if (e.fixed) return e;
  const notMyEvent = e.originalEvent.view?.document !== document;
  if (!e.target || notMyEvent) {
    e.target = document.elementFromPoint(e.canvasX!, e.canvasY!);
  }
  e.documentModel = this.pluginContext.project.getCurrentDocument();
  e.fixed = true;
  return e;
}
```

`fixEvent` 保证了**从画布 iframe 里拖出来的事件**（target 在 iframe document 中）能在主文档的大纲树上继续命中。

### 6.3 locate：投放位置计算总流程

```ts
locate(e): DropLocation | undefined | null {
  this.sensing = true;
  this.scroller?.scrolling(e);                        // ① 贴近面板上下边缘时自动滚动
  const tree = this.treeMaster?.currentTree;
  if (!tree || !tree.root || !this._shell) return null;

  // ② onMoveHook 过滤不可移动节点
  const operationalNodes = nodes?.filter((node) => {
    const onMoveHook = node.componentMeta?.advanced.callbacks?.onMoveHook;
    return onMoveHook && typeof onMoveHook === 'function' ? onMoveHook(node) : true;
  });
  if (isDragNodeObject(dragObject) && (!operationalNodes || operationalNodes.length === 0)) return;

  // ③ 模态组件特判：拖的是模态节点 → 永远投到 focusNode 第 0 位
  if (e.dragObject?.type === 'node' && componentMeta?.isModal && document?.focusNode) {
    return canvas.createLocation({ target: document.focusNode, detail: { type: Children, index: 0, valid: true }, ... });
  }

  // ④ "位置未变"短路优化：
  //    - 鼠标仍停在原行（pos === 'unchanged'），或
  //    - 鼠标 Y 仍落在现有插入线(.insertion)矩形内
  //    → 克隆原 location，只额外尝试缩进（IndentTrack），不再全树重算
  if (originLoc && ((pos && pos === 'unchanged') || (irect && globalY >= irect.top && globalY <= irect.bottom)) && dragObject) {
    const loc = originLoc.clone(e);
    const indented = this.indentTrack.getIndentParent(originLoc, loc);   // ⑤ 缩进跟踪
    if (indented) {
      const [parent, index] = indented;
      if (checkRecursion(parent, dragObject)) {          // 防止拖进自己的子孙
        if (tree.getTreeNode(parent).expanded) {         // 已展开 → 直接给出容器内位置
          this.dwell.reset();
          return canvas.createLocation({ target: parent, detail: { type: Children, index, valid: checkNesting(...) }, ... });
        }
        originLoc.detail.focus = { type: 'node', node: parent };  // 未展开 → 置 focus 并启动悬停计时
        this.dwell.focus(parent, e);
      } else {
        this.dwell.reset();
      }
    } else if (originLoc.detail.near) { originLoc.detail.near = undefined; this.dwell.reset(); }
    return;
  }

  this.indentTrack.reset();

  // ⑥ 常规路径：由事件 target 反查命中的树节点
  if (pos && pos !== 'unchanged') {
    let treeNode = tree.getTreeNodeById(pos.nodeId);
    if (treeNode) {
      let { focusSlots } = pos;                         // pos 由 getPosFromEvent 解析：
      let { node } = treeNode;                          //   target.closest('[data-id]') → nodeId
                                                        //   closest.matches('.tree-node-slots') → focusSlots
      // ⑥-1 拖的是已有节点且落点在自己的子孙内 → 上浮到祖先
      if (isDragNodeObject(dragObject)) {
        const newNodes = operationalNodes;
        let i = newNodes?.length; let p: any = node;
        while (i-- > 0) { if (newNodes[i].contains(p)) p = newNodes[i].parent; }
        if (p !== node) { node = p || document?.focusNode; treeNode = tree.getTreeNode(node); focusSlots = false; }
      }

      // ⑥-2 命中"插槽区" → 返回 focus: slots 的位置（悬停后进入指定插槽）
      if (focusSlots) {
        this.dwell.reset();
        return canvas.createLocation({ target: node, detail: { type: Children, index: null, valid: false, focus: { type: 'slots' } }, ... });
      }

      // ⑥-3 非根节点 → 贴近计算（前/后/内部）
      if (!treeNode.isRoot()) {
        const loc = this.getNear(treeNode, e);
        this.dwell.tryFocus(loc);
        return loc;
      }
    }
  }

  // ⑦ 兜底：从根节点向下钻取
  const loc = this.drillLocate(tree.root, e);
  this.dwell.tryFocus(loc);
  return loc;
}
```

`getPosFromEvent`（pane-controller.ts:649-669）：

```ts
function getPosFromEvent({ target }, stop) {
  if (!target || !stop.contains(target)) return null;   // 事件不在本面板内
  if (target.matches('.insertion')) return 'unchanged'; // ★ 命中插入线本身 → 保持位置不变（防抖动）
  const closest = target.closest('[data-id]');
  if (!closest || !stop.contains(closest)) return null;
  return { nodeId: closest.dataset.id, focusSlots: closest.matches('.tree-node-slots') };
}
```

**为什么需要 `'unchanged'` / 插入线矩形短路**：插入线本身是渲染在 children 列表里的一个 DOM 元素，一旦出现，鼠标下方就可能从"树节点"变成"插入线"。若不做短路，locate 会因 target 变化而重算，插入线随之移动，target 又变回节点……造成插入线抖动。短路后位置稳定，`insertion` 元素还开了 `pointer-events: all`（style.less:116）保证能被 `elementFromPoint` 命中从而进入该分支。

### 6.4 getNear：单节点前/后/内部判定

`getNear(treeNode, e)`（pane-controller.ts:350-452）按三段区域判定：

```
┌─────────────────────────────┐
│         节点标题上半区        │ → near: { node, pos: 'before' }  target=node.parent, index=node.index
├─────────────────────────────┤
│  已展开？                    │ → drillLocate(treeNode)：递归进入子节点列表继续判定
│  未展开且(isContainer||hasSlots)│ → focus: { type:'node', node }（悬停 500ms 后展开并落入内部, index=0）
├─────────────────────────────┤
│         节点标题下半区        │ → near: { node, pos: 'after' }  target=node.parent, index=node.index+1
└─────────────────────────────┘
```

- **插槽根节点**（`node.isSlotNode`）单独处理：非容器且无插槽时直接给出 `near: { pos: 'replace' }`（替换语义）；否则优先 drill 进插槽区，兜底 `focus: slots`。
- 每个分支都带 `valid: document.checkNesting(parent, dragObject)`（组件物料配置的容器/子组件规则校验）与 `focus`（折叠容器悬停聚焦）。
- `focusNode` 只在"未展开容器 + 鼠标还在标题下半区"时设置；一旦越过标题底部就清除（`if (globalY > titleRect.bottom) focusNode = undefined`），避免误聚焦。

### 6.5 drillLocate：向子级钻取

`drillLocate(treeNode, e)`（pane-controller.ts:454-568）——判定"指针是否落在 treeNode 的子级区域"，是递归核心：

1. `checkRecursion(treeNode.node, dragObject)`：目标是拖拽节点自身/其子孙 → 拒绝（返回 null，落到外层的 after 分支）。
2. **未展开的插槽节点**：直接给内部位置（插槽容器给 `focus: slots`，普通容器给 `index: 0`）。
3. **有插槽的节点**：先算 `.tree-node-slots` 区域矩形，指针在上半部 → 聚焦插槽区（`items = treeNode.slots`）；指针超出插槽区且节点非容器 → 返回 `focus: slots` 的高亮位置（紫色 slots 条高亮）。
4. **容器节点**：`items = treeNode.children`，遍历子节点矩形：
   - `globalY < rect.top` → 插到当前子节点前（before）；
   - `globalY > rect.bottom` → 跳过继续；
   - 落在某子节点内部 → 递归 `getNear(current, e, index, rect)`；
   - 全部越界 → 插到最后（`index = l`）或贴最后一个节点 after。
5. 最终 `canvas.createLocation(locationData)` 落位。

### 6.6 悬停自动展开：DwellTimer（helper/dwell-timer.ts）

```ts
export default class DwellTimer {
  private timeout = 500;                       // 停留 500ms 触发
  focus(node, event) {
    if (this.previous === node) return;        // 同一节点不重复计时
    this.reset();
    this.previous = node;
    this.timer = setTimeout(() => { this.decide(this.previous!, this.event!); this.reset(); }, this.timeout);
  }
  tryFocus(loc) {                              // 从 location.detail.focus 中提取焦点节点
    if (loc?.detail.focus?.type === 'node') this.focus(loc.detail.focus.node, loc.event);
    else this.reset();
  }
}
```

触发后的 decide 回调（PaneController 构造时注入，pane-controller.ts:44-68）：

```ts
private dwell = new DwellTimer((target, event) => {
  if (target.hasSlots()) {
    // 有插槽 → 聚焦 slots 区
    index = null; focus = { type: 'slots' };
  } else {
    // 无插槽 → 落到内部第一个
    index = 0;
    valid = !!document?.checkNesting(target, event.dragObject);
  }
  canvas.createLocation({ target, source: this.id, event, detail: { type: Children, index, focus, valid } });
});
```

**展开的联动链路**（关键，跨模块）：

```
DwellTimer 500ms 到期
  → canvas.createLocation({ target: 折叠节点, detail: { type: Children, index: 0 } })
    → designer.createLocation()
       → this.activeTracker.track({ node: loc.target, detail: loc.detail })
         → designer.activeTracker.onChange                       (designer.ts:248)
            → TreeMaster.initEvent 中注册的 canvas.activeTracker.onChange(setExpandByActiveTracker)
               → detail 是 ChildrenDetail ? treeNode.expand(true) : treeNode.expandParents()
               → boards.forEach(board => board.scrollToNode(treeNode, detail))
```

即：**在折叠容器上悬停 0.5s → 该节点被展开 → 下一帧 locate 走 drillLocate 进入其内部 → 插入线出现在子级列表中**。同时 TreeMaster 的 boards（两个 PaneController）会把该节点滚动进可视区。

### 6.7 水平缩进进/出容器：IndentTrack（helper/indent-track.ts）

拖拽保持"同一目标 + 同一 index"时，横向位移每累计 ±15px（`IndentSensitive`）触发一次层级变更：

- **右移（进一层）**：`index > 0` 时，目标变为前一个兄弟节点（须为容器），落到其子级末尾 `[prevSibling, prevSibling.children.size]`。
- **左移（退一层）**：`index === parent.children.size`（当前是最后一个）时，目标变为祖父节点，落到父节点之后 `[parent.parent, parent.index + 1]`。

前置条件（`getIndentParent`）：lastLoc 与 loc 的 target、source、index 均一致（即竖直方向没换行），否则重置。缩进目标若未展开同样交给 DwellTimer 聚焦展开。

### 6.8 边缘自动滚动：Scroller（designer/scroller.ts）

`locate()` 首行调用 `this.scroller?.scrolling(e)`：

- 指针距面板上/下边缘 30px（`SCROLL_ACCURACY`）以内时，按距离计算 10~50px/帧 的速度持续滚动（rAF 动画），拖出敏感区即停。
- PaneController 实现 `IPublicTypeScrollable`：`bounds` = 面板 DOM 矩形，`scrollTarget` = 包装后的滚动容器（`canvas.createScrollTarget(shell)`，designer 的 `ScrollTarget` 适配 window/element）。

反向的"滚动到某节点"（`ITreeBoard.scrollToNode`，pane-controller.ts:309-346）：

- 依据 detail 是否 ChildrenDetail 决定定位到插入线还是节点标题矩形；
- 目标矩形不在可视区 → `scroller.scrollTo({ top: 居中对齐 })`（200ms ease 动画）；
- 取不到矩形（节点尚未渲染）→ `requestIdleCallback` 最多重试 3 次；结尾再补一次 `tryTimes=4` 的确认滚动，兜住展开引起的布局位移。

### 6.9 合法性与安全性校验汇总

| 校验 | 位置 | 作用 |
|---|---|---|
| `checkRecursion(parent, dragObject)` | pane-controller.ts:636 | 拖拽节点不能包含投放目标（防循环嵌套） |
| `document.checkNesting(parent, dragObject)` | locate 各分支 | 物料 meta 的容器/嵌套规则（component.metadata.configure.nesting） |
| `onMoveHook` | locate ② | 组件级"是否允许移动"回调（advanced.callbacks.onMoveHook） |
| `onDropHook`（引擎侧） | designer 落点阶段 | 组件级"是否允许投放"回调 |
| ⑥-1 祖先上浮 | locate | 落点在自身子孙内时自动上浮到最近合法祖先 |
| `canClickNode` | tree.tsx | 锁定节点/条件不满足时禁止拖起 |

### 6.10 落点执行（引擎侧，dragend）

`designer.ts:217-246`：

```ts
this.dragon.onDragend((e) => {
  const loc = this._dropLocation;                       // locate 阶段写入的最后位置
  if (loc && isLocationChildrenDetail(loc.detail) && loc.detail.valid !== false) {
    let nodes;
    if (isDragNodeObject(dragObject)) {
      nodes = insertChildren(loc.target, [...dragObject.nodes], loc.detail.index, copy);  // copy: 按住 Ctrl/Alt 复制
    } else if (isDragNodeDataObject(dragObject)) {
      nodes = insertChildren(loc.target, nodeData, loc.detail.index);                     // 组件面板拖入：按 schema 新建
    }
    if (nodes) {
      loc.document?.selection.selectAll(nodes.map((o) => o.id));   // 选中新节点 → 属性面板切换到新节点
      setTimeout(() => this.activeTracker.track(nodes![0]), 10);   // 树上展开+滚动定位
    }
  }
  ...
});
```

同一时刻大纲插件侧的 `onDragend → switchPanes()` 把 backup pane 隐藏，右侧恢复属性面板（内容已随新选中节点切换）。TreeMaster 还会在 dragend 时 emit `outlinePane.dragend` 埋点事件（选中组件名 + 拖拽耗时）。

---

## 7. 视觉反馈渲染

| 反馈 | 数据来源 | 渲染位置 |
|---|---|---|
| **插入线**（虚线框，非法时红色 `.invalid`） | `dropDetail.index` 与子节点下标比对 | `tree-branches.tsx` `TreeNodeChildren.render`：`index === dropIndex` 处插入 `<div class="insertion">`，`dropIndex >= length` 时补在末尾 |
| **容器投放高亮**（`dropping`：图标/标题变品牌色） | `TreeNode.isResponseDropping()`（`loc.target.id === nodeId` 且 `detail.index != null`），订阅 `onDropLocationChanged` | `tree-node.tsx` |
| **悬停聚焦高亮**（`highlight`） | `TreeNode.isFocusingNode()`（`detail.focus.type === 'node'` 且是本节点） | `tree-node.tsx` |
| **插槽区高亮**（紫色 slots 条 + `insertion-at-slots` 预留插入位） | `treeNode.dropDetail?.focus?.type === 'slots'` | `tree-branches.tsx` `TreeNodeSlots` |
| **条件分组**（conditionGroup 折叠为一组，标题可整体命中） | `child.node.conditionGroup` | `TreeNodeChildren.render` 的 `endGroup()` 聚合逻辑，分组容器也带 `data-id`（可被 getPosFromEvent 命中） |
| **选中/隐藏/锁定/悬停探测** | selection / visible / locked / detecting 各自的事件订阅 | `tree-node.tsx` className 拼装 |

`insertion` 元素上开着 `pointer-events: all !important`（style.less:116），保证鼠标压在插入线上时 `document.elementFromPoint` 能取到它，从而命中 `getPosFromEvent` 的 `'unchanged'` 分支——位置锁定、不抖动。

订阅方式统一是 `project.currentDocument.onDropLocationChanged(() => this.setState({ dropDetail: treeNode.dropDetail }))`（tree-node.tsx:167-173、tree-branches.tsx:106-110），即**每次 DropLocation 变化，相关视图拉取最新 detail 局部重渲染**。

---

## 8. 数据层：TreeMaster / Tree / TreeNode

### 8.1 TreeMaster（controllers/tree-master.ts）

- **文档级单例树工厂**：`currentTree` 按 `document.id` 在 `treeMap` 中懒创建/缓存 `Tree`；`project.onRemoveDocument` 时清理。
- `boards: Set<ITreeBoard>`：登记所有树板（master/backup 两个 PaneController），`activeTracker` 变化时统一 `scrollToNode`。
- `initEvent()` 订阅：
  - `canvas.dragon.onDragstart` → `toVision()`：折叠所有顶层节点（拖拽开始给用户"收拢视野"），并记录开始时间；
  - `canvas.activeTracker.onChange` → `setExpandByActiveTracker`：**画布/树任何位置的激活跟踪 → 展开对应节点并滚动**（悬停展开、选中联动都走这里）；
  - `canvas.dragon.onDragend` → emit `outlinePane.dragend` 埋点；
  - workspace 模式下跟随 `onChangeActiveWindow / onChangeViewType` 重建 pluginContext（多窗口/多视图隔离）。
- pluginContext 变化通过 EventEmitter 广播，`OutlinePaneContext`（index.tsx 顶部）收到后重建 PaneController 与 Pane（`key={controller.id}` 强制重挂载）。

### 8.2 Tree（controllers/tree.ts）

- `root`：`document.focusNode` 对应的 TreeNode（Modal 视图等会切换 focusNode）。
- `treeNodesMap`：nodeId → TreeNode 缓存，`getTreeNode(node)` 命中则 `setNode` 刷新引用。
- 订阅文档事件驱动树刷新：
  - `onChangeNodeChildren` → `notifyExpandableChanged`（增删子节点后重算可展开性/子列表）；
  - `onChangeNodeProp`（key 为 `___title___` / `___condition___`）→ 标题/条件图标刷新；
  - `onChangeNodeVisible` → `setHidden`；
  - `history.onChangeCursor` → 根节点刷新（undo/redo 后）；
  - `onImportSchema` → 清空缓存重建。
- 提供 `expandAllAncestors / expandAllDecendants / collapseAllDecendants / setNodeSelected`。

### 8.3 TreeNode（controllers/tree-node.ts）

文档 Node 的**视图态代理**：expanded（默认折叠，根节点强制展开）、filterResult、eventemitter 事件（expandedChanged/hiddenChanged/lockedChanged/titleLabelChanged/conditionChanged/expandableChanged/filterResultChanged）。值得注意的 getter：

```ts
get expandable() {
  if (this.locked) return false;
  return this.hasChildren() || this.hasSlots() || this.dropDetail?.index != null;
  //                                              ★ 投放目标即使是空容器也显示展开箭头（拖完即有子节点）
}
get dropDetail() {   // 本节点是否为当前投放目标（含 focus/valid/near 等明细）
  const loc = currentDocument?.dropLocation;
  return loc && this.isResponseDropping() && isLocationChildrenDetail(loc.detail) ? loc.detail : null;
}
```

---

## 9. 端到端时序图

### 9.1 从组件面板拖入画布（属性面板 → 大纲树 → 恢复）

```
用户            组件面板            Dragon引擎                     大纲插件                     skeleton/右区
 │ mousedown+move │                    │                            │                            │
 ├───────────────►│ boost(NodeData)    │                            │                            │
 │                ├───────────────────►│ 位移>4px: dragstart        │                            │
 │                │                    │ _dragging=true ───────────►│ onDragstart→switchPanes    │
 │                │                    │                            │ showPanel(backupPane) ────►│ Panel.setActive(true)
 │                │                    │                            │                            │ backup pane 覆盖 settingsPane
 │ move(画布上)   │                    │ drag: chooseSensor=simulator│                            │
 ├───────────────────────────────────►│ simulator.locate → DropLocation（画布内插入位置）          │
 │                │                    │                            │                            │
 │ move(移到右树) │                    │ drag: chooseSensor=PaneController(isEnter 命中)           │
 ├───────────────────────────────────►│ → fixEvent(订正iframe坐标) → locate(e)                   │
 │                │                    │   getPosFromEvent→nodeId                                   │
 │                │                    │   getNear/drillLocate → createLocation                    │
 │                │                    │   dropLocation=loc → onDropLocationChanged                │
 │                │                    │   activeTracker.track ──► TreeMaster: expand/scrollToNode │
 │                │                    │                            │ 树渲染 insertion/dropping    │
 │ (悬停折叠节点0.5s)                  │ dwell.decide → createLocation(target=该节点,index=0)       │
 │                │                    │   → activeTracker → expand(true) → drill 进内部           │
 │ mouseup        │                    │ over(): dragend ───────────►│ onDragend→switchPanes      │
 ├───────────────────────────────────►│ designer.onDragend:         │ hidePanel(backupPane) ────►│ 恢复 settingsPane
 │                │                    │  insertChildren(target,nodes,index)                       │
 │                │                    │  selection.selectAll → 属性面板切换为新节点               │
```

### 9.2 树内拖拽（大纲树既是源也是目标）

```
mousedown(树节点) ──► TreeView.onMouseDown
                       selection 预处理（多选/已选集合）
                       canvas.dragon.boost({ type: Node, nodes }, e)
                          │
                          ▼
          （与 9.1 相同的 Dragon→Sensor→locate 流水线，
            区别：dragObject 为 Node 型 → 额外经过
            onMoveHook 过滤 / checkRecursion 防循环 / 祖先上浮）
                          │
          dragend: insertChildren(target, nodes, index, copy)  // copy=按住Ctrl/Alt 时为克隆
```

---

## 10. 关键源码索引

| 关注点 | 文件:行 |
|---|---|
| 插件入口/双面板注册/switchPanes | `packages/plugin-outline-pane/src/index.tsx:41-154` |
| pane 名常量 | `packages/plugin-outline-pane/src/helper/consts.ts` |
| 面板外壳（mount shell / Filter / TreeView） | `packages/plugin-outline-pane/src/views/pane.tsx:68-76` |
| Sensor 实现（locate/getNear/drillLocate/fixEvent/isEnter） | `packages/plugin-outline-pane/src/controllers/pane-controller.ts:126-568` |
| 悬停计时器 | `packages/plugin-outline-pane/src/helper/dwell-timer.ts` |
| 缩进跟踪 | `packages/plugin-outline-pane/src/helper/indent-track.ts` |
| 树交互（拖起 boost / 点击选中 / 双击折叠 / 悬停探测） | `packages/plugin-outline-pane/src/views/tree.tsx:36-178` |
| 插入线/插槽/条件分组渲染 | `packages/plugin-outline-pane/src/views/tree-branches.tsx:116-188` |
| 节点视图状态机（dropping/highlight/...） | `packages/plugin-outline-pane/src/views/tree-node.tsx` |
| 标题与操作按钮（重命名/隐藏/锁定/删除/展开） | `packages/plugin-outline-pane/src/views/tree-title.tsx` |
| 过滤算法 | `packages/plugin-outline-pane/src/views/filter-tree.ts` |
| 树模型（文档事件驱动刷新） | `packages/plugin-outline-pane/src/controllers/tree.ts` |
| 节点模型（expanded/dropDetail/expandable） | `packages/plugin-outline-pane/src/controllers/tree-node.ts` |
| TreeMaster（每文档一树/activeTracker 联动/boards） | `packages/plugin-outline-pane/src/controllers/tree-master.ts` |
| Dragon 拖拽引擎（boost/chooseSensor/dragstart 抖动） | `packages/designer/src/designer/dragon.ts:108-639` |
| DropLocation 类型定义 | `packages/types/src/shell/type/location.ts` |
| createLocation → activeTracker 联动 | `packages/designer/src/designer/designer.ts:314-326` |
| dragend 落点 insertChildren | `packages/designer/src/designer/designer.ts:217-246` |
| 自动滚动 Scroller | `packages/designer/src/designer/scroller.ts` |
| settingsPane 注册 | `packages/engine/src/inner-plugins/default-panel-registry.tsx:20-35` |
| rightArea 非互斥全量渲染 | `packages/editor-skeleton/src/skeleton.ts:211-222`、`layouts/right-area.tsx` |
| Panel 显隐（hidden class / PANEL_SHOW 事件） | `packages/editor-skeleton/src/widget/panel.ts:175-217`、`components/widget-views/index.tsx:138-246` |
| keepVisibleWhileDragging（浮动面板拖拽不收起） | `packages/editor-skeleton/src/layouts/left-float-pane.tsx:18-28` |
| shell dragon 代理（dragging/onDragstart/boost/addSensor） | `packages/shell/src/model/dragon.ts` |
| shell canvas 代理（createLocation/createScroller/activeTracker） | `packages/shell/src/api/canvas.ts` |
| 插入线/插槽/高亮样式 | `packages/plugin-outline-pane/src/views/style.less:115-194, 402-423` |
| 右区面板层叠样式 | `packages/editor-skeleton/src/layouts/workbench.less:392-409` |

---

## 附：设计要点小结

1. **切换即"覆盖"而非"替换"**：backup pane 与 settingsPane 同时挂载，靠非互斥 Panel + 绝对定位层叠实现瞬时切换，两侧内部状态（滚动位置、表单输入）在拖拽前后均不丢失。
2. **一切拖拽归一 Dragon**：大纲树不私造拖拽，只实现 Sensor 协议注册进引擎，因此画布/树/未来任意面板之间天然互通（拖拽对象可以是 Node 或 NodeData）。
3. **locate 是纯计算，createLocation 是唯一落点出口**：所有分支最终都收敛到 `canvas.createLocation`，由引擎统一维护 `document.dropLocation` 并广播，视图只消费事件，职责分离清晰。
4. **防抖三件套**：位移抖动阈值（4px）、插入线命中短路（`'unchanged'` + insertion 矩形）、同类位置克隆（`originLoc.clone`），保证拖拽过程中位置计算与视觉反馈稳定。
5. **展开/滚动全部走 activeTracker**：悬停展开（DwellTimer）、落点后定位、选中联动共用一条 `activeTracker.onChange → expand + scrollToNode` 通道，两个树板（master/backup）行为一致。
