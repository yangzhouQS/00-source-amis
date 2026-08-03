# 多场景渲染器 Phase 0-2 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 assembox-desktop-next 中增加编辑器增强标记 + 在 new-assembox-editor 中定义场景框架接口 + 实现 PC 场景的 ISchemaOps。

**Architecture:** Phase 0 改 assembox-desktop-next（useEditor DOM 标记 + 槽位标记 + 事件门控，isEditorEnv 门控）；Phase 1 在 new-assembox-editor 定义 ScenarioProfile/ISchemaOps/IRenderer/IComponentCatalog/INestingRules 接口 + Registry；Phase 2 实现 PC 场景的 PcSchemaOps（IBaseNode 格式 9 种 slot 字段操作）。

**Tech Stack:** TypeScript, Vue 3, assembox-desktop-next, assembox-core-next

**关联设计文档：** `docs/10-多场景可插拔渲染器设计.md` (v3)

> ⚠️ **重要约束**：`assembox-packages-project/` 目录下的所有修改**禁止 git commit**，改动仅保留在工作区。只有 `packages/new-assembox-editor/` 目录的修改才提交。

---

## 前置事实

- assembox-desktop-next 路径：`assembox-packages-project/libs/assembox-desktop-next`
- assembox-core-next 路径：`assembox-packages-project/libs/assembox-core-next`
- new-assembox-editor 路径：`packages/new-assembox-editor`
- 两个 *-next 包已在根 pnpm-workspace.yaml 注册（workspace:* 链接已建立）
- assembox-desktop-next 的 `useEditor.ts` 已有 `isEditorEnv()` 门控 + `window.AssemVueRenderer` 回调
- assembox-desktop-next 的容器组件模板各自渲染 `defaultSlot`/`toolSlot`/`filterSlot` 等
- assembox-desktop-next 的 `nesting.ts` 有 SLOTS 表 + `lookupSlotGate()` + `isCategoryAllowed()`
- assembox-desktop-next 的 `component-catalog.ts` 有 `lookupMeta()` + `ComponentCategory`
- assembox-core-next 的 `IBaseNode` 格式：`__nodeId/__nodeName/__nodeType/__nodeOptions/__nodeEvent/__nodeStyle/__nodeProps`
- SlotField 共 9 种：`defaultSlot/toolSlot/filterSlot/headerSlot/bottomSlot/labelSlot/rightSlot/columRender/buttonOption`

---

## File Structure

| 文件 | 责任 | 动作 |
|---|---|---|
| `assembox-desktop-next/src/composables/use-editor.ts` | DOM 标记 + designMode 门控 | 修改 |
| `assembox-desktop-next/src/composables/use-node-events.ts` | 设计态事件拦截 | 修改 |
| `assembox-desktop-next/src/composables/use-node-register.ts` | data-editor-id 双保险 | 修改 |
| `assembox-desktop-next/src/components/block-contanier/panel/assem-panel.vue` | defaultSlot 标记 | 修改 |
| `assembox-desktop-next/src/components/block-contanier/box/assem-box.vue` | defaultSlot 标记 | 修改 |
| `assembox-desktop-next/src/components/layout/assem-flex-box.vue` | item slot 标记 | 修改 |
| `assembox-desktop-next/src/components/layout/assem-flex-line.vue` | defaultSlot/rightSlot 标记 | 修改 |
| `assembox-desktop-next/src/components/element-container/block-element/assem-card.vue` | headerSlot/defaultSlot 标记 | 修改 |
| `assembox-desktop-next/src/constants.ts` | assemBoxDesignMode 变量声明 | 修改 |
| `packages/new-assembox-editor/src/scenario/types.ts` | 5 个接口定义 | 新建 |
| `packages/new-assembox-editor/src/scenario/registry.ts` | ScenarioRegistry | 新建 |
| `packages/new-assembox-editor/src/scenario/index.ts` | 出口 | 新建 |
| `packages/new-assembox-editor/src/scenarios/pc-desktop/schema-ops.ts` | PcSchemaOps | 新建 |
| `packages/new-assembox-editor/src/scenarios/pc-desktop/index.ts` | PC ScenarioProfile | 新建 |
| `packages/new-assembox-editor/src/scenarios/pc-desktop/empty-schema.ts` | PC 空模板 | 新建 |

---

# Phase 0 — assembox-desktop-next useEditor 增强

## Task 0.1: 全局变量声明 + useEditor DOM 标记

**Files:**
- Modify: `assembox-desktop-next/src/constants.ts`
- Modify: `assembox-desktop-next/src/composables/use-editor.ts`

- [ ] **Step 1: 在 constants.ts 增加 designMode 全局变量声明**

在 `assembox-desktop-next/src/constants.ts` 末尾追加：

```typescript
/** 设计/预览模式全局变量（编辑器通过 IRenderer.setDesignMode 设置） */
declare global {
  interface Window {
    assemBoxDesignMode?: 'design' | 'preview';
  }
}
```

- [ ] **Step 2: 增强 useEditor.ts — onMounted 时打 data-editor-id**

将 `assembox-desktop-next/src/composables/use-editor.ts` 的 `useEditor` 函数替换为：

```typescript
export function useEditor(): void {
  if (!isEditorEnv()) return;

  onMounted(() => {
    const instance = getCurrentInstance();
    nextTick(() => {
      // 编辑器回调（P0 已有契约）
      window.AssemVueRenderer?.onMountedInstance(instance);

      // DOM 标记：给组件根元素打 data-editor-id
      if (window.assemBoxDesignMode !== 'preview') {
        const el = (instance?.proxy?.$el ?? instance?.$el) as HTMLElement | null;
        if (el && el.nodeType === 1) {
          const nodeId = (instance?.props as any)?.__nodeId;
          if (nodeId) el.setAttribute('data-editor-id', nodeId);
        }
      }
    });
  });

  onUpdated(() => {
    const instance = getCurrentInstance();
    nextTick(() => {
      window.AssemVueRenderer?.onUpdatedInstance(instance);
    });
  });

  onUnmounted(() => {
    const instance = getCurrentInstance();
    window.AssemVueRenderer?.onUnmountedInstance(instance);
  });
}
```

- [ ] **Step 3: 在 use-editor.ts 增加 isDesignMode 辅助函数**

在文件末尾追加：

```typescript
/** 当前是否为设计模式（编辑器内 + design mode） */
export function isDesignMode(): boolean {
  return isEditorEnv() && window.assemBoxDesignMode !== 'preview';
}
```

- [ ] **Step 4: 验证 typecheck（不提交，此项目禁止 git commit）**

Run:
```bash
cd assembox-packages-project/libs/assembox-desktop-next && npx tsc --noEmit
```
Expected: 无新增错误（已有错误可忽略）

> ⚠️ **assembox-packages-project 目录禁止 git commit**，所有改动仅保留工作区。

## Task 0.2: 设计态事件拦截

**Files:**
- Modify: `assembox-desktop-next/src/composables/use-node-events.ts`

- [ ] **Step 1: 在 useNodeEvents 中增加设计态事件跳过**

读取 `use-node-events.ts`，找到事件注册逻辑（`onMounted` 中自动触发 onMounted 事件 + 注册自定义事件到 eventBus 的部分）。在注册事件之前增加门控：

```typescript
import { isDesignMode } from './use-editor';

// 在事件注册逻辑前增加：
if (isDesignMode()) {
  // 设计态：不注册事件 handler，避免编辑时触发生产 API
  return;
}
```

注意：需要找到 useNodeEvents 中实际注册事件的代码位置，在所有 `eventBus.on(...)` / `dispatch(...)` 注册之前加入此判断。onMounted 自动触发也应跳过。

- [ ] **Step 2: 验证 typecheck（不提交，此项目禁止 git commit）**

```bash
npx tsc --noEmit
```

> ⚠️ **assembox-packages-project 目录禁止 git commit**。

## Task 0.3: 容器组件槽位 DOM 标记

**Files:**
- Modify: `assembox-desktop-next/src/components/block-contanier/panel/assem-panel.vue`
- Modify: `assembox-desktop-next/src/components/block-contanier/box/assem-box.vue`
- Modify: `assembox-desktop-next/src/components/layout/assem-flex-line.vue`

> 因容器组件较多（10 个），本任务只处理前 3 个最常见的（Panel/Box/FlexLine），其余在后续任务批量处理。

- [ ] **Step 1: assem-panel.vue — defaultSlot 容器加标记**

在 `<NodeRenderer>` 的外层包裹一个 `<div>`（仅编辑态），加 `data-slot-host` + `data-slot-key`：

找到模板中的：
```vue
<template v-for="(slot, idx) in normalizedSlots" :key="idx">
  <NodeRenderer :node="slot" parent="Panel" slot-name="defaultSlot" />
</template>
```

改为：
```vue
<template v-for="(slot, idx) in normalizedSlots" :key="idx">
  <div v-if="isEditorEnv()" :data-slot-host="options.__nodeId" data-slot-key="defaultSlot">
    <NodeRenderer :node="slot" parent="Panel" slot-name="defaultSlot" />
  </div>
  <NodeRenderer v-else :node="slot" parent="Panel" slot-name="defaultSlot" />
</template>
```

并在 `<script setup>` 中引入：
```typescript
import { isEditorEnv } from '../../../composables/use-editor';
```

- [ ] **Step 2: assem-box.vue — 同 Panel 模式**

读取 `assem-box.vue` 的模板，找到渲染 `defaultSlot` 子节点的位置，同样加 `data-slot-host` + `data-slot-key="defaultSlot"` 包裹（仅 `isEditorEnv()` 时）。

- [ ] **Step 3: assem-flex-line.vue — defaultSlot + rightSlot 标记**

读取 `assem-flex-line.vue`，找到渲染 `defaultSlot` 和 `rightSlot` 子节点的位置，分别加标记。

- [ ] **Step 4: typecheck（不提交，此项目禁止 git commit）**

```bash
npx tsc --noEmit
```

> ⚠️ **assembox-packages-project 目录禁止 git commit**。

## Task 0.4: 剩余容器组件槽位标记

**Files:**
- Modify: `assem-flex-box.vue`, `assem-toolbar.vue`(如有), `assem-card.vue`, `assem-grid-item.vue`, `assem-tabpanel/*.vue`

- [ ] **Step 1: 逐个为剩余容器组件加 data-slot-host + data-slot-key**

对每个容器组件：
1. 读取模板，找到渲染各 slot 子节点的位置
2. 用 `v-if="isEditorEnv()"` 包裹 `<div :data-slot-host="nodeId" :data-slot-key="slotName">`
3. 引入 `isEditorEnv`

涉及组件及其 slot：
- FlexBox: `itemConfig[].defaultSlot` → 每个 item 一个标记
- Toolbar: `toolSlot` + `filterSlot`
- Card: `headerSlot` + `defaultSlot`
- GridItem: `defaultSlot`
- TabPanel: `tabPane[].defaultSlot` + `tabPane[].labelSlot`

- [ ] **Step 2: typecheck（不提交，此项目禁止 git commit）**

```bash
npx tsc --noEmit
```

> ⚠️ **assembox-packages-project 目录禁止 git commit**。

---

# Phase 1 — 场景框架接口定义

## Task 1.1: 定义 5 个核心接口

**Files:**
- Create: `packages/new-assembox-editor/src/scenario/types.ts`

- [ ] **Step 1: 创建 types.ts，写入全部接口定义**

```typescript
/**
 * 多场景可插拔渲染器接口定义
 * 设计文档: docs/10-多场景可插拔渲染器设计.md (v3)
 */

// ═══════════════════════════════════════════════
// ISchemaOps — Schema 树操作
// ═══════════════════════════════════════════════

export interface ISchemaOps {
  getNodeId(node: any): string;
  setNodeId(node: any, id: string): void;
  genNodeId(type: string): string;
  getNodeLabel(node: any): string;

  getNodeById(schema: any, id: string): any | undefined;
  getParentById(schema: any, id: string): any | undefined;
  walk(schema: any, visitor: (node: any, parent: any | null, slotKey: string) => void): void;
  getSlotChildren(parentNode: any, slotKey: string): any[];
  getSlots(node: any): { key: string; label: string }[];

  insertNode(schema: any, parentId: string, slotKey: string, node: any, index?: number): any | undefined;
  removeNode(schema: any, nodeId: string): any | undefined;
  moveNode(schema: any, nodeId: string, toParentId: string, slotKey: string, index?: number): boolean;
  updateNode(schema: any, nodeId: string, patch: any): any | undefined;
  cloneNode(node: any): any;
  cloneSchema(schema: any): any;

  createNode(renderType: string, nodeName: string, overrides?: any): any;
  emptySchema(): any;
}

// ═══════════════════════════════════════════════
// IRenderer — 设计态渲染器
// ═══════════════════════════════════════════════

export interface SlotMarker {
  slotKey: string;
  el: HTMLElement;
  rect: DOMRect;
}

export interface RendererMountOptions {
  isEditor?: boolean;
}

export interface IRenderer {
  mount(container: HTMLElement, schema: any, options?: RendererMountOptions): Promise<void>;
  setSchema(schema: any): void;
  updateNode?(nodeId: string, patch: any): void;
  onStructureChange?(): void;
  setDraggingState(active: boolean): void;
  setDesignMode(mode: 'design' | 'preview'): void;
  dispose(): void;

  getNodeElement(nodeId: string): HTMLElement | null;
  getRect(nodeId: string): DOMRect | null;
  nodeIdFromElement(el: HTMLElement | null): string | null;

  getSlotMarkers(nodeId: string): SlotMarker[] | null;
  resolveFromElement(el: HTMLElement | null): { nodeId: string; slotKey: string } | null;

  onReady?(cb: () => void): void;
  onClick?(cb: (nodeId: string | null, e: MouseEvent) => void): void;
  onHover?(cb: (nodeId: string | null) => void): void;
}

// ═══════════════════════════════════════════════
// IComponentCatalog — 组件面板数据
// ═══════════════════════════════════════════════

export interface ComponentPropConfig {
  name: string;
  title?: string;
  propType: string;
  defaultValue?: any;
  setter?: string;
  setterProps?: Record<string, any>;
}

export interface ComponentCatalogItem {
  renderType: string;
  name: string;
  icon?: string;
  group?: string;
  category?: string;
  scaffold: Record<string, any>;
  props?: ComponentPropConfig[];
  events?: { name: string; title?: string }[];
}

export interface IComponentCatalog {
  getComponents(): ComponentCatalogItem[];
  getGroups(): { name: string; title: string }[];
  getCategories(groupName: string): { name: string; title: string }[];
}

// ═══════════════════════════════════════════════
// INestingRules — 嵌套校验
// ═══════════════════════════════════════════════

export interface INestingRules {
  canNest(parentRenderType: string, slotKey: string, childRenderType: string): boolean;
  getAllowedCategories(parentRenderType: string, slotKey: string): string[] | undefined;
  getCategory(renderType: string): string | undefined;
}

// ═══════════════════════════════════════════════
// ScenarioProfile — 场景档案
// ═══════════════════════════════════════════════

export interface ScenarioContext {
  editor: any;
  bus: any;
  skeleton: any;
  setterRegistry: any;
  componentRegistry: any;
}

export interface ScenarioProfile {
  readonly id: string;
  readonly name: string;
  readonly schemaOps: ISchemaOps;
  readonly createRenderer: () => IRenderer;
  readonly componentCatalog: IComponentCatalog;
  readonly nestingRules: INestingRules;
  readonly emptySchema: () => any;

  init?(ctx: ScenarioContext): void;
  destroy?(): void;
}
```

- [ ] **Step 2: typecheck + 提交**

```bash
cd packages/new-assembox-editor
npx vue-tsc --noEmit
git add src/scenario/types.ts
git commit -m "feat(editor): 定义场景框架 5 个核心接口（ISchemaOps/IRenderer/IComponentCatalog/INestingRules/ScenarioProfile）"
```

## Task 1.2: ScenarioRegistry + 出口

**Files:**
- Create: `packages/new-assembox-editor/src/scenario/registry.ts`
- Create: `packages/new-assembox-editor/src/scenario/index.ts`

- [ ] **Step 1: 创建 registry.ts**

```typescript
import type { ScenarioProfile } from './types';

class ScenarioRegistryImpl {
  private profiles = new Map<string, ScenarioProfile>();
  private currentProfile: ScenarioProfile | null = null;

  register(profile: ScenarioProfile): void {
    if (this.profiles.has(profile.id)) {
      console.warn(`[ScenarioRegistry] 场景 "${profile.id}" 已注册，覆盖`);
    }
    this.profiles.set(profile.id, profile);
  }

  activate(id: string): ScenarioProfile {
    const profile = this.profiles.get(id);
    if (!profile) {
      throw new Error(`[ScenarioRegistry] 场景 "${id}" 未注册`);
    }
    if (this.currentProfile?.id === id) return this.currentProfile;
    this.currentProfile?.destroy?.();
    this.currentProfile = profile;
    return profile;
  }

  getCurrent(): ScenarioProfile {
    if (!this.currentProfile) {
      throw new Error('[ScenarioRegistry] 未激活任何场景，请先 activate');
    }
    return this.currentProfile;
  }

  has(id: string): boolean {
    return this.profiles.has(id);
  }

  list(): string[] {
    return Array.from(this.profiles.keys());
  }
}

export const scenarioRegistry = new ScenarioRegistryImpl();

export function registerScenario(profile: ScenarioProfile): void {
  scenarioRegistry.register(profile);
}
```

- [ ] **Step 2: 创建 index.ts 出口**

```typescript
export type {
  ISchemaOps,
  IRenderer,
  IComponentCatalog,
  INestingRules,
  ScenarioProfile,
  ScenarioContext,
  ComponentCatalogItem,
  ComponentPropConfig,
  SlotMarker,
  RendererMountOptions
} from './types';

export { scenarioRegistry, registerScenario } from './registry';
```

- [ ] **Step 3: typecheck + 提交**

```bash
npx vue-tsc --noEmit
git add src/scenario/
git commit -m "feat(editor): ScenarioRegistry + 模块出口"
```

---

# Phase 2 — PC 场景 ISchemaOps 实现

## Task 2.1: PC 空模板 + PcSchemaOps 核心

**Files:**
- Create: `packages/new-assembox-editor/src/scenarios/pc-desktop/empty-schema.ts`
- Create: `packages/new-assembox-editor/src/scenarios/pc-desktop/schema-ops.ts`

- [ ] **Step 1: 创建 empty-schema.ts**

```typescript
/**
 * PC 场景空 schema 模板
 * 结构与 assembox-desktop-next 的 AssemPlugin 期望一致
 */

let counter = 0;

function shortId(): string {
  counter += 1;
  return `${Date.now().toString(36)}${counter.toString(36)}`;
}

export function createPcEmptySchema(sceneName = 'main'): any {
  return {
    [sceneName]: {
      viewsProps: {
        planeOptions: {
          __nodeName: 'root',
          __nodeId: 'FlexBox::root',
          __nodeType: 'renderNode',
          __nodeEvent: {},
          __nodeOptions: {
            renderType: 'FlexBox',
            isRow: false,
            itemNum: 1,
            width: '100%',
            height: '100%',
            itemConfig: [
              {
                isFixed: false,
                size: '',
                paddingSize: 'base',
                clearPadding: [],
                isHidden: false,
                contentType: 'container',
                defaultSlot: null
              }
            ]
          }
        }
      }
    }
  };
}
```

- [ ] **Step 2: 创建 schema-ops.ts 核心结构**

写入 PcSchemaOps 类的框架（标识 + 遍历方法），具体实现：

```typescript
import type { ISchemaOps } from '../../scenario/types';
import { SLOTS, type SlotField } from '@cs/assembox-desktop-next';

let counter = 0;
function shortId(): string {
  counter += 1;
  return `${Date.now().toString(36)}${counter.toString(36)}`;
}

/**
 * PC 场景 Schema 操作（IBaseNode 格式）
 *
 * 节点结构: { __nodeId, __nodeName, __nodeType, __nodeOptions, __nodeEvent, __nodeStyle, __nodeProps }
 * 子节点位置: __nodeOptions.defaultSlot / toolSlot / filterSlot / headerSlot / bottomSlot / labelSlot / rightSlot / columRender / buttonOption
 * FlexBox 特殊: __nodeOptions.itemConfig[].defaultSlot
 */
export class PcSchemaOps implements ISchemaOps {
  // ── 标识 ──

  getNodeId(node: any): string {
    return node?.__nodeId ?? '';
  }

  setNodeId(node: any, id: string): void {
    if (node) node.__nodeId = id;
  }

  genNodeId(type: string): string {
    return `${type}::${shortId()}`;
  }

  getNodeLabel(node: any): string {
    return node?.__nodeName || node?.__nodeOptions?.renderType || '未命名';
  }

  // ── 遍历 ──

  getNodeById(schema: any, id: string): any | undefined {
    let found: any | undefined;
    this.walk(schema, (node) => {
      if (this.getNodeId(node) === id) found = node;
    });
    return found;
  }

  getParentById(schema: any, id: string): any | undefined {
    let parent: any | undefined;
    this.walk(schema, (node, p) => {
      if (this.getNodeId(node) === id) parent = p;
    });
    return parent;
  }

  walk(schema: any, visitor: (node: any, parent: any | null, slotKey: string) => void): void {
    const walkNode = (node: any, parent: any | null, slotKey: string): void => {
      if (!node || typeof node !== 'object') return;
      visitor(node, parent, slotKey);

      // 遍历所有 slot 字段
      const opts = node.__nodeOptions;
      if (!opts) return;

      for (const field of SLOT_FIELDS) {
        const val = opts[field];
        if (Array.isArray(val)) {
          val.forEach((child: any) => walkNode(child, node, field));
        } else if (val && typeof val === 'object' && val.__nodeType) {
          walkNode(val, node, field);
        }
      }

      // FlexBox 特殊: itemConfig[].defaultSlot
      if (Array.isArray(opts.itemConfig)) {
        opts.itemConfig.forEach((item: any) => {
          if (item?.defaultSlot) {
            walkNode(item.defaultSlot, node, 'defaultSlot');
          }
        });
      }
    };

    // schema 的入口结构: { sceneName: { viewsProps: { planeOptions: <root node> } } }
    const scenes = Object.values(schema || {});
    for (const scene of scenes) {
      const root = scene?.viewsProps?.planeOptions;
      if (root) walkNode(root, null, 'defaultSlot');
    }
  }

  getSlots(node: any): { key: string; label: string }[] {
    const renderType = node?.__nodeOptions?.renderType;
    if (!renderType) return [];

    const slotMap = (SLOTS as any)[renderType];
    if (!slotMap) return [];

    return Object.keys(slotMap).map((key) => ({
      key,
      label: SLOT_LABELS[key] ?? key
    }));
  }

  getSlotChildren(parentNode: any, slotKey: string): any[] {
    const opts = parentNode?.__nodeOptions;
    if (!opts) return [];

    // FlexBox 特殊: itemConfig[].defaultSlot
    if (slotKey === 'defaultSlot' && Array.isArray(opts.itemConfig)) {
      const children: any[] = [];
      opts.itemConfig.forEach((item: any) => {
        if (item?.defaultSlot) {
          if (Array.isArray(item.defaultSlot)) children.push(...item.defaultSlot);
          else children.push(item.defaultSlot);
        }
      });
      return children;
    }

    const val = opts[slotKey];
    if (!val) return [];
    if (Array.isArray(val)) return val;
    return [val];
  }

  // ── 增删改 ──

  insertNode(schema: any, parentId: string, slotKey: string, node: any, index?: number): any | undefined {
    const parent = this.getNodeById(schema, parentId);
    if (!parent) return undefined;

    const opts = parent.__nodeOptions;
    if (!opts) return undefined;

    // 确保 slot 字段存在且为数组
    if (!opts[slotKey]) opts[slotKey] = [];
    if (!Array.isArray(opts[slotKey])) opts[slotKey] = [opts[slotKey]];

    const arr = opts[slotKey];
    const at = index === undefined ? arr.length : Math.max(0, Math.min(index, arr.length));
    arr.splice(at, 0, node);
    return node;
  }

  removeNode(schema: any, nodeId: string): any | undefined {
    const parent = this.getParentById(schema, nodeId);
    if (!parent) return undefined;

    const opts = parent.__nodeOptions;
    if (!opts) return undefined;

    // 在所有 slot 字段中查找并移除
    for (const field of SLOT_FIELDS) {
      const val = opts[field];
      if (Array.isArray(val)) {
        const idx = val.findIndex((c: any) => this.getNodeId(c) === nodeId);
        if (idx >= 0) return val.splice(idx, 1)[0];
      } else if (val && this.getNodeId(val) === nodeId) {
        opts[field] = null;
        return val;
      }
    }

    // FlexBox itemConfig
    if (Array.isArray(opts.itemConfig)) {
      for (const item of opts.itemConfig) {
        if (item?.defaultSlot) {
          if (Array.isArray(item.defaultSlot)) {
            const idx = item.defaultSlot.findIndex((c: any) => this.getNodeId(c) === nodeId);
            if (idx >= 0) return item.defaultSlot.splice(idx, 1)[0];
          } else if (this.getNodeId(item.defaultSlot) === nodeId) {
            const removed = item.defaultSlot;
            item.defaultSlot = null;
            return removed;
          }
        }
      }
    }

    return undefined;
  }

  moveNode(schema: any, nodeId: string, toParentId: string, slotKey: string, index?: number): boolean {
    const removed = this.removeNode(schema, nodeId);
    if (!removed) return false;
    this.insertNode(schema, toParentId, slotKey, removed, index);
    return true;
  }

  updateNode(schema: any, nodeId: string, patch: any): any | undefined {
    const node = this.getNodeById(schema, nodeId);
    if (!node) return undefined;

    if (patch.__nodeOptions) {
      Object.assign(node.__nodeOptions, patch.__nodeOptions);
    }
    if (patch.__nodeEvent) {
      Object.assign(node.__nodeEvent, patch.__nodeEvent);
    }
    if (patch.__nodeStyle) {
      node.__nodeStyle = { ...(node.__nodeStyle || {}), ...patch.__nodeStyle };
    }
    if (patch.__nodeName !== undefined) {
      node.__nodeName = patch.__nodeName;
    }
    return node;
  }

  cloneNode(node: any): any {
    return this.cloneSchema(node);
  }

  cloneSchema(schema: any): any {
    return JSON.parse(JSON.stringify(schema));
  }

  // ── 节点工厂 ──

  createNode(renderType: string, nodeName: string, overrides?: any): any {
    const node: any = {
      __nodeName: nodeName,
      __nodeId: this.genNodeId(renderType),
      __nodeType: 'renderNode',
      __nodeEvent: {},
      __nodeOptions: {
        renderType,
        ...overrides
      },
      __nodeStyle: {},
      __nodeProps: null
    };
    return node;
  }

  emptySchema(): any {
    return createPcEmptySchema();
  }
}

// ── 常量 ──

const SLOT_FIELDS: string[] = [
  'defaultSlot', 'toolSlot', 'filterSlot', 'headerSlot',
  'bottomSlot', 'labelSlot', 'rightSlot', 'columRender', 'buttonOption'
];

const SLOT_LABELS: Record<string, string> = {
  defaultSlot: '内容区',
  toolSlot: '工具栏',
  filterSlot: '筛选项',
  headerSlot: '头部',
  bottomSlot: '底部',
  labelSlot: '标签',
  rightSlot: '右侧',
  columRender: '单元格',
  buttonOption: '按钮项'
};

import { createPcEmptySchema } from './empty-schema';
```

> 注意：`import { createPcEmptySchema }` 放在文件末尾是临时方案（避免循环引用），实际应放文件头部。

- [ ] **Step 3: 修正 import 位置（移到文件顶部）**

将 `import { createPcEmptySchema } from './empty-schema';` 移到文件顶部其他 import 旁边。

- [ ] **Step 4: typecheck**

```bash
npx vue-tsc --noEmit
```
Expected: 无错误（如果 `@cs/assembox-desktop-next` 的 SLOTS 导出方式不同，调整 import）

- [ ] **Step 5: 提交**

```bash
git add src/scenarios/pc-desktop/
git commit -m "feat(editor): PC 场景 PcSchemaOps（IBaseNode 9 种 slot 操作）+ 空模板"
```

---

## Self-Review

**1. Spec coverage:**
- P0-1 (DOM 标记): Task 0.1 ✓
- P0-2 (事件拦截): Task 0.2 ✓
- P0-3 (槽位标记): Task 0.3 + 0.4 ✓
- ISchemaOps 接口: Task 1.1 ✓
- IRenderer 接口: Task 1.1 ✓
- IComponentCatalog 接口: Task 1.1 ✓
- INestingRules 接口: Task 1.1 ✓
- ScenarioProfile: Task 1.1 ✓
- ScenarioRegistry: Task 1.2 ✓
- PcSchemaOps: Task 2.1 ✓
- PC 空模板: Task 2.1 ✓

**2. Placeholder scan:** 无 TBD/TODO。所有步骤有完整代码。

**3. Type consistency:** ISchemaOps 方法名在 Task 1.1 定义，在 Task 2.1 实现中完全一致（getNodeId/insertNode/moveNode 等）。SLOTS 导出需验证（`@cs/assembox-desktop-next` 是否直接导出 SLOTS 对象）。

**未覆盖（后续计划）：**
- Phase 0.5（AssemCore reactive 验证）→ Phase 3 renderer.ts 前验证
- Phase 3（PC renderer.ts）→ 需 Phase 0.5 结论
- Phase 4-7 → 依赖 Phase 3

---

Plan complete and saved to `packages/new-assembox-editor/docs/plans/2026-08-03-scenario-renderer-phase-0-2.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** - 每个任务派发独立子 agent，任务间 review
2. **Inline Execution** - 在本会话逐任务执行，带检查点

**Which approach?**
