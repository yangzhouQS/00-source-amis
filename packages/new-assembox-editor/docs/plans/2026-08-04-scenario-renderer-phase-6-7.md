# Phase 6-7 实施计划：编辑器核心接入 ScenarioProfile + 清除旧代码

> ⚠️ assembox-packages-project 禁止 commit。只提交 packages/new-assembox-editor。

**Goal**: 编辑器核心从 amis schema 完全切换到 ScenarioProfile 接口，清除所有旧 amis 代码。

---

## Phase 6 改造点总览

| 模块 | 当前 | 改为 |
|---|---|---|
| Editor 构造 | canvasMode + schema 参数 | scenario 参数 + activate profile |
| Store | PageSchema (amis) | any (由 scenario 决定) + schemaOps |
| DesignerHost | SchemaRenderer (amis) | IRenderer.mount() |
| BemTools | NodeTree.getEl | IRenderer.getNodeElement |
| Dragon/CanvasSensor | NodeTree + 原生查找 | IRenderer.resolveFromElement + nestingRules |
| 组件面板 | ComponentRegistry | IComponentCatalog |
| 大纲树 | amis outline | schemaOps.walk |
| 属性面板 | amis props | __nodeOptions |
| 历史记录 | amis snapshot | schemaOps.cloneSchema snapshot |

## 实施顺序

1. Editor 改造（scenario 接入 + schemaOps 替换 ops）
2. Store 改造（schema 类型 any + commit 走 schemaOps）
3. DesignerHost 改造（IRenderer.mount 替换 SchemaRenderer）
4. BemTools 改造（IRenderer.getNodeElement）
5. Dragon onDrop 改造（schemaOps.insertNode）
6. 组件面板改造（IComponentCatalog）
7. 大纲/属性/历史面板适配
8. 清除旧代码
