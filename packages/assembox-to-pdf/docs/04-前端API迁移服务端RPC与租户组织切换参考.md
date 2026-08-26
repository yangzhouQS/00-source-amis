# 前端 API 调用迁移服务端 RPC（绕行客户端 CAS）与租户组织后端切换 —— 可行性与实施参考

| 项目 | 内容 |
|------|------|
| 主题 | 将低代码场景的数据面调用从「浏览器 HTTP + CAS 会话」迁移为「服务端 RPC + 传播身份上下文」，并使租户/组织切换完全后端化 |
| 上游文档 | `03-SaaS鉴权与上下文的服务端运行时处理参考.md`（意见三方案 C 的深化）、`02-方案A详细设计` §6.3（D2 预取通道） |
| 性质 | 可行性研究与实施参考（供评审讨论） |
| 验证基线 | 代码事实标注出处；推断性结论显式标注【推断】 |

---

## 0. 现状机制（实证）

### 0.1 认证边界在哪一层

SaaS 后端（NestJS + `@cs/nest-cloud`）的 CAS 认证是 **HTTP 中间件**，全局挂载：

```ts
// examples-yq/node-mb-portal-system/src/controllers/app.module.ts:10-16
configure(consumer: MiddlewareConsumer) {
  consumer.apply(CasClientMiddleware).forRoutes("/*");   // ← 每个HTTP接口都要过CAS
}
```

含义链：
- **鉴权锚点是 HTTP 会话**（CAS 建立的 cookie/ticket），不是方法级注解 —— 脱离 HTTP 通道（进程内/内网 RPC）即天然脱离 CAS 约束面；
- 业务响应统一经 nest-cloud `TransformInterceptor`/`UnifiedExceptionFilter` 包成 `{code,status:'success'|'error',message,result}` 信封（`core-next/request/executor.ts:19-27` 注释实证）；
- 前端请求头（x-org-id/x-tenant-id/x-user-name 等 6 头）由 core-next 从 `$globalVars.$context` 注入（`request/headers.ts:8-28`）——**组织/租户的切换在前端就是换这组头的值**。

### 0.2 前端接口定义的分布（拦截面盘点）

| 调用源 | 位置 | 特征 |
|--------|------|------|
| 场景数据请求 | `dataSource.requestConfig`（url/method/paramsConfig 内联，**无独立接口登记**——编辑器 data-source-pane `doc/types.ts:64,107` 实证） | 主数据面，表格/列表组件消费 |
| 组件字典/配置拉取 | `use-remote-data` 驱动的 Select/Dictionary/table-setting 列配置 | 长尾，静态扫描易漏 |
| 框架级调用 | js-web-framework `Http`/portalStore 引导（门户用户态） | 渲染无关或可预填（doc 03 意见二） |
| 场景事件内裸调用 | `compileFn` 事件字符串里的 `$requestFns`/`$http` | 随场景任意，但 print 态交互件已剔除，实际占比低 |

### 0.3 已具备的承接基础

- **core-next 无 Vue 依赖**：`transformParams`（参数变换）/`executor`（信封剥离）是纯 TS，可直接在 Node 服务端复用 —— RPC 化后**参数装配与响应解析不用重写**；
- 设计文档 §6.3 D2 通道已预留：服务端预取 + `YqTableAsync.exposed.setData` 注入（`assem-yq-table-async.vue:209-227` 实证）；
- doc 03 意见一的身份委托链：任务凭证 ↔ taskId 绑定，为本文件「传播身份上下文」的基础设施起点。

---

## 1. 可行性分析

### 1.1 结论先行

**对「低代码导出数据面」这一特定范围：可行且推荐分级实施**；对「前端全部逻辑 RPC 化」：不推荐（成本失控）。可行的判定依据是调用面**有限可枚举**（0.2 表）且参数装配/信封解析代码**可直接移植**（0.3）。前提条件是平台具备（或愿意建设）内部身份传播基础设施（§4）——这是唯一硬依赖。

### 1.2 收益（针对导出数据面）

| # | 收益 | 说明 |
|---|------|------|
| P1 | 渲染页零凭证 | 数据全部服务端取回注入，print-host 不再携带任何 CAS 会话/任务凭证 —— 比 doc 03 方案 A/B 的暴露面都小，等于方案 C 的彻底形态 |
| P2 | **租户/组织切换后端化**（本分析核心目标） | 浏览器单会话单租户，跨租户批量导出在浏览器侧不可能；RPC 化后目标租户/组织只是 TaskContext 的字段值 + 一次权限复核（§4.3），一个任务可遍历用户有权访问的组织树逐 org 取数 |
| P3 | 长任务免疫会话过期 | CAS 会话过期不再影响在途任务（身份是签名的任务上下文，不是会话）；doc 03 意见四的 AUTH_EXPIRED 挂死问题在数据面彻底消失 |
| P4 | 性能与确定性 | 内网 RPC/内网 HTTP 重放省去 cookie 解析与中间件链；参数在服务端装配，结果确定性 = D2 的全部收益（渲染期零业务请求，见 02 文档 §6.3 对比表） |
| P5 | 审计集中 | 全部取数调用发生在服务端，可统一记账（浏览器侧取数则审计分散在前端与网关两处） |

### 1.3 代价与风险

| # | 风险 | 等级 | 缓解 |
|---|------|------|------|
| C1 | **授权锚点重建**：业务服务目前信任 CAS 中间件注入的身份；RPC 通道必须让服务接受「内部签名的传播身份」，需要平台级信任设施（内部 JWT/mTLS + 网关放行内网路由） | 高（硬依赖） | 分级：L1 先走「内网 HTTP 重放 + 服务签名头」（多数 nest-cloud 部署可加白名单内网路由），L2 再上完整内部 JWT（§3.3） |
| C2 | **端点→RPC 映射非 1:1**：controller 里可能有参数加工/权限判断/组织过滤；跳过 controller 直调 service 会漏逻辑（胖控制器陷阱） | 高 | 映射策略三级（§2.3）；L1 不跳 controller 无此问题；L2 只对「瘦控制器」开 RPC，胖的保持 HTTP |
| C3 | 参数装配依赖客户端状态：`transformParams` 读 `$dataModels`（如筛选条件、表单值）——服务端需重建同份数据模型快照 | 中 | 已有先例：server `SCENE_CONFIGS.dataModelConfig` 重建表单初值（周报场景实测）；筛选参数随任务 filters 下发合并 |
| C4 | 部署耦合：导出服务需持有各业务服务的 RPC 客户端/SDK，接口版本漂移 | 中 | L1 无 SDK 依赖；L2 经平台统一 codegen；契约测试纳入 CI |
| C5 | CAS 审计断链：绕行后 CAS 侧看不到这些调用 | 中 | 导出服务自建审计事件（§4.5），字段对齐 CAS 审计格式便于合规合并 |
| C6 | 长尾调用漏映射（字典/组件配置类） | 中 | 双模式兜底（§3.5）：未映射 requestFn 自动回落 D1 浏览器通道；运行时观测补齐登记表 |

### 1.4 不迁移清单（明确出界）

- 交互态写操作（增删改）：print 态已剔除交互件，无写调用；
- 门户登录/用户态引导：portalStore 预填解决（doc 03 意见二）；
- 场景事件内裸 `$http` 调用：随交互件剔除，不进迁移面。

---

## 2. 拦截与映射策略（Interception Strategy）

### 2.1 静态盘点：构建端点登记表（Endpoint Registry）

数据源是场景 JSON 本身。导出服务离线/启动时采集：

```
for scene in json-config / 配置服务场景库:
  for (name, rc) in scene.dataSource.requestConfig:
    registry.insert({
      sceneId, requestFn: name,          // 如 queryPayments
      http: { url: rc.url, method: rc.method, paramsConfig: rc.paramsConfig },
      rpcTarget: null,                    // 待映射（2.3）
      contextPolicy: { orgScoped: rc.paramsConfig?.paginationParams?.fixedConditions?.some(c=>c.fieldName==='orgId') }  // 【推断】按参数特征标记组织域
    })
```

产出物 `EndpointRegistry` 是后续一切的地基（映射、兜底判断、审计）。

### 2.2 运行时对账（静态盘点兜底）

静态扫描漏字典类长尾。过渡期在 D1 通道加网络捕获：RenderService 已挂 `page.on('console')`，同点位挂 `page.on('request')` 把实际出站请求（URL/方法/头/参数）回写对账日志，与 Registry diff 即发现未登记端点 —— 这是**一次性对账工具**而非长期机制。

### 2.3 HTTP → RPC 三级映射

| 级别 | 机制 | 映射成本 | 适用 |
|------|------|---------|------|
| **L1 内网 HTTP 重放**（零改造） | Registry 存 `http.url`；执行器在服务端重放同一 HTTP 请求，但：① 走内网域名/端口（不过 CAS 中间件的路由，或网关对内网服务身份放行）；② 头部注入改为「服务签名 + 传播身份」（§4.2） | 仅登记 URL | 起步期全量适用；**不存在胖控制器问题**（controller 逻辑原样执行） |
| **L2 service 层 RPC** | Registry 增加 `rpcTarget: { service, method }`（按 Nest 路由元数据 `RouterExplorer` 映射表生成，或业务方按模块登记）；导出服务持类型化客户端 | 每端点一条映射 + SDK | 瘦控制器（controller 只做 DTO 校验转发）；性能敏感高频端点 |
| **L3 进程内合并** | 导出服务并入业务服务集群为模块，DI 直调 | 架构级 | 仅当平台整体收敛部署时评估 |

**建议 L1 全量起步 → 按热度和稳定性挑 L2**。L1 与 L2 可共存（Registry 每条目独立标级），迁移是逐端点的渐进过程而非开关。

---

## 3. 实施工作流（Implementation Workflow）

### 3.1 组件设计（导出服务内新增 DataPlane 模块）

```
server/src/dataplane/
├── task-context.ts      # TaskContext 铸造/校验：{taskId, userId, tenantId, orgId, permissions[], orgSwitchScope[], exp} + 内部签名
├── endpoint-registry.ts # 端点登记表（静态采集 + 运行时对账回填）
├── rpc-executor.ts      # 按登记级别分派：L1 内网重放（axios + 信封解析）/ L2 类型化客户端
├── param-assembler.ts   # 复用 core-next transformParams（纯 TS 直接 import）+ 任务 filters 合并
└── injector.ts          # 预取结果 → claim 载荷 __INITIAL_DATA__ / 渲染后 setData 注入
```

### 3.2 执行序列（单任务）

```
业务前端 ──POST /exports（携用户 CAS 会话/网关 token）──▶ 导出服务
   │ ①验证调用者（唯一一次过 CAS/网关），铸造签名 TaskContext
   │ ②EndpointRegistry 查该场景全部 requestFn
   │ ③逐端点：param-assembler（dataModels 快照 + filters）→ rpc-executor
   │        L1: 内网HTTP重放（服务签名头 + 传播身份头）
   │        L2: RPC客户端调用（同一身份透传）
   │        业务服务: 校验内部签名 → 按(用户, 目标租户/组织)复核权限 → 执行 → 信封返回
   │ ④injector: 结果并入 claim 载荷 __INITIAL_DATA__
   ▼
渲染（BrowserContext，零凭证）：表格 autoLoad:false + setData 注入；图表数据场景内静态
   ▼
page.pdf() → 产物（签名URL，已有）
```

关键点：**CAS 边界只在第 ① 步被穿越一次**（用户真实会话验证调用者），此后数据面全部走内部信任通道；渲染页彻底无凭证。

### 3.3 组织/租户切换（后端化核心场景）

- TaskContext 含 `orgSwitchScope: string[]`（用户可达组织集合，铸造时向组织服务查询并快照）；
- 单任务单次导出想切 org：`printOptions.orgOverride`（值必须在 scope 内）→ rpc-executor 对每次调用注入目标 orgId 头并**逐调用复核**该 org 权限；
- 批量跨 org：任务层循环 `for org of scope` 复用同一 TaskContext 派生 org 子上下文，逐 org 取数渲染合并 PDF（或每 org 一份）—— 浏览器单会话做不到的形态；
- 租户切换同理但更严：仅允许平台运维侧预授权的跨租户任务（`tenantSwitchScope`），默认禁止。

### 3.4 渲染页配合改动

| 文件 | 改动 |
|------|------|
| `print-host/src/claim.ts` | `ClaimResponse` 扩展 `initialData` |
| `print-host/src/main.ts` | D2 路径：场景经 print-transform 时表格置 `autoLoad:false`，claim 后逐表 `getNode(id).exposed.setData(data)`（暴露 API 已实证可用） |
| `server/src/scene/scene.service.ts` | `SCENE_CONFIGS` 条目 `target: 'mock'|'http-replay'|'rpc'`（L1/L2 与 mock 三态并存） |
| `server/src/render/render.service.ts` | `dataMode:'prefetch'` 时先走 dataplane 再渲染（02 文档 §7.3 编排点前插一步） |

### 3.5 渐进路线与兜底

| 阶段 | 内容 | 兜底 |
|------|------|------|
| DP-1 | TaskContext 基建 + Registry 静态采集 + L1 重放打通 1 个场景 | 未映射端点自动回落 D1（浏览器通道，凭证按 doc 03 方案 A/B） |
| DP-2 | 运行时对账补齐登记表；orgOverride + 权限复核；审计事件 | 字典类长尾端点仍可 D1 |
| DP-3 | L2 RPC 热点端点；跨 org 批量任务；租户白名单机制 | L1 永远可用作降级通道 |

---

## 4. 安全与上下文管理（Security & Context Management）

### 4.1 信任锚点迁移

CAS 会话（浏览器持有）→ **签名的 TaskContext**（导出服务铸造、业务服务可验）。要求：

- 内部签名采用平台级密钥（HMAC/JWT），密钥仅存在于服务端密钥管理，支持轮换与吊销；
- TaskContext 短时效（任务超时 + 缓冲），audience 绑定（仅业务服务集群可验可用）；
- 有条件时叠加 mTLS：内网通道双向认证，签名头防伪造、mTLS 防劫持，双层防线。

### 4.2 混淆代理人（Confused Deputy）防护 —— 最关键

导出服务以自身身份发起调用但携带用户上下文，业务服务**绝不能因「调用方是可信服务」就跳过用户级权限判断**：

1. 业务侧新增内部调用校验（如 `@InternalActor()` 守卫）：验签名 → 提取 `(userId, tenantId, orgId, permissions)`；
2. **每次调用**按传播身份做权限判断（与 CAS 中间件对本会话用户做的事完全等价，只是身份来源从会话变为签名声明）；
3. org 切换目标必须落在 `orgSwitchScope` 内（铸造时快照），越界即拒（`PERM_DENIED`，不产出部分数据）；
4. 行/列级数据权限在 RPC 时服务端求值 —— 渲染页无凭证也无权限语义，绝不依赖前端过滤（print-transform 的 permissionSetting 处理仅是显示层）。

### 4.3 会话完整性

- 发起用户的 CAS 会话只被**读取验证一次**（任务创建），不被复制、不被延续 —— 会话登出/过期不影响已铸造任务（有意的解耦，TTL 兜底）；
- 渲染上下文（BrowserContext）零凭证：数据注入是纯数据，页面无法反查任何可重放的鉴权材料；
- 产物访问 = 已有的签名 URL（24h TTL），与身份链解耦但有审计关联（taskId 贯穿）。

### 4.4 上下文生命周期

```
铸造（任务创建）→ 快照（permissions/orgScope 冻结，任务期不随用户权限变化漂移）
  → 使用（每次RPC逐调用校验）→ 销毁（任务终态即失效，TTL兜底）
```

权限快照的取舍：任务期内用户被降权不会中断在途任务（快照语义）；若平台要求实时回收，增加「任务执行前重查权限」选项（代价是每次 RPC 多一次权限服务往返，建议仅租户切换场景开启）。

### 4.5 审计与监控

- 每 RPC 调用记录：`{taskId, actorUserId, targetTenantId, targetOrgId, service, method, duration, result}` → 审计 sink（字段与 CAS 审计对齐，合规侧可合并报表）；
- 指标新增：`dataplane_rpc_total{level=L1|L2, result}`、`dataplane_perm_denied_total`、`org_switch_total`；
- 异常告警锚点：`perm_denied` 突增 = scope 快照过期或映射错配；`fallback_d1_total` 增长 = 登记表欠账。

---

## 5. 结论

1. **可行，但限定范围**：低代码导出数据面（requestFn 可枚举 + core-next 参数/信封代码可移植）适合迁移；泛化到全前端 RPC 不经济（C2/C4 失控）。
2. **唯一硬依赖是内部身份传播设施**（内部签名 + 业务侧等价权限复核）。没有它，「绕行 CAS」就退化成「无鉴权内网裸奔」，不可接受；有它，CAS 边界从「每请求」收缩为「任务创建一次」，是安全模型的收敛而非削弱。
3. **租户/组织后端切换是该架构的自然产物**：org/tenant 从会话属性（不可变）变为 TaskContext 字段（可校验地重设），解锁跨组织批量导出等浏览器侧不可能的形态。
4. **落地路径**：L1 内网重放起步（零业务改造）→ 登记表对账 → L2 热点 RPC → 跨 org 批量；D1 浏览器通道全程保留为兜底，迁移是渐进收敛而非切换。

---

## 附录：事实出处索引

| 事实 | 位置 |
|------|------|
| CAS 为全局 HTTP 中间件 | `examples-yq/node-mb-portal-system/src/controllers/app.module.ts:10-16` |
| nest-cloud 信封拦截器语义 | `assembox-core-next/src/request/executor.ts:19-27`（注释） |
| 鉴权头注入与 $context 数据源 | `assembox-core-next/src/request/headers.ts:8-28`、`types/global-vars.ts` |
| requestConfig 内联无独立登记 | `new-assembox-editor/src/plugins/data-source-pane/doc/types.ts:64,107` |
| transformParams/executor 为 Vue-free 纯 TS（可服务端复用） | `assembox-core-next/src/request/transform.ts`、`executor.ts`（包无 Vue 依赖） |
| YqTableAsync setData/autoLoad 暴露（D2 注入口） | `assembox-desktop-next/src/components/.../assem-yq-table-async.vue:209-227` |
| 数据模型快照重建先例 | server `scene.service.ts` `SCENE_CONFIGS.dataModelConfig`（周报场景实测） |
| 身份委托/一次性票据基础 | `docs/03-*.md` 意见一；`server/src/ticket/ticket.service.ts` |
