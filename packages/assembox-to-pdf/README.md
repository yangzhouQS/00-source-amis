# assembox-to-pdf

assembox 低代码页面服务端 PDF 导出（方案 A：Playwright 无头浏览器 + 专用打印宿主页）。

- 技术调研：`docs/01-服务端PDF导出技术调研报告.md`
- 详细设计：`docs/02-方案A详细设计-Playwright无头浏览器PDF导出.md`

## 包结构

| 包 | 说明 |
|----|------|
| `print-transform/` | 场景打印变换（纯函数，零 DOM 依赖）：剔除交互件、表格全量分页、解除视口约束、Chart 注入 `animation:false`。15 个单测 |
| `print-host/` | 打印宿主页（Vite + Vue 3）：复用 `@cs/assembox-desktop-next` 渲染场景，实现就绪信号协议（请求计数 + 字体/图片 + 图表 canvas 落墨探测 + 打印布局规整） |
| `server/` | 导出服务（NestJS 10 + playwright-core）：任务队列、浏览器池、一次性票据、mock 业务 API（42 行 / 200 行长表） |
| `json-config/` | 测试场景：`single-table-scene`（单表 42 行）、`chart-table-scene`（G2Plot 三图表 + 200 行长表） |

## 快速开始

前置：Node ≥ 18、pnpm、本机 Chromium（`/usr/bin/google-chrome` 或设 `CHROMIUM_EXECUTABLE_PATH`）、
CJK 字体（fontconfig 可发现）。首次需联网下载 vendor 资产（UMD 组件库本地化）。

```bash
# 1. 安装（仓库根）
pnpm install

# 2. vendor 资产本地化（CDN → print-host/public/vendor，仅首次/清单变更时）
pnpm --filter @cs/print-host vendor

# 3. 构建打印宿主页 + 导出服务
pnpm --filter @cs/print-host build
pnpm --filter @cs/assembox-pdf-server build

# 4. 启动导出服务（默认 127.0.0.1:9100）
cd packages/assembox-to-pdf/server && node dist/main.js

# 5. 冒烟（16 项断言：同步/异步导出、分页、行完整性、图表光栅化、幂等、票据、指标）
cd packages/assembox-to-pdf/server && node scripts/smoke.mjs
```

产物示例：`/tmp/kilo/assembox-pdf-smoke-sync.pdf`（3 页 A4 横向，42 行全量，表头跨页重复）、
`/tmp/kilo/assembox-pdf-smoke-chart-table.pdf`（8 页 A4 横向：页 1 含 Column/Pie 并排 + Area 通栏三图表，
其后 200 行长表跨页）。

## 图表支持（G2Plot）

- 运行时：`@antv/g2plot` UMD（`window.G2Plot`，vendor 脚本从 node_modules 复制，离线可用）
- 场景节点：`renderType: "Chart"`，`g2PlotName`（Column/Pie/Area/Line…）、`options`（G2Plot 配置）、
  `data`（静态数据）——见 `json-config/chart-table-scene.json`
- 就绪协议：图表为 canvas 异步渲染（请求计数覆盖不到），settle 阶段轮询 canvas 落墨
  （alpha 通道非全透明）后放行，防止空白截取
- 打印变换：自动向 `options` 注入 `animation: false` 消除动画期截取风险，宽度改 `100%`
- 嵌套约束：Chart 类别为 `element`，只能放进 `YqBox`/`YqFlexBox` 槽位（`YqFlexLine` 仅收
  `lineElement`，放错会被嵌套门禁静默拒绝——`NEST_CATEGORY_NOT_ALLOWED`）

## API

```
POST /api/v1/exports          # 异步：{ sceneId, printOptions? } → 202 { taskId }
POST /api/v1/exports/sync     # 同步：直接流式返回 PDF（小文档）
GET  /api/v1/exports/:id      # 轮询状态 → { status, result{url,pages,bytes}, error, metrics }
GET  /api/v1/exports/:id/file # 产物下载
POST /api/v1/exports/:id/cancel
POST /internal/task/claim     # 宿主页一次性票据消费（内部）
GET  /health/ready /metrics   # 健康与指标
```

`printOptions`：`format / orientation / marginsMm / title / rowLimit(默认1000) / keepNav /
tolerant / dataMode / scale / showPageNumber`（白名单校验，未知字段剥除）。

## 配置

见 `server/.env.example`（端口、Chromium 路径、池并发、队列上限、超时等）。

## 已知约束（测试环境实测）

- 宽表（15 列 ~2200px）在 A4 纵向会被 Chrome 缩放至单页（fit-to-width 行为）；建议横向导出
- biz 底表（table-pro）为虚拟滚动表格：打印上下文用超高视口（794×30000）保证全量行入渲染区
- G2Plot 图表在 PDF 中以光栅图嵌入（Chromium 打印管线对 canvas 的标准行为），文字不可选中
- `获取表格配置失败` console 报错来自 yq-table-setting 请求门户配置接口（本地无该后端），不影响导出
- `/internal/task/debug-ticket` 为调试端点，生产部署必须移除或加内网 Guard

## Element Plus 双表结构的打印修复（实证记录）

底表（el-table 族）为「双表 + scrollbar 包装链」结构，直接打印会产生三个缺陷：表头孤悬页尾
（数据从下一页开始）、表头不跨页重复、包装链内分页异常（空白页/劈行）。根因经二分实验锁定：
**包装链（`.el-table__body-wrapper > .el-scrollbar > …`）阻断 Chromium 的 thead 跨页重复**
——同表移出链外即恢复。修复在就绪协议的打印规整阶段（`readiness.ts` `reparentTablesForPrint`）：

1. header 表的 `colgroup + thead` 合并进 body 表（跨页重复载体 + 列宽对齐）
2. body 表移出包装链直挂打印根，slot 继承组件壳全部类名（保住斑马纹/边框）
3. 隐藏原 `.el-table` 组件壳

验证：8 页文档表头出现 8 次（每页重复）、页 1 表头紧跟首行数据、200 行无劈行（smoke 第 17 项断言锁定）。
