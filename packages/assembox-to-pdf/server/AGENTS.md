# AGENTS.md — @cs/assembox-pdf-server

导出服务：NestJS 10 + playwright-core（系统 Chromium，非 Playwright bundled）。上级总览见 `../AGENTS.md`（§4 数据流、§7 断言体系为本包摘要）。

## 源码地图（模块化视角）

```
main.ts                    bootstrap：ValidationPipe(whitelist) / 静态托管 print-host dist / enableShutdownHooks
app.module.ts              模块聚合
exports/                   对外 API：Controller(202 创建/sync 流式/轮询/取消/下载) + Service(幂等指纹/队列满 429)
render/                    RenderService(单任务编排：票据→池→waitForFunction 竞速→page.pdf) + RenderWorker(POOL_CONTEXTS 条消费循环，基础设施错误重试≤2，PAGE_REPORTED 不重试) + pdf-options.ts(printOptions→page.pdf 参数；countPdfPages)
pool/                      BrowserPool：进程×上下文两级 + 信号量 + disconnected 自愈 + 空闲轮换；视口 794×30000(虚拟滚动表格需全量行入渲染区)
queue/                     InProcessQueue(FIFO+取消+深度) + TaskStore(内存任务表/产物落盘/指纹复用/统计) —— 演进 BullMQ 时保持接口
ticket/                    一次性票据(60s TTL，claim 即作废)
scene/                     SceneService：读 json-config + SCENE_CONFIGS 数据驱动装配(mock requestFn 映射、表单 dataModelConfig 初值)
claim/                     /internal/task/claim(宿主页专用) + debug-ticket(调试端点，生产必须移除)
mock/                      mock 业务 API：payments(42)/payments-large(200)/weekly-items(300)；信封 {code,status:'success',result:{count,result}}
health/ metrics/ printhost/ 就绪(池健康+队列未满) / Prometheus 文本 / /print 入口
```

## 关键实现事实

- **渲染等待竞速**：`__ASSEM_PDF_READY__` vs `__ASSEM_PDF_ERROR__`（谓词须返回错误**对象**非 `in` 布尔，jsonValue 取内容）vs 总超时（taskTimeoutMs+2s）。**不用 networkidle**（轮询请求会挂死）
- **countPdfPages 取全部 `/Count` 最大值**：Pages 树嵌套，子树 Count 可能靠前（曾把 13 页误判 8 页引发误诊，smoke 内 `countPages` 同步修复——勿回退成首匹配）
- **幂等指纹**：`sha1(tenantId+sceneId+printOptions+filters)`，10 分钟窗口复用产物；smoke 每轮用唯一 title `runTag` 就是为绕开它
- **错误分类**：`INFRASTRUCTURE_ERROR_CODES`（BROWSER_CRASH/POOL_EXHAUSTED/PAGE_TIMEOUT/RENDER_FAILED）可重试；HOST_LOAD_FAILED/PAGE_REPORTED（业务失败）不重试
- **优雅停机**：`enableShutdownHooks` → BrowserPool.onModuleDestroy 排空关浏览器；后台运行用 `setsid -f /绝对路径/node dist/main.js`（相对 PATH 在会话结束后失效——踩过）
- **表单初值结构**：`SCENE_CONFIGS[].dataModelConfig` 必须含**表层**（模型→表→字段→defaultValue），与 `buildDataModel` 入参一致；场景 JSON 里 `modelName` 为 `模型.表.字段` 三级

## 命令

```bash
pnpm --filter @cs/assembox-pdf-server build          # tsc → dist/
cd packages/assembox-to-pdf/server && node dist/main.js   # 127.0.0.1:9100，配置见 .env.example
node scripts/smoke.mjs                                # 22 项断言；产物 /tmp/kilo/assembox-pdf-smoke-*.pdf

# 手动导出
curl -X POST :9100/api/v1/exports/sync -H 'content-type: application/json' \
  -d '{"sceneId":"weekly-report-scene","printOptions":{"title":"x","orientation":"landscape"}}' -o out.pdf
```

## 排障

- **页数/行数可疑**：先 `pdfinfo` 真实页数 + `pdftotext -layout` 逐页看序号连续性，再交叉验证多列计数（tag/班组列），最后才怀疑渲染——解析层 bug 概率更高（§关键事实第 2 条）
- **PAGE_REPORTED**：看 server 日志 `console.error/pageerror` 行（RenderService 已挂页面诊断）+ 首个失败 requestFn 名
- **同步导出 503 POOL_EXHAUSTED**：正常背压，客户端应改走异步
- **加行高类诊断**：`page.evaluate` 内**不能出现 `document` TS 引用**（server tsconfig 无 DOM lib），用字符串形式传入
- 长任务后进程疑似消失：检查是否被 shell 超时连带杀死（用 setsid -f 脱离进程组）

## 迭代食谱

**加场景**：`scene.service.ts` SCENE_CONFIGS + `mock.controller.ts` 端点 →（场景 JSON 归 json-config，见上级 §9）
**调纸张/页眉页脚**：`render/pdf-options.ts pdfParamsOf`（页眉模板仅 inline style）
**调并发/超时**：`.env`（POOL_CONTEXTS/QUEUE_MAX/TASK_TIMEOUT_MS/BROWSER_RECYCLE_AFTER）
**生产化**：队列/存储按接口换实现；`claim/debug-ticket` 移除或加内网 Guard；`--no-sandbox` 配网络隔离
