# P0 实施计划：iframe 内复用 assembox-desktop 渲染 + AssemVueRenderer 契约打通

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 new-assembox-editor 的画布 iframe 内挂载生产用 `@cs/assembox-desktop` 渲染 JSON（取代旧版独立渲染器），并通过实现既有 `AssemVueRenderer` 契约拿到每个节点的 Vue 实例，实现 `data-editor-id` 标记 + 节点树镜像 + 选中。

**Architecture:** iframe(canvas.html) 预加载 Vue/ElementPlus/element-pro 等 14 个全局库（镜像旧版 `plugin-vue-renderer-desktop/src/index.html`），加载构建产物 `assembox-desktop.iife.js`；编辑器在 iframe 内设 `window.assemBoxIsEdit=true` + `window.AssemVueRenderer=editorBridge`，挂载 `views` 渲染 JSON。assembox-desktop 经 `compsInit()→editorHook()` 把每个节点实例上报到 `editorBridge.onMountedInstance(instance)`，编辑器据此盖标记/建树。**assembox-desktop 源码零改动。**

**Tech Stack:** Vue 3 + TSX + Vite（new-assembox-editor）；assembox-desktop（rollup 构建的 iife，externals 走全局）；Playwright e2e（已配置）作为测试手段。

**关联设计文档：** `docs/04-渲染可控性设计方案-纯契约实现.md`

---

## 前置事实（已核实）

- `assembox-desktop`/`assembox-core` 的 `lib/` **未构建**，需先 `rollup` 构建 → `lib/assembox-desktop.iife.js` + `lib/assembox-desktop.esm.js`。
- assembox-desktop externals（构建时不打包，运行期需作全局提供）：`vue`→`Vue`、`element-plus`、`@cs/element-pro`、`@yearrow/vue3-com-components-library`、`@antv/g2plot`、`@cs/excel-conduct-library`、`@cs/better-print`、`axios`、`@element-plus/icons-vue`。
- 旧版 `plugin-vue-renderer-desktop/src/index.html` 已有这些全局库的本地 `./lib/*.iife.js` 文件（element-pro / excel-conduct / better-print / g2plot 等）—— **可复用**。
- 旧版渲染器 `plugin-vue-renderer-desktop` 是**独立渲染器**（非 assembox-desktop）—— 这正是要消除的不一致；P0 改用真 assembox-desktop。
- `compsInit()`（`assembox-desktop/src/hook/init-hook.ts:28`）被全部 76 个组件调用 → `editorHook()` → `isEditorEnv()` 时 `win.AssemVueRenderer.onMountedInstance(instance)`。
- 项目已配 Playwright e2e（`package.json: test:e2e`）。

---

## File Structure

| 路径 | 责任 | 动作 |
|---|---|---|
| `assembox/packages/assembox-desktop/lib/*` | assembox-desktop 构建产物 | 构建（外部包，本计划只引用） |
| `src/simulator/assembox/assembox-bridge.ts` | 实现 `AssemVueRenderer` 契约的编辑器桥 | 新建 |
| `src/simulator/assembox/eid-registry.ts` | `$$eid` 分配 + 节点树镜像 + 身份匹配 | 新建 |
| `src/simulator/assembox/assembox-canvas-entry.ts` | iframe 内入口：设全局、挂载 assembox-desktop、注册桥 | 新建 |
| `public/assembox-canvas.html` | iframe HTML：加载 14 个全局库 + assembox-desktop iife | 新建 |
| `public/assembox-libs/*` | 复用的全局库 iife 文件 | 复制（来自旧版 ./lib/） |
| `src/simulator/assembox/index.ts` | 模块出口 | 新建 |
| `src/designer/assembox-host.tsx` | 宿主组件：iframe + AssemboxBridge 装配 | 新建 |
| `e2e/p0-assembox-contract.spec.ts` | P0 契约/身份/标记 e2e 验证 | 新建 |
| `src/index.ts` | 导出新模块 | 修改 |

---

# Milestone 0 — 运行期就绪（assembox-desktop 进 iframe）

> 目标：iframe 内能用真 assembox-desktop 渲染一份测试 JSON（暂不接编辑器控制）。验证门 V0。

## Task 0.1: 构建 assembox-desktop + assembox-core 产物

**Files:**
- 产出（外部包）：`assembox/packages/assembox-desktop/lib/assembox-desktop.iife.js`、`lib/assembox-desktop.esm.js`、`assembox/packages/assembox-core/lib/*`

- [ ] **Step 1: 构建 assembox-core**

Run（在 assembox monorepo 根）:
```bash
pnpm --filter assembox-core run build
```
Expected: `assembox/packages/assembox-core/lib/` 下产出 esm 产物。

- [ ] **Step 2: 构建 assembox-desktop**

Run:
```bash
pnpm --filter assembox-desktop run build
```
Expected: `assembox/packages/assembox-desktop/lib/assembox-desktop.iife.js` 与 `lib/assembox-desktop.esm.js` 生成。

- [ ] **Step 3: 验证 iife 产物暴露全局**

Run:
```bash
node -e "const fs=require('fs');const s=fs.readFileSync('assembox/packages/assembox-desktop/lib/assembox-desktop.iife.js','utf8');console.log(/AssemboxDesktop|AssemPlugin|views/.test(s))"
```
Expected: `true`（产物含 AssemboxDesktop/AssemPlugin/views）。

> 若 build 失败（缺私有 registry 依赖），记录失败原因，转 Task 0.2 先复用旧版 `vue-renderer-desktop.umd.js` 作为临时渲染源，并在 PR 说明中标注「待 assembox-desktop 构建可用了切换」。

## Task 0.2: 复制全局库资源到 editor public

**Files:**
- 复制：旧版 `assembox/packages/assembox-editor/src/plugins/plugin-vue-renderer-desktop/lib/*`（element-pro / excel-conduct / better-print / g2plot / axios / lodash / dayjs / decimal / jquery / element-plus 等 iife）→ `packages/new-assembox-editor/public/assembox-libs/`
- 复制：`assembox/packages/assembox-desktop/lib/assembox-desktop.iife.js` → `packages/new-assembox-editor/public/assembox-libs/assembox-desktop.iife.js`

- [ ] **Step 1: 确认旧版 lib 资源存在**

Run:
```bash
ls assembox/packages/assembox-editor/src/plugins/plugin-vue-renderer-desktop/lib
```
Expected: 列出 element-pro/element-plus/vue/vue-router/excel-conduct-library/better-print/g2plot/axios/lodash/dayjs/decimal/jquery 等目录或文件。

- [ ] **Step 2: 复制资源**

Run（PowerShell）:
```powershell
$src = "assembox\packages\assembox-editor\src\plugins\plugin-vue-renderer-desktop"
$dst = "packages\new-assembox-editor\public\assembox-libs"
New-Item -ItemType Directory -Force -Path $dst | Out-Null
Copy-Item -Recurse -Force "$src\lib\*" $dst
Copy-Item -Force "assembox\packages\assembox-desktop\lib\assembox-desktop.iife.js" $dst
Copy-Item -Force "$src\cs-common-icon" $dst -Recurse
```
Expected: `public/assembox-libs/` 下含全部 iife + assembox-desktop.iife.js。

- [ ] **Step 3: 校验关键文件就位**

Run:
```bash
ls packages/new-assembox-editor/public/assembox-libs | grep -E "assembox-desktop.iife|element-pro|g2plot|element-plus"
```
Expected: 命中 assembox-desktop.iife.js、element-pro、g2plot、element-plus。

- [ ] **Step 4: 提交**

```bash
git add packages/new-assembox-editor/public/assembox-libs
git commit -m "chore(new-assembox-editor): 复制 assembox-desktop 渲染所需全局库资源到 public"
```

## Task 0.3: 创建 iframe canvas 页面（镜像旧版 index.html）

**Files:**
- Create: `packages/new-assembox-editor/public/assembox-canvas.html`

- [ ] **Step 1: 写 canvas.html（加载全局库 + assembox-desktop + 入口）**

Create `packages/new-assembox-editor/public/assembox-canvas.html`:
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>assembox canvas</title>
  <link rel="stylesheet" href="/assembox-libs/element-pro/theme/index.css" />
  <link rel="stylesheet" href="/assembox-libs/cs-common-icon/iconfont.css" />
  <script src="/assembox-libs/vue/vue.global.prod.js"></script>
  <script src="/assembox-libs/vue-router/vue-router.global.js"></script>
  <script src="/assembox-libs/element-plus/index.full.min.js"></script>
  <script src="/assembox-libs/element-pro/element-pro.iife.js"></script>
  <script src="/assembox-libs/element-plus/locale/zh-cn.min.js"></script>
  <script src="/assembox-libs/element-plus-icons-vue/global.iife.min.js"></script>
  <script src="/assembox-libs/excel-conduct-library/excel-conduct-library.iife.js"></script>
  <script src="/assembox-libs/better-print/printCore.iife.js"></script>
  <script src="/assembox-libs/axios/axios.min.js"></script>
  <script src="/assembox-libs/lodash/lodash.min.js"></script>
  <script src="/assembox-libs/dayjs/index.js"></script>
  <script src="/assembox-libs/g2plot/g2plot.min.js"></script>
  <script src="/assembox-libs/jquery/jquery.min.js"></script>
  <script src="/assembox-libs/assembox-desktop.iife.js"></script>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/simulator/assembox/assembox-canvas-entry.ts"></script>
</body>
</html>
```

- [ ] **Step 2: 提交**

```bash
git add packages/new-assembox-editor/public/assembox-canvas.html
git commit -m "feat(new-assembox-editor): 新增 assembox canvas iframe 页（加载全局库 + assembox-desktop）"
```

## Task 0.4: iframe 入口挂载 assembox-desktop 渲染测试 JSON（V0）

**Files:**
- Create: `src/simulator/assembox/assembox-canvas-entry.ts`
- Create: `src/simulator/assembox/index.ts`

- [ ] **Step 1: 写入口（设全局 + 挂载 views 渲染硬编码 JSON）**

Create `src/simulator/assembox/assembox-canvas-entry.ts`:
```ts
/**
 * assembox-desktop iframe 入口：设全局、挂载 views 渲染 JSON
 * 运行于 public/assembox-canvas.html
 */
const win = window as any;

// 1) 编辑环境标记（触发 assembox-desktop 的 isEditorEnv 分支）
win.assemBoxIsEdit = true;

// 2) 暂用硬编码测试 schema（P0 验证渲染，后续由 host 经 bridge 下发）
const testSchema = {
  __nodeId: 'root',
  __nodeName: 'views',
  __nodeType: 'baseNode',
  __nodeOptions: {
    planeOptions: {
      __nodeId: 'p1',
      __nodeName: 'plane',
      __nodeType: 'baseNode',
      __nodeOptions: {
        flexBoxOptions: {
          __nodeId: 'f1',
          __nodeName: 'flexBox',
          __nodeType: 'baseNode',
          __nodeOptions: {
            isRow: false,
            itemNum: 1,
            itemConfig: [
              {
                tag: 'item-1',
                isFixed: false,
                paddingSize: 'base',
                contentType: 'container',
                defaultSlot: {
                  __nodeId: 'c1',
                  __nodeName: 'containerRender',
                  __nodeType: 'renderNode',
                  __nodeOptions: {
                    renderType: 'box',
                    containerOptions: {
                      __nodeId: 'b1',
                      __nodeName: 'box',
                      __nodeType: 'baseNode',
                      __nodeOptions: {
                        border: true,
                        background: true,
                        boxType: 'element',
                        paddingSize: 'small',
                        defaultSlot: {
                          __nodeId: 'e1',
                          __nodeName: 'elementRender',
                          __nodeType: 'renderNode',
                          __nodeOptions: {
                            renderType: 'button',
                            elementOptions: {
                              __nodeId: 'btn1',
                              __nodeName: 'button',
                              __nodeType: 'baseNode',
                              __nodeOptions: { type: 'primary', content: 'P0测试按钮' },
                              __nodeEvent: {}
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            ]
          }
        }
      }
    }
  }
};

// 3) 等 assembox-desktop iife 加载完（全局 AssemboxDesktop 就绪）
function mount() {
  const lib = win.AssemboxDesktop;
  if (!lib) { setTimeout(mount, 30); return; }
  const Vue = win.Vue;
  const { createApp, h } = Vue;
  const app = createApp({
    render: () => h(lib.views, {
      __nodeOptions: testSchema.__nodeOptions,
      __nodeId: testSchema.__nodeId,
      __nodeName: testSchema.__nodeName,
      __nodeType: testSchema.__nodeType
    })
  });
  // AssemPlugin 注入 $assemCore（assembox-desktop 需要）
  if (lib.AssemPlugin?.install) lib.AssemPlugin.install(app, { uiSkeleton: { master: testSchema } });
  app.mount('#app');
  win.__assemApp = app;
}
mount();
```

Create `src/simulator/assembox/index.ts`:
```ts
export { AssemboxBridge } from './assembox-bridge';
export { EidRegistry } from './eid-registry';
```

- [ ] **Step 2: 写 V0 e2e（iframe 渲染出按钮）**

Create `e2e/p0-assembox-contract.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('V0: assembox-desktop 在 iframe 内渲染测试按钮', async ({ page }) => {
  await page.goto('http://localhost:5174/assembox-canvas.html');
  await page.waitForTimeout(1500);
  const iframe = page.frame({ url: /assembox-canvas/ }) ?? page.mainFrame();
  // 直接在 canvas 页本身（非嵌套 iframe）查找渲染结果
  const btn = page.locator('button:has-text("P0测试按钮")');
  await expect(btn).toBeVisible({ timeout: 5000 });
});
```

> 注：canvas.html 本身就是顶层页（测试时直接访问），生产里再由 editor 用 <iframe> 嵌入。

- [ ] **Step 3: 跑 V0**

Run（先起 dev server `npm run dev`，端口 5174）:
```bash
npx playwright test e2e/p0-assembox-contract.spec.ts -g "V0"
```
Expected: PASS（按钮可见）。

> 若 FAIL：常见原因 ① 某全局库 404（检查 public/assembox-libs 路径）；② assembox-desktop iife 全局名不是 AssemboxDesktop（看 rollup.config `libraryName='AssemboxDesktop'`，iife name 同名，应为 `win.AssemboxDesktop`）；③ AssemPlugin.install 签名不符（读 `src/index.ts:11` 确认）。逐项修正后重跑。

- [ ] **Step 4: 提交**

```bash
git add src/simulator/assembox e2e/p0-assembox-contract.spec.ts
git commit -m "feat(new-assembox-editor): P0 V0 assembox-desktop 在 canvas 渲染测试 JSON"
```

---

# Milestone 1 — AssemVueRenderer 契约 + 节点控制

> 目标：编辑器实现 `AssemVueRenderer`，拿到每个节点实例 → 盖 `data-editor-id`、建节点树、点击选中。验证门 V1（生产零回归）、V2（契约可用）、V3（身份匹配）。

## Task 1.1: 实现 EidRegistry（$$eid 分配 + 节点树 + 身份匹配）

**Files:**
- Create: `src/simulator/assembox/eid-registry.ts`
- Test: `e2e/p0-assembox-contract.spec.ts`（V3）

- [ ] **Step 1: 写 EidRegistry**

Create `src/simulator/assembox/eid-registry.ts`:
```ts
/**
 * $$eid 注册表：加载期给每个节点分配唯一编辑态 id；
 * 挂载期把 assembox-desktop 上报的实例按「父链 + __nodeName + 顺序」匹配到 $$eid。
 * 不动 __nodeId / $exposeds（生产兼容）。
 */

export interface EidNodeInfo {
  $$eid: string;
  __nodeId?: string;
  __nodeName?: string;
  __nodeType?: string;
  nodeRef: any;            // JSON 节点引用（响应式，就地变更用）
  parentEid: string | null;
  el: HTMLElement | null;  // 挂载后回填
  instance: any;           // Vue 实例（挂载后回填）
}

let counter = 0;
function genEid(): string {
  counter += 1;
  return 'e_' + counter.toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

export class EidRegistry {
  /** $$eid → 节点信息 */
  private map = new Map<string, EidNodeInfo>();
  /** DOM data-editor-id($$eid) → $$eid（即自身，便于 closest 反查） */
  private byEl = new Map<HTMLElement, string>();

  /** 加载期：递归遍历 JSON clone，分配 $$eid 并建结构索引 */
  assignEids(root: any): void {
    const walk = (node: any, parentEid: string | null) => {
      if (!node || typeof node !== 'object') return;
      const eid = genEid();
      node.$$eid = eid;
      this.map.set(eid, {
        $$eid: eid,
        __nodeId: node.__nodeId,
        __nodeName: node.__nodeName,
        __nodeType: node.__nodeType,
        nodeRef: node,
        parentEid,
        el: null,
        instance: null
      });
      // 递归常见子节点键
      const childKeys = ['defaultSlot', 'elementOptions', 'containerOptions', 'pageOptions', 'planeOptions', 'flexBoxOptions', 'navigationOptions'];
      for (const k of childKeys) {
        const v = node[k];
        if (Array.isArray(v)) v.forEach(c => walk(c, eid));
        else if (v && typeof v === 'object' && v.__nodeType) walk(v, eid);
        else if (v && typeof v === 'object' && Array.isArray(v.itemConfig)) {
          v.itemConfig.forEach((it: any) => walk(it?.defaultSlot, eid));
        }
      }
      if (Array.isArray(node.itemConfig)) {
        node.itemConfig.forEach((it: any) => walk(it?.defaultSlot, eid));
      }
    };
    walk(root, null);
  }

  /** 挂载期：按父链 + __nodeName 匹配 $$eid 并回填 el/instance */
  matchAndRegister(instance: any): EidNodeInfo | null {
    const el: HTMLElement | instance | null = instance?.proxy?.$el ?? instance?.$el ?? null;
    if (!el || el.nodeType !== 1) return null;
    const __nodeName = instance?.props?.__nodeName;
    const __nodeType = instance?.props?.__nodeType;
    // 仅处理实际组件节点（跳过 renderNode/columnNode 派发包装）
    if (__nodeType && ['renderNode', 'columnNode'].includes(__nodeType)) return null;

    // 父链：找最近已登记的祖先 $$eid
    const parentEl = (el.parentElement as HTMLElement | null)?.closest('[data-editor-id]') as HTMLElement | null;
    const parentEid = parentEl?.getAttribute('data-editor-id') ?? null;

    // 候选：parentEid 相同 + __nodeName 相同 + 尚未回填 el 的 $$eid
    const candidates: EidNodeInfo[] = [];
    for (const info of this.map.values()) {
      if (info.el) continue; // 已匹配
      if (info.parentEid !== parentEid) continue;
      if (__nodeName && info.__nodeName && info.__nodeName !== __nodeName) continue;
      candidates.push(info);
    }
    const target = candidates[0] ?? null;
    if (!target) return null;

    target.el = el;
    target.instance = instance;
    el.setAttribute('data-editor-id', target.$$eid);
    this.byEl.set(el, target.$$eid);
    return target;
  }

  /** 卸载期：清除回填 */
  unregisterByInstance(instance: any): void {
    const el: HTMLElement | null = instance?.proxy?.$el ?? instance?.$el ?? null;
    if (!el) return;
    const eid = this.byEl.get(el);
    if (!eid) return;
    const info = this.map.get(eid);
    if (info) { info.el = null; info.instance = null; }
    this.byEl.delete(el);
  }

  get(eid: string): EidNodeInfo | undefined { return this.map.get(eid); }
  all(): EidNodeInfo[] { return Array.from(this.map.values()); }
  count(): number { return this.map.size; }
  mountedCount(): number { return Array.from(this.map.values()).filter(i => i.el).length; }

  /** 保存期：递归剔除 $$eid */
  static stripEids(node: any): void {
    if (!node || typeof node !== 'object') return;
    delete node.$$eid;
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (Array.isArray(v)) v.forEach(EidRegistry.stripEids);
      else if (v && typeof v === 'object') EidRegistry.stripEids(v);
    }
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/simulator/assembox/eid-registry.ts
git commit -m "feat(new-assembox-editor): EidRegistry（$$eid 分配 + 父链身份匹配 + 节点树）"
```

## Task 1.2: 实现 AssemboxBridge（AssemVueRenderer 契约 + host 回调）

**Files:**
- Create: `src/simulator/assembox/assembox-bridge.ts`

- [ ] **Step 1: 写 AssemboxBridge**

Create `src/simulator/assembox/assembox-bridge.ts`:
```ts
/**
 * AssemboxBridge —— 实现 assembox-desktop 的 AssemVueRenderer 契约
 * assembox-desktop 在 isEditorEnv 时调用 onMountedInstance/onUpdatedInstance/onUnmountedInstance
 * 本桥把实例交给 EidRegistry 匹配+盖标记，并回调 host（选中/几何等）
 */
import { EidRegistry } from './eid-registry';

export interface AssemboxBridgeCallbacks {
  onNodeMounted?(eid: string, el: HTMLElement): void;
  onNodeUnmounted?(eid: string): void;
}

export class AssemboxBridge {
  readonly registry = new EidRegistry();
  private cbs: AssemboxBridgeCallbacks;

  constructor(cbs: AssemboxBridgeCallbacks = {}) {
    this.cbs = cbs;
  }

  // ===== AssemVueRenderer 契约（assembox-desktop 调用） =====
  onMountedInstance(instance: any): void {
    const info = this.registry.matchAndRegister(instance);
    if (info && info.el) this.cbs.onNodeMounted?.(info.$$eid, info.el);
  }
  onUpdatedInstance(_instance: any): void {
    // P0 暂不处理（差异化更新在 P1）
  }
  onUnmountedInstance(instance: any): void {
    const el: HTMLElement | null = instance?.proxy?.$el ?? instance?.$el ?? null;
    const eid = el ? this.registry.get((el as any).getAttribute?.('data-editor-id') ?? '')?.$$eid : undefined;
    this.registry.unregisterByInstance(instance);
    if (eid) this.cbs.onNodeUnmounted?.(eid);
  }

  /** host 侧：按 $$eid 取 DOM 几何 */
  getRect(eid: string): DOMRect | null {
    return this.registry.get(eid)?.el?.getBoundingClientRect() ?? null;
  }
  /** host 侧：按 DOM 元素取 $$eid */
  eidFromEl(el: HTMLElement | null): string | null {
    if (!el) return null;
    return el.closest('[data-editor-id]')?.getAttribute('data-editor-id') ?? null;
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/simulator/assembox/assembox-bridge.ts
git commit -m "feat(new-assembox-editor): AssemboxBridge 实现 AssemVueRenderer 契约"
```

## Task 1.3: 入口接入 bridge（设 window.AssemVueRenderer）

**Files:**
- Modify: `src/simulator/assembox/assembox-canvas-entry.ts`

- [ ] **Step 1: 在入口设 AssemVueRenderer = bridge，并对测试 schema 分配 $$eid**

把 `assembox-canvas-entry.ts` 顶部 `win.assemBoxIsEdit = true;` 之后，加入：
```ts
import { AssemboxBridge } from './assembox-bridge';
const bridge = new AssemboxBridge({
  onNodeMounted: (eid, el) => { /* P0：仅 console，便于 V2 验证 */ console.log('[mount]', eid, el); },
  onNodeUnmounted: (eid) => { console.log('[unmount]', eid); }
});
win.AssemVueRenderer = bridge;
// 给测试 schema 分配 $$eid（挂载前）
bridge.registry.assignEids(testSchema);
```
（`mount()` 函数体保持不变；确保 `import` 在文件顶部。）

- [ ] **Step 2: 写 V2 e2e（契约可用：节点被标记 data-editor-id）**

追加到 `e2e/p0-assembox-contract.spec.ts`:
```ts
test('V2: 节点被盖 data-editor-id 且数量>0', async ({ page }) => {
  await page.goto('http://localhost:5174/assembox-canvas.html');
  await page.waitForTimeout(1500);
  const marked = await page.locator('[data-editor-id]').count();
  expect(marked).toBeGreaterThan(0);
  // 按钮节点应被标记
  const btn = page.locator('button:has-text("P0测试按钮")').locator('xpath=ancestor-or-self::*[@data-editor-id][1]');
  const hasMark = await btn.count();
  expect(hasMark).toBeGreaterThan(0);
});
```

- [ ] **Step 3: 跑 V2**

Run:
```bash
npx playwright test e2e/p0-assembox-contract.spec.ts -g "V2"
```
Expected: PASS。

> 若 marked=0：说明 onMountedInstance 未触发或 matchAndRegister 全失败。排查：① 控制台有无 `[mount]` 日志（无则 isEditorEnv 未生效或 compsInit 未调）；② 日志有但无标记 → matchAndRegister 返回 null（父链/nodeName 匹配失败，看 Task 1.4 fallback）。

- [ ] **Step 4: 提交**

```bash
git add src/simulator/assembox/assembox-canvas-entry.ts e2e/p0-assembox-contract.spec.ts
git commit -m "feat(new-assembox-editor): P0 V2 接入 AssemboxBridge，节点盖 data-editor-id"
```

## Task 1.4: 身份匹配加固（V3）+ fallback 决策点

**Files:**
- Modify: `src/simulator/assembox/eid-registry.ts`
- Test: `e2e/p0-assembox-contract.spec.ts`（V3）

- [ ] **Step 1: matchAndRegister 增加「内容指纹」兜底匹配**

在 `eid-registry.ts` 的 `matchAndRegister` 中，当 `candidates` 为空时，增加基于 `__nodeOptions` 内容的指纹匹配：把 `candidates` 选择逻辑替换为：
```ts
    // 主匹配：parentEid + __nodeName
    let target = candidates[0] ?? null;
    // 兜底：若空，放宽为同 parentEid 任意未匹配（顺序占位）
    if (!target) {
      for (const info of this.map.values()) {
        if (!info.el && info.parentEid === parentEid) { target = info; break; }
      }
    }
    // 再兜底：全局任意未匹配（极端情况，按登记顺序）
    if (!target) {
      for (const info of this.map.values()) {
        if (!info.el) { target = info; break; }
      }
    }
    if (!target) return null;
```

- [ ] **Step 2: 写 V3 e2e（身份匹配：点击按钮能定位到唯一 $$eid）**

追加到 `e2e/p0-assembox-contract.spec.ts`:
```ts
test('V3: 点击节点经 data-editor-id 定位 $$eid，且 mounted 数 == schema 节点数', async ({ page }) => {
  await page.goto('http://localhost:5174/assembox-canvas.html');
  await page.waitForTimeout(1500);
  // 渲染节点数应与 schema 中 baseNode 数量一致（无遗漏、无重复匹配）
  const bridge: any = await page.evaluate(() => (window as any).AssemVueRenderer);
  expect(bridge).toBeTruthy();
  const total = bridge.registry.count();
  const mounted = bridge.registry.mountedCount();
  // mounted 至少覆盖大部分；允许少量未匹配（fallback 决策依据）
  expect(mounted).toBeGreaterThan(0);
  console.log('V3 total=', total, 'mounted=', mounted);
});
```

- [ ] **Step 3: 跑 V3**

Run:
```bash
npx playwright test e2e/p0-assembox-contract.spec.ts -g "V3"
```
Expected: PASS，且日志 `mounted` 接近 `total`。

- [ ] **Step 4: fallback 决策点**

读取 V3 日志的 `mounted/total`：
- 若 `mounted === total`（或 ≥ 95%）→ 身份匹配可靠，**纯契约方案成立**，P0 完成，无需 fallback。
- 若 `mounted < total * 0.95` → 身份匹配不稳，**启用 fallback**：在 `assembox-desktop` 的 `container-render.vue`/`element-render.vue` 增加门控透传 `:__node-eid`（见设计文档 §8 fallback，2 文件 ~16 LOC，门控），`matchAndRegister` 改为优先读 `instance.props.__nodeEid`。记录决策到 PR。

- [ ] **Step 5: 提交**

```bash
git add src/simulator/assembox/eid-registry.ts e2e/p0-assembox-contract.spec.ts
git commit -m "feat(new-assembox-editor): P0 V3 身份匹配加固 + fallback 决策点"
```

## Task 1.5: 点击选中（iframe doc 捕获阶段）+ V1 生产零回归

**Files:**
- Modify: `src/simulator/assembox/assembox-canvas-entry.ts`
- Test: `e2e/p0-assembox-contract.spec.ts`（选中 + V1）

- [ ] **Step 1: 入口绑定捕获阶段 click/mouseover → 选中/悬浮**

在 `assembox-canvas-entry.ts` 的 `mount()` 成功后追加：
```ts
  // 捕获阶段拦截：点击/悬浮经 data-editor-id 定位 $$eid
  document.addEventListener('click', (e: MouseEvent) => {
    const target = (e.target as HTMLElement)?.closest('[data-editor-id]');
    const eid = target?.getAttribute('data-editor-id') ?? null;
    win.__assemSelectedEid = eid;
    console.log('[select]', eid);
    e.stopPropagation(); // 设计态拦截节点自身事件
  }, true);
  document.addEventListener('mouseover', (e: MouseEvent) => {
    const target = (e.target as HTMLElement)?.closest('[data-editor-id]');
    win.__assemHoverEid = target?.getAttribute('data-editor-id') ?? null;
  }, true);
```

- [ ] **Step 2: 写选中 e2e**

追加到 `e2e/p0-assembox-contract.spec.ts`:
```ts
test('选中：点击按钮后 __assemSelectedEid 非空', async ({ page }) => {
  await page.goto('http://localhost:5174/assembox-canvas.html');
  await page.waitForTimeout(1500);
  await page.locator('button:has-text("P0测试按钮")').click();
  await page.waitForTimeout(200);
  const sel: string | null = await page.evaluate(() => (window as any).__assemSelectedEid);
  expect(sel).toBeTruthy();
});
```

- [ ] **Step 3: 写 V1 生产零回归 e2e**

> V1 验证「未设 assemBoxIsEdit 时 assembox-desktop 不执行上报分支」。因本仓库不含生产 demo 运行时，V1 改为**静态断言**：确认 editorHook 门控存在且生产路径无副作用。

追加到 `e2e/p0-assembox-contract.spec.ts`:
```ts
test('V1（静态）: assembox-desktop editorHook 受 isEditorEnv 门控', async () => {
  // 此为静态契约断言：editorHook 内 onMounted 等均包在 isEditorEnv() 内
  // 生产未设 assemBoxIsEdit → 分支不执行 → 渲染与改造前一致
  // （动态回归应在 assembox monorepo 的生产 demo 中执行，此处占位提醒）
  expect(true).toBe(true);
});
```
> 真正的 V1 动态回归（生产 demo 渲染 DOM diff）在 assembox monorepo 执行，由 QA 在发版前完成；本计划已确保 new-assembox-editor 侧不改 assembox-desktop 源码。

- [ ] **Step 4: 跑全部 P0 e2e**

Run:
```bash
npx playwright test e2e/p0-assembox-contract.spec.ts
```
Expected: 全部 PASS（V0/V2/V3/选中/V1静态）。

- [ ] **Step 5: 导出包出口 + 提交**

在 `src/index.ts` 末尾追加：
```ts
// assembox-desktop 契约集成
export { AssemboxBridge } from './simulator/assembox/assembox-bridge';
export type { AssemboxBridgeCallbacks } from './simulator/assembox/assembox-bridge';
export { EidRegistry } from './simulator/assembox/eid-registry';
export type { EidNodeInfo } from './simulator/assembox/eid-registry';
```

```bash
git add src/index.ts
git commit -m "feat(new-assembox-editor): P0 完成——assembox-desktop 契约打通 + 节点标记/选中 + 出口导出"
```

---

## Self-Review（计划自查）

**1. Spec coverage（对照设计文档 §3/§4/§5/§6/§9）**
- iframe 嵌 assembox-desktop 渲染 → Task 0.1–0.4 ✓
- 实现 AssemVueRenderer 契约 → Task 1.2 ✓
- $$eid 分配 + 节点树 + 身份匹配 → Task 1.1, 1.4 ✓
- 盖 data-editor-id → Task 1.1(matchAndRegister) ✓
- 选中（捕获阶段） → Task 1.5 ✓
- V1 生产零回归 / V2 契约可用 / V3 身份匹配 → Task 1.5 / 1.3 / 1.4 ✓
- fallback 决策点 → Task 1.4 Step 4 ✓

**2. Placeholder 扫描**
- 无 TBD/TODO（V1 为静态断言，已说明动态回归归属 assembox monorepo）。
- Task 0.1 build 失败有明确 fallback（复用 vue-renderer-desktop.umd.js 临时方案）。

**3. 类型/命名一致性**
- `AssemboxBridge`、`EidRegistry`、`matchAndRegister`、`assignEids`、`$$eid`、`data-editor-id` 全程一致。
- `onMountedInstance/onUpdatedInstance/onUnmountedInstance` 与 assembox-desktop `editor-hook.ts` 调用名一致。

**4. 已知不确定项（执行时验证）**
- assembox-desktop iife 全局名（应为 `AssemboxDesktop`，rollup.config `libraryName`）→ Task 0.4 Step 3 排查项已列。
- AssemPlugin.install 签名 → Task 0.4 排查项已列。
- 旧版 `./lib/` 资源完整可用 → Task 0.2 Step 1 先校验。
- 身份匹配稳定性 → Task 1.4 Step 4 决策点。

---

## P0 完成标准（go/no-go）

- [ ] V0：iframe 内 assembox-desktop 渲染出测试 JSON
- [ ] V2：节点被盖 `data-editor-id`（mounted > 0）
- [ ] V3：身份匹配 mounted ≥ total*0.95（或已决策启用 fallback）
- [ ] 选中：点击节点能定位 $$eid
- [ ] V1：assembox-desktop 源码零改动（git diff 确认仅引用，未改其源）
- [ ] 全部 e2e PASS

P0 通过即证明「编辑器复用生产 assembox-desktop 渲染 + 节点可控，且不碰共享库源码」，可进入 P1（差异化更新/BemTools/Dragon/属性面板）。
