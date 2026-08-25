# SaaS 鉴权与上下文在服务端导出运行时的处理参考

| 项目 | 内容 |
|------|------|
| 主题 | 低代码场景的真实业务接口（SaaS 前端浏览器 API + 完整鉴权）在无头渲染 PDF 导出中的优雅接入 |
| 依赖框架 | `@cs/js-web-framework`（portalStore / Http / portalPinia） |
| 性质 | 参考意见（供评审讨论），含现状实证、方案建议与实施路线 |
| 关联文档 | `01-服务端PDF导出技术调研报告.md`、`02-方案A详细设计`（§4.3/§9 已预留凭证通道设计口） |

---

## 1. 现状实证：鉴权与上下文机制拆解

接入前必须理解三层机制（均引自本仓库代码 / vendored UMD 实证）：

### 1.1 第一层：请求头注入链（core-next，可编程接入口）

```
createHttpFn (request/executor.ts)
  → setRequestHeaders(axiosConfig, assemCore.$globalVars.$context, config.security)  (request/headers.ts:8-28)
  → 注入 6 个请求头：
      x-client-ajax: true
      x-org-id:        context.orgId
      x-user-name:     context.userName（security.encryptEnabled 时 AES 加密）
      x-application-id: context.applicationId
      x-tenant-id:     context.tenantId
      x-tenant-code:   context.tenantCode
```

**关键结论**：鉴权头的数据源是 `$globalVars.$context`（`global-vars.ts` Context 类型：permissions/navRouters/orgId/userName/applicationId/tenantId/tenantCode）。**服务端渲染只要在 mount 前把 `$context` 装配正确，全部业务请求自动携带租户/组织/用户头** —— 这是最干净、零侵入框架的接入口。

`$context` 默认全空（`assem-core.ts:57-67`），由宿主注入；编辑器画布的做法是 mount 后 `Object.assign(assemCore.$globalVars, runtimeConfig.globalVars)`（`iframe-canvas-renderer.ts:345-351`）。

### 1.2 第二层：会话凭证（js-web-framework Http）

vendored UMD 实证（`print-host/public/vendor/js-web-framework.js`）：

- `Http` 类封装 axios，`setHeaders(obj)` 设置实例级公共头（即 token/Authorization 的注入通道）；
- **会话过期语义是浏览器导向的**：响应 `401 && code===302 && redirectUrl` → `portalBridge.redirectLogin({loginUrl})` 并返回 `new Promise(()=>{})`（永不决议，等待浏览器跳转登录页）；
- 凭证本体（cookie 或 header token）由门户在浏览器侧建立，`portalStore` 持有用户态。

### 1.3 第三层：上下文数据（portalStore）

`portalStore`（pinia defineStore）持有完整 SaaS 上下文：`userId/userName/realName/orgId/orgName/orgType/tenantId/tenantCode/tenantName/applicationId/permissions/products/...`。core-next 的 `Context` 是其子集；组件库（table-setting 等）经 `usePortalContext()` 直读框架全局。

### 1.4 当前导出管线的空缺

print-host `main.ts` 现状：`security: {}`、不设 `$context`、claim 载荷无凭证字段、requestConfig 指向 mock —— 即三层机制全部未接。这是有意的测试态设计（mock 无鉴权），但也意味着接真实 API 前 these gaps 必须逐层补齐。

---

## 2. 服务端运行时的核心矛盾

| 浏览器语义 | 无头渲染的冲突 | 后果（不处理时） |
|-----------|--------------|-----------------|
| 凭证由门户域 cookie / 内存 token 建立 | 渲染上下文是全新 BrowserContext，无任何凭证 | 全部业务请求 401 |
| 401+302 → redirectLogin 跳登录页 | 无头页面无人跳转，Promise 永不决议 | 任务挂死至 30s 超时，错误语义丢失 |
| portalStore 由门户登录流程填充 | 打印宿主页无登录流程 | 组织/租户/用户头缺失，接口层鉴权失败或数据错租户 |
| 凭证生命周期 = 用户会话（小时级） | 导出任务是分钟级一次性消费 | 长效凭证进渲染页 = 攻击面扩大 |

**总原则**：导出服务必须把「用户身份」以**短期、单任务、可撤销**的形式委托给渲染运行时，而不是复刻浏览器的长效会话。

---

## 3. 处理意见

### 意见一：身份委托链（Identity Delegation）—— 总体架构

不要把用户原始凭证（门户 cookie / 长效 token）直接交给渲染页。建立三级委托：

```
业务前端                导出服务                       渲染运行时（BrowserContext）
─────────              ─────────                      ─────────────────────────
POST /exports
+ 用户凭证(cookie/token)
        │  ①验证用户身份
        ▼
   导出服务向鉴权中心/网关
   申请【任务凭证】(短期 token,     ──②签发一次性票据──▶ ticket 在 URL
   绑定 taskId + tenantId + user,    (60s TTL, 已实现)
   TTL = 任务超时 + 缓冲, ≤5min)
        │
        └────③claim 载荷携带────▶  { scene, portalContext, apiCredential }
                                      │ ④注入（见意见二/三）
                                      ▼
                                  业务请求带全鉴权头 + 任务凭证
                                  任务结束 context.close() → 凭证随票据一并作废
```

- **任务凭证换取**：优先走平台既有网关的 token exchange（服务身份 + user context 换短期 token）；无此能力时退化为「cookie 转发」（意见三方案 A），仍受单任务生命周期约束。
- **绑定关系**：任务凭证 ↔ taskId 一一对应；票据 claim 时才下发（票据本身一次性，已实现），凭证不落 URL、不落日志、不进任务表持久层（内存态，随 TaskStore 记录仅存凭证指纹用于排障）。
- **撤销**：任务完结/失败/超时即失效（TTL 兜底）；异常场景可主动吊销（黑名单机制留接口）。

### 意见二：上下文装配（portalContext 通道）—— 最优先落地

**改动小、收益直接**：claim 载荷扩展 `portalContext` 字段，print-host 装配进 `$globalVars.$context`，第一层请求头链自动生效。

```
① claim 载荷（server SceneService/ClaimController 组装）：
   portalContext: {
     orgId, userName, applicationId, tenantId, tenantCode, permissions, navRouters
   }   // 来源：a) 任务发起时网关解析的用户态（推荐） b) 配置服务按 sceneId 预登记

② print-host main.ts（mount 前装配；reactive 包装由 desktop-next 负责，对齐画布做法）：
   app.use(AssemPlugin, { uiSkeleton, dataSource, routerConfig, security });
   const core = app.config.globalProperties.$assemCore;
   Object.assign(core.$globalVars.$context, task.portalContext);   // ← 头注入链的数据源

③ security 配置随载荷下发（encryptKey/encryptEnabled），与线上一致 —— x-user-name 加密口径不同会导致鉴权失败
```

**注意**：`$context` 装配必须发生在任何业务请求发出之前（表格 onMounted 即取数），即 `wrapFns` 之前完成 —— main.ts 现有顺序（install → wrapFns → mount）只需在 wrapFns 前插入一步。

**portalStore 的取舍**：组件库少量逻辑直读 `window.JsWebFramework.portalStore`（如 table-setting 取列配置）。建议 print-host 在 `installVendorPlugins` 阶段用 portalContext **预填 portalStore**（`Z.setState` 或直接对 store state 赋值），使「框架上下文」与「core 上下文」一致；不要走真实门户的登录/拉取流程。

### 意见三：凭证注入通道 —— 三方案对比

| 方案 | 机制 | 优点 | 缺点 | 适用 |
|------|------|------|------|------|
| **A. Cookie 转发**（推荐起步） | 导出服务从发起请求提取门户 cookie → `context.addCookies()` 注入 BrowserContext（限业务 API 域） | 零后端改造；与浏览器行为完全一致 | cookie 是长效凭证，生命周期大于任务；需限定 domain/path + httpOnly 保护 | 平台暂无 token exchange 时 |
| **B. 网关短期 token**（推荐终态） | 意见一的任务凭证 → `extraHTTPHeaders` 或 claim 载荷下发 → 页内 `Http.setHeaders({Authorization})` / core 请求层附加头 | 凭证生命周期=任务；可审计可吊销 | 需要网关支持 token exchange；请求层需加一条 header 注入 | 有鉴权中心协作时 |
| **C. 服务端预取（D2）** | 凭证不出导出服务：Node 侧带用户上下文头预取数据 → `__INITIAL_DATA__` 注入（设计文档 §6.3 D2 / §7.1 已预留） | 凭证暴露面最小；结果确定性最强 | 预取链路需复刻 transformParams；columnSlots 动态渲染仍需页面执行 | 高敏数据 / 高并发场景 |

**实施顺序**：A 起步（打通）→ B 替换（收敛凭证面）→ C 按场景启用（性能与安全双优）。三方案对渲染页代码几乎无差别（都体现为「请求带了正确头」），迁移成本低。

### 意见四：会话过期（401）的 fail-fast 治理

框架的 `redirectLogin` + 永不决议 Promise 在无头环境必须被拦截，否则任务挂死且错误语义丢失：

1. **页内拦截（print-host）**：`installVendorPlugins` 后包装 `Http` 实例的响应拦截（或经 axios 全局 `axios.interceptors.response`，print-host 已加载全局 axios）识别 `401 + code 302`：置 `__ASSEM_PDF_ERROR__ = { code: 'AUTH_EXPIRED', message: '会话过期/凭证无效' }`，并 `reject` 使就绪计数归零 —— 替代 redirectLogin 的挂死语义；
2. **服务端分类（server）**：`RenderError` 增加 `AUTH_EXPIRED` 归入**不可重试**类（重试无意义，凭证不会自愈）；任务失败原因回传业务前端提示重新发起（届时换取新凭证）；
3. **票据竞态**：凭证 TTL 应略大于票据 TTL + 任务超时，避免「票据有效但凭证先死」的中间态；出现该中间态按 AUTH_EXPIRED 处理。

### 意见五：mock → 真实 API 的配置化切换

现状 `SCENE_CONFIGS`（server 内存表）是测试态。演进两步：

1. **环境级开关**：`SCENE_CONFIGS` 条目增加 `target: 'mock' | 'real'`；`real` 模式下 requestConfig 不再指向 `/internal/mock/*`，而是从**场景配置服务**拉取该场景的 dataSource 原始定义（真实前端接口地址），mock 与 real 可按场景灰度；
2. **claim 载荷收敛**：真实模式下 claim 只下发 `{ sceneRef, portalContext, apiCredential }`，dataSource 由配置服务定义 —— 与设计文档 §9「不接受请求体直传场景」一致，鉴权头/凭证由本文件意见二/三补齐。

### 意见六：租户隔离与审计

- **运行时隔离**（已具备）：每任务独立 BrowserContext，cookie/storage/缓存任务间零共享，结束即销毁；
- **数据面隔离**：`x-tenant-id/x-org-id` 由 portalContext 保证；D2 预取时同头由导出服务附加；
- **审计**：任务记录补 `operator（发起人）、credentialFingerprint（凭证指纹）、authSource（cookie/token-exchange/prefetch）` 三字段；`AUTH_EXPIRED` 事件单独计量（`export_fail_total{reason="AUTH_EXPIRED"}`）—— 若该指标突增，通常意味着凭证换取链路 TTL 配置错位；
- **凭证不落盘**：任何日志/任务表/产物元数据不存凭证明文（现有票据一次性机制保持）。

### 意见七：多租户高并发的凭证缓存（可选优化）

同用户短时间连续导出（如批量导出多个场景）时，避免每次都走 token exchange：导出服务内存级缓存 `userId → 任务凭证`（TTL ≤ 5min，容量上限 + LRU），票据仍然每任务一张。注意：缓存的是**短期任务凭证**而非用户原始凭证，且仅在导出服务进程内存（不进 Redis 等共享存储，防横向扩散）。

---

## 4. 与现有代码的衔接点清单

| 文件 | 改动 | 对应意见 |
|------|------|---------|
| `server/src/exports/exports.controller.ts` | 创建任务时提取请求凭证（cookie 转发 / token exchange） | 一、三 |
| `server/src/claim/claim.controller.ts` | 载荷扩展 `portalContext` + `apiCredential` | 一、二 |
| `server/src/scene/scene.service.ts` | `SCENE_CONFIGS` 增加 `target` 与 real 模式的配置服务拉取 | 五 |
| `server/src/pool/browser-pool.ts` | `withContext` 支持按任务 `addCookies`（方案 A） | 三 |
| `server/src/common/render-error.ts` | `AUTH_EXPIRED` 码，归入不可重试集合 | 四 |
| `print-host/src/claim.ts` | `ClaimResponse` 类型扩展 | 二 |
| `print-host/src/main.ts` | wrapFns 前装配 `$globalVars.$context` + security | 二 |
| `print-host/src/assets.ts` | portalStore 预填；401 拦截（响应拦截包装） | 二、四 |
| `print-host/src/readiness.ts` | 无需改动（`__ASSEM_PDF_ERROR__` 通道已通） | 四 |

## 5. 实施路线建议

| 阶段 | 内容 | 验收 |
|------|------|------|
| P1（打通） | 意见二（portalContext 装配）+ 意见三 A（cookie 转发）+ 意见四（401 fail-fast） | 真实场景导出成功；过期凭证 5s 内失败且错误码正确（非 30s 挂死） |
| P2（收敛） | 意见三 B（token exchange）+ 意见五（配置化切换）+ 意见六（审计字段/指标） | 凭证 TTL ≤ 5min；mock/real 按场景灰度；审计可查 |
| P3（优化） | 意见三 C（D2 预取）+ 意见七（凭证缓存） | 高并发场景吞吐提升；凭证暴露面收敛到服务端 |

---

## 附录：机制出处索引

| 事实 | 位置 |
|------|------|
| 鉴权头注入（6 头 + userName 加密） | `assembox-core-next/src/request/headers.ts:8-28`，常量 `request/constants.ts:35-42` |
| `$context` 类型与默认空值 | `core-next/src/types/global-vars.ts:8-16`、`core/assem-core.ts:57-67` |
| 宿主注入 globalVars 的既有模式 | `new-assembox-editor/src/simulator/iframe/iframe-canvas-renderer.ts:345-351` |
| SecurityConfig（encryptKey/encryptEnabled） | `core-next/src/types/assem-config.ts:14-19` |
| 框架 401+302 → redirectLogin 永不决议 | vendored `js-web-framework.js`（Http 响应拦截） |
| `Http.setHeaders` / `portalStore` 全字段 / `portalPinia` | vendored `js-web-framework.js`（UMD 导出面） |
| usePortalContext 双环境桥接 | `new-assembox-editor/src/scenarios/pc-desktop/hooks/use-portal-context/use-portal-context.ts` |
| 一次性票据 / 任务间上下文隔离（已具备） | `server/src/ticket/ticket.service.ts`、`pool/browser-pool.ts withContext` |
