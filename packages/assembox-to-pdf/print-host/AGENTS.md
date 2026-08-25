# AGENTS.md — @cs/print-host

打印宿主页：Chromium 内加载的 Vue 3 页面，负责装配渲染栈、执行就绪信号协议、产出可打印布局。上级总览见 `../AGENTS.md`（§4 数据流、§6 就绪协议、§8 双表修复为本包摘要）。

## 运行形态

Vite 构建为纯静态产物（base=`/print-assets/`），由 server `ServeStaticAssets` 托管 + `/print?ticket=` 返回 index.html。**不在本包起 dev 服务调试**——宿主页依赖 claim 接口与票据，调试一律走 server 端到端。

## 源码地图（按执行顺序）

| 文件 | 职责 | 关键约束 |
|------|------|---------|
| `src/main.ts` | bootstrap：`win.Vue = ESM Vue`（单实例，UMD 包全读它）→ `loadVendorAssets()` → `claimTask()` → `deserializeScene(单个场景对象)` → `transformForPrint` → createApp + AssemPlugin + registerDefaults → `wrapFns`（**必须 mount 前**，表格 onMounted 即发请求）→ mount | `deserializeScene` 入参是 `[sceneName]` 处的单场景，传整个 uiSkeleton 会 `planeOptions` undefined；不设 `assemBoxIsEdit`（打印是运行态） |
| `src/assets.ts` | vendor UMD 装载（**顺序敏感**：element-plus → icons → vue-router → axios → element-plus-ui → table-pro → js-web-framework → biz-lib → g2plot）+ `installVendorPlugins`（portalPinia 是 tableCode 表格硬依赖；ElementPlus 注入 zhCn locale） | CSS 加载**必须等 load 事件**（返回 Promise），否则无样式布局竞态 |
| `src/readiness.ts` | 就绪信号协议（本包核心，见下）+ `normalizePrintLayout` + `reparentTablesForPrint` | settle 顺序不可乱 |
| `src/claim.ts` | 一次性票据 → 任务载荷（sceneName/uiSkeleton/dataSource/routerConfig/printOptions） | 失败走 `failFast` 置 `__ASSEM_PDF_ERROR__` |
| `src/print.css` | `@media print`：解视口约束、el-table 族解高、斑马纹背景 `print-color-adjust:exact`、`thead table-header-group`、`tr break-inside avoid`、打印表槽 `.assem-print-table`；屏幕态按纸宽 794px（landscape 1123px） | 约束只圈 `[data-print-root]`，不污染 Element Plus 全局 |
| `src/shims/vue3-biz-components-library.ts` | ESM 桥接：desktop-next dist 以 ESM import `useTableSetting`，真身是 UMD 全局——shim 转发到 `globalThis.Vue3BizComponentsLibrary` | 同编辑器 vite.config.ts alias 思路 |
| `scripts/vendor.mjs` | 资产本地化：CDN 下载（与编辑器画布 DEFAULT_PC_ASSETS 同源同版本）+ g2plot 从 node_modules 复制 | 产物 `public/vendor/` 已 gitignore，换环境要重跑 `pnpm vendor` |

## 就绪信号协议（readiness.ts）

状态机：`LOADING → (请求计数归零) → SETTLING → READY`（`window.__ASSEM_PDF_READY__=true`）/ 任一请求返回 `status:'error'`（非 tolerant）→ `ERROR`（`__ASSEM_PDF_ERROR__`）。

settle 顺序（**每步都有实证过的失败案例，勿调换/删除**）：

1. 两帧 → 2. 样式表 load → 3. `fonts.ready` → 4. 图片 → 5. 图表 canvas 落墨（alpha 非全透明；无图表宽限 600ms）→ 6. **表格行数 ≥5 帧稳定**（虚拟滚动分批渲染，批次间隙高度不变——高度判定曾把 300 行截在 153）→ 7. `normalizePrintLayout` + `reparentTablesForPrint` → 8. 两帧 + 文档高度稳定。

**wrapFns 关键**：core-next 请求失败**返回** `status:'error'` 不抛错（executor.ts:61-67），按返回值判定否则静默产出残缺 PDF。

## 打印布局规整（两函数，勿删）

- `normalizePrintLayout`：vendored 主题有 `html/body` 全高规则会把打印钉死一页——内联覆盖剥高度；`.el-table` 链同理
- `reparentTablesForPrint`：el-table 双表结构（header/body 各一张 table）+ scrollbar 链阻断 thead 跨页重复（**二分实验实证：链外同表即恢复**）。合并 colgroup+thead 进 body 表 → 移出链直挂 `[data-print-root]`（slot 继承组件壳全部类名，保斑马纹/边框）→ 隐藏原壳。smoke 断言锁定

## 命令

```bash
pnpm --filter @cs/print-host vendor   # 仅首次/清单变更（需联网拉 CDN）
pnpm --filter @cs/print-host build    # 产物 dist/ 由 server 托管
```

改任何文件后：`pnpm build` → 起 server → `node scripts/smoke.mjs`（22/22 才算过）。本包无独立单测，smoke 是唯一门禁。

## 踩坑记录（新增坑请追加）

- 嵌套门禁：Chart(element 类) 放 `YqFlexLine`（仅收 lineElement）被**静默拒绝**，console 才可见 `NEST_CATEGORY_NOT_ALLOWED`
- `useTablePersistConfig` 依赖 pinia active 实例——`installVendorPlugins` 里 portalPinia `createPinia()` 必须在 AssemPlugin 前 app.use
- 主题 CSS `height:100%` 链会把 body 撑到视口高（超高视口 30000px 时尤其明显），打印只剩一页
