# 多场景渲染器 Phase 0.5 + 3 + 4 + 5 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 验证 AssemCore schema 引用行为 + 实现 PC 场景 IRenderer（设计态渲染器）+ PcNestingRules + PcComponentCatalog。

**Architecture:** Phase 0.5 验证 AssemCore 不深拷贝 uiSkeleton（line 49 直接赋值引用）→ Phase 3 实现 PcRenderer（包装 AssemPlugin + reactive schema + DOM/槽位查询 + 事件回调）→ Phase 4 包装 nesting.ts → Phase 5 从 manifest.ts 提取组件清单。

**Tech Stack:** TypeScript, Vue 3, assembox-desktop-next, assembox-core-next

> ⚠️ **assembox-packages-project 目录禁止 git commit**。只有 `packages/new-assembox-editor/` 的修改才提交。

---

## 前置事实（已验证）

- AssemCore 构造函数 **直接赋值引用**（`this.uiSkeleton = config.uiSkeleton`），**不深拷贝** ✅
- AssemPlugin.install 把 `core.$dataModels` / `core.$globalVars` 用 `reactive()` 包装后替换引用
- `core.uiSkeleton` 未被 reactive 包装（但编辑器可以自己包装后传入）
- AssemNodeRenderer 无 `:key`（需在 renderer 层用响应式驱动重渲染）
- `nesting.ts` 导出 `SLOTS` / `lookupSlotGate` / `isCategoryAllowed` / `SlotField` / `SlotHost` / `SlotGate`
- `component-catalog.ts` 导出 `lookupMeta` / `getComponentMap` / `ComponentCategory` / `ComponentMeta`
- `manifest.ts` 导出 `COMPONENTS` 表（`{ [K in keyof ComponentTypes]: { component, category } }`）
- Phase 0 已给容器组件加了 `data-slot-host` + `data-slot-key` DOM 标记
- Phase 0 已给 useEditor 加了 `data-editor-id` DOM 标记

---

## File Structure

| 文件 | 责任 | 动作 |
|---|---|---|
| `scenarios/pc-desktop/renderer.ts` | PcRenderer（IRenderer 实现） | 新建 |
| `scenarios/pc-desktop/nesting-rules.ts` | PcNestingRules（INestingRules 实现） | 新建 |
| `scenarios/pc-desktop/component-catalog.ts` | PcComponentCatalog（IComponentCatalog 实现） | 新建 |
| `scenarios/pc-desktop/component-metadata.ts` | 组件元数据（scaffold + props） | 新建 |
| `scenarios/pc-desktop/index.ts` | ScenarioProfile 聚合 | 新建 |

---

# Phase 0.5 — AssemCore Reactive 验证

## Task 0.5: 验证 + 确定 reactive schema 桥接方案

**结论（已通过代码审查确认）**：

AssemCore 构造函数（`assem-core.ts:49`）：
```typescript
this.uiSkeleton = config.uiSkeleton;  // 直接赋值，不拷贝
```

AssemPlugin.install（`desktop-next/index.ts:15`）：
```typescript
const core = new AssemCore(config);  // core.uiSkeleton === config.uiSkeleton（同一引用）
```

**方案确定**：编辑器在 `mount()` 时把 Store 的 reactive schema 直接作为 `config.uiSkeleton` 传入 → AssemCore 持有同一 reactive 引用 → ISchemaOps 原地修改 → Vue reactivity 自动传播到组件。

- [ ] **Step 1: 无需代码改动，记录结论**

方案 = **C（reactive 引用共享）**。无需改 AssemCore，无需 IRenderer 层包装 proxy。

---

# Phase 3 — PC 场景 IRenderer 实现

## Task 3.1: PcRenderer 骨架 + mount/dispose

**Files:**
- Create: `packages/new-assembox-editor/src/scenarios/pc-desktop/renderer.ts`

- [ ] **Step 1: 创建 renderer.ts**

```typescript
import { createApp, reactive, h, type App } from 'vue';
import {
  AssemPlugin,
  registerDefaults,
  ASSEM_CONTEXT_KEY,
  NODE_REGISTRY_KEY,
} from '@cs/assembox-desktop-next';
import type { AssemConfig } from '@cs/assembox-core-next';
import type {
  IRenderer,
  SlotMarker,
  RendererMountOptions,
} from '../../scenario/types';

/**
 * PC 场景设计态渲染器
 *
 * 包装 assembox-desktop-next（生产渲染器），增加编辑器专属能力：
 * - reactive schema 桥接（Store.schema === AssemCore.uiSkeleton 同一引用）
 * - DOM 查询（data-editor-id / data-slot-host / data-slot-key）
 * - 事件回调（onClick / onHover / onReady）
 */
export class PcRenderer implements IRenderer {
  private app: App | null = null;
  private container: HTMLElement | null = null;
  private schema: any = null;
  private core: any = null;

  // 事件回调
  private readyCbs: Array<() => void> = [];
  private clickCb: ((nodeId: string | null, e: MouseEvent) => void) | null = null;
  private hoverCb: ((nodeId: string | null) => void) | null = null;

  async mount(
    container: HTMLElement,
    schema: any,
    options?: RendererMountOptions,
  ): Promise<void> {
    this.container = container;
    this.schema = schema;

    // 编辑器环境标记
    (window as any).assemBoxIsEdit = true;
    (window as any).assemBoxDesignMode = 'design';

    // 注册 AssemVueRenderer 契约（供 useEditor 回调）
    (window as any).AssemVueRenderer = {
      onMountedInstance: (_instance: unknown) => {
        // 节点挂载后可触发 ready（首次）
        if (this.readyCbs.length) {
          this.readyCbs.forEach((cb) => cb());
          this.readyCbs = [];
        }
      },
      onUpdatedInstance: (_instance: unknown) => {},
      onUnmountedInstance: (_instance: unknown) => {},
    };

    // 绑定画布级事件（capture 阶段，供选区/悬浮）
    this.bindCanvasEvents(container);

    // 创建 Vue app + 安装 AssemPlugin
    const config: AssemConfig = {
      uiSkeleton: schema,
      dataSource: { api: {}, requestConfig: [], sharedFns: {} },
      security: {},
    };

    this.app = createApp({
      render: () => {
        // 渲染第一个场景的 planeOptions（根节点）
        const scenes = Object.values(this.schema || {});
        const root = (scenes[0] as any)?.viewsProps?.planeOptions;
        if (!root) return h('div', '空场景');
        return h('div', { class: 'assem-pc-canvas' }, [
          this.renderNode(root),
        ]);
      },
    });

    this.app.use(AssemPlugin, config);
    registerDefaults();
    this.app.mount(container);

    // 获取 core 引用（供 updateNode 使用）
    this.core = this.app.config.globalProperties.$assemCore;
  }

  /**
   * 递归渲染节点（简化版：直接用 AssemNodeRenderer 风格）
   * 实际渲染委托给 assembox-desktop-next 的组件系统
   */
  private renderNode(node: any): any {
    // 这里只渲染根节点，子节点由 assembox-desktop-next 组件内部递归渲染
    // 根节点是一个 FlexBox，它的 __nodeOptions.itemConfig[].defaultSlot 包含子节点
    // assembox-desktop-next 的组件会自动递归
    const renderType = node?.__nodeOptions?.renderType;
    if (!renderType) return null;

    // 动态解析组件
    const { lookupComponent } = require('@cs/assembox-desktop-next');
    const Comp = lookupComponent(renderType);
    if (!Comp) return h('div', `未注册: ${renderType}`);

    return h(Comp, {
      __nodeOptions: node.__nodeOptions,
      __nodeEvent: node.__nodeEvent || {},
      __nodeStyle: node.__nodeStyle,
      __nodeProps: node.__nodeProps,
      __nodeId: node.__nodeId,
      __nodeName: node.__nodeName,
    });
  }

  setSchema(schema: any): void {
    // 全量替换：更新 schema 引用（如果是 reactive 对象，直接改属性）
    // 方案：替换 scenes 的内容
    const oldKeys = Object.keys(this.schema || {});
    const newKeys = Object.keys(schema || {});
    // 清除旧场景
    for (const key of oldKeys) {
      delete this.schema[key];
    }
    // 写入新场景
    for (const key of newKeys) {
      this.schema[key] = schema[key];
    }
  }

  updateNode(nodeId: string, patch: any): void {
    // 属性变更：通过 NodeRegistry.patchProps 或直接改 reactive schema
    // reactive schema 的属性变更会自动传播到组件（useNodeOptions computed）
    if (patch.__nodeOptions) {
      const node = this.findNodeById(nodeId);
      if (node) Object.assign(node.__nodeOptions, patch.__nodeOptions);
    }
    if (patch.__nodeEvent) {
      const node = this.findNodeById(nodeId);
      if (node) Object.assign(node.__nodeEvent, patch.__nodeEvent);
    }
    if (patch.__nodeStyle) {
      const node = this.findNodeById(nodeId);
      if (node) node.__nodeStyle = { ...(node.__nodeStyle || {}), ...patch.__nodeStyle };
    }
  }

  onStructureChange(): void {
    // 结构变更靠 reactive 数组操作自动 diff，无需手动触发
  }

  setDraggingState(active: boolean): void {
    (window as any).assemBoxDesignMode = active ? 'design' : 'design'; // 保持 design
    if (this.container) {
      this.container.style.cursor = active ? 'copy' : '';
      this.container.style.pointerEvents = active ? 'none' : '';
      // 恢复
      if (!active) {
        this.container.style.pointerEvents = '';
      }
    }
  }

  setDesignMode(mode: 'design' | 'preview'): void {
    (window as any).assemBoxDesignMode = mode;
  }

  // ── DOM 查询 ──

  getNodeElement(nodeId: string): HTMLElement | null {
    if (!this.container) return null;
    return this.container.querySelector(`[data-editor-id="${nodeId}"]`) as HTMLElement | null;
  }

  getRect(nodeId: string): DOMRect | null {
    const el = this.getNodeElement(nodeId);
    return el ? el.getBoundingClientRect() : null;
  }

  nodeIdFromElement(el: HTMLElement | null): string | null {
    if (!el) return null;
    const found = el.closest('[data-editor-id]') as HTMLElement | null;
    return found ? found.getAttribute('data-editor-id') : null;
  }

  // ── 槽位查询 ──

  getSlotMarkers(nodeId: string): SlotMarker[] | null {
    if (!this.container) return null;
    const els = this.container.querySelectorAll(`[data-slot-host="${nodeId}"]`);
    if (!els.length) return null;
    return Array.from(els).map((el) => {
      const slotKey = el.getAttribute('data-slot-key') || 'defaultSlot';
      return {
        slotKey,
        el: el as HTMLElement,
        rect: el.getBoundingClientRect(),
      };
    });
  }

  resolveFromElement(el: HTMLElement | null): { nodeId: string; slotKey: string } | null {
    if (!el) return null;
    // 先找最近的 slot 标记
    const slotEl = el.closest('[data-slot-host]') as HTMLElement | null;
    const nodeEl = el.closest('[data-editor-id]') as HTMLElement | null;
    if (!nodeEl) return null;
    const nodeId = nodeEl.getAttribute('data-editor-id')!;
    const slotKey = slotEl?.getAttribute('data-slot-key') || 'defaultSlot';
    return { nodeId, slotKey };
  }

  // ── 事件回调 ──

  onReady(cb: () => void): void {
    this.readyCbs.push(cb);
  }

  onClick(cb: (nodeId: string | null, e: MouseEvent) => void): void {
    this.clickCb = cb;
  }

  onHover(cb: (nodeId: string | null) => void): void {
    this.hoverCb = cb;
  }

  // ── 内部方法 ──

  private bindCanvasEvents(container: HTMLElement): void {
    // capture 阶段 click → 选中
    container.addEventListener(
      'click',
      (e: MouseEvent) => {
        if ((window as any).assemBoxDesignMode !== 'design') return;
        const nodeId = this.nodeIdFromElement(e.target as HTMLElement);
        this.clickCb?.(nodeId, e);
        e.stopPropagation();
      },
      true,
    );

    // capture 阶段 mouseover → 悬浮
    container.addEventListener(
      'mouseover',
      (e: MouseEvent) => {
        if ((window as any).assemBoxDesignMode !== 'design') return;
        const nodeId = this.nodeIdFromElement(e.target as HTMLElement);
        this.hoverCb?.(nodeId);
        e.stopPropagation();
      },
      true,
    );

    container.addEventListener(
      'mouseleave',
      () => {
        this.hoverCb?.(null);
      },
      true,
    );
  }

  private findNodeById(nodeId: string): any | undefined {
    // 在 schema 树中查找节点（简化遍历）
    const walk = (node: any): any => {
      if (!node || typeof node !== 'object') return undefined;
      if (node.__nodeId === nodeId) return node;
      const opts = node.__nodeOptions;
      if (!opts) return undefined;
      for (const field of ['defaultSlot', 'toolSlot', 'filterSlot', 'headerSlot', 'rightSlot']) {
        const val = opts[field];
        if (Array.isArray(val)) {
          for (const child of val) {
            const found = walk(child);
            if (found) return found;
          }
        } else if (val && typeof val === 'object') {
          const found = walk(val);
          if (found) return found;
        }
      }
      if (Array.isArray(opts.itemConfig)) {
        for (const item of opts.itemConfig) {
          if (item?.defaultSlot) {
            const found = walk(item.defaultSlot);
            if (found) return found;
          }
        }
      }
      return undefined;
    };

    const scenes = Object.values(this.schema || {});
    for (const scene of scenes) {
      const root = (scene as any)?.viewsProps?.planeOptions;
      if (root) {
        const found = walk(root);
        if (found) return found;
      }
    }
    return undefined;
  }

  dispose(): void {
    this.app?.unmount();
    this.app = null;
    this.container = null;
    this.schema = null;
    this.core = null;
    (window as any).AssemVueRenderer = undefined;
  }
}
```

- [ ] **Step 2: typecheck**

```bash
cd packages/new-assembox-editor && npx vue-tsc --noEmit
```

> 预期可能有 `require` 相关错误——把 `require('@cs/assembox-desktop-next')` 改为顶部 import。

- [ ] **Step 3: 修正 import（把 require 改为顶部 import）**

将 renderer.ts 中 `renderNode` 方法的 `lookupComponent` 从 require 改为：
```typescript
import { lookupComponent } from '@cs/assembox-desktop-next';
```
放在文件顶部 import 区。

- [ ] **Step 4: 重新 typecheck**

```bash
npx vue-tsc --noEmit
```

- [ ] **Step 5: 提交**

```bash
git add src/scenarios/pc-desktop/renderer.ts
git commit -m "feat(editor): PC 场景 PcRenderer（设计态渲染器 — AssemPlugin 包装 + DOM/槽位查询 + 事件回调）"
```

---

# Phase 4 — PC 场景 INestingRules 实现

## Task 4.1: PcNestingRules

**Files:**
- Create: `packages/new-assembox-editor/src/scenarios/pc-desktop/nesting-rules.ts`

- [ ] **Step 1: 创建 nesting-rules.ts**

```typescript
import type { INestingRules } from '../../scenario/types';
import {
  lookupSlotGate,
  isCategoryAllowed,
  lookupMeta,
  type SlotField,
  type SlotHost,
} from '@cs/assembox-desktop-next';

/**
 * PC 场景嵌套校验
 * 直接包装 assembox-desktop-next 的 nesting.ts + component-catalog.ts
 */
export class PcNestingRules implements INestingRules {
  canNest(
    parentRenderType: string,
    slotKey: string,
    childRenderType: string,
  ): boolean {
    const gate = lookupSlotGate(
      parentRenderType as SlotHost,
      slotKey as SlotField,
    );
    if (!gate) return true; // 未登记 = 不限
    if (gate === 'any') return true;
    const childMeta = lookupMeta(childRenderType);
    if (!childMeta) return false;
    return isCategoryAllowed(childMeta.category, gate);
  }

  getAllowedCategories(
    parentRenderType: string,
    slotKey: string,
  ): string[] | undefined {
    const gate = lookupSlotGate(
      parentRenderType as SlotHost,
      slotKey as SlotField,
    );
    if (!gate || gate === 'any') return undefined;
    return gate;
  }

  getCategory(renderType: string): string | undefined {
    return lookupMeta(renderType)?.category;
  }
}
```

- [ ] **Step 2: typecheck + 提交**

```bash
npx vue-tsc --noEmit
git add src/scenarios/pc-desktop/nesting-rules.ts
git commit -m "feat(editor): PC 场景 PcNestingRules（包装 nesting.ts SLOTS 表）"
```

---

# Phase 5 — PC 场景 IComponentCatalog 实现

## Task 5.1: 组件元数据定义

**Files:**
- Create: `packages/new-assembox-editor/src/scenarios/pc-desktop/component-metadata.ts`

- [ ] **Step 1: 创建 component-metadata.ts（常用组件元数据）**

```typescript
import type { ComponentCatalogItem } from '../../scenario/types';

/**
 * PC 场景组件元数据
 *
 * scaffold 是拖入画布时生成的默认 __nodeOptions 片段。
 * props 驱动设置面板（setter 推断 + 默认值）。
 * events 驱动事件 Tab。
 *
 * ⚠️ 与 manifest.ts 的 ComponentTypes 同步：manifest 加了新组件或新属性，
 * 这里也要加。长期目标：让 manifest.ts 导出运行时元数据。
 */

// ── 分组定义 ──
export const PC_GROUPS = [
  { name: 'basic', title: '基础组件' },
  { name: 'form', title: '表单组件' },
  { name: 'layout', title: '布局组件' },
  { name: 'container', title: '容器组件' },
  { name: 'data', title: '数据组件' },
];

export const PC_CATEGORIES = [
  { name: 'display', title: '显示类' },
  { name: 'input', title: '输入类' },
  { name: 'button', title: '按钮类' },
  { name: 'select', title: '选择类' },
  { name: 'date', title: '日期类' },
  { name: 'layout-item', title: '布局项' },
  { name: 'container-item', title: '容器项' },
  { name: 'table', title: '表格类' },
  { name: 'list', title: '列表类' },
  { name: 'other', title: '其他' },
];

// ── 组件元数据 ──
export const PC_COMPONENTS: ComponentCatalogItem[] = [
  // ── 按钮 ──
  {
    renderType: 'Button',
    name: '按钮',
    group: 'basic',
    category: 'button',
    scaffold: { renderType: 'Button', content: '按钮', type: 'primary', plain: false },
    props: [
      { name: 'content', title: '按钮文字', propType: 'string', defaultValue: '按钮' },
      { name: 'type', title: '类型', propType: 'select', defaultValue: 'primary',
        setterProps: { options: [
          { label: '主要', value: 'primary' }, { label: '成功', value: 'success' },
          { label: '警告', value: 'warning' }, { label: '危险', value: 'danger' },
          { label: '默认', value: '' },
        ]}},
      { name: 'plain', title: '朴素', propType: 'boolean', defaultValue: false },
      { name: 'icon', title: '图标', propType: 'string', defaultValue: '' },
    ],
    events: [{ name: 'onClick', title: '点击' }],
  },
  // ── 输入框 ──
  {
    renderType: 'Input',
    name: '输入框',
    group: 'form',
    category: 'input',
    scaffold: { renderType: 'Input', placeholder: '请输入', clearable: true },
    props: [
      { name: 'placeholder', title: '占位文本', propType: 'string', defaultValue: '请输入' },
      { name: 'clearable', title: '可清空', propType: 'boolean', defaultValue: true },
      { name: 'disabled', title: '禁用', propType: 'boolean', defaultValue: false },
    ],
    events: [{ name: 'onChange', title: '值变化' }, { name: 'onClear', title: '清空' }],
  },
  // ── 下拉选择 ──
  {
    renderType: 'Select',
    name: '下拉选择',
    group: 'form',
    category: 'select',
    scaffold: { renderType: 'Select', placeholder: '请选择', clearable: true },
    props: [
      { name: 'placeholder', title: '占位文本', propType: 'string', defaultValue: '请选择' },
      { name: 'clearable', title: '可清空', propType: 'boolean', defaultValue: true },
      { name: 'disabled', title: '禁用', propType: 'boolean', defaultValue: false },
    ],
    events: [{ name: 'onChange', title: '值变化' }, { name: 'onClear', title: '清空' }],
  },
  // ── 标签 ──
  {
    renderType: 'Label',
    name: '标签',
    group: 'basic',
    category: 'display',
    scaffold: { renderType: 'Label', content: '标签文字' },
    props: [
      { name: 'content', title: '文本', propType: 'string', defaultValue: '标签文字' },
    ],
  },
  // ── 面板 ──
  {
    renderType: 'Panel',
    name: '面板',
    group: 'container',
    category: 'container-item',
    scaffold: { renderType: 'Panel', showHeader: true, title: '面板标题', border: true, paddingSize: 'base', defaultSlot: null },
    props: [
      { name: 'title', title: '标题', propType: 'string', defaultValue: '面板标题' },
      { name: 'showHeader', title: '显示头部', propType: 'boolean', defaultValue: true },
      { name: 'border', title: '边框', propType: 'boolean', defaultValue: true },
    ],
  },
  // ── 盒子 ──
  {
    renderType: 'Box',
    name: '盒子',
    group: 'container',
    category: 'container-item',
    scaffold: { renderType: 'Box', border: true, background: false, paddingSize: 'base', defaultSlot: null },
    props: [
      { name: 'border', title: '边框', propType: 'boolean', defaultValue: true },
      { name: 'background', title: '背景', propType: 'boolean', defaultValue: false },
    ],
  },
  // ── FlexBox ──
  {
    renderType: 'FlexBox',
    name: '弹性布局',
    group: 'layout',
    category: 'layout-item',
    scaffold: {
      renderType: 'FlexBox', isRow: true, itemNum: 1,
      itemConfig: [{ isFixed: false, paddingSize: 'base', clearPadding: [], isHidden: false, contentType: 'container', defaultSlot: null }],
    },
    props: [
      { name: 'isRow', title: '水平排列', propType: 'boolean', defaultValue: true },
      { name: 'itemNum', title: '列数', propType: 'number', defaultValue: 1 },
    ],
  },
  // ── 工具栏 ──
  {
    renderType: 'Toolbar',
    name: '工具栏',
    group: 'container',
    category: 'container-item',
    scaffold: { renderType: 'Toolbar', border: false, divider: false, toolSlot: [], filterSlot: [] },
    props: [
      { name: 'border', title: '边框', propType: 'boolean', defaultValue: false },
      { name: 'divider', title: '分割线', propType: 'boolean', defaultValue: false },
    ],
  },
  // ── 表单 ──
  {
    renderType: 'Form',
    name: '表单',
    group: 'form',
    category: 'other',
    scaffold: { renderType: 'Form', defaultSlot: null },
  },
  // ── 表单项 ──
  {
    renderType: 'FormItem',
    name: '表单项',
    group: 'form',
    category: 'other',
    scaffold: { renderType: 'FormItem', label: '标签', defaultSlot: null },
    props: [
      { name: 'label', title: '标签', propType: 'string', defaultValue: '标签' },
    ],
  },
  // ── 筛选项 ──
  {
    renderType: 'FilterItem',
    name: '筛选项',
    group: 'form',
    category: 'other',
    scaffold: {
      renderType: 'FilterItem', label: '筛选',
      layout: { xs: 24, sm: 12, md: 8, lg: 6, xl: 4 },
      defaultSlot: null,
    },
    props: [
      { name: 'label', title: '标签', propType: 'string', defaultValue: '筛选' },
    ],
  },
  // ── 卡片 ──
  {
    renderType: 'Card',
    name: '卡片',
    group: 'data',
    category: 'other',
    scaffold: { renderType: 'Card', header: '', defaultSlot: null },
    props: [
      { name: 'header', title: '标题', propType: 'string', defaultValue: '' },
    ],
  },
  // ── 数字输入 ──
  {
    renderType: 'InputNumber',
    name: '数字输入',
    group: 'form',
    category: 'input',
    scaffold: { renderType: 'InputNumber' },
  },
  // ── 开关 ──
  {
    renderType: 'Switch',
    name: '开关',
    group: 'form',
    category: 'input',
    scaffold: { renderType: 'Switch' },
  },
  // ── 单选组 ──
  {
    renderType: 'RadioGroup',
    name: '单选组',
    group: 'form',
    category: 'select',
    scaffold: { renderType: 'RadioGroup' },
  },
  // ── 多选组 ──
  {
    renderType: 'CheckboxGroup',
    name: '多选组',
    group: 'form',
    category: 'select',
    scaffold: { renderType: 'CheckboxGroup' },
  },
  // ── 日期选择 ──
  {
    renderType: 'DatePicker',
    name: '日期选择',
    group: 'form',
    category: 'date',
    scaffold: { renderType: 'DatePicker' },
  },
  // ── 统计 ──
  {
    renderType: 'Statistic',
    name: '统计',
    group: 'basic',
    category: 'display',
    scaffold: { renderType: 'Statistic' },
  },
  // ── 图片 ──
  {
    renderType: 'Image',
    name: '图片',
    group: 'basic',
    category: 'display',
    scaffold: { renderType: 'Image' },
  },
  // ── 图标 ──
  {
    renderType: 'Icon',
    name: '图标',
    group: 'basic',
    category: 'display',
    scaffold: { renderType: 'Icon' },
  },
  // ── Tag ──
  {
    renderType: 'Tag',
    name: '标签',
    group: 'basic',
    category: 'display',
    scaffold: { renderType: 'Tag' },
  },
];
```

- [ ] **Step 2: typecheck**

```bash
npx vue-tsc --noEmit
```

## Task 5.2: PcComponentCatalog + ScenarioProfile 聚合

**Files:**
- Create: `packages/new-assembox-editor/src/scenarios/pc-desktop/component-catalog.ts`
- Create: `packages/new-assembox-editor/src/scenarios/pc-desktop/index.ts`

- [ ] **Step 1: 创建 component-catalog.ts**

```typescript
import type { IComponentCatalog, ComponentCatalogItem } from '../../scenario/types';
import { PC_COMPONENTS, PC_GROUPS, PC_CATEGORIES } from './component-metadata';

/**
 * PC 场景组件目录
 * 从 component-metadata.ts 提供组件清单 + 分组 + 分类
 */
export class PcComponentCatalog implements IComponentCatalog {
  getComponents(): ComponentCatalogItem[] {
    return PC_COMPONENTS;
  }

  getGroups(): { name: string; title: string }[] {
    return PC_GROUPS;
  }

  getCategories(groupName: string): { name: string; title: string }[] {
    // 根据分组筛选该组下的分类
    const groupComponents = PC_COMPONENTS.filter((c) => c.group === groupName);
    const usedCategories = new Set(groupComponents.map((c) => c.category));
    return PC_CATEGORIES.filter((cat) => usedCategories.has(cat.name));
  }
}
```

- [ ] **Step 2: 创建 index.ts（ScenarioProfile 聚合）**

```typescript
import type { ScenarioProfile } from '../../scenario/types';
import { PcSchemaOps } from './schema-ops';
import { PcRenderer } from './renderer';
import { PcComponentCatalog } from './component-catalog';
import { PcNestingRules } from './nesting-rules';

/**
 * PC 桌面端场景档案
 */
export const pcDesktopProfile: ScenarioProfile = {
  id: 'pc-desktop',
  name: 'PC 桌面端',

  schemaOps: new PcSchemaOps(),
  createRenderer: () => new PcRenderer(),
  componentCatalog: new PcComponentCatalog(),
  nestingRules: new PcNestingRules(),
  emptySchema: () => new PcSchemaOps().emptySchema(),
};
```

- [ ] **Step 3: typecheck + 提交**

```bash
npx vue-tsc --noEmit
git add src/scenarios/pc-desktop/
git commit -m "feat(editor): PC 场景完整实现（PcRenderer + PcNestingRules + PcComponentCatalog + ScenarioProfile 聚合）"
```

---

## Self-Review

**1. Spec coverage:**
- Phase 0.5 (reactive 验证): Task 0.5 ✅（代码审查确认引用共享）
- IRenderer.mount/dispose/setSchema/updateNode: Task 3.1 ✅
- IRenderer DOM 查询 (getNodeElement/getRect/nodeIdFromElement): Task 3.1 ✅
- IRenderer 槽位查询 (getSlotMarkers/resolveFromElement): Task 3.1 ✅
- IRenderer 事件回调 (onClick/onHover/onReady): Task 3.1 ✅
- IRenderer.setDraggingState/setDesignMode: Task 3.1 ✅
- INestingRules.canNest/getAllowedCategories/getCategory: Task 4.1 ✅
- IComponentCatalog.getComponents/getGroups/getCategories: Task 5.2 ✅
- ComponentCatalogItem 元数据 (scaffold + props + events): Task 5.1 ✅
- ScenarioProfile 聚合: Task 5.2 ✅

**2. Placeholder scan:** 无 TBD。所有代码完整。renderNode 用了简化实现（lookupComponent），实际效果需运行验证。

**3. Type consistency:**
- PcRenderer 实现 IRenderer 全部方法 ✓
- PcNestingRules 实现 INestingRules 全部方法 ✓
- PcComponentCatalog 实现 IComponentCatalog 全部方法 ✓
- pcDesktopProfile 符合 ScenarioProfile 接口 ✓
- ComponentCatalogItem 字段名与 component-metadata.ts 一致 ✓

**已知风险（实施时验证）：**
- PcRenderer.renderNode 的简化渲染是否完整（可能需要用 AssemNodeRenderer 而非手动 lookupComponent）
- reactive schema 是否真的自动传播到 useNodeOptions（需运行验证）
- Window 全局变量在 SSR 下可能不存在（编辑器环境无此问题）
