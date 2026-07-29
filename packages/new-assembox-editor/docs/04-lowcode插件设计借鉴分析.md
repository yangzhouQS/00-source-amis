# LowCode-Engine 插件设计借鉴分析

> 研究对象：`01-lc/lowcode-plugins/packages` 下 17 个阿里 lowcode-engine 官方插件（React 技术栈）
> 目标：提炼可迁移到本项目（new-assembox-editor，Vue3 + 自研内核）的设计理念与功能点，给出落地建议
> 结论先行：本项目**插件骨架与画布拖拽已对标**；主要差距在**面板能力深度**（搜索/区块/数据源/源码/Monaco/多视图）与**若干架构模式**（元数据管线、错误边界、状态机、懒加载）。

---

## 一、本项目现状对标

| 能力域 | 本项目现状 | lowcode 对应插件 |
|---|---|---|
| 插件契约 | `EditorPlugin`（contributes: components/setters/actions/assets/skeleton）+ `PluginManager` | 所有插件的四段式 factory |
| 骨架插槽 | `Skeleton`（7 个 area + Widget/Panel/PanelDock） | skeleton.add |
| 组件面板 | `components-pane`（group/category 分组、点击/拖拽、**无搜索/无优先级/单 scaffold**） | plugin-components-pane |
| 大纲面板 | `outline-pane` | — |
| Schema 面板 | `schema-pane`（**纯 JSON 文本展示**） | plugin-schema / plugin-code-editor |
| 设置面板 | `settings-pane`（PropConfig → setter 推断） | set-ref-prop / datasource 表单 |
| 历史面板 | `history-pane`（列表）+ `EditorStore.history`（**全量 clone ×50**） | plugin-undo-redo |
| 拖拽引擎 | `Dragon`（自模拟，跨 iframe，已重构） | dragon.from |
| 画布 | iframe 隔离渲染 + inline 模式 | simulator |
| 撤销重做 | `store.undo/redo`（全量快照） | document.history |
| **缺失** | 组件搜索、区块/模板、数据源、Monaco 源码编辑、设备尺寸、多视图/多窗口、元数据管线、错误边界 | components-pane 搜索 / block+action-block / datasource / code-editor / simulator-size / view-manager+resource-tabs / set-ref-prop / ErrorBoundary |

---

## 二、lowcode-engine 插件设计范式（提炼）

### 范式一：面板型插件（占多数）
```
factory(ctx) → { name, dep, exports, init(ctx) }
  init() 内：ctx.skeleton.add({ area, type: PanelDock|Widget, name, content, props })
  + 监听生命周期事件（onSimulatorRendererReady / onShowPanel）
  + contentProps 透传引擎能力（project/event/setters）
```
**关键模式**：①注册后立即 `disable()`，渲染器就绪才 `enable()`（门控）；②`onShowPanel` 懒加载、`onHidePanel` 自动保存；③错误边界兜底 + resetKey 恢复。

### 范式二：管线型插件（无 UI）
```
material.registerMetadataTransducer(fn, priority, name)
  → 在组件元数据加载时按 priority 流经各 transducer，无侵入增强元数据
material.addBuiltinComponentAction(desc)
  → 声明式给所有组件悬浮工具栏加动作（控制反转）
```
**关键模式**：声明式描述符（数据驱动 UI），引擎主导渲染，插件只提供行为。

### 跨插件通用模式
- **数据归属分离**：纯视图型插件（resource-tabs/view-manager）不自持状态，数据来自 engine workspace，只做投影
- **事件总线解耦**：插件间用自定义事件协作（`BlockChanged` / `codeEditor.focusByFunction`）
- **Hook 工厂**：`Map<key, fn[]>` 极简发布订阅（本项目 `Dragon.on` 已采用此模式）
- **i18n Text 抽象**：`string | {type:'i18n', zh_CN, en_US}` + reader

---

## 三、借鉴建议（按优先级）

### P0｜架构优化（优化现有，低风险高收益）

#### P0-1 元数据转换管线（借鉴 set-ref-prop）
**现状**：`ComponentRegistry.register` 直接存 meta，无转换阶段；设置通用字段（如 ref/key/data-id）需每个组件 meta 手动声明。
**lowcode 设计**：`material.registerMetadataTransducer(fn, priority, name)`——组件 meta 加载时按 priority 流经管线，插件可无侵入给所有组件注入字段（refId 默认值、统一分组、隐藏字段）。
**落地建议**：
- `ComponentRegistry` 增加 `transducers: Array<{fn, priority, name}>` + `registerMetadataTransducer(fn, priority, name)`
- `get(type)` / `resolve(node)` 返回前，按 priority 升序应用所有 transducer 生成最终 meta（缓存）
- 内置一个 transducer：自动为非根组件注入 `ref` 字段（StringSetter，默认 `${type}-${短id}`）到"高级"分组
- **收益**：插件可统一增强物料（埋点 id、权限标记、运行时 ref），无需改组件定义

#### P0-2 声明式组件动作（借鉴 action-block）
**现状**：节点工具栏动作硬编码在 `BemTools`（上移/下移/复制/删除）。
**lowcode 设计**：`material.addBuiltinComponentAction({name, content:{icon,title}, action(node), important})`——引擎遍历协议自动渲染按钮，插件只描述行为。
**落地建议**：
- `ComponentRegistry` 增加 `builtinActions: ComponentAction[]` + `addBuiltinComponentAction(desc)`
- `BemTools` 工具栏改为遍历 `builtinActions` + 节点 meta 自定义 actions 渲染
- 第一个落地动作："保存为区块"（见 P1-2）
- **收益**：工具栏可扩展，业务方按需加动作（埋点预览、数据绑定、跳转）

#### P0-3 历史位掩码状态（借鉴 undo-redo）
**现状**：`EditorStore.history` 全量 clone ×50，无 canUndo/canRedo 标志位（history-pane 无法精确显示按钮可用态）。
**lowcode 设计**：`history.getState()` 返回数值，`state & 1`=可撤销、`state & 2`=可重做。
**落地建议**：
- `EditorStore` 暴露 `historyState`（位掩码 getter），UI 据此禁用/启用按钮
- 顺势优化历史为**增量 patch**（记录 mutator 或 JSON-patch），替代全量 clone（解决大 schema 内存压力，对应上一轮分析的性能项）
- **收益**：按钮态准确 + 历史内存降一个量级

#### P0-4 错误边界（借鉴 datasource/code-editor）
**现状**：无错误边界，单组件渲染抛错会白屏。
**lowcode 设计**：面板包 `ErrorBoundary`，崩溃显示 Fallback + "刷新"按钮，用 `resetKey` 强制 remount 恢复。
**落地建议**：
- 封装 `<ErrorBoundary>` 组件（Vue3 `onErrorCaptured` + 渲染 fallback + `key` 重挂）
- 包裹各 pane（settings-pane/schema-pane/components-pane）与画布 iframe 宿主
- **收益**：局部崩溃不拖垮整个编辑器

#### P0-5 面板懒加载（借鉴 schema/datasource/code-editor）
**现状**：所有面板常驻渲染，schema-pane 持续占用。
**lowcode 设计**：`onShowPanel` 才 pull 最新数据（惰性），`onHidePanel` 自动保存。
**落地建议**：
- `Skeleton` 的 `Panel`/`PanelDock` 增加 `onActive`/`onDeactive` 生命周期回调（现有 `WidgetContainer` 已有 active 概念，补 hook）
- schema-pane 改为激活时才导出 schema、失活时自动回写
- **收益**：减少常驻面板开销，避免无关面板的持续监听

---

### P1｜能力补齐（缺失的核心功能）

#### P1-1 组件面板增强（借鉴 components-pane）
**现状**：`components-pane` 仅 group/category 分组，无搜索、无优先级、单 scaffold。
**lowcode 设计**：
- **transform 转换层**：资产包 → 统一 Group→Category→Component 三级树，用 `pipe` 函数管道归一化（兼容多协议）
- **优先级反向排序**：`priority = list.length - index`，资产声明顺序即面板顺序
- **Snippet 多态**：一组件多套初始 schema，拖拽用全局唯一 id 查表
- **搜索去抖**：`debounce(200ms)`，匹配 `title#name#description#keywords`，过滤保留分组结构
**落地建议**：
- 新增 `registry/material-transform.ts`：`transformMetas(metas) → GroupTree`，优先级排序 + 分组
- `ComponentMeta` 增加 `snippets?: Scaffold[]`（替代单一 `scaffold`），`ComponentRegistry.createNode(type, snippetId?)` 按 id 取 scaffold
- `components-pane` 增加搜索框（debounce）、保留 group 包裹过滤
- **收益**：组件多、搜索体验、多模板场景

#### P1-2 区块/模板系统（借鉴 plugin-block + action-block）
**现状**：无区块复用能力。
**lowcode 设计**：**生产消费闭环**——action-block 对选中节点 `html2canvas` 截图 + `JSON.stringify(schema)` 存库；plugin-block 列表面板 + 拖拽落料（`dragon.from` + `data-id` 查 store）。区块实体 = `{id, title, screenshot, schema(JSON 字符串)}`。
**落地建议**：
- 定义 `BlockMeta { id, title, screenshot, schema: string }`
- 生产侧：P0-2 的"保存为区块"动作 → `html2canvas(node.el)` 截图 + `editor.getSchema()` 序列化 → 存入 `BlockRegistry`（内存/localStorage/远程）
- 消费侧：新增 `block-pane`（PanelDock），卡片列表 + Dragon 拖拽源（复用现有 `dragon.from`/`startNodeDrag`）
- 拖入时 `editor.insert` 反序列化的 schema（`cloneNode` 重分配 id）
- **收益**：用户沉淀复用结构，提升搭建效率

#### P1-3 设备尺寸/预览（借鉴 simulator-size）
**现状**：`EditorStore.state.platform`（desktop/mobile）仅标识，无设备预设 UI、无画布缩放。
**lowcode 设计**：顶栏 Widget，设备预设表 `[{key:'default'},{key:'tablet'},{key:'phone'}]` + `NumberPicker` 自定义宽度；数据层切 device、CSS 层 `.device-{key}` 自适应。
**落地建议**：
- `EditorStore` 增加 `device: { key, width }` 状态
- 新增 `simulator-size` 插件（顶栏 Widget）：预设表 + 宽度输入
- 画布宿主（iframe-designer-host）根据 `device.width` 设置 iframe 宽度 + 居中
- **收益**：响应式预览、多端设计

#### P1-4 Monaco 源码编辑 + schema 双向同步（借鉴 base-monaco-editor + code-editor）
**现状**：`schema-pane` 是纯 JSON 文本，无语法高亮、无校验、无双向编辑。
**lowcode 设计**：
- **base-monaco-editor**：异步单例加载器（`getSingletonMonaco` 闭包缓存）、`useEditor` Hook 封装时序、受控更新用 `executeEdits` 替代 `setValue`（**防光标跳动**）、多模型 `Map<path, viewState>`
- **code-editor**：schema ⇄ code 双向（Babel parse AST 遍历 ClassMethod 提取 state/methods/lifeCycles）、`onShowPanel` 拉取、`onHidePanel` 回写、Babel 实时校验 + monaco 装饰器报错
**落地建议**（分阶段）：
- **阶段一**：引入 `monaco-editor` + 封装 `useMonaco` composable（异步单例 + 受控更新防光标），替换 schema-pane 的 textarea 为 Monaco JSON 编辑器（高亮 + Ctrl+S 回写 + JSON 校验）
- **阶段二**：schema ⇄ Vue SFC/JS 双向（Vue3 场景适配：转 `<template>` + `setup`）
- **收益**：专业源码编辑、调试后门、高级用户提效

#### P1-5 数据源面板（借鉴 datasource-pane）
**现状**：无数据源概念。
**lowcode 设计**：**xstate 状态机驱动**复杂面板（idle/detail.create|edit|view|import|export）、formily + JSONSchema 动态表单、CRUD + 拖拽排序 + 过滤、整体导出→局部改→整体导入持久化、插件化类型扩展。
**落地建议**：
- schema 增加 `dataSource?: DataSource[]` 字段（`{id, type, options}`）
- 新增 `datasource-pane`：用有限状态机（Pinia + 状态枚举或引入 xstate）驱动 CRUD UI
- 数据源类型可扩展（`DataSourceType {type, schema, formFields}`），内置 fetch/jsonp
- **收益**：页面级数据管理，低代码核心能力

#### P1-6 多视图/多窗口（借鉴 view-manager-pane + resource-tabs）
**现状**：单文档（单 schema），无多页面/多窗口管理。
**lowcode 设计**：`workspace.resourceList` + `windows`（窗口投影）；view-manager 纯视图（列表→分组→递归树 + 三层右键外置）；resource-tabs 组件自治监听 + localStorage 会话恢复。
**落地建议**（较重，按需）：
- 引入 `Project { resources: Resource[], activeWindow }` 概念，Editor 关联当前 window
- `resource-tabs`（subTopArea Widget）：窗口投影 + 关闭未保存确认 + 会话恢复
- `view-manager-pane`：resource 树 + 三层右键菜单外置（options 回调注入）
- **收益**：多页面/多组件编排，从"单页编辑器"到"应用编辑器"

---

### P2｜架构级增强（远期）

#### P2-1 三层架构（Controller/Store/Service）（借鉴 multiple-editor）
**现状**：`Editor` 门面聚合所有子系统，逻辑集中。
**lowcode 设计**：Controller（命令式，命令中心）+ Context/Store（声明式 UI 状态）+ Service（扩展注册中心，tapable 风格）三层分离。
**落地建议**：复杂面板（如未来的 datasource、code-editor）采用此分层；`Editor` 保持门面，内部大模块拆 Controller + Store。

#### P2-2 通用 Hook 工厂（借鉴 multiple-editor）
**现状**：`Dragon.on` 已用 `Map<key, fn[]>` 多订阅。
**lowcode 设计**：`hookFactory(key)` → 注册函数 + `Map<string, fn[]>` + `triggerHook`，极简发布订阅基类。
**落地建议**：抽取 `utils/hook-factory.ts`，`EventBus`、`Dragon`、未来 Service 统一复用。

#### P2-3 i18n Text 抽象（借鉴 components-pane）
**现状**：文本硬编码中文。
**lowcode 设计**：`Text = string | {type:'i18n', zh_CN, en_US}` + `getTextReader(lang)`。
**落地建议**：meta 的 name/title/description 支持 i18n Text 类型，`getNodeLabel` 等统一经 reader 读取。

#### P2-4 标准化插件契约（借鉴全部插件）
**现状**：`EditorPlugin` 有 contributes，但缺 `pluginName`/`dep`/`exports`/`preferenceDeclaration`。
**lowcode 设计**：`{pluginName, dep:[], exports(), init(ctx), preferenceDeclaration}`。
**落地建议**：`EditorPlugin` 接口补 `pluginName`、`dep`（依赖插件名）、`preference`（配置声明）；`PluginManager.activate` 按 dep 拓扑排序。

---

## 四、优先级实施路线图

```
P0（架构优化，1-2 周，低风险）
  ├─ P0-3 历史位掩码 + 增量 patch（顺带解决性能项）
  ├─ P0-4 错误边界（包裹各 pane）
  ├─ P0-1 元数据转换管线
  ├─ P0-2 声明式组件动作
  └─ P0-5 面板懒加载（onActive/onDeactive）

P1（能力补齐，按业务优先级）
  ├─ P1-1 组件面板搜索 + Snippet（最高频用户诉求）
  ├─ P1-3 设备尺寸/预览（低成本高感知）
  ├─ P1-2 区块系统（生产消费闭环）
  ├─ P1-4 Monaco 源码编辑（阶段一先 JSON）
  ├─ P1-5 数据源面板（状态机驱动）
  └─ P1-6 多视图/多窗口（应用级编辑器）

P2（架构级，持续）
  ├─ P2-2 Hook 工厂抽取
  ├─ P2-4 插件契约标准化
  ├─ P2-1 三层架构（新模块采用）
  └─ P2-3 i18n Text 抽象
```

---

## 五、插件-能力映射速查表

| lowcode 插件 | 核心设计理念 | 借鉴项 | 本项目落地模块 |
|---|---|---|---|
| components-pane | transform 转换层 + 优先级排序 + Snippet 多态 + 搜索去抖 | P1-1 | `registry/material-transform.ts` + `components-pane` |
| set-ref-prop | Metadata Transducer 管线 + 声明式字段注入 | P0-1 | `ComponentRegistry.registerMetadataTransducer` |
| action-block | addBuiltinComponentAction 协议 + html2canvas 截图 | P0-2 / P1-2 | `ComponentRegistry.addBuiltinComponentAction` + `BemTools` |
| plugin-block | 快照即数据 + dragon.from + 内存缓存 | P1-2 | `BlockRegistry` + `block-pane` |
| undo-redo | 位掩码状态 + 内核委托 + Disposable | P0-3 | `EditorStore.historyState` |
| schema | TransformStage + 双向闭环 + 惰性刷新 | P0-5 / P1-4 | `schema-pane` + Monaco |
| datasource-pane | xstate 状态机 + JSONSchema 表单 + 插件化类型 | P1-5 | `datasource-pane` |
| base-monaco-editor | 异步单例 + useEditor + 受控更新防光标 | P1-4 | `useMonaco` composable |
| code-editor | schema⇄code 双向 + Babel 实时校验 + 函数级操作 | P1-4 | `schema-pane`（源码模式） |
| simulator-size | 设备预设表 + CSS 类自适应 | P1-3 | `simulator-size` 插件 |
| view-manager-pane | 纯视图 + 递归树 + 三层右键外置 | P1-6 / P2 | `view-manager-pane` |
| resource-tabs | 窗口投影 + 组件自治监听 + localStorage 会话恢复 | P1-6 | `resource-tabs` |
| multiple-editor | Controller/Context/Service 三层 + Hook 工厂 | P2-1 / P2-2 | 复杂面板架构 + `utils/hook-factory` |

---

## 六、关键设计原则总结

1. **引擎做薄、插件做厚**：内核只暴露模型 API（project/document/material/skeleton/event），业务能力由插件组合。本项目已具备此骨架（`EditorPlugin.contributes`）。
2. **声明式 > 命令式**：能用数据描述符（元数据管线、动作协议、skeleton 配置）就不用硬编码。优先补 P0-1/P0-2。
3. **数据归属分离**：纯视图面板不自持状态，数据来自 store/project，只做投影（减少同步 bug）。
4. **懒加载 + 错误边界**：重资源（Monaco）懒加载，面板崩溃隔离（P0-4/P0-5）。
5. **事件解耦**：插件间用事件总线协作，不直接引用（本项目 `EventBus` 已就绪）。
6. **分层复用**：基础组件（Monaco 封装）零引擎耦合，业务插件才耦合 schema 结构。
