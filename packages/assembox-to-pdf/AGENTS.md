# AGENTS.md — assembox-to-pdf 迭代指南

面向 AI 编码代理与后续迭代者的工作指南。目的：拿到任务后能快速定位改动点、按正确顺序构建验证、不踩已实证过的坑。

## 1. 本包是什么

assembox 低代码页面**服务端 PDF 导出**的实现（方案 A：Playwright 无头浏览器 + 专用打印宿主页）。输入场景 JSON（+ mock/业务数据），输出保真 PDF。

- 技术调研：`docs/01-服务端PDF导出技术调研报告.md`
- 详细设计（含章节号引用）：`docs/02-方案A详细设计-Playwright无头浏览器PDF导出.md`
- SaaS 鉴权/上下文接入参考：`docs/03-SaaS鉴权与上下文的服务端运行时处理参考.md`
- 快速开始：`README.md`

## 2. 目录与职责

```
packages/assembox-to-pdf/
├── print-transform/        # 场景打印变换（纯函数，零 DOM 依赖，仅依赖 core-next 类型）
│   ├── src/transform.ts    #   主入口 transformForPrint(scene, options)
│   ├── src/known-types.ts  #   renderType 清单（源自 desktop-next manifest）+ 剔除表
│   └── test/               #   vitest，对 json-config 真实场景做快照式断言
├── print-host/             # 打印宿主页（Vite + Vue 3，构建为静态产物由 server 托管）
│   ├── src/main.ts         #   bootstrap：claim → vendor 资产 → 变换 → AssemPlugin → mount
│   ├── src/readiness.ts    #   就绪信号协议（本包最核心、最易出错的一环）
│   ├── src/assets.ts       #   vendored UMD 资产装载（顺序敏感）
│   ├── src/print.css       #   @media print 规范（解视口约束/断页/背景色）
│   ├── src/claim.ts        #   一次性票据换取任务载荷
│   ├── src/shims/          #   @cs/vue3-biz-components-library ESM 桥接（真身是 UMD 全局）
│   └── scripts/vendor.mjs  #   资产本地化（CDN 下载 + g2plot 从 node_modules 复制）
├── server/                 # 导出服务（NestJS 10 + playwright-core）
│   ├── src/exports/        #   对外 API（异步 202 / 同步流式 / 轮询 / 取消 / 下载）
│   ├── src/render/         #   RenderService（单任务编排）+ RenderWorker（队列消费）
│   ├── src/pool/           #   BrowserPool（进程×上下文两级，信号量并发）
│   ├── src/queue/          #   InProcessQueue + TaskStore（演进 BullMQ 同接口）
│   ├── src/ticket/         #   一次性票据（60s TTL）
│   ├── src/scene/          #   场景装配（SCENE_CONFIGS 数据驱动）+ mock/ + claim/ + health/ + metrics/
│   ├── scripts/smoke.mjs   #   端到端冒烟（22 项断言）
│   └── .env.example        #   配置项说明
├── json-config/            # 测试场景：single-table-scene / chart-table-scene / weekly-report-scene
└── docs/                   # 调研与设计文档（改架构先改文档，评审后再动代码）
```

**依赖方向**：`print-transform` ← core-next 类型；`print-host` ← desktop-next + print-transform；`server` ← NestJS + playwright-core（不依赖 Vue 生态）。

## 3. 常用命令（必须在仓库根执行，Node ≥ 18 / pnpm，经 nvm 用 v22）

```bash
pnpm install                                          # 安装（触发 desktop-next prepare 重建）

pnpm --filter @cs/print-host vendor                   # vendor 资产本地化（仅首次/清单变更；产物 public/vendor/ 已 gitignore）
pnpm --filter @cs/print-transform test                # vitest（20 项）
pnpm --filter @cs/print-transform typecheck           # tsc --noEmit
pnpm --filter @cs/print-host build                    # vite build → dist/（server 托管该目录）
pnpm --filter @cs/assembox-pdf-server build           # tsc → dist/

# 启动（前台调试用；后台需 setsid 脱离进程组，node 用绝对路径）
cd packages/assembox-to-pdf/server && node dist/main.js   # 默认 127.0.0.1:9100

# 端到端冒烟（依赖 pdftotext 做行/表头断言；产物落 /tmp/kilo/assembox-pdf-smoke-*.pdf）
cd packages/assembox-to-pdf/server && node scripts/smoke.mjs
```

**改动后最小验证顺序**：改 `print-transform` → 跑其 vitest；改 `print-host` → rebuild 后起 server 跑 smoke；改 `server` → rebuild + smoke。任何改动合入前 smoke 必须 22/22。

**环境依赖**：本机 Chromium（`/usr/bin/google-chrome`，或 `CHROMIUM_EXECUTABLE_PATH`）、CJK 字体（fc-list 可见）、`pdftotext`/`pdfinfo`（smoke 断言用，缺失时相关断言自动跳过并仍计数通过项——见 §7 注意）。

## 4. 端到端数据流（改任何环节前先通读）

```
POST /api/v1/exports(/sync) { sceneId, printOptions }
  → SceneService.assemble：读 json-config/*.json（剥 uiSkeleton 壳）+ SCENE_CONFIGS（requestFn 映射、表单初值）
  → TicketService.issue（一次性票据）
  → BrowserPool.withContext（794×30000 超高视口 ← 虚拟滚动表格需要）
    → page.goto /print?ticket=...（emulateMedia: print）
      宿主页 main.ts：
        win.Vue = ESM Vue（单实例）→ loadVendorAssets（顺序：element-plus → icons → vue-router
        → axios → element-plus-ui → table-pro → js-web-framework → biz-lib → g2plot）
        → claimTask（票据换场景载荷）→ deserializeScene（单场景对象，不是整个 uiSkeleton！）
        → transformForPrint（剔除交互件/弹层、表格全量分页、Chart animation:false、解高度约束）
        → createApp + AssemPlugin + registerDefaults + installVendorPlugins（含 portalPinia）
        → readiness.wrapFns（包装 $requestFns 计数，mount 前调用）
        → mount → readiness 协议 settle（§6）
    → waitForFunction(__ASSEM_PDF_READY__ / __ASSEM_PDF_ERROR__ 竞速) → page.pdf()
  → TaskStore.savePdf（data/exports/，已 gitignore）
```

**关键事实**（均已在代码实证，改前必知）：
- core-next 请求失败**返回** `status:'error'` 而非抛错（`request/executor.ts:61-67`）——就绪协议按返回值判失败
- `YqTableAsync` 在 `onMounted` 经 `ctx.$requestFns[requestFn]` 取数（`assem-yq-table-async.vue:201-205`）
- `deserializeScene()` 接收**单个 SceneConfig**（`{viewsProps}`），传整个 uiSkeleton 会炸 `planeOptions` undefined
- `buildDataModel` 入参是「模型→**表**→字段→defaultValue」，表单 `modelName` 必须写全 `模型.表.字段`（少一层渲染 `[object Object]`）
- Chart 组件数据是场景内静态 `data`（不走 requestFn），依赖 `window.G2Plot[g2PlotName]`；animation 是 G2Plot 配置项，须并入 `options`
- 嵌套门禁（`desktop-next src/components/nesting.ts`）：Chart 属 `element` 只能进 `YqBox`/`YqFlexBox` 槽；`YqFlexLine` 仅收 `lineElement`，放错**静默拒绝**（console `NEST_CATEGORY_NOT_ALLOWED`）
- 事件是 `new Function` 编译（非沙箱，`docs/architecture/05 §5.2`）——场景必须来源受信

## 5. print-transform 规则表

`src/transform.ts` 数据驱动：剔除 `REMOVE_RENDER_TYPES`（工具栏/按钮/筛选器/上传/开关）+ 弹层数组清空 + 表格分页改 `{currentSize: rowLimit, layout:'total'}` + Chart 改写 + `YqBox/YqPanel` 解 `height:100%`。未知 renderType **透传+上报**（前向兼容，不丢内容）。

**新增组件/规则时**：`known-types.ts` 补类型 → `transform.ts` 加规则分支 → `test/` 用真实场景 JSON 加断言（fixture 直接读 `../../json-config/*.json` 的 `.uiSkeleton`）。

## 6. 就绪信号协议（readiness.ts）——顺序不可乱

settle 依次等待，任一缺失产出「看似成功」的残缺 PDF：

1. 样式表 load（vendor CSS ~500KB 异步，不等则无样式布局，行高错、分页错）
2. `document.fonts.ready`（CJK 字体）
3. 图片 complete
4. 图表 canvas 落墨（alpha 通道非全透明；无图表场景宽限 600ms 放行）
5. **表格行数多帧稳定**（≥5 帧不变）——table-pro 虚拟滚动**分批渲染**，批次间隙文档高度不变，按高度判定会在 300 行截到 153 行时误放行
6. `normalizePrintLayout()`：剥 html/body 与 `.el-table` 链的内联高度 → **`reparentTablesForPrint`**（§8）
7. 再两帧 + 文档高度稳定

失败通道：请求返回 `status:'error'`（非 tolerant）→ `__ASSEM_PDF_ERROR__`，服务端 `PAGE_REPORTED` 不重试。

## 7. 验证断言体系与已知解析坑

- smoke（`server/scripts/smoke.mjs`）22 项：三个场景的行完整性（`Sf-1987*`/tag/班组列计数）、表头跨页重复（`-layout` 逐行正则）、图表光栅化（`/Subtype /Image` 计数）、封皮独占页、幂等指纹、票据拒绝、指标
- **PDF 页数解析必须取全部 `/Count` 最大值**：Chromium 的 Pages 树嵌套，子树 Count 可能靠前（首匹配曾把 13 页误判 8 页，引发一轮误诊）——`pdf-options.ts countPdfPages` 与 smoke 内 `countPages` 都已修复，勿回退
- pdftotext 缺失时 `countText` 返回 -1、断言跳过（**不会失败**）——机器上没装 poppler 时 smoke 的行数断言是虚过，装 poppler 后才算真验证

## 8. Element Plus 双表打印修复（勿删）

底表结构：`.el-table > .header-wrapper > table(含thead)` + `.body-wrapper > .el-scrollbar 链 > table(无thead)`。三个缺陷：孤行表头、表头不跨页重复、包装链内分页异常（二分实验实证：**scrollbar 链阻断 thead 重复**）。`readiness.ts reparentTablesForPrint`：合并 colgroup+thead 进 body 表 → body 表移出链直挂打印根（slot 继承组件壳全部类名保斑马纹/边框）→ 隐藏原壳。smoke 第 17/22 项断言锁定此行为。

## 9. 迭代食谱

**加新场景**：`json-config/xxx.json`（完整 AssemConfig 形态 `{uiSkeleton:{sceneName:{viewsProps}}}`，注意嵌套门禁）→ server `scene.service.ts` `SCENE_CONFIGS` 加 requestFn 映射/表单初值 → `mock.controller.ts` 加数据端点（信封 `{code,status:'success',result:{count,result}}`，toPaged 剥一层取 result）→ 长表记得分页改写依赖 transform 的 rowLimit → `print-transform/test` 加断言 → smoke 加场景断言。

**改 vendor 资产**：`print-host/scripts/vendor.mjs` 改清单（CDN 或 NPM 源）→ `pnpm vendor` → `assets.ts` VENDOR_JS/VENDOR_CSS 对齐（含 global 名与 asPlugin 标记）→ rebuild host。

**调纸张/页眉**：`server/src/render/pdf-options.ts pdfParamsOf`（Chromium 页眉页脚模板仅 inline style）。

**生产化演进**（设计文档 §14 开放问题）：队列换 `@nestjs/bullmq`（TaskStore/ExportQueue 已按接口抽象）、存储换 OSS、`debug-ticket` 端点**必须移除或加内网 Guard**、`--no-sandbox` 配套网络隔离、暖页复用。

## 10. 约定

- 提交格式沿用仓库风格：`feat(assembox-to-pdf): 中文摘要` + 实证要点正文；git 身份用 `git -c user.name=yz -c user.email=yz@qq.com` 内联（勿改全局配置）
- 不提交：`data/exports/`（产物）、`print-host/public/vendor/`（可再生的 vendored 资产）、任何 `dist/`
- 改架构/协议（就绪信号、表格重排、票据流程）先改 `docs/02-*.md` 对应章节并在本文档同步坑点记录
- 后台起 server 用 `setsid -f /绝对路径/node dist/main.js`（shell 会话结束后需存活）；`pkill -f "node dist/main"` 清理
