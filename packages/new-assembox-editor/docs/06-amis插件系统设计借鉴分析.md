# amis 插件系统设计借鉴分析

> 研究对象：百度 amis 本体核心包
> - `amis-editor-core`（编辑器插件系统：Plugin 基类 + EditorManager + Region）
> - `amis-core`（运行时：渲染器注册 + Store + 双轨作用域）
> - `amis-editor`（内置插件落地 + 自举配置面板 + builder 数据源）
> - `amis-formula`（公式引擎）
> 配套文档：`04-lowcode插件设计借鉴分析.md`、`05-lowcode物料meta设计借鉴分析.md`
> 本文聚焦 amis 的**三层扩展架构**，并与 lowcode-engine、本项目（new-assembox-editor）三方对比。

---

## 一、amis 插件系统全景：三层扩展架构

amis 的"插件"横跨三个层次，需先厘清（这是与 lowcode 最大的认知差异）：

| 层 | 包 | 扩展对象 | 注册方式 | 解决什么 |
|---|---|---|---|---|
| **运行时渲染器层** | amis-core | 渲染器（怎么把 schema 渲染成 UI） | `@Renderer` 装饰器 / `registerRenderer` | 扩展可渲染的组件类型 |
| **编辑器插件层** | amis-editor-core | 编辑器插件（组件怎么被编辑） | `registerEditorPlugin(class)` | 扩展组件的编辑能力（面板/物料/工具栏/Region） |
| **公式/数据层** | amis-formula + amis-core | 公式函数/过滤器/模板引擎 | `registerFunction/registerFilter/registerTplEnginer` | 扩展 `${}` 表达式与数据联动 |

关键洞察：amis 的"渲染器注册"（运行时）与"编辑器插件"（设计时）是**两套独立注册表**，靠 `rendererName` 字符串桥接——编辑器插件声明 `rendererName` 绑定某渲染器，运行时与编辑时解耦。本项目（new-assembox-editor）当前是**一套 ComponentMeta 同时承担运行渲染 + 编辑配置**（meta 既是渲染依据又是配置依据），是另一种路线。

---

## 二、amis-editor-core：编辑器插件系统

### 2.1 Plugin 契约（PluginInterface + BasePlugin）

一个 amis 编辑器插件是一个**类**，继承 `BasePlugin`，通过实现不同方法分化角色（**无显式插件类型枚举**，实现什么方法即什么角色）。8 个通道：

| 通道 | 关键成员 | 职责 |
|---|---|---|
| 标识 | `rendererName` / `name` / `order` / `scene` | 绑定渲染器、排序、场景隔离 |
| 节点匹配 | `getRendererInfo(ctx)` | **首个命中认领节点**（`rendererName===renderer.name`） |
| Region 容器 | `regions[]`（key/label/renderMethod/matchRegion/dndMode/accept/preferTag） | 可放置区 + DnD 策略 + 子组件偏好 |
| 配置面板 | `panelBody`/`panelBodyCreator`/`panelBodyAsyncCreator` | **声明式 amis schema**（自举，零组件代码） |
| 物料 | `scaffold`/`previewSchema`/`scaffolds[]`/`scaffoldForm` | 拖入脚手架 + 多变体 + 创建向导 |
| 工具栏/菜单 | `buildEditorToolbar`/`buildEditorContextMenu` | 选中浮动按钮、右键菜单 |
| 生命周期钩子 | `before/after-insert/update/move/delete` 等 | 全部可拦截（return false 阻止） |
| 数据干预 | `filterProps`/`wrapperProps`/`buildDataSchemas`/`overrides` | 编辑态 mock、数据契约、渲染器覆写 |

### 2.2 双重调度模式（amis 最核心的架构亮点）

EditorManager 用**两种互补模式**调度插件：

**(A) 广播收集器（Aggregate）**——产出聚合 UI
```
buildToolbars() → 遍历 plugins.buildEditorToolbar(ctx, toolbars[]) → push 到同一数组
collectPanels(node) → 遍历 plugins.buildEditorPanel(ctx, panels[]) → push
collectRenderers() → 遍历 plugins.buildSubRenderers(ctx, list[]) → push
```
每个插件往**同一个传入数组**贡献，manager 统一下发。

**(B) 事件总线（trigger）**——生命周期拦截
```
trigger('before-insert', ctx)
  → camelize → 'beforeInsert' → 找插件上的同名方法 + 外部 on() 监听
  → 顺序执行；return false → preventDefault；return Promise → await
```
**事件名→方法名自动映射**（约定即协议，零注册成本）。所有写操作统一：`insert → trigger('before-insert') → store.insert → trigger('after-insert')`。

### 2.3 渲染器 Hack 注入（Region 机制）

amis 不要求组件主动配合编辑器。对于声明了复杂 `regions` 的组件，manager 用 `hackRenderers + hackIn` **覆盖渲染器原型方法**，把 Region（可放置区节点）动态注入 React 子树。配合 `makeWrapper`（HOC）在渲染器实例与 EditorNode 树间建立双向绑定（mount→addChild、unmount→removeChild）。

### 2.4 高级特性
- **虚拟渲染器（VRenderer）**：给非渲染器组件（Tab 项、CRUD 列）赋予点选/配置能力
- **多重身份（multifactor）**：一个 DOM 节点关联多个插件配置面板（CRUD↔Table）
- **scene 场景隔离**：不同编辑器形态（页面/布局/迷你）启用不同插件子集
- **priority 覆盖**：同 id 插件按 priority 替换，支持覆盖内置组件

---

## 三、amis-core：运行时扩展机制

### 3.1 渲染器注册（factory.tsx）
- `@Renderer({type, storeType, isolateScope, weight, autoVar, ...})` 装饰器 → `registerRenderer`
- 三张注册表：`renderers[]`（按 weight 升序）、`renderersTypeMap{}`（O(1) 直接映射）、`cache{}`（正则结果缓存）
- 匹配链：`renderersTypeMap[type]` 直接命中 → cache → 遍历 test（正则/函数）
- `storeType` 字符串关联 MST Store，`factory` 自动用 `HocStoreFactory` 包裹组件（视图与状态解耦）

### 3.2 Store 状态管理（MST 状态树）
- StoreType 家族：Root/Service/Form/CRUD/Combo/Table...（`RegisterStore` 可扩展）
- 数据作用域 = **JS 原型链**（`createObject(parent,child)` 让 `child.__super=parent`），变量查找沿原型链冒泡，零成本

### 3.3 双轨作用域（amis 的精髓）
| 作用域 | 实现 | 用途 |
|---|---|---|
| 数据作用域 | Store.data 的 `__super` 原型链 | 公式 `${xxx}` 变量查找 |
| 组件作用域 | ScopedContext 树 | 组件间通信 reload/send/close、按 name/id 查组件 |

两者通过 `GETRENDERERDATA/GETRENDERERPROP` 公式函数交叉打通。

### 3.4 约定优于配置（xxxOn 后缀）
`getExprProperties` 扫描 schema，把 `visibleOn`/`disabledOn`/`xxxClassName` 等后缀属性在当前 data 下自动求值——任意属性都能"公式化"。

---

## 四、amis-formula：公式引擎

三段式编译执行流水线：
```
"${a + b | html}" → lexer(状态机) → Token流 → parse(递归下降) → AST → Evaluator.evalute(反射分发)
```
- **反射式求值**：`camelize(ast.type)`（func_call→funcCall）找方法
- **扩展点**：`registerFunction`/`registerFormula`/`registerFilter`/`registerTplEnginer`
- **惰性求值**：IF/AND/OR 短路
- **AST 缓存**（`memoParse`）、多模板引擎可插拔（builtin `${}` + lodash `<%- %>`）

---

## 五、amis-editor：插件落地范式

### 5.1 自举式配置面板（amis 最独特的设计）
配置面板本身是一段 **amis schema**：
```
panelBodyCreator = ctx => getSchemaTpl('tabs', [
  { title:'属性', body: getSchemaTpl('collapseGroup', [
    { title:'基本', body: [getSchemaTpl('formItemName'), getSchemaTpl('label'), {name:'maxLength',...}] }
  ])}
])
```
**用 amis 编辑 amis**——配置面板即享受平台所有表单组件（联动/校验/公式），无需再造 setter 体系。

### 5.2 三层配置复用（抑制重复）
1. `getSchemaTpl('name')`（轻量 schema 片段，`setSchemaTpl/getSchemaTpl` 注册原语）
2. `@Renderer({type:'ae-xxx'})`（复杂交互控件：OptionControl/APIControl/ValidationControl...）
3. Plugin class（组件级编排，组装 ①②）

### 5.3 side-effect import 去中心化注册
每个插件文件末尾 `registerEditorPlugin(XxxPlugin)`，`plugin/index.ts` 用 `export *` 聚合——新增组件无需改注册中心。

### 5.4 filterProps 编辑态数据 mock
容器型组件编辑态自动注入 mock 数据（Table 按列造数据），让"无数据源"也能所见即所得。

### 5.5 buildDataSchemas 数据契约
每个组件声明"向外暴露什么数据结构"，供兄弟组件做字段绑定/公式引用（出参契约）。

---

## 六、三方对比：amis vs lowcode-engine vs new-assembox-editor

| 维度 | amis | lowcode-engine | new-assembox-editor（本项目） |
|---|---|---|---|
| **插件契约** | class 内聚所有通道（实现方法分化角色） | factory + ctx + skeleton contribution | EditorPlugin（contributes 对象） |
| **设计哲学** | 重内聚、约定优于配置、自举 | 重分离、显式契约、概念正交 | 元数据驱动（接近 lowcode） |
| **配置面板** | 自举 amis schema（零组件代码） | Setter 组件 + meta 配置 | PropConfig + setter 推断 |
| **调度模型** | 广播收集器 + 事件总线（方法名映射） | 生命周期 init + 注册表 | EventBus + PluginManager.buildPanels |
| **渲染器绑定** | rendererName + getRendererInfo 首个命中 | componentName + meta | meta.type（弱绑定，编辑器插件不直绑组件） |
| **容器/Region** | RegionConfig + renderMethod hack 注入 | isContainer + nestingRule + onNodeAdd | regions + accept（无 hack 注入） |
| **运行时/编辑时** | 两套注册表（renderer/plugin）分离 | 物料 meta + 运行时组件 | 一套 meta 兼任 |
| **变量/公式** | amis-formula（lexer/parser/Evaluator） | JSExpression + supportVariable | 无（待补） |
| **数据契约** | buildDataSchemas（出参） | — | 无 |
| **编辑态 mock** | filterProps | — | 无 |
| **虚拟渲染器** | VRenderer（编辑非渲染器组件） | — | 无 |
| **配置复用** | 三层（tpl片段/ae控件/Plugin） | Setter 注册表 | setter 系统（单层） |
| **批量注册** | side-effect import | — | builtin-plugins.tsx 手动 |

---

## 七、借鉴建议（按优先级，落到本项目）

> 选型前提：本项目走 **Vue3 + PropConfig + setter 元数据驱动**路线（接近 lowcode），**不采用 amis 的自举 schema 配置面板**（路线差异）。借鉴聚焦 amis 的**调度架构、Region 注入、数据契约、公式引擎、编辑态 mock** 等与路线无关的设计精华。

### P0｜调度架构（优化现有 PluginManager + EventBus）

#### P0-1 广播收集器模式（借鉴 amis buildToolbars/collectPanels）
**现状**：`PluginManager.buildPanels/buildToolbars/buildContextMenu` 已有雏形，但模式不统一。
**amis**：统一的"遍历插件 → push 到传入数组"广播收集范式，签名一致。
**落地**：统一三者签名为 `build*(ctx, output[])`，PluginManager 遍历收集；明确"广播收集"与"事件总线"两种调度场景的分工。

#### P0-2 事件名→方法名映射（借鉴 amis trigger camelize）
**现状**：插件用 `bus.on('xxx', handler)` 显式注册监听。
**amis**：`trigger('before-insert')` 自动找插件的 `beforeInsert` 方法，约定即协议，零注册。
**落地**：`PluginManager` 在 activate 时扫描插件实例的 `beforeXxx/afterXxx` 方法名，自动绑定到对应 EventBus 事件（约定映射），减少样板。插件可直接实现 `beforeInsert(event)` 而非手动 `bus.on`。

### P1｜编辑器能力增强

#### P1-1 编辑器插件绑定组件类型（借鉴 rendererName + getRendererInfo）
**现状**：EditorPlugin 与组件类型弱绑定（contributes.components 注册 meta，但面板逻辑不按组件类型分发）。
**amis**：插件声明 `rendererName`，按选中节点类型匹配插件渲染配置面板。
**落地**：EditorPlugin 增加 `matchType?: string | ((node)=>boolean)`，settings-pane 按选中节点的 `type` 匹配插件贡献的配置项；支持"一个组件多插件贡献面板"（类似 multifactor）。

#### P1-2 Region 增强（借鉴 amis RegionConfig + preferTag）
**现状**：`RegionConfig`（key/label/dndMode/accept/optional）。
**amis**：还有 `preferTag`（偏好子组件类型）、`insertPosition`（inner/outer）、`modifyGhost`。
**落地**：`RegionConfig` 补 `preferTag?`（拖入时优先匹配某类组件）、`placeholder?`（空区域提示），配合 05 文档 P1-4 容器三件套。

#### P1-3 编辑态数据 mock（借鉴 amis filterProps）
**现状**：编辑态直接渲染真实 schema，无数据源时空白。
**amis**：容器型组件 `filterProps` 编辑态造 mock 数据（Table 按列造行）。
**落地**：`ComponentMeta` 增加 `filterPropsAtDesign?: (props, node) => props`（设计态 props 变换），编辑器渲染前应用——无数据表格也能预览。

#### P1-4 数据契约 buildDataSchemas（借鉴 amis）
**现状**：组件无"出参"声明，无法做字段联动。
**amis**：`buildDataSchemas(node)` 声明组件向外暴露的数据结构，供兄弟组件绑定。
**落地**：`ComponentMeta` 增加 `dataSchema?: (node) => DataSchemaNode`，为未来变量绑定（05 文档 supportVariable）和组件间联动提供基础。

### P1｜公式引擎（借鉴 amis-formula，对应 05 文档变量绑定）

#### P1-5 引入/借鉴公式引擎
**现状**：无公式/变量求值（05 文档 P0-3 supportVariable 待补）。
**amis**：amis-formula 是成熟的三段式（lexer→parser→Evaluator）公式引擎，支持 `${}` 模板、函数、过滤器、原型链作用域。
**落地**：变量绑定的底层需要公式求值。可：
- **方案A**：直接引入 amis-formula（框架无关，纯 TS）作为 `${}` 求值器；
- **方案B**：借鉴其架构自研轻量版（lexer/parser/Evaluator + registerFunction/filter）。
联动 05 文档 P0-3，setter 的 `VariableSetter` 值为 JSExpression，渲染时经公式引擎求值。

### P2｜架构级（远期）

#### P2-1 虚拟渲染器（借鉴 amis VRenderer）
**现状**：只能编辑已注册的渲染器节点，Tab 项/CRUD 列等非渲染器组件无法编辑。
**amis**：VRenderer 给非渲染器组件赋予点选/配置能力。
**落地**：远期，当需要编辑"组件内部结构项"（非独立渲染器）时参考。

#### P2-2 配置三层复用（借鉴 amis tpl/ae控件/Plugin）
**现状**：setter 系统（单层），PropConfig 重复声明。
**amis**：getSchemaTpl（片段）→ 控件 → Plugin 三级复用。
**落地**：setter 之上建立"配置片段"复用层（如标准 formItemName/label/validation 片段），减少 PropConfig 重复。

#### P2-3 双轨作用域（借鉴 amis 数据/组件作用域）
**现状**：无运行时数据作用域概念（编辑器是设计态）。
**amis**：数据作用域（原型链）+ 组件作用域（Scoped 树）。
**落地**：本项目是**编辑器**（非运行时引擎），运行时渲染由 amis/amis-vue 等承担。此条借鉴价值有限，仅在未来若做"编辑器内实时预览数据联动"时参考。

---

## 八、设计哲学对比与选型启示

| 哲学 | amis | lowcode-engine | 启示 |
|---|---|---|---|
| **插件粒度** | 一个 class 内聚所有通道 | 概念正交（Plugin/Setter/Pane/物料分离） | 本项目已选 lowcode 路线（分离），保持 |
| **配置面板** | 自举（schema 即面板） | 元数据 + 通用 setter | 本项目选 setter 路线，保持 |
| **扩展侵入** | 渲染器 hack（原型覆盖） | 显式注册 API | hack 高效但耦合；本项目用显式注册，可对存量组件借鉴"AOP 注入"思路（Vue 可用 directive/wrapper） |
| **约定** | xxxOn 后缀、方法名映射 | 显式 API | 适度约定（方法名映射）提效，但避免过度隐式 |
| **运行/编辑** | 两套注册表分离 | 物料 meta + 运行组件 | 本项目一套 meta 兼任，简化但耦合；若未来运行时独立（如产物可脱离编辑器），需分离 |

**核心结论**：
- amis 的**自举式配置面板**与**渲染器 hack 注入**是其作为"低代码框架"的核心创新，但与本项目（Vue3 + setter 元数据）路线不同，**不直接搬**。
- amis 的**调度架构（广播收集 + 事件总线 + 方法名映射）**、**Region/preferTag**、**编辑态 mock**、**数据契约**、**公式引擎**是**与路线无关的通用设计精华**，值得借鉴。
- **公式引擎**（amis-formula）是本项目补齐变量绑定（05 文档）的关键依赖，可考虑直接引入。

---

## 九、借鉴汇总与路线图

```
P0（调度架构，1 周，低风险）
  ├─ P0-1 广播收集器模式统一（buildPanels/Toolbars/ContextMenu 签名一致）
  └─ P0-2 事件名→方法名映射（插件实现 beforeInsert 即自动绑定）

P1（编辑器能力 + 公式）
  ├─ P1-1 编辑器插件按组件类型匹配（matchType + multifactor）
  ├─ P1-3 编辑态数据 mock（filterPropsAtDesign）
  ├─ P1-4 数据契约（buildDataSchemas，为联动奠基）
  ├─ P1-5 公式引擎（引入 amis-formula，联动 05 文档 supportVariable）
  └─ P1-2 Region 增强（preferTag/placeholder）

P2（架构级，远期）
  ├─ P2-1 虚拟渲染器（编辑非渲染器组件）
  ├─ P2-2 配置三层复用（setter 之上建片段层）
  └─ P2-3 双轨作用域（仅实时预览联动时考虑）
```

---

## 十、与配套文档的联动

| 本文档借鉴项 | 关联文档 | 关系 |
|---|---|---|
| P1-5 公式引擎 | 05 P0-3 supportVariable 变量绑定 | 公式引擎是变量绑定的求值底层 |
| P1-2 Region 增强 | 05 P1-4 容器三件套（nestingRule+onNodeAdd） | Region 容器语义的组成 |
| P1-1 插件按类型匹配 | 04 P0-1 元数据转换管线 | 都涉及插件与组件 meta 的关系 |
| P0-1/P0-2 调度架构 | 04 插件契约标准化 | 调度是插件契约的执行侧 |
| P1-4 数据契约 | 05 物料 meta | dataSchema 是 meta 的运行时出参 |

三份文档（04 lowcode 插件、05 lowcode 物料、06 amis）共同构成 new-assembox-editor 向主流低代码方案对标的完整借鉴蓝图：
- **04**：编辑器扩展能力（插件层）
- **05**：物料表达力（meta 层）
- **06**：调度架构与运行时扩展（amis 的独特范式 + 公式引擎）
