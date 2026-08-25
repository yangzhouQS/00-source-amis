# drag/ — 拖放引擎（AGENTS.md）

画布拖放的完整链路实现：拖拽引擎（dragon）、画布感应器（canvas-sensor）、
拖拽幽灵（drag-ghost）。**本目录不持有 schema**——命中后的插入/移动一律经
`editor.schemaOps`（底层走 `scenarios/pc-desktop/slot-accessors.ts`）。

## 目录结构

```
drag/
├── dragon.ts            拖拽引擎：from（挂拖源）/boost（程序化启动）、传感器选择、
│                        事件序列（mousedown 抖动>4px→dragstart→drag→drop/dragend）、
│                        ESC 取消 / Alt 按住=复制语义、setDraggingState 通知渲染器
├── canvas-sensor.ts     画布感应器（DragSensor 实现）：三级命中 + 槽位几何解析 +
│                        嵌套/后代/单节点槽三重校验 + 插入索引几何计算 + 指示线
├── drag-ghost.tsx       拖拽跟随幽灵（半透明组件名预览，position:fixed 跟随鼠标）
├── drag-ghost-style.less
├── types.ts             契约：DragObject / LocateEvent / DropLocation /
│                        DragSensor（locate/clearIndicator/contentDocument）/
│                        DragonCallbacks（onDragstart/onDrag/onDrop/onDragend）
└── index.ts             barrel（Dragon / CanvasSensor / DragGhost / 类型）
```

## 核心链路

```
面板项 mousedown（components-pane）→ editor.startComponentDrag
  → dragon.boost({ type: "nodeData", data: scaffold }, e)
画布内拖已有节点（designer-host/outline 注册 from）→ boost({ type: "node", nodeId })

  mousemove 抖动 > 4px
    → dragstart（emit onDragstart；setDraggingState(true) 通知渲染器压暗/禁交互）
  每次 mousemove → createLocateEvent(e)（clientX/Y + elementFromPoint）
    → chooseSensor：按全局坐标命中的 contentDocument 选感应器
      （iframe 的 mousemove 天然派发在画布文档内，elementFromPoint 即画布元素）
    → sensor.locate(target, x, y)                    ← canvas-sensor.ts
    → emit onDrag(locateEvent, location | null)

  mouseup → emit onDrop(dragObject, location)
    nodeData → catalog scaffold 建新节点 → editor.insert(containerId, region, node, index)
    node     → editor.move(nodeId, containerId, region, index)
    （均走 slot-accessors insertChildIntoOpts；单节点槽/间接容器语义见下）
  ESC → 取消；Alt 按住 drop → 复制语义（不 move 原 node）
```

## canvas-sensor.locate 校验链（顺序即优先级）

```
0  findContainerEl(target)：从命中元素沿 parentElement 上爬，三级命中
   ① data-editor-id + schemaOps.isContainer(node) → 容器
      slotKey = profile.resolveSlotKeyFromDom(renderType, containerEl, hitEl)
                ?? "defaultSlot"     ← 多槽位几何解析（scenarios/pc-desktop/slot-dom/）
   ② data-slot-host + data-slot-key 显式标记（外置兼容路径，当前渲染库不写入）
   ③ renderer.resolveFromElement 兜底 —— 注意同样要做几何解析
      （无标记时它返回的 slotKey 恒为 defaultSlot 兜底值，会吞掉槽位区分；
       且 cur 可能是槽位子元素，必须 cur.closest 回容器根再查规则）

1.5 嵌套校验  nestingRules.canNest(parentRenderType, slotKey, childRenderType)
              不过 → clearIndicator() + return null
1.6 后代拦截  拖已有节点时 isDescendantNode（防拖进自身/后代成环）
1.7 单节点槽占用拦截  schemaOps.isSingleNodeSlot 且已有占用者且占用者≠拖动者
              → 拒绝（YqToolBar.defaultSlot 等 wrapper 硬编码单节点渲染的槽，
                数组化会让渲染层取 .__nodeOptions 得 undefined 而崩溃）

2  computeInsertIndex(containerId, slotKey, canvasX/Y)
     getSlotChildren（schema 子节点序列）→ 逐个取实时 DOM rect
       （renderer.getNodeElement 优先，querySelector 兜底，防 re-render 后 stale ref）
     → detectMainAxis：hRange > vRange × 1.2 → 水平主轴，否则纵向
     → 按主轴排序 → 光标与子节点中点二分 → rawIndex
     → isLayoutReversed：computedStyle flex row-reverse/column-reverse
       → 视觉序与 schema 序相反 → index = len - rawIndex（翻转）

3  renderIndicator / clearIndicator
     与插入索引共用 detectMainAxis（杜绝"索引按水平算、指示线画竖线"的矛盾）
     画到画布文档 body（assem-drag-indicator），水平主轴→竖线，纵向→横线
```

## 数据契约（types.ts）

| 类型 | 字段要点 |
|---|---|
| `DragObject` | `type: "nodeData" \| "node"`；nodeData 带 `data`（scaffold/renderType），node 带 `nodeId` |
| `DropLocation` | `containerId / region（slotKey）/ index / indicator` |
| `DragSensor` | `id / locate(target,x,y) / clearIndicator() / contentDocument / sensorAvailable` |
| `DragonCallbacks` | `onDragstart / onDrag(locateEvent, location?) / onDrop / onDragend` |

## 已知坑（改动前必读，均为实战踩过）

1. **MouseEvent 必须 `buttons: 1`**：chooseSensor/locate 链路按住左键过滤，
   合成事件不带 buttons 会被静默丢弃（表现为 dragging=true 但 activeSensor=null）。
2. **iframe 模式事件必须派发到画布文档**：host 文档 dispatchEvent 的 target
   不在画布 DOM，sensor.locate 上爬找不到 data-editor-id。鼠标进入 iframe 后
   事件天然来自画布文档；模拟/程序化驱动时用 `iframe.contentDocument.dispatchEvent`，
   坐标用 iframe 视口局部坐标。
3. **category 查询用编辑器静态表**（nesting-categories.ts）：渲染库
   `lookupMeta` 是运行时注册表，iframe 模式下 host 侧库副本未 registerDefaults
   恒 undefined → canNest 全拒绝。渲染库加组件必须同步静态表
   （`__tests__/nesting-categories.test.ts` 守护，漂移即红）。
4. **槽位门禁双源**：渲染库 SLOTS 表（渲染期+编辑器共用）+ 编辑器
   `SLOT_GATE_OVERRIDES`（nesting-rules.ts，纯编辑器语义的槽位如
   YqToolBar.defaultSlot——它由 wrapper 直渲不经 NodeRenderer，渲染库表
   登记无意义）。改门禁先判断语义归属再选边。
5. **单节点槽**（slot-accessors SINGLE_NODE_SLOTS，宿主维度）：wrapper 硬编码
   单节点渲染的槽位，插入走"空→赋值 / 占用→拒绝"分支；moveNode 有预检
   （先 remove 后 insert 的顺序下不预检会丢节点，含拖动者即占用者的原地豁免）。
6. **指示线与索引共用主轴判定**：改其中一个必须同步另一个的轴来源。
7. **子节点 DOM rect 用 freshEl**：渲染器 re-render 会替换元素引用，缓存 rect
   会算出错误 index——每次 locate 重新取元素。

## 自动化验证要点（Playwright，均实战验证过）

- 完整拖拽模拟：`mousedown`（面板项）→ `mousemove` 抖动 >4px（host 文档）→
  画布内 `mousemove` ×2（iframe 文档，间隔 ~120ms 让 locate 跑完）→ 检查
  `dragon.lastLocation` / 指示线 → `mouseup`（buttons: 0）→ 查 schema 落点。
- 拖拽中状态探测：`editor.dragon.dragging / dragObject / activeSensor / lastLocation`
  均为运行时可读字段（TS private 仅编译期）。
- 断言落点用 schema（`schemaOps.getNodeById(...).__nodeOptions[region]`），
  不要只看指示线（它可能来自上一帧）。

## 相关模块

| 模块 | 职责 |
|---|---|
| `core/editor.ts` | wireDragon（onDrop 落地）/ startComponentDrag / isDescendantNode |
| `scenarios/pc-desktop/slot-dom/` | 多槽位几何解析规则（按组件拆分，命中①③调用） |
| `scenarios/pc-desktop/slot-accessors.ts` | 槽位读写单一真相源（插入/单节点槽/间接容器） |
| `scenarios/pc-desktop/nesting-rules.ts` | canNest（SLOTS + 覆盖表 + 静态 category） |
| `designer/designer-host.tsx` | 画布内节点 from() 拖源注册 |
| `plugins/components-pane/` | 面板拖源（startComponentDrag） |
| `plugins/outline-pane/` | 大纲树拖源（canNestInto + move） |
