# assembox 低代码页面服务端 PDF 导出 —— 技术调研报告

| 项目 | 内容 |
|------|------|
| 主题 | 在纯 Node.js 服务端环境中，将低代码场景渲染页面转换为 PDF 的技术可行性与方案选型 |
| 范围 | `@cs/assembox-core-next` + `@cs/assembox-desktop-next` 渲染栈（Vue 3 + Element Plus） |
| 状态 | 探索性研究（Exploration），尚未实施 |
| 结论预告 | **可行**。推荐「Playwright 无头浏览器 + 专用打印宿主页」为主方案，详见第 6 章 |

---

## 1. 背景与问题定义

### 1.1 目标

将 assembox 低代码平台产出的场景配置（JSON，如 `json-config/single-table-scene.json`）所描述的页面，**完全在 Node.js 服务器端**渲染并导出为 PDF 文档。用户侧不参与渲染，服务端输入场景 JSON（+ 业务数据上下文），输出 PDF 二进制。

### 1.2 渲染栈现状（代码库实证）

调研基于对本仓库的实际阅读，以下事实直接影响方案设计：

| 事实 | 出处 | 对 PDF 导出的影响 |
|------|------|-------------------|
| 渲染器 `@cs/assembox-desktop-next` 是 **Vue 3 插件**（`app.provide` / `reactive`），组件基于 Element Plus 2.x | `desktop-next/src/index.ts` | SSR 技术上可行（Vue 3 有 `createSSRApp`），但依赖组件库的 SSR 兼容性 |
| 核心引擎 `@cs/assembox-core-next` **无 Vue 依赖**，`adaptNodeTree()` 负责字符串事件 → 函数 | `core-next` 源码结构 | 引擎层与渲染层解耦良好，便于在任意宿主（含打印页）中复用 |
| 事件逻辑以字符串存储，经 `compileFn`（`new Function`）求值，**不是沙箱** | `docs/architecture/05-render-pipeline.md` §5.2 | 场景配置必须来源可信；多租户下需进程/上下文隔离 |
| `YqTableAsync` 等异步组件在 `onMounted` 中通过 `ctx.$requestFns[requestFn]` 取数 | `assem-yq-table-async.vue` | PDF 截取必须等待异步数据就绪，不能只等 DOM 挂载 |
| 图表组件依赖浏览器全局 `window.G2Plot` | `assem-g2plot-chart.vue` | SSR / jsdom 路线无法覆盖图表；无头浏览器路线天然支持 |
| `use-editor.ts` 中 `window` 访问有 `typeof window !== 'undefined'` 守卫 | `composables/use-editor.ts` | 渲染器大部分代码具备 SSR 安全性（图表除外） |
| 仓库已引入 **Playwright 1.62.1**（编辑器包 e2e 测试） | `new-assembox-editor/package.json` | 无头浏览器方案的依赖成本近乎为零 |
| 场景中混有大量交互件：筛选器、工具栏、分页、增删改按钮 | `single-table-scene.json` | PDF 导出需要「打印视图」——剔除交互件，仅保留数据呈现 |

### 1.3 核心矛盾

低代码页面的渲染结果 = **JSON 声明 × Vue 运行时 × Element Plus 组件行为 × 异步数据 × CSS 级联**。任何绕过真实浏览器渲染管线的方案，都必须自己重新实现这条链路中的全部或一部分——这正是各方案成本差异的根源。

---

## 2. 可行性分析

### 2.1 结论：技术可行，且业界有成熟先例

服务端 PDF 生成本质上是「谁来做布局」的问题。三条可行路径：

1. **让真实浏览器引擎做布局**（无头 Chromium）——Chromium 的打印管线（Skia PDF 后端）是生产级方案，`page.pdf()` 直接输出矢量 PDF，文本可选中、可检索。
2. **让 Node 程序直接排版**（pdfkit 等）——绕过 HTML/CSS，从结构化数据（场景 JSON 本身就是结构化的）直接绘制文档。
3. **混合**：SSR 产出静态 HTML + 预注入数据，再用无 JS 模式的浏览器打印——用确定性换取速度。

### 2.2 可行性论据

| 维度 | 论据 |
|------|------|
| 渲染引擎可用性 | Playwright / Puppeteer 在 Node ≥ 18 官方支持 headless Chromium；本项目 `engines: node >= 18` 已满足 |
| 打印能力 | Chromium `page.pdf()` 支持 `@page`、页眉页脚、`preferCSSPageSize`、背景打印，是浏览器原生打印预览的同一套管线 |
| 数据链路 | 场景渲染所需数据走 `ctx.$requestFns`，服务端渲染时可以让宿主页携带会话凭证照常请求，或改为服务端预取后注入 `$dataModels` |
| 字体 | CJK 字体（Noto Sans CJK SC）可安装于容器系统层，Chromium 打印时自动子集化嵌入 |

### 2.3 硬约束（不可回避的成本）

- **必须部署 Chromium 二进制**（约 150–400 MB 镜像增量）及其系统依赖库（`libnss3` 等）。
- **每个渲染实例的内存开销**约 100–300 MB（视页面复杂度），高并发必须做池化与限流（第 4.5 节）。
- 容器内通常需要 `--no-sandbox --disable-dev-shm-usage` 等启动参数，需配套安全评估。

---

## 3. 技术方案对比

### 3.1 方案 A：无头浏览器自动化（Playwright / Puppeteer）★ 主推

#### 原理

在 Node 服务中启动无头 Chromium，加载一个**专用打印宿主页**（复用 `@cs/assembox-desktop-next` 渲染场景），等待渲染与数据就绪后调用 `page.pdf()`。

#### A1（下策）：直接打开现有 SPA 页面截图式打印

把用户正在看的页面 URL 直接交给 `page.pdf()`。**不推荐作为正式方案**：

- 页面含工具栏、筛选器、分页器等交互件，导出的 PDF 充满无意义控件；
- 布局按屏幕视口（如 1440px 宽）设计，与 A4 纸比例不匹配，靠 `viewport` 硬凑效果差。

#### A2（上策）：专用打印宿主页 + 场景「打印变换」

为导出构建独立路由（如 `/#/print?sceneId=xxx&token=xxx`），做三件事：

1. **场景打印变换**：加载场景 JSON 后，静态遍历节点树，剔除/收敛交互件——移除 `YqToolBar`、`YqAdvancedFilter`、分页配置、危险/编辑按钮；表格分页改为「全量数据、单页」模式（或服务端预取全量数据注入）。这可以做成 `assembox-core-next` 之上的纯函数工具（输入场景 JSON，输出打印场景 JSON），可单测、可复用。
2. **打印 CSS**：宿主页引入 `@media print` 样式（`-webkit-print-color-adjust: exact`、表格断页规则、隐藏滚动容器并解除高度裁剪——Element Plus 表格默认固定高度 + 内部滚动，打印前需展开为自然高度）。
3. **就绪信号**：宿主页在所有异步请求完成后设置 `window.__ASSEM_PDF_READY__ = true`（实现见 4.2 节），服务端 `waitForFunction` 精确等待。

```ts
// 服务端导出核心（示意）
const browser = await pool.acquire();          // 浏览器池，见 4.5
const context = await browser.newContext();    // 每任务独立上下文（隔离 cookie/存储）
const page = await context.newPage();
await page.emulateMedia({ media: 'print' });   // 激活 @media print 规则
await page.goto(printUrl, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ASSEM_PDF_READY__ === true', { timeout: 30_000 });
await page.evaluate(() => document.fonts.ready); // 字体就绪，见 4.4
const pdf = await page.pdf({
  format: 'A4',
  printBackground: true,                        // Element Plus 斑马纹/表头底色必需
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: '<div class=idx style="font-size:8px;width:100%;text-align:center">'
    + '<span class=pageNumber></span> / <span class=totalPages></span></div>',
  margin: { top: '16mm', bottom: '16mm' },
});
await context.close();                          // 立即回收上下文
pool.release(browser);
```

#### Playwright vs Puppeteer 选型

| 维度 | Playwright | Puppeteer |
|------|-----------|-----------|
| 本仓库现状 | **已依赖（1.62.1）**，团队有 e2e 经验 | 需新增依赖 |
| 浏览器上下文隔离 | 原生 `newContext()`，轻量、适合池化多任务 | 较新版本支持，生态稍弱 |
| 自动等待 | `waitForFunction` / 网络生命周期 API 更完善 | 基本够用 |
| `page.pdf()` | 仅 Chromium 通道 | 仅 Chromium |

**结论：选 Playwright**（复用既有依赖与团队经验，多上下文隔离对多租户导出尤为重要）。

#### 优点 / 缺点

- ✅ **像素级保真**：所见即所得，CSS/JS/图表/字体全部由真实引擎处理；布局精度是低代码平台的硬需求，此点是决定性优势。
- ✅ 图表（G2Plot）、复杂表格（固定列、合并单元格）开箱即用。
- ❌ 资源开销最大，需要池化、限流、监控配套。
- ❌ 每页导出时延约 1–5 s（视页面复杂度与数据量）。

### 3.2 方案 B：HTML→PDF / 编程式 PDF 库（jsPDF、pdfkit 等）

#### 3.2.1 作为「HTML 转换器」使用 —— 不可行

jsPDF（及其 `html()` 插件）、pdfkit 均为**编程式 PDF 生成器**，不具备 HTML/CSS 布局引擎：

- 无 CSS 级联、无 flexbox/grid、无 CSS 变量与预处理器产物（本项目组件样式大量依赖 less 编译与 Element Plus 主题变量）；
- 不执行 JavaScript——assembox 页面的 DOM **完全由 JS 运行时生成**（Vue 挂载 + `adaptNodeTree` + 异步取数），交给它们的只是空壳 `<div id="app">`；
- jsPDF 的 `html()` 实际借道 canvas 截图，中文与矢量文本支持差。

结论：**任何「把 assembox 页面 HTML 喂给 jsPDF/pdfkit」的路线都不成立**。

#### 3.2.2 作为「数据直排引擎」使用 —— 纯表格场景的高性价比辅轨 ★ 值得保留

换一个视角：场景 JSON 本身就是结构化数据（`columnConfigs`、字段标签、行数据）。可以完全绕过 HTML，用 **pdfkit 直接从「场景 JSON + 预取行数据」排版 PDF**：

- 表头/列宽/对齐直接来自 `columnConfigs`（`width`、`align` 已显式声明，天然是排版指令）；
- 字体嵌入 pdfkit 原生支持（注册 NotoSansSC 字体文件即可）；
- 内存与时延比无头浏览器低一个数量级（无浏览器进程），并发能力强；
- 代价：**与屏幕视图不再是同一套视觉**（无 Element Plus 皮肤），且只覆盖表格/表单/文本类组件，图表、复杂布局需逐个手写排版器——长期会成为维护负担。

定位：作为**轻量快速导出轨道**，服务「单表/清单类报表批量导出」等高频场景；不作为通用方案。

### 3.3 方案 C：SSR 集成策略

#### C1：纯 SSR + 无 JS 的 HTML→PDF 引擎 —— 不推荐

用 `createSSRApp` + `@vue/server-renderer` 的 `renderToString` 在 Node 内产出静态 HTML，再交给不执行 JS 的转换器（如 WeasyPrint、wkhtmltopdf）排版。

对本渲染栈的实证障碍：

| 障碍 | 说明 |
|------|------|
| `onMounted` 不执行 | `YqTableAsync` 的数据获取挂在 `onMounted`，SSR 产出的 HTML 表格是空的；要补数据必须实现 `async setup` + 服务端预取注入（改造量大，涉及 `useRemoteData`、`ctx.$requestFns` 全链路） |
| 图表不可用 | `window.G2Plot` 仅浏览器存在，SSR 阶段图表节点渲染为空 |
| 额外引入新引擎 | WeasyPrint 是 Python 生态；wkhtmltopdf 已停止维护且 CSS 支持陈旧（无 grid）——为了绕开 Chromium 又引入第二个排版引擎，得不偿失 |

#### C2：SSR 预注数据 + Chromium 无 JS 打印 —— 远期性能优化变体

保留 Chromium，但把「执行 JS 取数」前移到 Node 内：服务端预取全部业务数据 → SSR（或简单模板）产出**已含数据的静态 HTML** → Chromium 以 `javascriptEnabled: false` 打开并 `page.pdf()`。

- 收益：浏览器内不再跑 Vue 运行时与业务请求，单任务耗时与内存显著下降，且结果**确定性更强**（不依赖前端请求成功）；
- 前提：仍是方案 A2 的打印变换 + 打印 CSS 资产，只是把「数据注入」从浏览器内搬到浏览器外；
- 限制：动态性强的节点（事件驱动的 `onValueRender` 单元格渲染）需要确保在注入数据后静态可渲染，图表仍需浏览器 JS（该页面需退回 A2）。

结论：**C2 是 A2 的优化演进，不是独立方案**；首期不实施，预留架构口子（打印宿主页支持 `__INITIAL_DATA__` 注入协议即可）。

### 3.4 方案 D（否决项简评）：jsdom/happy-dom + html2canvas 类

在 Node 内用 jsdom 模拟 DOM 跑 Vue，再截图/转 PDF。否决理由：jsdom 无真实排版引擎（`getBoundingClientRect` 恒为 0）与无 Canvas/图表能力；本仓库 jsdom 仅用于组件单测，不具备生产渲染条件；html2canvas 依赖真实光栅化，链路最终仍绕回浏览器。

---

## 4. 关键技术挑战与对策

### 4.1 CSS 样式保真

| 挑战 | 对策 |
|------|------|
| 屏幕布局 ≠ 纸张布局（视口 1440px vs A4 210mm） | 打印变换阶段把响应式栅格（`GridItem span`）按纸张宽度重排；宿主页按 794px（A4 @96dpi）视口渲染 |
| Element Plus 表格固定高度 + 内部虚拟滚动，打印时截断 | 打印 CSS 解除 `height: 100%` 裁剪、`overflow: visible`；分页改为服务端全量 |
| Chromium 打印管线的已知差异：`box-shadow` 丢失、背景色默认不打印 | `printBackground: true`；`-webkit-print-color-adjust: exact`；打印视图设计上避免依赖阴影 |
| `position: fixed` 元素在每页重复渲染 | 打印变换剔除悬浮件（回到顶部、吸底工具栏） |

### 4.2 JavaScript 执行与数据就绪（最易翻车点）

`waitUntil: 'networkidle'` 对轮询、埋点等长连接场景不可靠，必须用**显式就绪信号**。推荐在打印宿主页实现请求计数器（挂在 `AssemConfig` 的请求层 / `afterReq` 白名单钩子上，core-next 已预留该函数属性通道）：

```ts
// 打印宿主页（示意）：包装请求层，计数归零且两帧后置位
let pending = 0;
const wrap = (fn) => async (...args) => {
  pending++; try { return await fn(...args); } finally {
    if (--pending === 0) requestAnimationFrame(() =>
      requestAnimationFrame(() => (window.__ASSEM_PDF_READY__ = true)));
  }
};
// 场景内 requestFns 全部经 wrap 注入
```

注意：就绪信号必须覆盖**字体加载**（`document.fonts.ready`）与图片（`img.decode()` / `naturalWidth` 检查），否则首帧内容残缺。

### 4.3 分页控制

- 表头跨页重复：Element Plus 表格 `<thead>` 在 Chromium 打印中默认重复（`display: table-header-group`），需在打印 CSS 中显式保障；多级表头需验证。
- 行内断页：`tr { break-inside: avoid; }` 防止一行被腰斩；长单元格（备注列）允许 `break-word`。
- 页眉页脚/页码：`page.pdf({ displayHeaderFooter })` 模板注入（文档标题、导出时间、页码）；或 `@page` margin box（Chromium 支持有限，优先用 API）。

### 4.4 字体嵌入（CJK 专项）

| 事项 | 方案 |
|------|------|
| 容器缺中文字体 → PDF 方块 | 镜像安装 `fonts-noto-cjk`（Debian）或随应用分发 NotoSansSC `.otf` 并注册到 fontconfig |
| 自定义字体（品牌字体、图标字体） | 打印宿主页 `@font-face` 指向服务端静态资源；Element Plus 图标随组件样式加载 |
| 字体闪烁/首帧缺字 | `await page.evaluate(() => document.fonts.ready)` 纳入就绪协议 |
| 产物体积 | Chromium 打印自动子集化嵌入，单文档增量通常 < 1 MB（纯文本场景） |

### 4.5 资源管理（高并发的生死线）

- **进程模型**：常驻 1–N 个 Chromium 进程（`launch({ args: ['--disable-dev-shm-usage', '--disable-gpu'] })`），每进程开多个 `BrowserContext` 承接任务——上下文间存储/Cookie 隔离且创建成本远低于进程。
- **池化与排队**：`generic-pool` 或自研信号量限制并发上下文数（经验起点：每进程 ≤ 4 活跃页，按 2C4G 容器 1 进程起步压测调整）；超出即入队，队列超时快速失败。
- **熔断与自愈**：单任务硬超时（建议 30 s）后强制 `context.close()`；进程崩溃/OOM 由池自动重建；连续失败阈值触发进程回收。
- **泄漏防线**：`finally` 中必关上下文；监听 `page.on('crash')`；定期（如每 500 任务）轮换进程。
- **容量估算**：2C4G 容器 ≈ 1 Chromium 进程 + 4 并发上下文，单任务 2–4 s → 单容器约 60–120 PDF/分钟（表格类场景），可水平扩容。
- **K8s 注意**：`/dev/shm` 限制（用 `--disable-dev-shm-usage` 规避）、Pod 内存 limit 需覆盖 Chromium 峰值（≥ 1.5 GiB 余量）。

### 4.6 安全

- 场景事件经 `compileFn`（`new Function`，非沙箱）执行：导出宿主页运行的场景必须与线上同源同权限约束，**只接受平台自有配置服务下发的场景 ID**，不接受请求体直传任意 JSON；
- 多租户任务跑在独立 `BrowserContext`，任务结束即销毁；导出服务与内网 API 之间用短期票据而非长期凭证；
- 容器内 `--no-sandbox` 的补偿措施：导出服务独立部署域、不挂载敏感挂载点、网络策略仅放行白名单域名。

---

## 5. 方案对比矩阵

| 维度 | A2 无头浏览器（Playwright） | B-直排 pdfkit 辅轨 | C2 SSR 预注 + Chrome 无 JS | A1 直截现有页 | C1 纯 SSR + 打印引擎 |
|------|:---:|:---:|:---:|:---:|:---:|
| 与屏幕视图的保真度 | ★★★★★ | ★★（另起一套视觉） | ★★★★☆ | ★★★（含交互噪音） | ★★ |
| 复杂 CSS（flex/grid/主题） | 完整支持 | 不支持（手工排版） | 完整支持 | 完整支持 | 受引擎限制 |
| JS/图表（G2Plot） | 支持 | 不支持 | 图表需退回 A2 | 支持 | 不支持 |
| 中文/字体嵌入 | 系统 fontconfig 自动 | 手动注册字体 | 同 A2 | 同 A2 | 视引擎 |
| 单任务资源开销 | 高（100–300 MB） | 极低（< 50 MB） | 中 | 高 | 中 |
| 单任务时延 | 1–5 s | 100–500 ms | 0.5–2 s | 2–6 s | 1–3 s |
| 高并发能力 | 中（须池化） | 高 | 中高 | 中 | 中 |
| 工程改造量 | 中（打印变换 + 宿主页 + 池） | 中（每类组件写排版器） | 高（预取链路改造） | 低 | 高且引入新引擎 |
| 结果确定性 | 中（依赖前端请求） | 高 | 高 | 低 | 高 |
| **定位** | **通用主方案** | 高频报表辅轨 | 远期优化 | 仅 PoC | 否决 |

---

## 6. 结论与推荐

### 6.1 推荐路线

> **主方案 A2**：Playwright 无头 Chromium + 专用打印宿主页 + 场景打印变换（纯函数，落在 `assembox-to-pdf` 包内）。
> **辅轨 B**：针对「单表全量导出」这类高频、低样式要求的场景，提供 pdfkit 数据直排快速通道。
> **远期 C2**：待主方案上线并验证后，将数据预取前移至 Node 侧（`__INITIAL_DATA__` 注入协议），提升确定性与吞吐。

理由：低代码平台的竞争力在于「用户在画布上摆出来的样子，导出后就是这个样子」——**布局精度是硬约束**，只有真实浏览器引擎能零成本继承整套渲染栈（Element Plus 主题、less 产物、G2Plot 图表、自适应栅格）。其余方案都在不同程度上要求「重写一遍渲染器」，与低代码平台的规模经济性相悖。

### 6.2 分阶段路线图

| 阶段 | 内容 | 验收标准 |
|------|------|----------|
| P0 PoC（约 1 周） | Playwright 脚本加载 `single-table-scene` 宿主页 → A4 PDF；打通就绪信号与字体 | PDF 表格数据完整、中文正常、表头跨页重复 |
| P1 最小可用（2–3 周） | 打印变换工具（剔除交互件/全量分页）；导出 HTTP 服务（队内排队 + 超时）；Dockerfile（Chromium + Noto CJK） | 20 并发压测无泄漏、无 OOM；产物 < 5 MB/份 |
| P2 生产化 | 浏览器池与自愈、指标（排队数/耗时/失败率）接入监控、对象存储归档、辅轨 B 上线 | SLO：P95 < 8 s，成功率 > 99.5% |
| P3 优化 | C2 数据预注、暖页复用、按场景类型路由 A/B 轨 | 单位成本下降 ≥ 50% |

### 6.3 目标架构（示意）

```
                    ┌────────────────────────────────────────────┐
 业务系统 ──MQ/HTTP──▶  PDF 导出服务（Node.js）                      │
                    │  ┌──────────┐  ┌────────────┐  ┌─────────┐ │
                    │  │ 任务队列  │→│ 场景打印变换 │→│ 数据预取 │ │   ┌──────────────┐
                    │  └──────────┘  │ (纯函数)    │  └────┬────┘ │   │ Chromium 池  │
                    │       │        └────────────┘       │      │   │ ctx1..ctxN   │
                    │       ▼                             ▼      │   │ @media print │
                    │  ┌───────────────────────────────────┐    │──▶│ __PDF_READY__│
                    │  │ 打印宿主页(复用 desktop-next 渲染) │◄───┘    │ page.pdf()   │
                    │  └───────────────────────────────────┘         └──────┬───────┘
                    │  ┌──────────┐   ┌──────────┐                        │
                    │  │ 辅轨 B:  │   │ 对象存储  │◀── PDF ◀───────────────┘
                    │  │ pdfkit   │   │ + 回调    │
                    │  └──────────┘   └──────────┘
                    └────────────────────────────────────────────┘
```

### 6.4 风险清单

| 风险 | 等级 | 缓解 |
|------|------|------|
| Chromium 容器内存峰值导致 OOMKill | 高 | 池化限并发、镜像调优、Pod limit 余量、压测准入 |
| 前端请求在导出会话中失败（权限/网络） | 高 | 就绪信号含失败上报；P3 迁移到服务端预取 |
| Element Plus 组件打印差异（虚拟滚动表格等） | 中 | 打印变换限定使用静态表格渲染路径；建立打印视觉回归用例（PDF 快照比对） |
| 场景配置注入恶意事件代码 | 中 | 仅接受平台下发场景 ID；独立浏览器上下文；导出域隔离 |
| 大数据量全量导出撑爆页面 | 中 | 行数上限 + 分批导出策略；辅轨 B 承接超大批量 |

---

*附：本报告所有代码骨架仅为方向性示意，实施细节以各阶段设计文档为准。*
