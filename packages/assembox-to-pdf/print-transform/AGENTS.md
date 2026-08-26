# AGENTS.md — @cs/print-transform

场景打印变换库：将运行态场景 JSON 变换为打印友好场景。**纯函数、零 DOM 依赖**，可在任何 Node/浏览器环境运行。上级总览见 `../AGENTS.md`（§5 为本包摘要）。

## 职责边界

| 做 | 不做 |
|----|------|
| 剔除交互件（工具栏/按钮/筛选器/上传/开关/弹层） | 数据获取（表格仍走 requestFn，只是分页改全量） |
| `YqTableAsync` 分页改写 `{currentSize: rowLimit, pageSizes:[rowLimit], layout:'total'}` | CSS 层面的事（归 `print-host/src/print.css` 与 readiness 规整） |
| Chart 注入 `animation:false`（**并入 `options`**，非节点属性）与 `width:'100%'` | 图表数据变换（静态 `data` 原样透传） |
| `YqBox/YqPanel/根布局` 解除 `height:'100%'` 视口约束 | DOM 重排（thead 合并/表格重挂在 readiness.ts） |
| 未知 renderType 透传 + `stats.unknownRenderTypes` 上报 | 剔除（前向兼容：新组件不丢内容） |

## 源码地图

- `src/transform.ts` — `transformForPrint(scene, options)` 主入口 + `collectRenderTypes`（测试辅助）。遍历策略是**通用深走查**：任何带 `__nodeOptions.renderType` 的对象即渲染节点，槽位属性自动覆盖，无需逐组件定义访问路径
- `src/known-types.ts` — `KNOWN_RENDER_TYPES`（**唯一真相源是 desktop-next `src/components/manifest.ts` 的 COMPONENTS**，新组件合入 desktop-next 后必须同步此处）+ `REMOVE_RENDER_TYPES` 剔除表
- `src/options.ts` — `PrintTransformOptions`（rowLimit/keepNav）与 `TransformStats`
- `test/transform.test.ts` — 对 `../../json-config/*.json` 真实场景断言（读 `.uiSkeleton` 键），含幂等/纯函数守卫

## 不可破坏的契约

1. **纯函数**：绝不修改输入场景（测试有 `JSON.stringify` 前后比对守卫）
2. **函数安全深克隆**：`deserializeScene` 后事件已是函数，`structuredClone` 会抛错——用自研 `deepClone`（函数按引用共享，本库不改动它们，安全）
3. **幂等**：重复变换结果一致（剔除类天然幂等；改写类只写固定值，勿改成增量逻辑）
4. 语义陷阱：动画开关是 G2Plot 配置项——`assem-chart.vue` 只透传 `options`，写在节点级不生效（曾踩过）

## 命令

```bash
pnpm --filter @cs/print-transform test        # vitest（当前 20 项）
pnpm --filter @cs/print-transform typecheck   # tsc --noEmit
```

无构建步骤：`package.json` 的 `main` 直指 `src/index.ts`（print-host 经 Vite 直接编译源码）。改完必须 test + typecheck 双绿，再触发 print-host 侧验证（若规则影响布局）。

## 迭代食谱

**新增剔除/改写规则**：`known-types.ts` 确认类型登记 → `transform.ts` `transformNode` 加分支（剔除 return null；改写后继续走查槽位）→ 测试加真实场景断言 → 更新 `../AGENTS.md` §5 摘要。

**加新测试场景的联动**：`json-config/` 新增场景后，在 `test/transform.test.ts` 加 describe 块（fixture 模式见现有 weekly-report 用例），断言剔除数/表格改写/chartRewrites 统计。
