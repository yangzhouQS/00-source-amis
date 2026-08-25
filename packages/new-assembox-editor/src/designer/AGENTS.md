# designer/ — 设计器交互层（AGENTS.md）

画布交互的核心实现：拖放引擎、选中/hover 覆盖层、右键菜单、原地编辑、节点信息面包屑。
**本目录只做"交互与 DOM 命中"，不持有 schema**——数据一律经 `editor.store` / `editor.schemaOps` 读写。

## 目录结构

```
designer/
├── designer-host.tsx            设计器宿主：挂画布(inline/iframe) + 注册 CanvasSensor + 点击选中
├── bem-tools.tsx / -style.less  覆盖层：hover 虚线框 + 选中实线框 + 工具栏(动作按钮 + NodeSelector)
├── node-selector/               工具栏最左侧节点胶囊：hover 展开父级链（面包屑向上选容器）
├── component-action-manager.ts  工具栏动作声明式注册表（register/getAvailableActions/isDisabled）
├── context-menu-manager.ts      右键菜单注册表
├── live-editing.ts              原地文本编辑（双击 label/button 文本 → contenteditable）
├── dom-marking.ts               DOM 标记常量（唯一：ATTR_EDITOR_ID = "data-editor-id"）
└── drag/
    ├── dragon.ts                拖拽引擎：boost/from、传感器选择、mousedown 抖动(>4px)→dragstart、ESC/Alt 复制
    ├── canvas-sensor.ts         画布感应器：三级命中 + 槽位几何解析 + 插入索引 + 指示线
    ├── drag-ghost.tsx           拖拽跟随幽灵（半透明预览）
    └── types.ts                 DragObject/DropLocation/LocateEvent 契约
```

## 三条核心链路

### 1. 拖放（palette → canvas / canvas 内移动）

```
面板项 mousedown → editor.startComponentDrag → dragon.boost(dragObject, e)
  → mousemove 抖动 >4px → dragstart（setDraggingState 通知渲染器进入拖拽态）
  → 每次 move：createLocateEvent（坐标 + elementFromPoint）
      → chooseSensor（按全局坐标命中感应区；iframe 事件天然来自画布文档）
      → sensor.locate(target, x, y)                      ← canvas-sensor
          ① findContainerEl 三级命中（见下）
          ② nestingRules.canNest 嵌套校验（不过 → 清指示线返 null）
          ③ isDescendantNode 后代拦截（防拖进自身）
          ④ computeInsertIndex：schema 子节点 + 实时 DOM rect
             → detectMainAxis（hRange > vRange×1.2 判水平）
             → 光标与子节点中点二分 → row-reverse/column-reverse 则索引翻转
          ⑤ renderIndicator（与 ④ 共用主轴判定，杜绝方向矛盾）
  → mouseup → editor.onDrop
      nodeData（新组件）→ catalog scaffold 建节点 → insert(containerId, region, node, index)
      node（已有节点）  → move(nodeId, containerId, region, index)
      （落地均走 slot-accessors insertChildIntoOpts；间接容器空壳优先/ createEntry 造壳）
```

**findContainerEl 三级命中**（canvas-sensor.ts，从 elementFromPoint 结果向上爬 parentElement）：

1. `data-editor-id` + `schemaOps.isContainer(node)` → 容器；slotKey 由场景几何解析：
   `editor.profile.resolveSlotKeyFromDom(renderType, containerEl, hitEl) ?? "defaultSlot"`
   （多槽位组件规则表在 `scenarios/pc-desktop/slot-dom/`，按组件一文件拆分）
2. `data-slot-host` + `data-slot-key` 显式标记（外置标记兼容路径，当前渲染库不写入）
3. `renderer.resolveFromElement` 兜底；命中③同样要做场景几何解析（resolveFromElement 无标记时 slotKey 恒为 defaultSlot 兜底值，会吞掉槽位区分；注意 `cur.closest` 回容器根再查规则）

### 2. 选中 / hover

```
画布 mousedown（iframe 经渲染器 onClick 回报 / designer-host 空白点击兜底）
  → editor.handleClick → store.select(id) → state.activeId
BemTools 响应 activeId：computePos（renderer.getNodeElement + rect，iframe 坐标加 iframe 偏移）
  → select-box（transform 定位，不撑滚动容器）+ 工具栏（智能避让：上/下/框内三选一）
hover 同构（state.hoverId → hover-box 虚线框）
```

### 3. NodeSelector 父级链（node-selector/index.tsx）

```
选中节点 → 胶囊(图标+名称, catalog 元数据) 置工具栏视觉最左
hover 胶囊 → el-popover(trigger=hover) 展开父级链（getParentById 向上 ≤5 层）
hover 项 → store.state.hoverId 联动高亮
click 项 → editor.select(父id)（深层容器"点不到"时的选中逃生舱，借鉴 lowcode-engine）
```

## 已知坑（改动前必读，均为实战踩过）

1. **boxes 数组必须带稳定 key**（bem-tools.tsx）：hover-box 的插入/移除若数组无 key，
   select-box 按位置错位 patch → 工具栏/NodeSelector 整体重挂载 → el-popover 弹层被
   替换为关闭态新实例，表现为"鼠标移向选项弹层就收起"。已加 `key="hover-box"/"select-box"`。
2. **嵌套校验的 category 查询用编辑器侧静态表**（`scenarios/pc-desktop/nesting-categories.ts`）：
   渲染库 `lookupMeta` 是运行时注册表，iframe 模式下 host 侧库副本未 registerDefaults，
   恒 undefined → canNest 全拒绝。静态表与渲染库 COMPONENTS 的对齐由
   `src/__tests__/nesting-categories.test.ts` 守护，渲染库加组件必须同步该表（测试会红）。
3. **toolbar 是 `flex-direction: row-reverse`**：DOM 尾部 = 视觉最左。往工具栏加"视觉最左"
   的元素要放在 map 之后（NodeSelector 即如此）。
4. **BEM 命名空间**（useAssemNamespace）：`ns.e("current")` 生成 `block__current`（挂在
   同 block 下），跨文件复用 block（如 node-selector 复用 "bem-tools" block）时元素名
   必须写全 `ns.e("node-selector-current")`，且与 less 类名严格一致；根元素勿用 `ns.b()`
   （与宿主 block 根类名撞车）。
5. **transform 定位**（posStyle）：边框/覆盖层用 `translate3d` 而非 left/top——transform
   不参与父级 scrollWidth 计算，移到容器外不会撑高滚动区。
6. **多槽位组件新增**：在 `scenarios/pc-desktop/slot-dom/` 建 resolver 文件 + 注册表加一行；
   类名取自 element-plus-ui 源码，升级 UI 库改类名需同步（匹配不到自动回退 defaultSlot，
   不会更糟）。单测在 `src/__tests__/slot-dom.test.ts`。
7. **右键菜单/动作注册**是声明式的（context-menu-manager / component-action-manager），
   不要在 BemTools 里硬编码按钮——注册 `register({name,title,icon,condition,action,weight})`。

## 自动化验证要点（Playwright）

- 拖拽模拟必须：① mousedown 后 mousemove 抖动 >4px 触发 dragstart；② MouseEvent 带
  `buttons: 1`（否则 chooseSensor 不认）；③ 鼠标进入 iframe 后事件要派发到
  **iframe 的 contentDocument**（host 文档事件的 target 不在画布，sensor.locate 爬不到）。
- hover 模拟用 Playwright `hover`（CDP 真实输入）；合成 `dispatchEvent` 里
  `mouseenter/leave` 不冒泡，派发到子元素不触发根监听，结论不可信。
- 弹层"可见性"判断用 `getComputedStyle.display/visibility`，el-popover 默认 persistent
  （隐藏后节点仍在 body，不能只查存在性）。
- 验证子树是否被重挂载：给节点挂 `el.__marker = 'x'`，操作后检查标记是否存活。

## 相关模块（改本目录常要一起看）

| 模块 | 职责 |
|---|---|
| `core/editor.ts` | Editor 门面：handleClick/onDrop/select/startComponentDrag/wireDragon |
| `core/store.ts` | state（activeId/hoverId/schema/designMode）响应式源 |
| `scenarios/pc-desktop/slot-dom/` | 多槽位组件槽位解析规则（按组件拆分） |
| `scenarios/pc-desktop/slot-accessors.ts` | 槽位读写单一真相源（insert/locate/forEachChild） |
| `scenarios/pc-desktop/nesting-rules.ts` | canNest（SLOTS 门禁 + 静态 category 表） |
| `simulator/iframe/*` | iframe 画布渲染器（getNodeElement/onClick 回报） |
| `skeleton/widgets/tip` | 工具栏 Tip 提示 |
