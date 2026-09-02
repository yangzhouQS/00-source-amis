# 三期设计文档：大纲树拖拽统一到 Dragon 引擎（outline-drag-unification）

> 关联文档：[outline-pane-implementation.md](./outline-pane-implementation.md)（旧版机制解析）
> 前置依赖：**一期**（右区 backup 面板切换）、**二期**（OutlineSensor 投放感应区）
> 影响范围：`plugins/outline-pane/`、`designer/drag/`、`core/editor.ts`
>
> 本文回答：
> 1. 为什么大纲树要放弃原生 HTML5 DnD、统一到 Dragon 自模拟拖拽？
> 2. 具体怎么改（文件级设计 + 代码骨架）？
> 3. 成本多少、风险在哪、怎么验收与回滚？

---

## 目录

1. [背景与动机](#1-背景与动机)
2. [现状盘点：两套拖拽体系并存的实证](#2-现状盘点两套拖拽体系并存的实证)
3. [目标与非目标](#3-目标与非目标)
4. [总体设计](#4-总体设计)
5. [详细设计](#5-详细设计)
6. [交互行为对照表（迁移前 vs 迁移后）](#6-交互行为对照表迁移前-vs-迁移后)
7. [改造成本明细](#7-改造成本明细)
8. [风险清单与缓解](#8-风险清单与缓解)
9. [测试计划](#9-测试计划)
10. [实施顺序与回滚策略](#10-实施顺序与回滚策略)
11. [验收标准（DoD）](#11-验收标准dod)

---

## 1. 背景与动机

### 1.1 现状

当前编辑器同时存在两套互不相通的拖拽体系：

| 体系 | 使用方 | 事件模型 | 能力 |
|---|---|---|---|
| **Dragon**（自模拟，mousedown→mousemove→mouseup） | 组件面板 → 画布（`startComponentDrag`，editor.ts:360） | 捕获阶段监听 host doc + 所有 sensor 文档 | 4px 抖动判定、ESC 取消、Alt/Ctrl 复制态标记、DragGhost 幽灵、跨 iframe、sensor 协议 |
| **原生 HTML5 DnD**（draggable + dragstart/dragover/drop） | 大纲树内部（tree-node.tsx:91 `draggable`） | 浏览器原生 drag 事件 | 仅树内排序/移动，无法跨出树 |

两者互不相通的直接后果：

- **面板组件拖不进大纲树**（Dragon 拖拽不会触发树的 dragover）——二期 OutlineSensor 解决；
- **树上节点拖不到画布**（原生 dragover/drop 在画布侧无监听，CanvasSensor 只认 Dragon 事件）——**三期解决**；
- **树上拖拽没有 ESC 取消、没有 Alt 复制、没有 DragGhost**——三期解决；
- 两套代码路径、两套落点语义、两套测试方法，维护成本双份。

### 1.2 动机

三期 = 把大纲树从原生 DnD 迁到 Dragon，成为 Dragon 的**拖源**（from）+ 继续作为二期的**投放感应区**（sensor），实现"一切拖拽归一 Dragon"（旧版设计要点，见 outline-pane-implementation.md 附录-2）。

统一后免费获得的能力：

1. **树 → 画布拖拽移动节点**（现在做不到，用户只能删除后重新拖入）；
2. **树 → 树、树 → 画布、画布 → 树、面板 → 树** 四条拖拽链路共用一条事件流水线；
3. ESC 中途取消、Alt/Ctrl 按住复制投放（需顺带补全 Dragon 的 copy 语义传递，见 D4）；
4. 树拖拽获得 DragGhost 跟随提示；
5. 一期 backup 面板切换状态机对树拖拽同样生效（`dragon.onDragstart` 天然覆盖）。

---

## 2. 现状盘点：两套拖拽体系并存的实证

### 2.1 树侧（原生 DnD）现状

```
tree-node.tsx
├─ :91   draggable={!isScene.value}            ← 原生拖拽开关
├─ :106  onDragstart → emit("dragstart")       ← index.tsx:161 handleDragStart
├─ :107  onDragover  → emit("dragover")        ← index.tsx:167 handleDragOver（落点计算+dwell）
├─ :108  onDrop      → emit("drop")            ← index.tsx:189 handleDrop
└─ :109  onDragend   → emit("dragend")         ← index.tsx:200 handleDragEnd

index.tsx（outline-pane）
├─ :156-158  draggingId / dragOverId / dragOverMode 本地状态
├─ :161-165  handleDragStart：dataTransfer.setData("text/plain", node.id)
├─ :167-187  handleDragOver：computeDropMode(25/50/25) + canDrop + DwellExpander
├─ :189-198  handleDrop：executeDrop（直接 editor.move，绕过 Dragon onDrop 管线）
└─ :200-209  handleDragEnd / clearDragState

tree-drag.ts（纯函数，121 行）
├─ computeDropMode / isDescendant / collectRootIds / canNestInto / canDrop / executeDrop
└─ DwellExpander（800ms 悬停展开）
```

### 2.2 Dragon 侧现状（与三期的差距）

| 能力 | 现状 | 差距 |
|---|---|---|
| 抖动判定（点击 vs 拖拽） | ✅ dragon.ts:22-31、265 | 无 |
| ESC 取消 | ✅ dragon.ts:158-166 | 树原生 DnD 享受不到 |
| Alt/Ctrl 复制态 | ⚠️ **只标记不传递**：`_copy`（dragon.ts:156、168-170）从未传给 onDrop，`DragonCallbacks.onDrop` 签名无 copy 参数（types.ts:92）；wireDragon 的 node 分支只调 `move`，无复制分支（editor.ts:315-324） | **三期必须补全，否则树迁移后 copy 依旧是哑弹** |
| DragGhost | ✅ drag-ghost.tsx:26-44 订阅 onDragstart/onDrag/onDragend | 树原生 DnD 无 ghost |
| 投放执行 | ✅ wireDragon onDrop（editor.ts:268-326）：nodeData→insert / node→move，sensor 无关 | 树的 executeDrop 绕过此管线（双重校验逻辑分叉） |
| 树作为拖源 | ❌ 树节点未接 `dragon.from()` / `startNodeDrag`（editor.ts:375 已有 API 但无调用方） | 三期核心工作 |
| 树作为投放区 | ❌（二期 OutlineSensor 交付） | 三期硬前置 |

### 2.3 并存的技术冲突（为什么必须移除 draggable，不能双轨）

`draggable=true` 的元素上 mousedown 后，浏览器可能进入**原生拖拽模式**：此后 `mousemove`/`mouseup` 停止派发（被 dragstart/drag/dragend 取代）。若三期只给树接 `dragon.from()`（绑 mousedown）而保留 `draggable`：

- Dragon boost 后等待 mousemove 判抖动 → 浏览器切原生 DnD → mousemove 不来 → **Dragon 挂起**（listeners 挂着、拖拽态残留，直到下一次任意点击才可能恢复）；
- 反向：原生 drag 进行中 Dragon 完全无感知。

结论：**迁移必须一次性移除 `draggable` 与全部原生 DnD 处理器**，用功能开关做灰度而非双轨并存（见 §10）。

---

## 3. 目标与非目标

### 3.1 目标

1. 树节点成为 Dragon 拖源：mousedown（左键）→ 抖动 >4px → dragstart，产出 `{ type: "node", nodeId, title }`；
2. 删除树的原生 DnD 代码路径（draggable、4 个 handler、dataTransfer 通信）；
3. 树上拖拽的落点高亮改由二期 OutlineSensor 的 locate 驱动（sensor 内复用 computeDropMode/canDrop）；
4. 投放执行统一收敛到 `wireDragon.onDrop`（executeDrop 退役）；
5. 补全 Dragon copy 语义传递链：`_copy` → onDrop 回调参数 → wireDragon node 分支复制投放（clone + regenerateNodeIds + insert，复用 duplicate 的成熟逻辑 editor.ts:759-776）；
6. 点击/拖拽二义性处理：抖动阈值内 mouseup = 点击选中（现有 onClick 不受影响）；
7. 全链路 Playwright e2e + tree-drag 纯函数单测。

### 3.2 非目标（明确不做）

| 项 | 理由 |
|---|---|
| 多选拖拽（旧版 ctrl/meta 多选后拖集合） | 新版 store 为单选模型（activeId），需先做选区模型重构，独立立项 |
| 水平缩进进/出容器（旧版 IndentTrack ±15px） | 树纵向三段命中已够用；缩进交互与画布拖拽语义冲突，观察用户反馈再定 |
| 条件分支分组（conditionGroup）拖拽特判 | 新版 schema 无此概念 |
| 树内边缘自动滚动（旧版 Scroller） | 高树拖拽时手动滚轮可解；列为三期 P2 可选增强（见 D8） |
| 根节点（场景根）作为拖拽目标 | 维持现状：根不可 before/after（canDrop 已拦截 collectRootIds） |

---

## 4. 总体设计

### 4.1 目标架构（改造后）

```
┌─ 拖源（统一 Dragon.from 语义）────────────────────────────────┐
│  组件面板项 mousedown → startComponentDrag → boost(nodeData)  │
│  画布节点 mousedown   → startNodeDrag     → boost(node)  ①    │
│  大纲树节点 mousedown → startNodeDrag     → boost(node)  ②新增 │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─ Dragon（唯一事件流水线）─────────────────────────────────────┐
│  mousemove >4px → dragstart（ghost 显示 / backup 面板切换①）   │
│  每次 mousemove → chooseSensor（isEnter 全局坐标命中）          │
│  ESC → 取消  /  Alt|Ctrl → copy 态（传递到 onDrop）③补全       │
└──────────────────────────────────────────────────────────────┘
              │                                    │
              ▼                                    ▼
┌─ CanvasSensor（画布）──────┐      ┌─ OutlineSensor（大纲树）②二期交付│
│ 三级命中 + 槽位几何解析     │      │ data-node-id 反查 + 三段命中      │
│ 产出 DropLocation          │      │ 产出 DropLocation                │
└───────────────────────────┘      └─────────────────────────────────┘
              │                                    │
              └──────────────┬─────────────────────┘
                             ▼
┌─ wireDragon.onDrop（唯一投放出口）④───────────────────────────┐
│  nodeData → catalog scaffold → insert                        │
│  node     → copy ? duplicate+insert : move                   │
│  （嵌套校验兜底保留：canNest(parentRenderType, region, child)） │
└──────────────────────────────────────────────────────────────┘
```

① 一期交付　② 二期交付（三期补 node 型支持）　③④ 三期补全/收敛

### 4.2 二三期边界（避免范围漂移）

| 能力 | 二期交付 | 三期交付 |
|---|---|---|
| OutlineSensor（locate/isEnter/指示线） | ✅ 含 nodeData 型 | 补 node 型（拖已有节点的 canDrop 校验、防环） |
| 树拖源 | ❌ 仍原生 DnD | ✅ 迁 Dragon |
| executeDrop（树侧直接 move） | 保留（树内拖仍是原生 DnD） | **退役**（统一走 onDrop） |
| copy 语义链路 | ❌ | ✅ |
| 树 → 画布拖拽 | ❌ | ✅（免费获得：node 型 + CanvasSensor 均已存在） |

> 若二期未实施先行三期：树上"自己拖自己"没有 sensor 承接，拖拽悬空无反馈。**三期硬依赖二期**，排期上不可倒置。

---

## 5. 详细设计

### D1 树节点拖源改造（tree-node.tsx + index.tsx）

**tree-node.tsx：**

```tsx
// 删除
draggable={!isScene.value}                                  // :91
onDragstart={(e) => emit("dragstart", e, props.node)}       // :106
onDragover={(e) => emit("dragover", e, props.node)}         // :107
onDrop={(e) => emit("drop", e, props.node)}                 // :108
onDragend={() => emit("dragend")}                           // :109

// 新增（同一位置）
onMousedown={(e: MouseEvent) => emit("nodeMousedown", e, props.node)}
```

emits 声明同步收敛（tree-node.tsx:41）：`dragstart/dragover/drop/dragend` → `nodeMousedown`。
递归子节点转发（tree-node.tsx:176-179）同步替换。

**index.tsx 拖源入口：**

```tsx
/** 拖源 mousedown：左键 + 非交互元素豁免 → Dragon boost（4px 内 mouseup = 点击选中） */
const handleNodeMousedown = (e: MouseEvent, node: OutlineNode) => {
  if (e.button !== 0) return;
  if (node.id.startsWith("__scene__")) return;
  // 豁免：删除按钮 / 展开箭头等交互元素（closest 白名单，防按住按钮拖出节点）
  const target = e.target as HTMLElement;
  if (target.closest(`.${ns.e("node-actions")}, .${ns.e("node-arrow")}, button, input, .el-popper`)) return;
  props.editor.startNodeDrag(e, node.id);   // editor.ts:375 既有 API，title 取节点显示名
};
```

要点：

- **`startNodeDrag` 已存在且无调用方**（editor.ts:375-385），三期是它的首个消费者，零引擎改动接拖源；
- **点击/拖拽二义**：Dragon 抖动 4px 内 mouseup 不进入 dragstart，浏览器照常派发 click → 现有 `onClick → handleSelect`（index.tsx:95）不受影响；拖拽位移大于阈值时 click 的 mousedown/up target 不同，浏览器不派发 click，无误选。**无需旧版 `isShaken` 二次确认**（旧版需要是因为 click 监听在 mousedown 的原元素上，新版 click 语义天然正确）；
- **豁免白名单**用 closest 而非事件 target 判等：删除按钮内是 `<button>`/`<el-icon>` 多层结构。

### D2 落点高亮状态机迁移（index.tsx）

现状：`dragOverId/dragOverMode` 由原生 dragover 事件流驱动（index.tsx:156-158、177-178）。
迁移后：树不再是事件接收方，**高亮状态改由 Dragon 事件流驱动**：

```tsx
// 删除：handleDragStart / handleDragOver / handleDrop / handleDragEnd + dataTransfer 全套（~60 行）
// 保留：dragOverId / dragOverMode / draggingId 三个 ref（TreeNode props 接口不变，CSS 类不动）

// 新增：订阅 Dragon（组件 mount 时）
onMounted(() => {
  offDrag = props.editor.dragon.on({
    onDragstart: () => {
      draggingId.value = props.editor.dragon.dragObject?.type === "node"
        ? props.editor.dragon.dragObject.nodeId ?? ""
        : "";
    },
    onDrag: (_e, location) => {
      // 仅当OutlineSensor是激活感应区时才有树侧落点（location.source 见 D3）
      const tree = location as TreeDropLocation;           // 扩展字段 source/dropMode/targetNodeId
      dragOverId.value = tree?.source === "outline" ? tree.targetNodeId : "";
      dragOverMode.value = tree?.dropMode ?? "inner";
      dwellHover(tree);                                     // DwellExpander 驱动不变（复用现有 dwell 实例）
    },
    onDragend: clearDragState,                              // ESC 取消/投放完成统一走这里
  });
});
onBeforeUnmount(() => { offDrag?.(); dwell.destroy(); });
```

收益：`DwellExpander`（tree-drag.ts:99-121）原样复用；`drag-over/drag-inner` CSS（tree-node.tsx:87-88）原样复用。

### D3 OutlineSensor 产出扩展（二期产物 + 三期增量）

`DropLocation`（types.ts:43-58）增加**可选**扩展字段（向后兼容，CanvasSensor 不受影响）：

```ts
export interface DropLocation {
  containerId: NodeId;
  region: string;
  index: number;
  indicator?: { /* 画布指示线，不变 */ };
  /** 三期新增（可选）：产生本位置的感应区标识 */
  source?: "canvas" | "outline";
  /** 三期新增（可选）：树侧三段命中语义（驱动 drag-over/drag-inner CSS） */
  dropMode?: "before" | "after" | "inner";
  /** 三期新增（可选）：命中的树节点 id（高亮目标行） */
  targetNodeId?: NodeId;
}
```

OutlineSensor.locate 内部（二期骨架，三期增量标注）：

```ts
locate(target, x, y): DropLocation | null {
  const row = (target as HTMLElement | null)?.closest("[data-node-id]");
  if (!row) return null;                                   // 树空白/面板 padding：无落点
  const nodeId = row.getAttribute("data-node-id")!;

  // 三期增量：node 型拖拽的校验链（tree-drag.ts 既有纯函数直接复用）
  const dragObj = this.editor.dragon.dragObject;
  if (dragObj?.type === "node") {
    const mode = computeDropMode(row as HTMLElement, y);
    if (!canDrop(this.editor, dragObj.nodeId!, nodeId, mode, buildOutline(...))) return null;
    // canDrop 内含：自拖/后代拦截（isDescendant）、场景组拦截、根 before/after 拦截、嵌套校验
  }

  const mode = computeDropMode(row as HTMLElement, y);      // 25/50/25 三段（tree-drag.ts:12-18）
  if (mode === "inner") {
    // inner：目标即容器，defaultSlot 语义（单节点槽/间接容器由 onDrop 落地时的
    // slot-accessors + nestingRules 兜底，与画布同构）
    return { containerId: nodeId, region: "defaultSlot", index: END,
             source: "outline", dropMode: "inner", targetNodeId: nodeId };
  }
  // before/after：定位到目标的父槽位（executeDrop 的 findSlotOf 逻辑内聚到 sensor）
  const loc = this.editor.schemaOps.findSlotOf(this.editor.store.schema, nodeId);
  if (!loc) return null;                                    // 根节点 before/after → null（canDrop 已拦，双保险）
  return { containerId: loc.parentId, region: loc.slotKey,
           index: mode === "after" ? loc.index + 1 : loc.index,
           source: "outline", dropMode: mode, targetNodeId: nodeId };
}
```

设计决策：

1. **before/after 的位置换算内聚到 sensor**（原 executeDrop:91-96 的 findSlotOf 逻辑平移），onDrop 管线无感知；
2. **校验前置到 locate**（canDrop 拒绝 → 返回 null → 无高亮），wireDragon onDrop 的 canNest 兜底保留（双保险，画布链路同构）；
3. `buildOutline` 输入：sensor 持有 editor 引用，直接 `buildOutlineFromSchemaOps`（树视图与 sensor 各自构建 OutlineNode 树，纯数据无状态，开销可接受；避免 sensor ↔ 视图实例耦合）。

### D4 copy 语义补全（dragon.ts + editor.ts）——三期必须项

现状断链：`_copy` 只在 dragon.ts:156 闭包里翻转，从未传出。

**(1) 回调签名扩展**（types.ts:92，可选参数向后兼容）：

```ts
onDrop?: (dragObject: DragObject, location: DropLocation, copy?: boolean) => void;
onDragend?: (dragObject: DragObject, location: DropLocation | null, copy?: boolean) => void;
```

**(2) dragon.ts over() 传出**（约 272-299 处）：

```ts
if (dragObj && loc) {
  this.emit("onDrop", dragObj, loc, _copy);
}
if (dragObj) {
  this.emit("onDragend", dragObj, loc, _copy);
}
```

**(3) wireDragon node 分支补复制**（editor.ts:315-324）：

```ts
} else if (dragObject.type === "node" && dragObject.nodeId) {
  if (this.isDescendantNode(dragObject.nodeId, location.containerId)) return;
  if (copy) {
    // 复制投放：clone → 重生成 id → insert（对齐 duplicate 的成熟逻辑 editor.ts:759-776）
    const node = this.schemaOps.getNodeById(this.store.schema, dragObject.nodeId);
    if (!node) return;
    const cloned = this.schemaOps.cloneNode(node);
    this.regenerateNodeIds(cloned);
    this.insert(location.containerId, location.region, cloned, location.index);
    this.store.select(this.schemaOps.getNodeId(cloned));
  } else {
    this.move(dragObject.nodeId, location.containerId, location.region, location.index);
  }
}
```

注：nodeData 型（面板拖入）本身就是新建，`copy` 对其无语义，忽略。

**(4) 视觉反馈（可选增强）**：DragGhost 在 copy 态追加"⊕ 复制"角标——订阅 onDrag 无法拿到 copy 键态，简化方案：ghost 订阅 document keydown/keyup 自查 Alt/Ctrl（与 dragon.checkCopy 同源逻辑，展示用不追求强一致）。

### D5 ESC 取消（免费能力，仅验证）

Dragon 已实现（dragon.ts:158-166：ESC → 清 lastLocation → over() → onDragend 无 location）。迁移后树上拖拽按 ESC：

- 不执行任何 schema 变更 ✅（onDrop 不触发）
- 树高亮清理：D2 的 `onDragend: clearDragState` 兜底 ✅
- ghost 消失：drag-ghost.tsx:39-42 已订阅 ✅

唯一注意：ESC 监听绑定在 host document + sensor 文档（dragon.ts:325），**焦点在树面板（host 文档）时有效**；无需额外处理。

### D6 树 → 画布拖拽（免费能力，仅验证）

链路：树 mousedown → boost(node) → 鼠标移入画布 → chooseSensor 命中 CanvasSensor（isEnter 全局坐标，dragon.ts:212-226）→ canvas-sensor.locate（三级命中 + 嵌套校验，node 型 `isDescendantNode` 拦截已在 canvas-sensor 实施见 AGENTS 1.6）→ mouseup → wireDragon.onDrop node 分支 move。

**零新增代码**，e2e 补回归用例即可。这是三期最划算的收益——当前用户想移动节点到别的容器，只能删了重拖。

### D7 hover 联动保留与抑制

树行 `onMouseenter → store.state.hoverId`（tree-node.tsx:94-99，画布高亮联动）在拖拽中**保留**：拖拽经过树行时画布对应节点亮框，是"拖到哪一层"的有效反馈（对齐旧版 detecting 联动）。副作用（拖拽中鼠标扫过树行触发画布 hover-box 重渲染）经评估可接受——hover-box 是 transform 定位轻量节点（AGENTS designer/坑-5）。

### D8 树内边缘自动滚动（P2 可选，默认不做）

若用户反馈长树拖拽够不到目标再实施：sensor.locate 首行加 rAF 滚动检测（距面板顶/底 30px 内按距离 10~50px/帧滚动），实现约 60 行 + 样式 0。**默认不排期**，列为观察项。

---

## 6. 交互行为对照表（迁移前 vs 迁移后）

| 场景 | 迁移前（原生 DnD） | 迁移后（Dragon） |
|---|---|---|
| 树内拖动排序（before/after/inner） | ✅ | ✅（三段命中语义/高亮 CSS/dwell 展开完全一致） |
| 悬停折叠节点自动展开 | ✅ 800ms | ✅ 同参数（DwellExpander 复用） |
| 拖入自身后代拦截 | ✅ isDescendant | ✅ 同函数 |
| 嵌套规则校验 | ✅ canNestInto | ✅ 同函数 + onDrop 兜底（多一层保险） |
| ESC 取消 | ❌ | ✅ |
| Alt/Ctrl 复制投放 | ❌ | ✅（D4） |
| 拖拽幽灵提示 | ❌ | ✅ DragGhost |
| 树 → 画布移动节点 | ❌ | ✅（D6） |
| 画布 → 树移动节点 | ❌ | ✅（二期 sensor + node 型，D3） |
| 面板 → 树插入 | ❌ | ✅（二期交付） |
| 点击选中（未拖动） | ✅ | ✅（抖动阈值内 click 原样派发） |
| 拖拽中右侧切大纲树（一期） | ❌（原生 DnD 不触发 dragon.onDragstart） | ✅（树拖拽也触发 backup 面板切换） |
| 拖拽结束高亮清理 | dragend 事件 | onDragend 统一（ESC/投放/取消三路收敛） |

---

## 7. 改造成本明细

### 7.1 文件级改动清单

| 文件 | 类型 | 改动内容 | 估算行数 |
|---|---|---|---|
| `plugins/outline-pane/tree-node.tsx` | 修改 | 删 draggable + 4 个 DnD handler；加 onMousedown 转发；emits 收敛；递归转发同步 | -20 / +12 |
| `plugins/outline-pane/index.tsx` | 修改 | 删 handleDragStart/Over/Drop/End + dataTransfer（~60 行）；加 handleNodeMousedown（~10）+ Dragon 订阅块（~35） | -60 / +45 |
| `plugins/outline-pane/tree-drag.ts` | 修改 | executeDrop 退役（-20）；canNestInto/canDrop/computeDropMode/isDescendant 保留供 sensor；DwellExpander 保留 | -20 / 0 |
| `designer/drag/types.ts` | 修改 | DropLocation 加 source/dropMode/targetNodeId 可选字段；onDrop/onDragend 签名加 copy | +10 |
| `designer/drag/dragon.ts` | 修改 | over() 传出 _copy（两处 emit） | +2 |
| `core/editor.ts` | 修改 | wireDragon node 分支 copy 复制投放（clone+regenerate+insert+select） | +18 |
| `designer/drag/outline-sensor.ts`（二期产物） | 修改 | node 型校验链 + source/dropMode/targetNodeId 产出 + findSlotOf 平移 | +55 |
| `designer/drag/drag-ghost.tsx` | 修改（可选） | copy 角标（键态自查） | +15 |
| **核心代码净计** | | | **≈ -100 / +155（净 +55，其中 +55 在二期文件）** |
| `src/__tests__/tree-drag.test.ts` | 新增 | 纯函数既有行为锁 + copy 分支单测 | ~150 |
| `e2e/outline-drag.spec.ts` | 新增 | 见 §9.2 场景表 | ~280 |
| **含测试合计** | | | **≈ 500 行** |

### 7.2 人日估算

| 项 | 估算 | 说明 |
|---|---|---|
| 开发（D1-D5） | 2.0 人日 | 改动面小但交互细节多（豁免白名单/二义性/状态清理） |
| 联调（D6/D7 + 一期面板联动 + iframe 画布） | 1.0 人日 | 四条拖拽链路互拖回归 |
| 单测 + e2e 编写 | 1.5 人日 | e2e 拖拽模拟有既有方法论（AGENTS：buttons:1、抖动 >4px、iframe contentDocument 派发） |
| 缓冲 | 0.5 人日 | 原生 DnD 残留行为清理（浏览器拖拽手势/文本选中等边角） |
| **合计** | **5 人日**（单人） | 前提：二期 sensor 已合入 |

> 若与二期（OutlineSensor 新建，估 4-5 人日）合并排期：整体 9-10 人日，建议拆两个 PR 但同一迭代交付。

---

## 8. 风险清单与缓解

| # | 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|---|
| R1 | draggable 未清干净 → 原生 DnD 抢占事件，Dragon 挂起（§2.3） | 中 | 高 | 全局 grep `draggable|dataTransfer` 守护；e2e 用例覆盖"树拖到画布"（挂起必红） |
| R2 | 拖拽中树重渲染（dwell 展开/schema 变更）导致 locate 拿 stale DOM rect | 中 | 中 | locate 每次经 `closest("[data-node-id]")` 实时取行元素（对齐 AGENTS drag/坑-7 freshEl 原则）；不做 rect 缓存 |
| R3 | mousedown 豁免漏项（右键菜单项、popconfirm 弹层内按下） | 中 | 低 | closest 白名单 + e2e"删除按钮按住拖动不拖起节点"用例；弹层在 body 下（el-popper），不在树行内，天然不命中 |
| R4 | copy 语义与既有快捷键冲突（Alt 在 Windows 部分浏览器触发菜单） | 低 | 低 | Ctrl 同样生效（dragon.checkCopy 两者都认）；文档标注 Alt 为主、Ctrl 为备 |
| R5 | 抖动 4px 内 mouseup 后 click 误触发选中拖拽起点节点 | 低 | 低 | 属预期行为（等同点击）；若反馈差再引入旧版 isShaken 二次确认（+6 行） |
| R6 | 树节点 title 字段（ghost 显示）取 `__nodeName` 可读性差 | 低 | 低 | startNodeDrag 已用 getNodeLabel；增强：catalog 显示名优先（+3 行） |
| R7 | 一期 backup 面板在树拖拽时也弹出（树上拖 → 右区切树） | 低 | 中 | 预期行为（旧版同款）；但树拖拽起于左侧树本身时视觉重复——switchPanes 去重逻辑（一期）按"激活 sensor 是否 outline"二次判断（+5 行，一期实现时预留） |
| R8 | 移动端/触屏无 mousedown | — | — | 现状同样不支持（原生 DnD 触屏更差），非回归 |

---

## 9. 测试计划

### 9.1 单元测试（`src/__tests__/tree-drag.test.ts` 新增）

| 用例 | 断言 |
|---|---|
| computeDropMode 三段边界 | rect.top+0.24h → before；0.26h~0.74h → inner；0.76h → after |
| canDrop 防环 | 拖节点到其孙子 → false |
| canDrop 根拦截 | 目标为顶层节点 before/after → false |
| canNestInto | Button → YqFlexLine.defaultSlot true；Button → Button.defaultSlot 按静态表 |
| sensor locate 三映射 | before → (parent, slot, i)；after → (parent, slot, i+1)；inner → (target, defaultSlot, END) |
| wireDragon copy 分支 | copy=true 时 schema 中原节点仍在 + 新节点 id 不同（regenerate 生效） |

### 9.2 Playwright e2e（`e2e/outline-drag.spec.ts` 新增）

> 模拟方法遵循 AGENTS drag/ 已验证经验：`mousedown`（树行）→ host 文档 `mousemove` 抖动 >4px → 目标位置 `mousemove`（host 文档，树在 host 侧）或 iframe `contentDocument` 派发（画布侧）→ `mouseup`（buttons:0）；断言用 schema 落点而非指示线。

| # | 场景 | 断言 |
|---|---|---|
| 1 | 树内 before/after/inner 三态拖动 | schema 子序变化 / 容器变化；drag-over/drag-inner CSS 类出现 |
| 2 | 悬停折叠节点 800ms | expandedIds 变化 + 子级渲染 |
| 3 | 拖节点进自身后代 | 无 schema 变更、无高亮 |
| 4 | **树 → 画布**移动（R1 守护用例） | iframe 画布内 schema 落点正确、无 Dragon 挂起（`dragon.dragging === false` 终态） |
| 5 | 画布 → 树（二期回归 + 三期 node 型） | 树内 schema 落点正确 |
| 6 | ESC 取消 | schema 不变、高亮清空、ghost 隐藏 |
| 7 | Ctrl 按住投放 | 原节点保留 + 克隆落位 + 新 id |
| 8 | 点击树行（<4px 位移） | 选中生效、不触发拖拽 |
| 9 | 按住删除按钮拖动 | 不拖起节点、popconfirm 正常 |
| 10 | 拖拽中右区切大纲树（一期联动） | backup 面板出现，dragend 后恢复 |

### 9.3 回归范围

- `e2e/smoke.spec.ts` 全绿（画布加载不受影响）；
- 既有单测全绿（slot-accessors / nesting-categories / slot-dom 等，本改造不应触碰其断言面）；
- 手工回归：树搜索过滤态下拖拽（filteredData 与 sensor 的 buildOutline 数据源不一致场景——**设计决策：拖拽期间禁用搜索框或拖拽以全量树为准**，取后者，sensor 不感知过滤）。

---

## 10. 实施顺序与回滚策略

### 10.1 PR 切分（建议 2 个 PR，同一迭代）

**PR-1：引擎补全（无行为变化的基建）**
1. types.ts：DropLocation 扩展字段 + 回调 copy 参数（可选，全兼容）
2. dragon.ts：over() 传出 _copy
3. editor.ts：wireDragon copy 分支
4. 单测：copy 分支 + types 兼容性
→ 可独立合入，先行验证画布拖拽 Alt 复制（顺手交付一个存量缺失能力）

**PR-2：树迁移（破坏性，带开关）**
1. OutlineSensor node 型支持（依赖二期已合入）
2. tree-node/index/tree-drag 拖源与状态机迁移
3. 开关：`const OUTLINE_DRAGON_DRAG = true`（tree-node.tsx 顶部常量）
   - true：onMousedown → startNodeDrag
   - false：保留旧 draggable 路径（旧 handler 代码在开关后一个迭代删除）
4. e2e 全场景

### 10.2 回滚

- PR-1 独立可回滚（copy 参数可选，无调用方依赖）；
- PR-2 回滚 = 开关置 false（旧路径未删）；确认稳定（1 个迭代/线上一周）后删除旧路径 + 开关（-80 行清理 PR）。

### 10.3 上线观察指标

- e2e 拖拽套件通过率；
- 控制台 `[Dragon]` 回调出错日志（dragon.ts:96 有兜底打点）频次；
- 用户反馈：树拖拽挂起/误选（R1/R5）工单。

---

## 11. 验收标准（DoD）

1. ✅ 树节点 mousedown 拖动：树内三态落点、dwell 展开、防环行为与迁移前一致（§6 表前 4 行）；
2. ✅ ESC 取消拖拽：schema 零变更、全部高亮/ghost 清理；
3. ✅ Ctrl/Alt 按住投放：node 型克隆落位、新 id、原节点保留；
4. ✅ 树 → 画布 / 画布 → 树 / 面板 → 树 三条跨区链路 schema 落点正确；
5. ✅ `grep -r "draggable\|dataTransfer" src/plugins/outline-pane` 无结果（开关置 true 稳定后）；
6. ✅ 单测 + e2e（§9 全用例）+ smoke 全绿；
7. ✅ 一期 backup 面板对树拖拽生效（拖起树节点 → 右区切换）；
8. ✅ executeDrop 无引用（退役完成）；
9. ✅ typecheck / lint 零新增错误。

---

## 12. 决策记录（2026-09-02 grilling 评审拍板）

| # | 决策 | 落地 |
|---|---|---|
| Q1 | 间接容器宿主子节点**禁用 before/after**（声明限制，不夹带数据层重构）；精确格子寻址立四期 | canDropFor 增加间接子槽拒绝（slot-accessors 导出 `isIndirectChildSlot`） |
| Q2 | 单节点槽已占用 → sensor 阶段拒绝（无高亮），对齐 canvas-sensor 1.7 | canDropFor 用 `schemaOps.isSingleNodeSlot` + `getSlotChildren` 占用检查 |
| Q3 | **node 型禁止跨场景**（源不可见消失=丢失）；nodeData（面板新建）允许任意场景目标 | 快照携带 nodeId→scene 映射 |
| Q4 | 过滤态允许拖拽，落点语义=相对目标行（findSlotOf 语义天然成立） | 无代码，文档明示 |
| Q5 | dragstart 快照 OutlineNode 树 + sceneMap，拖拽全程复用（拖拽中 schema 不变） | OutlineSensor.takeSnapshot |
| Q6 | **dwell/scroller 内聚 OutlineSensor（per 实例），零可见性守卫**（隐藏面板 rect 全零→isEnter 永不命中→locate/dwell 天然不跑，对齐 lc-engine PaneController 模式）；展开态保持 per 实例（不引入 TreeMaster 共享模型，差异在本文档明示） | sensor 持 DwellExpander；视图经构造回调 onDwellExpand/isCollapsed 注入 |
| Q7 | dwell 展开后落点延迟到下次 mousemove 刷新（接受） | 无代码 |
| Q8 | copy 投放走 insert 事件语义（BEFORE_INSERT/AFTER_INSERT），不新增 COPY 事件 | wireDragon copy 分支调 this.insert |

事实核查修正：`insertChildIntoOpts` 对重叠间接容器走"首个空格子"策略、`index` 仅在 createEntry 时生效（slot-accessors.ts:325-362）——Q1 限制即针对此；`editor.insert/move` 各自单次 commit，copy 分支 undo 粒度单步（已验证）。

---

## 附：关键源码索引（现状锚点）


| 关注点 | 文件:行 |
|---|---|
| 树原生拖拽开关 | `plugins/outline-pane/tree-node.tsx:91` |
| 树原生 DnD handlers 转发 | `plugins/outline-pane/tree-node.tsx:106-109` |
| 树拖拽状态机（待迁移） | `plugins/outline-pane/index.tsx:155-211` |
| 落点纯函数（保留复用） | `plugins/outline-pane/tree-drag.ts:12-96` |
| DwellExpander（保留复用） | `plugins/outline-pane/tree-drag.ts:99-121` |
| Dragon _copy 断链点 | `designer/drag/dragon.ts:156、168-170` |
| Dragon ESC / over / bind | `designer/drag/dragon.ts:158-166、272-300、310-336` |
| chooseSensor（跨区互切核心） | `designer/drag/dragon.ts:212-226` |
| DropLocation 契约（扩展点） | `designer/drag/types.ts:43-58` |
| onDrop 投放管线（唯一出口） | `core/editor.ts:268-326` |
| startNodeDrag（三期首个消费者） | `core/editor.ts:375-385` |
| duplicate 复制逻辑（copy 分支参照） | `core/editor.ts:759-776` |
| DragGhost 订阅 | `designer/drag/drag-ghost.tsx:26-44` |
| CanvasSensor 注册（sensor 范式参照） | `designer/designer-host.tsx:86` |
| 大纲树插件注册 | `plugins/builtin-plugins.tsx:102-125` |
