# Phase 6-7 实施计划：编辑器核心接入 ScenarioProfile + 清除旧代码

> ⚠️ assembox-packages-project 禁止 commit。只提交 packages/new-assembox-editor。

**Goal**: 编辑器核心从 amis schema 完全切换到 ScenarioProfile 接口，清除所有旧 amis 代码。

**核心改造逻辑**: 当前编辑器的每个 amis 耦合点（ops.*、PageSchema、$$id、bridge.rerender 等），全部替换为 schemaOps.* / any / __nodeId / renderer.* 。

---

## 逐文件改造清单

### 文件 1: `src/core/editor.ts`（579 行，改动量最大）

**改动点逐行对照**:

| 行号 | 当前代码 | 改为 | 原因 |
|---|---|---|---|
| 31 | `import type {PageSchema, PageNode, NodeId}` | 删除，改为 `import type {ISchemaOps, IRenderer, INestingRules, IComponentCatalog, ScenarioProfile} from '../scenario/types'` | 不再用 amis 类型 |
| 35 | `import * as ops from '../schema/operations'` | 删除 | 不再用 amis ops |
| 19-22 | `import {InProcessBridge} / IframeBridge / SimulatorBridge` | 删除 | 渲染走 IRenderer，不再用 Bridge |
| 37-47 | `EditorOptions { schema?: PageSchema, canvasMode? }` | 改为 `{ scenario: string, schema?: any }` | 场景驱动 |
| 60 | `readonly nodeTree = new NodeTree()` | 删除 | 渲染器内部管理节点树 |
| 61 | `readonly bridge: SimulatorBridge` | 改为 `renderer: IRenderer \| null = null` | 渲染走 IRenderer |
| 62-63 | `readonly canvasMode` | 删除 | 场景决定渲染方式 |
| 新增 | — | `readonly profile: ScenarioProfile` | 场景档案 |
| 新增 | — | `get schemaOps(): ISchemaOps { return this.profile.schemaOps }` | 便捷别名 |
| 新增 | — | `get nestingRules()` / `get catalog()` | 便捷别名 |
| 81-83 | `this.store = new EditorStore(options.schema)` | `this.store = new EditorStore(options.schema ?? this.profile.emptySchema(), this.profile.schemaOps)` | Store 需 schemaOps |
| 101-119 | bridge 创建逻辑（if canvasMode） | 删除，改为 `this.renderer = this.profile.createRenderer()` | 场景创建渲染器 |
| 155-193 | `wireDragon()` — onDrop 用 componentRegistry + this.insert | 改为用 `this.catalog.getComponents()` 找 scaffold + `this.schemaOps.createNode()` + `this.insert(parentId, slotKey, node, index)` | Dragon 投放走 schemaOps |
| 184-193 | dragon.setDragStateSetter 用 bridge | 改为用 `this.renderer?.setDraggingState(active)` | 渲染器接管 |
| 196-208 | `isDescendantNode` 用 nodeTree.getParent | 改为用 `this.schemaOps.getParentById(this.store.schema, ancestorId)` 检查 | schemaOps 遍历 |
| 211-216 | `startComponentDrag` 用 componentRegistry.get | 改为用 `this.catalog.getComponents().find(c => c.renderType === type)` | 组件面板走 catalog |
| 220-229 | `startNodeDrag` 用 ops.getNodeById + ops.getNodeLabel | 改为 `this.schemaOps.getNodeById` + `this.schemaOps.getNodeLabel` | schemaOps |
| 367-371 | `loadSchema` 用 ops + bridge.rerender | 改为 `this.store.loadSchema(schema)` + `this.renderer?.setSchema(schema)` | 渲染器接管 |
| 374-376 | `getSchema` 用 ops.cloneSchema | 改为 `this.schemaOps.cloneSchema(this.store.schema)` | schemaOps |
| 379-382 | `copy` 用 ops.getNodeById + ops.cloneNode | 改为 `this.schemaOps.getNodeById` + `this.schemaOps.cloneNode` | schemaOps |
| 385-394 | `paste` 用 ops.getParentById + ops.locateChild + ops.cloneNode | 改为 schemaOps 等价方法。locateChild 没有 → 新增 `schemaOps.findSlotOf(nodeId)` 或在 Editor 内用 walk 查找 | 需要 schemaOps 补充 |
| 402-423 | `insert` 用 ops.cloneSchema + ops.ensureIds + ops.insertNode + bridge.rerender | 改为 `schemaOps.insertNode(schema, parentId, slotKey, node, index)` + `renderer.onStructureChange?.()` | schemaOps + 渲染器 |
| 426-434 | `update` 用 ops.updateNode + bridge.rerender | 改为 `schemaOps.updateNode` + `renderer.updateNode?.(nodeId, patch)` | schemaOps + 渲染器 |
| 437-439 | `updateProps` | 改为 `this.update(nodeId, {__nodeOptions: props})` | IBaseNode 格式属性在 __nodeOptions |
| 442-460 | `move` 用 ops.moveNode + bridge.rerender | 改为 `schemaOps.moveNode` + `renderer.onStructureChange?.()` | schemaOps |
| 463-474 | `remove` 用 ops.removeNode + bridge.rerender | 改为 `schemaOps.removeNode` + `renderer.onStructureChange?.()` | schemaOps |
| 477-491 | `duplicate` 用 ops.* + ops.locateChild | 改为 schemaOps.* + 自定义查找 | schemaOps |
| 494-517 | `moveUp` / `moveDown` 用 ops.moveUp/moveDown | PcSchemaOps 未实现 moveUp/moveDown → Editor 内用 schemaOps.moveNode 实现（先 remove 再 insert 到 index-1/index+1） | 需 Editor 层实现 |
| 520-533 | `undo` / `redo` 用 store.undo + bridge.rerender | 改为 `store.undo()` + `renderer.setSchema(store.schema)` | 渲染器 |
| 537-541 | `select` | 不变（store.select + bus.trigger） | 格式无关 |
| 560-573 | `handleClick` / `handleHover` / `handleRenderReady` | 不变 | 格式无关 |

**验证**:
```bash
npx vue-tsc --noEmit
# 预期：有错误（因为 Store / DesignerHost 还没改）
# 目标：editor.ts 本身无新增错误
```

---

### 文件 2: `src/core/store.ts`（293 行）

| 行号 | 当前 | 改为 |
|---|---|---|
| 3-5 | `import * as ops from '../schema/operations'` + PageSchema 类型 | 删除，改为接收 schemaOps 参数 |
| 40-41 | `schema: PageSchema` | `schema: any` |
| 57 | `constructor(initial?: PageSchema)` | `constructor(initial?: any, schemaOps?: ISchemaOps)` |
| 65 | `readonly schemaRef = shallowRef<PageSchema>` | `shallowRef<any>` |
| 67-69 | `ops.cloneSchema` + `ops.ensureIds` | `this.schemaOps.cloneSchema(initial)` + 手动 ensureIds（或 schemaOps.ensureIds） |
| 86-89 | `get schema(): PageSchema` | `get schema(): any` |
| 96-105 | `loadSchema` 用 ops.cloneSchema + ops.ensureIds | 用 `this.schemaOps.cloneSchema` |
| 107-125 | `commit` 用 ops.cloneSchema 做快照 | 用 `this.schemaOps.cloneSchema` |
| 230+ | `activeNode` 用 ops.getNodeById | 用 `this.schemaOps.getNodeById(this.state.schema, id)` |
| 255+ | `outline` 用 amis 风格 buildOutline | 用 `this.schemaOps.walk` 构建大纲 |

**验证**:
```bash
npx vue-tsc --noEmit
# 预期：editor.ts + store.ts 编译通过，其他文件有错误（后续修复）
```

---

### 文件 3: `src/designer/designer-host.tsx`（92 行）

**完整重写**（当前基于 SchemaRenderer + NodeTree + InProcessBridge，全部替换为 IRenderer）:

```tsx
// 改造后结构：
export const DesignerHost = defineComponent({
  setup(props) {
    const canvasRef = ref<HTMLElement | null>(null);

    onMounted(async () => {
      const el = canvasRef.value;
      if (!el || !props.editor.renderer) return;

      // 1. 挂载渲染器（替代 SchemaRenderer + bridge）
      await props.editor.renderer.mount(el, props.editor.store.schema, { isEditor: true });

      // 2. 渲染器事件回调
      props.editor.renderer.onClick((nodeId, e) => props.editor.select(nodeId));
      props.editor.renderer.onHover((nodeId) => props.editor.store.setHover(nodeId));
      props.editor.renderer.onReady(() => props.editor.bus.trigger(EVENT.SIMULATOR_READY, {}));

      // 3. 注册拖拽感应区（改为用 renderer 解析）
      const sensor = new CanvasSensor(
        {
          id: 'pc-canvas',
          getContentDocument: () => document,
          getBounds: () => el.getBoundingClientRect(),
          toGlobal: (lx, ly) => ({x: lx, y: ly}),
          elementFromPoint: (lx, ly) => {
            // 用 renderer 的 resolveFromElement
            return document.elementFromPoint(lx, ly);
          }
        },
        props.editor  // 注入 editor（Phase 0 P0-5 改造后的 CanvasSensor）
      );
      props.editor.dragon.addSensor(sensor);
    });

    onBeforeUnmount(() => {
      props.editor.renderer?.dispose();
    });

    return () => (
      <div class={ns.b()}>
        <div class={ns.e('canvas')} ref={canvasRef}>
          {/* 渲染器自己渲染内容，这里只提供容器 */}
          <BemTools store={props.editor.store} editor={props.editor} containerRef={canvasRef.value} />
        </div>
      </div>
    );
  }
});
```

**关键变化**:
- 删除 `provide(RENDERER_CONTEXT_KEY)` — IRenderer 自己渲染
- 删除 `SchemaRenderer` 组件 — IRenderer.mount() 渲染
- 删除 InProcessBridge — IRenderer 接管通信
- CanvasSensor 注入 editor 而非 nodeTree + store

**验证**: 启动 dev server，画布渲染 PC schema JSON（非 amis），点击节点能选中

---

### 文件 4: `src/designer/bem-tools.tsx`（224 行）

| 行号 | 当前 | 改为 |
|---|---|---|
| 85-86 | `const el = props.tree.getEl(id)` | `const el = props.editor?.renderer?.getNodeElement(id)` |
| 142 | `props.tree.get(hoverId)?.type` | `props.editor?.renderer` 无法直接取 type → 从 store.schema 用 schemaOps.getNodeById 取 __nodeOptions.renderType |
| 153 | `props.tree.get(activeId)` | 同上 |
| props | `tree: NodeTree` | `editor: Editor`（从 editor.renderer 取 DOM） |

**验证**: 选中节点出现高亮框 + 工具栏按钮

---

### 文件 5: `src/designer/drag/canvas-sensor.ts`

| 当前 | 改为 |
|---|---|
| 构造注入 `tree: NodeTree, store: EditorStore` | 改为注入 `editor: Editor` |
| `this.tree.get(id)?.isContainer` | `editor.schemaOps.isContainer?.(node)` 或从 nestingRules 查 |
| `this.tree.getChildren(parentId)` | `editor.schemaOps.getSlotChildren(parent, slotKey)` |
| `this.tree.getEl(id)` | `editor.renderer.getNodeElement(id)` |
| `findContainerId` 用 `tree.get` | 用 `editor.renderer.resolveFromElement(el)` |

---

### 文件 6: `src/plugins/components-pane/components-pane.tsx`

| 当前 | 改为 |
|---|---|
| `editor.componentRegistry.groupForPalette()` | `editor.catalog.getComponents()` + 按 group/category 分组 |
| `editor.componentRegistry.createNode(type)` | 从 catalog.find(c => c.renderType === type) 取 scaffold，用 `editor.schemaOps.createNode(type, name, scaffold)` |
| `editor.startComponentDrag(e, type)` | 不变（Editor 内部改实现） |

---

### 文件 7: `src/plugins/settings-pane/settings-pane.tsx`

| 当前 | 改为 |
|---|---|
| `node.props` | `node.__nodeOptions` |
| `node.onEvent` | `node.__nodeEvent` |
| `node.style` | `node.__nodeStyle` |
| `node.type` | `node.__nodeOptions.renderType` |
| `node.$$id` | `node.__nodeId` |
| `resolveSetter(editor.componentRegistry, propConfig)` | `resolveSetter(editor.setterRegistry, propConfig)`（setter 推断不变，只是数据源从 componentRegistry 改为 catalog 的 ComponentCatalogItem.props） |
| `editor.updateProps(nodeId, { [name]: v })` | `editor.updateProps(nodeId, { [name]: v })` — Editor 内部改为 `this.update(nodeId, {__nodeOptions: props})` |

---

### 文件 8: `src/plugins/outline-pane/outline-pane.tsx`

| 当前 | 改为 |
|---|---|
| `store.outline` (amis 风格 computed) | `editor.schemaOps.walk(schema, visitor)` 构建大纲树 |

---

### 文件 9: `src/plugins/schema-pane/schema-pane.tsx`

基本不变（JSON.stringify + JSON.parse），只是 schema 格式不同。

---

### 文件 10: `src/plugins/history-pane/history-pane.tsx`

基本不变（读 store.history），只是 label 来源不同。

---

### 文件 11: `src/skeleton/workbench.tsx`

删除 `DragGhost` 和 `ContextMenu` 的 editor.dragon / editor 依赖中与 amis 相关的部分（如果有）。

---

### 文件 12: `src/plugins/builtin-plugins.tsx`

| 当前 | 改为 |
|---|---|
| `DesignerCanvasSwitch` 在 inline / iframe 间切换 | 删除，统一用 DesignerHost（场景决定渲染方式） |
| IframeDesignerHost | 删除（Phase 7） |

---

### 文件 13: ISchemaOps 补充方法

PcSchemaOps 需要新增：
- `isContainer(node)`: 判断是否容器（有 slot 字段或 itemConfig）
- `findSlotOf(nodeId)`: 找到 nodeId 所在的 parent + slotKey + index（供 paste/duplicate 用）

---

## Phase 7: 清除旧代码

### 删除文件

| 文件 | 原因 |
|---|---|
| `src/schema/types.ts` | amis PageSchema/PageNode 类型 |
| `src/schema/operations.ts` | amis ops（insertNode/moveNode 等） |
| `src/simulator/renderer.tsx` | amis SchemaRenderer + NodeRenderer |
| `src/simulator/renderer-context.ts`（如果有） | amis RendererContext |
| `src/simulator/in-process-bridge.ts` | amis InProcessBridge |
| `src/simulator/iframe/` 整个目录 | amis IframeBridge + IframeSimulatorRenderer + protocol |
| `src/simulator/assembox/` 整个目录 | P0 AssemboxBridge（被 PcRenderer 取代） |
| `src/simulator/node-tree.ts` | NodeTree（被 IRenderer 内部管理取代） |
| `src/simulator/bridge.ts` | SimulatorBridge 接口（被 IRenderer 取代） |
| `src/registry/component-registry.ts` | ComponentRegistry（被 IComponentCatalog 取代） |
| `src/designer/iframe-designer-host.tsx` | IframeDesignerHost（被统一 DesignerHost 取代） |
| `src/demo/components.ts` | amis 风格 demo 组件 |
| `src/demo/main.tsx` | 重写为 PC 场景 demo |

### 保留文件

| 文件 | 原因 |
|---|---|
| `src/core/*` (editor/store/di/event-bus/plugin-manager/logger/selection) | 核心层，改造后仍用 |
| `src/registry/setter-registry.ts` | Setter 系统 |
| `src/registry/asset-registry.ts` | 资产管理 |
| `src/registry/action-registry.ts` | 动作系统 |
| `src/setters/*` | 25 个 Setter |
| `src/skeleton/*` | 骨架布局 |
| `src/designer/drag/*` | Dragon 拖拽引擎 |
| `src/designer/bem-tools.tsx` | 覆盖层（改造后仍用） |
| `src/designer/designer-host.tsx` | 画布宿主（改造后仍用） |
| `src/hooks/*` | BEM / 快捷键 |
| `src/plugins/*` | 面板插件（适配后仍用） |
| `src/scenario/*` | 场景框架 |
| `src/scenarios/*` | PC 场景实现 |

---

## 验证标准

### 每个 Task 的验证

| Task | 验证方法 |
|---|---|
| 6.1 Editor 改造 | `npx vue-tsc --noEmit` editor.ts 本身无错误 |
| 6.2 Store 改造 | typecheck store.ts 通过 |
| 6.3 DesignerHost | 启动 dev server，画布渲染 PC schema |
| 6.4 BemTools | 选中节点出现高亮框 |
| 6.5 CanvasSensor | 拖拽指示线正常 |
| 6.6 组件面板 | 面板显示 PC 组件列表 |
| 6.7 属性面板 | 改属性值画布实时更新 |
| 6.8 大纲/历史 | 大纲树正确 + 撤销重做正常 |
| 7.1 清除旧代码 | `vite build` 成功无残留引用 |

### 最终端到端验证

```
加载 single-table-scene.json → 渲染 → 选中节点（data-editor-id）
→ 拖入组件到指定槽位（data-slot-key + canNest 校验）
→ 改属性（reactive 传播局部更新）
→ 切预览（事件正常执行）
→ 保存出 PC 格式 JSON
```
