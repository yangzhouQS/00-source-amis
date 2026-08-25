# 方案 A 详细设计：Playwright 无头浏览器服务端 PDF 导出

| 项目 | 内容 |
|------|------|
| 上游文档 | `01-服务端PDF导出技术调研报告.md`（选型结论：方案 A2） |
| 性质 | 详细设计（供评审讨论），含开放问题清单（§14） |
| 涉及包 | `@cs/assembox-core-next`、`@cs/assembox-desktop-next`、新建 `assembox-to-pdf` |
| 服务端框架 | **NestJS 10**（对齐仓库既有服务端应用，如 `assembox-packages-project/apps/assembox-builder`：`@nestjs/common ^10.4.8` + platform-express） |
| 部署形态 | 本期仅设计应用与运行环境（Node ≥ 18 + 本机 Chromium），容器化/K8s 部署方案**另行设计，不在本文范围** |
| 验证基线 | 代码事实均引自本仓库，标注 `文件:行号` |

---

## 1. 设计目标与非目标

### 1.1 目标

1. **G1 保真**：导出 PDF 与用户在浏览器中看到的页面视觉一致（同主题、同字体、同布局语义），布局精度优先级最高。
2. **G2 通用**：覆盖 `@cs/assembox-desktop-next` 全部已注册组件（表格、表单、布局、G2Plot 图表），不按场景写死。
3. **G3 可运维**：高并发下资源可控（池化、限流、自愈），失败可观测、可追溯。
4. **G4 安全**：不降低现有安全水位（凭证短期化、场景来源受信、任务间隔离）。

### 1.2 非目标（本期不做）

- 交互式 PDF（表单填写、链接跳转保留）；
- 超大批量（> 1 万行）报表导出——由辅轨 B（pdfkit 直排）承接；
- 页面级「打印设计师」（用户自定义打印模板编辑器）——但架构为其预留 `printOptions` 扩展点。

---

## 2. 总体架构

### 2.1 服务拓扑

```
 业务前端        导出服务(NestJS)                    渲染层              外部依赖
┌────────┐  ┌──────────────────────────┐  ┌───────────────────┐  ┌──────────────┐
│ 业务系统 │─▶│ ExportsModule(Controller) │─▶│ Chromium 池        │  │ 场景配置服务   │
│ 触发导出 │  │  ├ QueueModule(进程内/可换) │  │  ├ 进程 ×N         │  │ 业务 API 集群  │
└────────┘  │  ├ RenderModule(编排)      │  │  └ BrowserContext │  │ 对象存储(演进) │
            │  ├ PoolModule(浏览器池)     │  │    ×M/进程         │  └──────────────┘
            │  └ ClaimModule(票据/宿主)   │  │ 每上下文加载:      │
            │ TicketModule / StorageModule│  │  打印宿主页(静态)  │──▶ 按票证请求业务API
            └────────────┬───────────────┘  └───────────────────┘  └──────────────┘
                         │ PDF 结果 → Storage(本地盘→对象存储) → 回调/轮询 → 业务前端下载
                         ▼
```

### 2.2 代码落点（monorepo 内）

```
packages/assembox-to-pdf/
├── docs/                      # 本设计文档
├── json-config/               # 测试场景
├── print-transform/           # ① 场景打印变换：纯函数库，零 DOM 依赖（依赖 core-next 类型）
│   ├── src/
│   │   ├── transform.ts       #    主入口 transformForPrint(scene, printOptions)
│   │   ├── rules/             #    节点规则表（剔除/改写/保留）
│   │   └── __tests__/         #    快照单测（输入场景 JSON → 输出打印场景 JSON）
├── print-host/                # ② 打印宿主页：Vite 静态站点，构建产物部署为静态资源
│   ├── src/
│   │   ├── main.ts            #    bootstrap（复用编辑器 renderer.ts 配方，见 §4.2）
│   │   ├── readiness.ts       #    就绪信号协议实现（§5）
│   │   ├── print.css          #    @media print 规范（§8）
│   │   └── inject.ts          #    D2 数据注入通道（§6.3）
└── server/                    # ③ 导出服务：NestJS 10 应用（模块划分见 §7.0）
    ├── src/
    │   ├── main.ts
    │   ├── app.module.ts      #    根模块（Config/Schedule/Terminus + 业务模块）
    │   ├── exports/           #    对外 API：Controller + Service + DTO（§7.1）
    │   ├── claim/             #    宿主页内部接口（一次性票据消费，§4.1）
    │   ├── render/            #    单任务渲染编排 RenderService（§7.3）
    │   ├── pool/              #    浏览器池 BrowserPool Provider（§7.4）
    │   ├── queue/             #    队列抽象：InProcessQueue ↔ BullMQ 同接口（§7.2）
    │   ├── ticket/            #    票据签发/校验/作废
    │   ├── storage/           #    产物存储抽象：本地盘 ↔ OSS 同接口
    │   ├── scene/             #    受信场景拉取（对接配置服务，§9）
    │   └── common/            #    RenderError 错误码、日志 interceptor、metrics
    ├── test/                  #    e2e（supertest + 池测试替身）
    └── nest-cli.json
```

> `server/` 作为独立 workspace 包加入 `pnpm-workspace.yaml`（当前 workspace 已注册 `packages/new-assembox-editor` 等，照此追加）；`print-transform` 与 `print-host` 同理。

**依赖方向**：`print-transform` ← 仅依赖 `core-next` 类型；`print-host` ← 依赖 `desktop-next` + `print-transform`；`server` ← NestJS 10 + Playwright + `print-transform`（仅类型），**不依赖** Vue 生态（服务与前端资产解耦，可独立部署扩缩容）。

---

## 3. 端到端时序

```
业务系统        导出API         队列          渲染Worker        Chromium上下文        业务API/配置服务
  │  POST /exports │             │              │                  │                    │
  │───────────────▶│  入队,返回id │              │                  │                    │
  │◀──202 {id}─────│────────────▶│  acquire     │                  │                    │
  │                │             │─────────────▶│ newContext        │                    │
  │                │             │              │─────────────────▶│                    │
  │                │             │              │ goto(printUrl)   │                    │
  │                │             │              │─────────────────▶│ GET /print?sceneId │
  │                │             │              │                  │──┐ 拉取场景配置      │
  │                │             │              │                  │◀─┘─────────────────│
  │                │             │              │                  │ 渲染+异步取数(D1)    │
  │                │             │              │                  │──┐─────────────────▶│
  │                │             │              │                  │◀─┘─────────────────│
  │                │             │              │ waitForFunction  │                    │
  │                │             │              │  __PDF_READY__   │                    │
  │                │             │              │─────────────────▶│                    │
  │                │             │              │ page.pdf()       │                    │
  │                │             │  PDF+指标     │◀──binary─────────│                    │
  │                │             │◀─────────────│ context.close()  │                    │
  │  上传OSS,回调   │◀────────────│  完结         │                  │                    │
  │◀──callback─────│             │              │                  │                    │
```

---

## 4. 打印宿主页（print-host）

### 4.1 加载协议

**方式选择：URL 携带任务票据，POST 数据走 `window.__PRINT_TASK__` 注入。**

| 方案 | 取舍 |
|------|------|
| A. 全部参数走 URL query | 丢失——场景配置 + 数据覆盖可能超过 URL 长度上限，且敏感信息落日志 |
| **B. URL 只带 `taskTicket`（短期、单任务、签名）** ✅ | 宿主页持票向导出服务换取完整任务描述（打印场景 JSON + 选项），票据即任务凭证，天然防重放 |

```
GET {PRINT_HOST_URL}/print?ticket=eyJhbGciOi...            ← Chromium 加载
宿主页:  ticket → POST {INTERNAL}/internal/task/claim      ← 换取 { scene, printOptions, dataOverride?, apiCredential? }
         （INTERNAL 为导出服务内网端口，见 §7.1/§9）
```

`claim` 一次性消费（防同一票据并发渲染两份），并绑定导出服务内部会话。

### 4.2 Bootstrap（复用既有配方，零新概念）

实证依据：编辑器 `renderer.ts` 已验证本配方可在非门户宿主中完整渲染场景（含 `tableCode` 表格）。打印宿主页 = 同配方去掉设计态标记：

```ts
// print-host/src/main.ts（骨架）
import { createApp, h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import { AssemPlugin, AssemViews, registerDefaults } from '@cs/assembox-desktop-next';
import { deserializeScene } from '@cs/assembox-core-next';
import { transformForPrint } from '@cs/print-transform';   // §6
import { installReadiness } from './readiness';            // §5
import './print.css';

const { scene, printOptions, dataOverride } = await claimTask(); // 持票换任务

// ① 打印变换（纯函数，可在此处或导出服务侧执行，见 §6.4 讨论）
const printScene = transformForPrint(deserializeScene(scene), printOptions);

// ② 就绪信号安装：先装计数器，再装核心（计数器要包住 $requestFns）
const readiness = installReadiness();                      // 返回 { wrap, settle, fail }

const app = createApp({
  setup: () => () => h(AssemViews, { viewsProps: printScene.viewsProps }),
});
app.use(createRouter({ history: createMemoryHistory(), routes: [/* 按 routerConfig 生成，同 buildSceneRouter */] }));
app.use(AssemPlugin, { uiSkeleton: printScene, dataSource: sceneConfig.dataSource, routerConfig, security });
app.use(ElementPlus);
app.use(createPinia());          // ⚠️ 必须：tableCode 表格的持久化配置依赖 pinia（renderer.ts:117-124 实证）
registerDefaults();
app.mount('#app');

// ③ 包装请求函数并挂接失败通道（AssemPlugin install 后 $requestFns 已生成）
readiness.wrapFns(app.config.globalProperties.$assemCore);

// ④ D2 数据注入（若任务携带 dataOverride）
await injectData(app.config.globalProperties.$assemCore, dataOverride);  // §6.3

// ⚠️ 不设置 window.assemBoxIsEdit / assemBoxDesignMode —— 打印宿主是运行态，非设计态（use-editor.ts:17 实证其影响分支）
```

**样式加载**：整包引入 Element Plus 主题 + 业务组件库样式 + 平台字体声明（`@font-face` 指向导出服务静态域），不做按需裁剪（保真优先，页面加载时延由暖页优化兜底，§7.4）。

### 4.3 凭证与跨域

- 打印宿主页与导出服务同域部署（`print.internal`），`claim` 返回**短期业务 API 凭证**（由导出服务用自身服务身份 + 任务发起人上下文换取，如网关签发的 5 分钟 token）；
- 业务 API 请求头加密复用 `AssemConfig.security`（core-next `request/headers.ts` 既有机制），密钥随任务下发，仅存活于单次渲染上下文内存中。

---

## 5. 就绪信号协议（readiness）

### 5.1 状态机

```
 LOADING ──请求计数归零──▶ SETTLING(2帧+字体+图片) ──▶ READY     → window.__ASSEM_PDF_READY__ = true
    │                          │
    └── 任一请求失败且不可降级 ─┴──────────────────────▶ ERROR   → window.__ASSEM_PDF_ERROR__ = {code, message, requestFn}
```

### 5.2 实现：包装 `$requestFns`（不侵入 core-next）

`AssemCore.$requestFns` 是普通函数表（`assem-core.ts:37`，构造时经 `_initRequestFns` 生成），宿主页在 install 后逐键包装即可，**无需改动 core-next**：

```ts
// print-host/src/readiness.ts（骨架）
export function installReadiness() {
  let pending = 0, failed: string[] = [], firstPaint = false;
  const settle = async () => {
    await document.fonts.ready;                                   // 字体
    await Promise.allSettled([...document.images].map(i =>
      i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })));  // 图片
    await doubleRaf();                                            // 两帧：Vue flush + Element Plus 渲染
    (window as any).__ASSEM_PDF_READY__ = true;
  };
  const bump = () => { if (--pending === 0) settle(); };
  return {
    wrapFns(core) {
      for (const key of Object.keys(core.$requestFns)) {
        const orig = core.$requestFns[key];
        core.$requestFns[key] = async (...args) => {
          pending++;
          try {
            const res = await orig(...args);
            if (res.status === 'error') failed.push(key);        // 请求「永不抛错」(executor.ts:117 实证)，须按 status 判定
            return res;
          } finally { bump(); }
        };
      }
    },
  };
}
```

**关键实证**：core-next 请求函数失败时**返回** `status:'error'` 而非抛异常（`executor.ts:61-67`），就绪协议必须检查返回值，否则失败被静默吞掉导出残缺 PDF。

**失败策略**：主数据请求失败 → 直接置 `__ASSEM_PDF_ERROR__`，导出服务将该任务标记失败并回传首个错误（保真优先，不产出半成品）；枚举类字典请求失败 → 允许降级（打印选项 `tolerant: true` 时），仅记录告警。

### 5.3 图表就绪（G2Plot）

图表是唯一无法用请求计数覆盖的异步源。两步处理：

1. 打印变换统一向图表节点注入 `animation: false`（G2Plot 通用配置），消除动画期截取风险；
2. 就绪协议增加 canvas 探测：SETTLING 阶段轮询（rAF，上限 3s）页面内 `canvas` 元素像素非全空白（`getImageData` 采样）后才放行 READY。

> 精确信号（plot 实例的渲染完成事件）依赖对 `@cs/vue3-biz-components-library` 图表组件的改造，列为开放问题 Q3，P0 先用保守探测。

---

## 6. 场景打印变换（print-transform）

### 6.1 定位与契约

```ts
transformForPrint(scene: SceneConfig, options: PrintOptions): SceneConfig
```

- **纯函数**：输入反序列化后的场景，输出**新对象**（与 `adaptNodeTree` 同样的不可变约定，`05-render-pipeline.md` §5.1 实证）；
- **可单测**：`single-table-scene.json` 等真实场景作 fixtures，快照断言输出；
- **幂等**：对已变换场景重复执行无副作用（内部用 `Symbol` 标记已处理节点）。

### 6.2 节点规则表（首版）

遍历方式复用 core-next 的节点树结构（`planeOptions` / `dialogOptions[]` / `drawerOptions[]` / `defaultSlot` / `itemConfig[].defaultSlot` / `toolSlot` / `filterSlot` / `columnSlots[].columRender`）。

| 规则 | renderType / 目标 | 处理 | 依据（single-table-scene.json 实证） |
|------|------------------|------|------|
| **剔除** | `YqToolBar` | 整树移除（连带 toolSlot/filterSlot 内全部按钮与筛选器） | 工具栏仅服务交互（:55-537） |
| **剔除** | `Dialog` / `Drawer`（dialogOptions/drawerOptions 数组） | 清空数组 | 弹层不属于打印内容（:800-） |
| **剔除** | 游离 `Button`、分页跳转类 | 移除 | 增删改按钮在打印中无意义（:466-528） |
| **剔除** | `YqNavigationBar` | 默认剔除，可由 `printOptions.keepNav` 保留（转为纯标题条） | 导航条依赖 vue-router 状态（:28-42） |
| **改写** | `YqTableAsync` | 见 §6.3 数据策略 | 异步取数挂 onMounted（:201-205） |
| **改写** | 图表节点 | 注入 `animation:false`；宽度改 `100%` | §5.3 |
| **改写** | 根布局 `YqFlexBox` | 移除 `height:'100%'` 视口约束，改为自然高度 | 屏幕视口布局 vs 纸张流式布局 |
| **保留** | `Form`（只读态）、`Tag`、`RawHtml`、`GridBox`、描述文本 | 原样保留 | 数据呈现主体 |
| **通知** 未知 renderType | — | 不剔除，透传（打印宿主与线上渲染器同版本，能渲则渲），上报 `PRINT_TRANSFORM_UNKNOWN_TYPE` 计数 | 前向兼容：新组件上线但规则表未更新时不至于丢内容 |

**规则表以数据驱动**（`rules/` 下每条规则 `{ match, apply }`），新增组件时只需加规则 + fixture，主流程不动。

### 6.3 `YqTableAsync` 数据策略（D1/D2 双轨）

| | D1：浏览器内取数（默认） | D2：服务端预取 + 注入 |
|---|---|---|
| 机制 | 保留 `requestFn`，改写分页参数（`currentSize` = 任务行上限，如 1000） | `autoLoad:false` + 服务端取数后经 `exposed.setData({count, result})` 注入（assem-yq-table-async.vue:180-185、209-227 实证暴露此 API） |
| 优点 | 零改造，请求链路（含 beforeReq/afterReq、信封剥离）与线上一致 | 无浏览器内业务请求：快、确定性强、凭证不进页面 |
| 缺点 | 依赖页面内请求成功；分页参数改写需验证 biz 底表组件对大 pageSize 的行为 | 服务端需复刻请求参数变换（`transformParams` 含数据模型取值，链路复杂）；`columnSlots` 的 `onValueRender` 仍需页面内执行 |
| 适用 | 通用场景、含复杂单元格渲染 | 高并发、敏感数据、超长列表 |

**首版决策：D1 为默认，D2 作为 `printOptions.dataMode: 'prefetch'` 选项**。D2 的注入通道（§4.2 第④步）按 `YqTableAsync` 暴露 API 逐表 `setData`；预取由导出服务直接调用业务 API（复用信封约定，`executor.ts:28-33` 实证）。

### 6.4 变换执行位置（讨论点 Q1）

| 位置 | 影响 |
|------|------|
| 导出服务进程内 | 导出服务需依赖 `print-transform`（纯函数，无 Vue 依赖，可行）；任务描述里是「已变换场景」，宿主页薄 |
| 打印宿主页内 | 变换逻辑随前端资产发布，版本与渲染器天然对齐 ✅；但变换规则对服务端不可见（排障需看页面日志） |

**建议：宿主页内执行**（版本对齐价值大于排障成本），服务端只透传原始场景 + 选项。

---

## 7. 导出服务（server，NestJS 10）

### 7.0 技术栈与模块划分

对齐仓库既有 NestJS 应用约定（`assembox-packages-project/apps/assembox-builder`：`@nestjs/common ^10.4.8`、platform-express、`nest build`）：

| 关注点 | 选型 | 说明 |
|--------|------|------|
| HTTP 框架 | `@nestjs/platform-express` | 与 builder 一致；渲染瓶颈在 Chromium，非 Web 框架 |
| 参数校验 | `class-validator` + `class-transformer`，全局 `ValidationPipe({ whitelist: true, transform: true })` | `printOptions` 字段白名单收敛，未知字段拒绝，防注入打印无关开关 |
| API 文档 | `@nestjs/swagger` | DTO 即文档（`@ApiProperty`），供业务系统对接 |
| 配置 | `@nestjs/config` | `.env`：池参数、超时、路径、内网端口等 |
| 定时任务 | `@nestjs/schedule`（builder 已用） | 浏览器轮换、过期票据清扫、任务表清理 |
| 健康检查 | `@nestjs/terminus` | `/health/ready` = 池可用 + 队列未满；`/health/live` = 进程存活 |
| 指标 | `nestjs-prometheus` | `/metrics`，指标清单见 §11 |
| 队列 | 首版 `InProcessQueue`（Provider 实现 `ExportQueue` 接口）；演进替换 `@nestjs/bullmq` | 接口不变，模块内换实现类 |
| 存储 | `StorageService` 接口：首版本地盘实现；演进换 OSS 实现 | 与队列同思路，环境无关抽象 |

**模块与依赖注入拓扑**（Playwright 只出现在 Pool/Render 两处，其余模块可用测试替身）：

```
AppModule
 ├─ ExportsModule   ── ExportsController (POST/GET/cancel, sync 模式)
 │                    ExportsService ──▶ ExportQueue, TicketService, SceneService, StorageService
 ├─ ClaimModule     ── ClaimController (POST /internal/task/claim) ──▶ TicketService, SceneService
 ├─ RenderModule    ── RenderWorker（队列消费循环）──▶ RenderService ──▶ BrowserPool, TicketService, StorageService
 ├─ PoolModule      ── BrowserPool（@Injectable, OnModuleInit/OnModuleDestroy）
 ├─ QueueModule     ── { provide: 'ExportQueue', useClass: InProcessQueue }   // 演进: BullMqQueue
 ├─ TicketModule    ── TicketService（签发/一次性消费/TTL）
 ├─ SceneModule     ── SceneService（HTTP 拉取受信场景 + 缓存）
 └─ StorageModule   ── { provide: 'StorageService', useClass: LocalDiskStorage } // 演进: OssStorage
```

### 7.1 API 契约（NestJS Controller + DTO）

```
POST /api/v1/exports                     # 创建任务
  { sceneId, printOptions?, filters?, callbackUrl? }
  → 202 { taskId, status:'queued', pollUrl }

GET  /api/v1/exports/:id                 # 轮询状态
  → { status: 'queued'|'rendering'|'uploading'|'done'|'failed',
      result?: { url, expiresAt, bytes, pages }, error?: {code,message} }

POST /api/v1/exports/:id/cancel          # 取消排队任务

# 宿主页内部接口（单独端口/内网 Guard，仅渲染宿主来源可达）
POST /internal/task/claim   { ticket } → { scene, printOptions, dataOverride?, apiCredential }   # 一次性
```

契约即代码（节选）：

```ts
// exports/dto/print-options.dto.ts —— 白名单收敛，未知字段由 ValidationPipe 拒绝
export class PrintOptionsDto {
  @IsIn(['A4', 'A3', 'Letter'])              format?: 'A4' | 'A3' | 'Letter';
  @IsIn(['portrait', 'landscape'])           orientation?: 'portrait' | 'landscape';
  @IsObject() @ValidateNested()              marginsMm?: { top; bottom; left; right };
  @IsOptional() @IsString()                  headerTemplate?: string;    // 支持 {{title}} {{exportedAt}}
  @IsOptional() @IsBoolean()                 showPageNumber?: boolean;
  @IsInt() @Min(1) @Max(5000)                rowLimit?: number;          // 默认 1000，防失控
  @IsOptional() @IsBoolean()                 keepNav?: boolean;
  @IsOptional() @IsBoolean()                 tolerant?: boolean;         // 字典类请求失败是否降级
  @IsIn(['browser', 'prefetch'])             dataMode?: 'browser' | 'prefetch';
  @IsNumber() @Min(0.5) @Max(2)              scale?: number;
}

// exports/exports.controller.ts
@Controller('api/v1/exports')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @SwaggerOk(CreateExportRespDto)
  create(@Body() dto: CreateExportDto, @ReqIdentity() identity: Identity): CreateExportRespDto { ... }

  @Post('sync')                                  // 同步小文档通道（§7.2）
  @HttpCode(HttpStatus.OK)
  async createSync(@Body() dto: CreateExportDto, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const pdf = await this.exportsService.renderSync(dto, identity, SYNC_TIMEOUT_MS); // 超时抛错→前端改走异步
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${dto.sceneId}.pdf"` });
    return new StreamableFile(pdf.buffer);
  }

  @Get(':id')      get(@Param('id') id: string): ExportStatusDto { ... }
  @Post(':id/cancel') cancel(@Param('id') id: string): ExportStatusDto { ... }
}
```

`printOptions` 默认值：`A4 / portrait / margins {12,16,12,12}mm / rowLimit 1000 / dataMode 'browser' / scale 1.0`（由 `ExposesService` 合并 DTO 与默认值，不信任客户端传全）。

### 7.2 任务模型与队列

```
ExportTask { id, tenantId, sceneId, printOptions, status, attempts, createdAt,
             ticket?, deadline, resultPath?, metrics? { queuedMs, renderMs, pdfBytes, pages } }
```

- **队列（NestJS 内的抽象与实现）**：
  - `ExportQueue` 接口：`enqueue(task)` / `dequeue(renderCount)`（并发槽位就绪时拉取）/ `cancel(id)` / `depth()`；
  - 首版 `InProcessQueue`：有界（`queueMax`，满则 Controller 直接 `429`）+ 指数退避重入队；
  - 演进 `BullMqQueue`（`@nestjs/bullmq` + Redis）：多实例部署/崩溃恢复时整体替换 Provider，**业务代码零改动**——这是选 NestJS 的直接收益之一；
- **幂等**：`sceneId + printOptions + filters` 指纹去重，10 分钟窗口内直接复用产物（`ExportsService` 内实现，队列无关）；
- **重试**：仅对 `rendering` 阶段的基础设施错误（浏览器崩溃、上下文超时）重试 ≤ 2 次，业务失败（`__ASSEM_PDF_ERROR__`）不重试（重试也不会成功）；
- **TTL**：产物 URL 签名 24h；任务记录保留 7 天（`@nestjs/schedule` `@Cron` 清扫）。

### 7.3 单任务渲染编排（RenderService）

```ts
// render/render.service.ts（骨架，@Injectable）
@Injectable()
export class RenderService implements OnModuleDestroy {
  constructor(
    private readonly pool: BrowserPool,            // §7.4
    private readonly tickets: TicketService,
    @Inject('PrintHostConfig') private readonly host: { baseUrl: string },
  ) {}

  async render(task: ExportTask): Promise<PdfResult> {
    const ticket = await this.tickets.issue(task);  // 一次性票据
    const ctx = await this.pool.acquireContext();   // 含并发槽位排队
    try {
      const page = await ctx.newPage();
      await page.emulateMedia({ media: 'print' });
      const url = `${this.host.baseUrl}/print?ticket=${ticket}`;
      const loadResp = await page.goto(url, { waitUntil: 'domcontentloaded' }); // 不等 networkidle（有轮询请求时会挂死）
      if (loadResp && !loadResp.ok()) throw new RenderError('HOST_LOAD_FAILED', String(loadResp.status()));
      await Promise.race([
        page.waitForFunction('__ASSEM_PDF_READY__ === true', null, { timeout: task.deadlineMs }),   // 默认 30s
        page.waitForFunction('window.__ASSEM_PDF_ERROR__', null, { timeout: task.deadlineMs })
          .then(e => { throw new RenderError('PAGE_REPORTED', JSON.stringify(e)); }),
      ]);
      const pdf = await page.pdf(pdfParamsOf(task.printOptions));
      return { buffer: pdf, metrics: await collectPageMetrics(page) };
    } finally {
      await ctx.close().catch(() => {});            // 上下文立即销毁：凭证、localStorage、缓存全清
    }
  }

  onModuleDestroy() { /* 触发 pool.drain()，见 §7.5 */ }
}
```

`RenderWorker`（RenderModule 内 Provider）持有并发槽位信号量循环消费 `ExportQueue`，每任务包裹超时与错误分类（HOST_LOAD_FAILED / PAGE_REPORTED / TIMEOUT / CRASH / POOL_EXHAUSTED）。

### 7.4 浏览器池（BrowserPool Provider）

**两级模型：进程（Browser）× 上下文（BrowserContext）。生命周期挂在 NestJS 模块钩子上：**

```ts
// pool/browser-pool.provider.ts（骨架）
@Injectable()
export class BrowserPool implements OnModuleInit, OnModuleDestroy {
  private browser?: Browser;
  private slots: Semaphore;                        // contextsPerBrowser 并发槽位

  async onModuleInit() {
    this.browser = await chromium.launch({
      args: ['--disable-dev-shm-usage', '--disable-gpu', '--no-sandbox', '--font-render-hinting=none'],
    });
    this.browser.on('disconnected', () => this.handleDisconnect());   // 自愈链入口
  }

  acquireContext(timeoutMs): Promise<BrowserContext> { /* 槽位排队 + newContext() + 使用计数 */ }

  @Cron(every30minOr500Tasks)                       // @nestjs/schedule：定期轮换
  async recycle() { /* 排空后 close 旧进程、重启新进程，防累积泄漏（Vue/G2Plot 实例释放不完全） */ }

  async onModuleDestroy() { /* 优雅停机：拒绝新任务→排空槽位→browser.close()（§7.5） */ }
}
```

| 参数 | 首版默认 | 说明 |
|------|---------|------|
| `browsersPerInstance` | 1 | 单 NestJS 进程单浏览器进程，OOM 边界清晰；扩容 = 多起服务实例 |
| `contextsPerBrowser` | 3–4（可配） | 活跃渲染并发；上下文创建 ~50ms，远轻于进程 |
| `queueMax` | 100 | 超出即 Controller 层 429 快速失败 |
| `taskTimeoutMs` | 30_000 | 硬超时，超时强关上下文 |
| `browserRecycleAfter` | 500 任务 / 30min | 定期轮换（Cron），防累积泄漏 |

**自愈链**：`page.on('crash')` / `browser.on('disconnected')` → 标记进程不健康 → 池重建 → 排队任务重新派发（受 §7.2 重试上限保护）；连续 3 次重建失败 → `/health/ready` 置为 down，摘除本实例流量。

**暖页优化（P2）**：常驻「预热上下文」预加载宿主页外壳（应用样式、字体、Element Plus），任务到来时同上下文内 `page.goto` 复用 HTTP 缓存，目标把宿主页加载从 ~1.5s 压到 ~400ms。

### 7.5 生命周期与优雅停机（NestJS 信号钩子）

```
SIGTERM ─▶ app.enableShutdownHooks()（main.ts）
        ─▶ ExportsModule: Controller 返回 503（拒绝新任务）
        ─▶ BrowserPool.onModuleDestroy: 停止派发 → 在渲任务等待完成（上限 taskTimeoutMs）→ browser.close()
        ─▶ 队列中未处理任务：写回任务表（状态 queued），由演进方案的 BullMQ/其他实例接管；单实例期则随进程退出丢弃（业务侧可重提）
```

进程模型：**单 NestJS 进程内一条渲染流水线**（1 浏览器 × N 上下文）；垂直扩容靠调 `contextsPerBrowser`，水平扩容靠多实例（演进 BullMQ 后天然支持）。**禁止 PM2 cluster 模式**（多进程共享 Chromium 管理复杂且无收益），单实例用 `fork` 模式或裸进程即可。

---

## 8. 打印 CSS 与分页规范（print.css）

```css
@media print {
  html, body { margin: 0; background: #fff; }
  /* ① 解除视口约束：屏幕态 YqFlexBox/YqBox 是 height:100% + overflow:hidden 的视口布局 */
  [data-print-root], [data-print-root] * { overflow: visible !important; }
  [data-print-root] { min-height: 0 !important; height: auto !important; }

  /* ② 背景色/边框必须打印（Element Plus 表头底色、斑马纹、Tag 配色） */
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  /* ③ 表格断页 */
  table { page-break-inside: auto; }
  tr  { page-break-inside: avoid; }          /* 行不腰斩 */
  thead { display: table-header-group; }      /* 表头跨页重复（Chromium 原生支持） */
  tfoot { display: table-footer-group; }      /* 合计行贴每页底部/末页 */

  /* ④ 布局盒约束：GridBox 栅格在纸宽下按比例收缩，禁止横向溢出 */
  [data-print-root] { max-width: 100%; }
  img, canvas, svg { max-width: 100%; height: auto; }
}

/* 屏幕态（渲染等待期）也按纸宽布局，避免打印媒体切换时 reflow 抖动 */
body[data-print-host] { width: 794px; margin: 0 auto; }   /* A4@96dpi；landscape 时 1123px */
```

配套：宿主页在 bootstrap 时按 `printOptions` 设置 `document.body.dataset.printHost = ''` 与根容器 `data-print-root`，CSS 只圈定打印根，不污染 Element Plus 全局样式。

**已知 Chromium 打印差异清单**（设计层面规避，不硬修）：`box-shadow` 半透明丢失（Tag/卡片阴影改边框替代）、`position:fixed` 每页重复（已在变换中剔除悬浮件）、CSS 变量在页眉页脚模板中不可用（页眉页脚用 API 模板，§7.1）。

---

## 9. 安全设计

| 威胁 | 对策 |
|------|------|
| 场景配置注入恶意事件（`compileFn` 是 `new Function` 非沙箱，05-render-pipeline.md §5.2 实证） | 任务仅接受 `sceneId`，由导出服务向**配置服务**拉取受信场景；不接受请求体直传场景 JSON。渲染进程不持有平台长期凭证 |
| 票据重放/劫持 | ticket 一次性消费 + 60s TTL + 绑定渲染实例标识；`/internal/*` 独立端口监听（`app.listen(port, '127.0.0.1' 或内网网卡)`）或独立 Guard，仅宿主页可达 |
| 越权数据访问 | 业务凭证 = 发起人上下文短期 token（≤ 5min），单任务内闭环；D2 模式下凭证不出导出服务 |
| `--no-sandbox` 放大利用面 | 运行账户最小权限（非 root、无写权限目录仅产物目录）、机器/网段层面仅放行配置服务/业务 API 出口、不挂载敏感凭证到运行环境（本期非容器部署，网络隔离依赖主机防火墙/安全组） |
| 任务间串数据 | 每任务独立 BrowserContext（cookie/storage/缓存隔离），结束即销毁；D2 场景数据不经页面 |
| PDF 内容合规 | 页眉默认带「导出时间 + 操作人水印位」（printOptions 可配），满足审计需求 |

---

## 10. 运行环境（本期非容器化）

> 容器镜像、K8s 探针/HPA、Pod 资源规格等部署设计**另行出文档**，本文仅约定应用对运行环境的要求。

### 10.1 环境要求（开发/测试环境即生产形态基线）

| 项 | 要求 | 检查方式 |
|----|------|---------|
| Node | ≥ 18（与 `assembox-desktop-next` `engines` 一致；建议 20/22 LTS） | `node -v` |
| Chromium | 本机安装（方式二选一，见下） | 启动时 `chromium.launch` 成功 + `/health/ready` |
| 中文字体 | Noto Sans CJK SC（fontconfig 可发现） | 渲染冒烟场景无方块字 |
| 依赖库 | `libnss3` 等 Chromium 运行库（Linux） | `ldd $(which chromium) \| grep 'not found'` 为空 |

**Chromium 获取方式**（优先 a，离线环境用 b）：

```
a. Playwright 官方分发：pnpm --filter server exec playwright install chromium --with-deps
b. 系统包管理器安装 chromium，并设 PRINT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium 指定 executablePath
```

### 10.2 服务启动与本地开发

```bash
# monorepo 根
pnpm install
pnpm --filter @cs/print-host build          # 构建打印宿主页静态产物
pnpm --filter @cs/assembox-pdf-server start:dev   # NestJS watch 模式（nest start --watch）
# 环境变量见 server/.env.example：
#   PORT=9100  INTERNAL_PORT=9101  PRINT_HOST_URL=http://127.0.0.1:9100/print
#   POOL_CONTEXTS=3  QUEUE_MAX=100  TASK_TIMEOUT_MS=30000
#   SCENE_SERVICE_URL=...  (配置服务地址)
```

**静态宿主页托管**：NestJS 侧 `ServeStaticModule`（`@nestjs/serve-static`）直接托管 `print-host/dist`，开发与单机部署零额外组件；演进到多实例/CDN 时再拆独立静态服务（`PRINT_HOST_URL` 配置切换）。

**产物存储**：首版 `LocalDiskStorage`（目录 `data/exports/`，签名 URL 由 NestJS 路由代理下载）；演进替换 OSS 实现（§7.0 StorageService 抽象）。

---

## 11. 可观测性与测试

**指标**（`nestjs-prometheus` 提供 `/metrics`，Prometheus 抓取）：`export_queue_depth`、`export_task_duration_seconds{phase=queue|render|pdf|upload}`、`export_pdf_pages`、`pool_contexts_active`、`pool_browser_restarts_total`、`export_fail_total{reason}`（区分 HOST_LOAD_FAILED / PAGE_REPORTED / TIMEOUT / CRASH）。

**日志**：NestJS 全局 LoggingInterceptor，每任务一条结构化日志（taskId、sceneId、phase 耗时、页数、字节数、失败原因），`PAGE_REPORTED` 时附带页面回传的首个错误请求名。

**视觉回归（保真护栏，G1 的验收手段）**：
- fixtures：3–5 个代表性场景（单表、表单、图表混排、长表格跨页）；
- 流程：渲染 PDF → `pdftoppm` 转 PNG → 与基线像素 diff（阈值 0.1%）；
- 触发时机：print-host 资产变更、Element Plus 升级、字体/镜像变更、Chromium 版本变更。

---

## 12. 实施计划

| 阶段 | 周期 | 交付物 | 验收 |
|------|------|--------|------|
| P0 PoC | 1 周 | 脚本化：Playwright 加载 print-host（硬编码 single-table 场景）→ A4 PDF；打通 wrapFns + READY 协议 | 表格数据完整、中文正常、表头跨页重复、斑马纹/底色保留 |
| P1 MVP | 3 周 | print-transform 库（规则表 + 单测）、NestJS 导出服务（模块骨架 + API + InProcessQueue + BrowserPool + 优雅停机）、本地环境脚本（Chromium/字体自检） | 20 并发压测无泄漏无 OOM；P95 < 10s；失败可回查日志 |
| P2 生产化 | 2–3 周 | 视觉回归流水线、指标告警、暖页优化、D2 预取通道、幂等去重；BullMQ 队列替换（多实例）评估 | SLO：成功率 > 99.5%，P95 < 8s |

---

## 13. 风险与对策（方案 A 专项）

| 风险 | 等级 | 对策 | 验证时点 |
|------|------|------|---------|
| biz 底表组件对大 `currentSize` 行为未知（D1 全量分页） | 高 | P0 首个验证项；不满足则该场景走 D2 | P0 |
| `--no-sandbox` 安全评审受阻 | 中 | 备选：Chromium headless=new；或独立安全域/专用机部署；容器化时再评估 seccomp | P1 前 |
| G2Plot 就绪探测误判（空白画布采样） | 中 | 探测 + 最小等待双条件；推动 biz 组件暴露渲染完成事件（Q3） | P1 |
| 页眉页脚模板 class 受限（Chromium 仅内联样式） | 低 | 模板约定「仅 inline style」，文档化 | P0 |
| Vue/Element Plus 未卸载导致的上下文内存增长 | 中 | 定期轮换进程（500 任务）；池指标监控 rss | P1 压测 |

---

## 14. 开放问题（评审讨论清单）

| # | 问题 | 备选与倾向 |
|---|------|-----------|
| Q1 | 打印变换执行位置：服务端 vs 宿主页 | 倾向宿主页（版本对齐）；代价是服务端排障看不到变换产物——可通过 `claim` 时回传变换后场景快照到任务记录缓解 |
| Q2 | D1 全量分页的实现细节：改 `currentSize` vs 底表组件需要显式「关闭分页」开关 | 若 biz 组件（`@cs/vue3-biz-components-library` 的 yq-table-async）需要改造，改造量算在 P0/P1 边界上，需与组件库 owner 对齐 |
| Q3 | 图表就绪精确信号：是否给 biz 图表组件加 `onRendered` 回调 / `exposed.ready` | 短期用像素探测；中期建议组件库统一补「渲染完成」暴露，导出与 e2e 测试同时受益 |
| Q4 | 导出服务与业务后端的部署关系：独立域 vs 挂业务网关 | 影响凭证换取方式与内网隔离范围，需运维参与评审（本期先单机部署，但凭证通道设计需提前定型） |
| Q5 | 多场景（uiSkeleton 多 key）导出：单 PDF 拼接 vs 每场景一份 | 首版单场景单 PDF；多场景拼接在任务层做（PDF 合并库），不动渲染链路 |
| Q6 | `printOptions` 是否进设计器（平台侧「打印配置」面板） | 本期 API 透传即可；设计器面板是后续需求，架构已预留 |

---

## 附录 A：关键代码事实索引

| 事实 | 位置 |
|------|------|
| `AssemCore.$requestFns` 为普通函数表，构造时生成 | `assembox-core-next/src/core/assem-core.ts:37,77-78,197` |
| 请求失败返回 `status:'error'` 不抛异常 | `assembox-core-next/src/request/executor.ts:61-67,117-131` |
| `YqTableAsync` 暴露 `reloadData/setData/getLoading` 等，`autoLoad` 默认 true | `assembox-desktop-next/src/components/element-container/block-element/table/assem-yq-table-async.vue:80-82,201-205,209-227` |
| `deserializeScene` = JSON → adaptNodeTree 后场景 | `assembox-core-next/src/core/scene-serializer.ts:78` |
| 非门户宿主完整渲染配方（router+AssemPlugin+ElementPlus+pinia） | `packages/new-assembox-editor/src/scenarios/pc-desktop/renderer.ts:100-135` |
| pinia 为 tableCode 表格硬依赖 | `renderer.ts:117-124` 注释实证 |
| `window.assemBoxIsEdit` 设计态标记影响组件分支 | `assembox-desktop-next/src/composables/use-editor.ts:17-22` |
| `compileFn` 非沙箱（`new Function`） | `docs/architecture/05-render-pipeline.md` §5.2 |
| Dialog/Drawer 由 AssemViews 直渲，不经 NodeRenderer | 同上 §5.3 |
| 仓库既有服务端应用为 NestJS 10（platform-express + schedule + typeorm），本文服务端设计对此对齐 | `assembox-packages-project/apps/assembox-builder/package.json:27-32` |
