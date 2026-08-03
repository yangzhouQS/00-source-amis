# pnpm Monorepo 改造设计

## 目标

将 `00-source-amis`（原 lerna/npm-workspaces 管理的 amis 源码目录）改造为纯 pnpm 管理的 monorepo，移除全部 lerna 配置。

## 纳入清单（18 个包）

| 分组 | glob 路径 | 包名 |
|------|-----------|------|
| amis 核心 (10) | `packages/*` | amis, amis-core, amis-editor, amis-editor-core, amis-formula, amis-theme-editor-helper, amis-ui, office-viewer, vite-plugin-amisr, @cs/new-assembox-editor |
| Vue 示例 (2) | `vue3-examples`, `packages-vue` | vue3-scoped-demo, amis-editor-vue |
| assembox libs (5) | `assembox-packages-project/libs/*` | @cs/assembox-core-next, -desktop-next, -editor-next, @cs/code-generator, @cs/assembox-dsl-kit |
| assembox apps (2) | `assembox-packages-project/apps/*` | node-mb-assembox-demo-system, assembox-builder |
| 示例应用 (1) | `examples-yq/node-mb-portal-system` | node-mb-portal-system |

## 关键决策

### amis 包内部互引：方案 A（link-workspace-packages）

amis 各包用版本号互引（`amis-core: ^6.13.0`、`office-viewer: *`）。采用 `.npmrc` 的 `link-workspace-packages=true`，让 pnpm 在版本匹配时自动链接本地包，**零改动** amis package.json，保留上游合并能力。

### assembox 内部链接：保留 workspace:*

core → desktop → editor → dsl-kit → demo 的 `workspace:*` 互引两端都在 monorepo 内，天然成立，无需改动。

### 外部 @cs/* 依赖：移除/改版本号

- `node-mb-portal-system` 的 `@cs/vue3-biz-components-library: workspace:*` → `^0.1.2`
- 其余外部 @cs/*（better-print、element-pro、table-pro、nest-* 等）本就是版本号，保持不变，从 registry 解析。

### 嵌套 workspace 冲突：保留为独立子 monorepo

经实验验证，pnpm 按目录就近选 workspace root：从 `assembox-packages-project` 内执行 pnpm 命令时只识别内层 8 个项目，会另建 lockfile 造成漂移。因此决定 **保留 `assembox-packages-project/pnpm-workspace.yaml`，但从父级 glob 移除 assembox 包**。

最终结构为两个独立 pnpm monorepo 共存：
- **父级** `00-source-amis`：管理 `packages/*`、`vue3-examples`、`packages-vue`、`examples-yq/node-mb-portal-system`（14 项）
- **子级** `assembox-packages-project`：自含完整 workspace（`libs/*` + `apps/*`，8 项），可随时整体移走独立开发

两者各自 `pnpm install`，无嵌套歧义。

## 改造步骤

1. 新建 `00-source-amis/pnpm-workspace.yaml`（4 类 glob：packages/*、vue3-examples、packages-vue、examples-yq/node-mb-portal-system）
2. 保留 `assembox-packages-project/pnpm-workspace.yaml`（独立子 monorepo）
3. 修改根 `package.json`：删 npm `workspaces` 字段，新增 `packageManager: pnpm@10.0.0`，`--workspaces` 脚本改 `pnpm -r`
4. 合并 `.npmrc`：加 `link-workspace-packages=true`，并入 only-built-dependencies
5. 修复 `node-mb-portal-system` 外部 workspace 依赖
6. lerna.json：已删除（lerna 与 pnpm 不兼容，全部改用 pnpm 原生命令：`pnpm version`、`pnpm publish -r`；devDependencies 移除 `lerna`）

## 验证

- 父级 `pnpm install` 成功，`pnpm ls -r` 列出 14 项（含 amis/vue/portal）
- assembox 独立 `pnpm ls -r`（从内层目录）列出 8 项，无嵌套歧义
- `@cs/assembox-desktop-next` 软链指向本地 `@cs/assembox-core-next`
- amis 的 `amis-core` 依赖自动链接本地包（`link-workspace-packages=true` 生效）
