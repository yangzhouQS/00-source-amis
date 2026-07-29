# LowCode 物料 Meta 设计借鉴分析

> 研究对象：`01-lc/lowcode-materials/packages` 下 4 个物料包
> - `fusion-lowcode-materials`（Fusion 物料，116 组件 meta）
> - `antd-lowcode-materials`（Ant Design 物料，88 组件 meta）
> - `fusion-ui`（业务组件库，28 meta）
> - `graph-x6-materials`（x6 图表物料，3 meta）
> 配套文档：`04-lowcode插件设计借鉴分析.md`（插件层）、本文聚焦**物料层（被编辑组件的元信息）**
> 结论先行：本项目 `ComponentMeta` 骨架（type/props/PropConfig/regions/events）已具备，主要差距在 **meta 表达力**（条件联动/虚拟属性/变量绑定/分组嵌套）、**容器语义**（nestingRule + onNodeAdd 自动包裹）、**物料工程化**（资产包/双产物/动态加载）。

---

## 一、本项目物料层现状

```ts
// schema/types.ts —— ComponentMeta（已有）
interface ComponentMeta {
  type, name, icon?, category?, group?, tags?,
  scaffold?: Partial<PageNode>,        // 单一初始 schema
  props?: PropConfig[],                 // 属性配置（驱动 setter）
  events?: EventConfig[],
  regions?: RegionConfig[],             // 容器投放区
  isContainer?, acceptParent?,
  renderComponent?, override?, weight?, hidden?, disabled?
}

interface PropConfig {
  name, title?, propType, defaultValue?, setter?, setterProps?,
  hidden?: boolean | ((value) => boolean),  // 条件隐藏（已支持函数）
  group?, description?
}
```
- **物料注册**：内置（`demo/components.ts` 手动 `register`），无资产包/动态加载
- **setter 系统**：25 个（String/Bool/Number/Select/Radio/Json/Array/Object/Icon/Color/Function…），缺 Mixed/Slot/Variable/Expression
- **分组**：`group` + `category` 两层（组件面板已用），但**属性面板内无折叠分组**
- **容器**：`regions[].accept` + `isContainer`，无 nestingRule/onNodeAdd

---

## 二、lowcode 物料 Meta 设计范式（提炼）

### 核心范式：三层分离 + 函数即配置

```
meta = {
  身份层：componentName / title / group / category / icon / npm映射
  类型层：props[] —— "有哪些属性、什么类型"（propType，可序列化，服务校验/代码生成）
  配置层：configure.props[] —— "怎么编辑"（setter / group / condition / defaultValue）
  容器层：configure.component / nestingRule / advanced.callbacks —— "如何嵌套、拖入时如何整理结构"
  能力层：configure.supports —— style/events/loop/condition 能力开关
  预设层：snippets[] —— 一个物料多套拖入模板（含完整 mock 数据）
}
```

**函数即配置**（最关键）：`condition`/`setter.props`/`setValue`/`getValue`/`onNodeAdd` 都是**运行时函数**（构建期 `noParse` 保留，不序列化），可读取同节点其他属性、遍历 document——meta 表达力从"静态声明"升级到"声明 + 运行时逻辑"。

### 资产包工程化：清单 + 引用
`assets.json` 不内联 meta（含函数无法序列化），而是 `packages[]`（CDN 库）+ `components[]`（meta 模块 URL + 导出名）+ `sort`（面板排序）。引擎动态 import meta.js 模块拿到含函数的 meta。

### 设计态/运行态双产物
物料包产出运行态库（`lib`/`es`）+ 设计态视图（`view.js`，含 `ValueWrapper` 让受控组件设计态非受控渲染）。`__designMode` 分流。

### 异构物料接入（x6 启示）
物料不一定是组件，可以是"描述对象工厂"（x6 节点定义）。meta 用 `supports:false` 做减法（关闭通用能力），只暴露最小配置，复杂度交给物料自身运行时。

---

## 三、借鉴建议（按优先级）

### P0｜Meta 表达力增强（优化现有 PropConfig，低风险高收益）

#### P0-1 属性折叠分组（借鉴 fusion/antd `type:'group'`）
**现状**：`settings-pane` 属性扁平罗列，无折叠分组。
**lowcode**：`configure.props[]` 支持 `{type:'group', title, display:'accordion'|'block'|'inline', items:[]}` 嵌套，Table 有 7 大组、Form 布局用手风琴。
**落地**：`PropConfig` 扩展联合类型支持 group 项；`settings-pane` 渲染分组容器（ElCollapse）。`PropConfig.group`（字符串）升为嵌套结构。
```ts
type PropConfig = PropField | PropGroup;
interface PropGroup { type: 'group'; title?: string; display?: 'block'|'accordion'; items: PropConfig[] }
```

#### P0-2 条件联动 `condition`（借鉴 fusion/antd）
**现状**：`hidden: (value)=>boolean` 仅能看当前字段值。
**lowcode**：`condition: (node) => boolean` 可读同节点任意属性（`node.props.x`），支持 visible/hidden。
**落地**：`PropConfig` 增加 `condition?: (node: PageNode) => boolean`（替代/增强 hidden），`settings-pane` 渲染前求值。`resolve.ts isFieldHidden` 改为传 `PageNode`（注：上一轮已建议，此处联动）。

#### P0-3 变量绑定 `supportVariable`（借鉴 antd transform-meta）
**现状**：无变量绑定，所有属性静态值。
**lowcode**：逐属性 `supportVariable: true`，构建期自动把 setter 包成 `MixedSetter + VariableSetter`，绑定后值变 JSExpression。
**落地**：`PropConfig` 加 `supportVariable?: boolean`；新增 `VariableSetter` + `MixedSetter`；`resolveSetter` 时若 supportVariable 则自动包装。

#### P0-4 嵌套点路径 name（借鉴 antd `pagination.pageSize`）
**现状**：嵌套对象必须用 ObjectSetter 整体配置。
**lowcode**：`name: 'a.b.c'` 直接拍平为独立可配项，配 condition 控制显隐。
**落地**：`updateNode`/`getNodeValue` 支持点路径读写（lodash.get/set 语义），PropConfig.name 允许点路径。

#### P0-5 MixedSetter（多形态切换，借鉴 fusion）
**现状**：一个属性固定一个 setter。
**lowcode**：`MixedSetter` 包装多个 setter，用户在"字面值/JSON/表达式/图标"间切换。
**落地**：新增 `MixedSetter`（内部维护当前选中 setter + 值类型标记），是 P0-3 变量绑定的基础。

---

### P1｜高级 Meta 能力（缺失的核心特性）

#### P1-1 虚拟属性 + getValue/setValue（借鉴 fusion `!type` / antd form.item）
**价值最高**。把多个底层 prop 聚合成一个友好 UI 控件，双向映射。
**现状**：无，复杂组件只能暴露多个原始开关。
**落地**：
```ts
interface PropConfig {
  // ... 
  /** 虚拟属性：不落 props，仅 UI；通过 getValue/setValue 双向映射真实属性 */
  virtual?: boolean;
  getValue?: (node: PageNode) => any;
  setValue?: (node: PageNode, value: any) => void;  // 可联动改其他属性
}
```
场景：按钮"形式"聚合 text/warning/ghost 三布尔；表单"校验规则"聚合 required/pattern/min。

#### P1-2 setValue 副作用（借鉴 fusion responsive-grid / antd pagination）
写一个属性联动改其他属性/增删子节点。
**落地**：`PropConfig.extraProps.setValue(node, value)`，setter onChange 时调用，可触发 `editor.update` 其他字段。

#### P1-3 能力开关 `configure.supports`（借鉴全部物料）
**现状**：所有组件默认支持样式/事件编辑。
**lowcode**：`supports: { style?: bool, events?: string[], loop?: bool, condition?: bool }` 控制属性面板页签。
**落地**：`ComponentMeta` 加 `supports?`，settings-pane 按此显示/隐藏"样式""事件"页签；异构物料（图表）用 `supports:false` 全关。

#### P1-4 容器语义三件套（借鉴 fusion Form/Dialog + fusion-ui ProForm）
**现状**：`regions[].accept` + `isContainer`，无嵌套约束/拖入自动包裹。
**lowcode**：`nestingRule: { parentWhitelist?, childWhitelist? }` + `advanced.callbacks.onNodeAdd/onNodeRemove`（拖入自动套 Form.Item、子节点删空自删）。
**落地**：
```ts
interface ComponentMeta {
  // ...
  nestingRule?: { parentWhitelist?: string[]; childWhitelist?: string[] };
  advanced?: {
    initialChildren?: () => PageNode[];        // 拖入默认子节点
    onNodeAdd?: (node, parentNode, editor) => void;  // 拖入自动包裹
    onNodeRemove?: (node, parentNode, editor) => void;
  };
}
```
在 `editor.insert` / Dragon `onDrop` 后触发对应容器 meta 的 `onNodeAdd`。

#### P1-5 snippets 多预设（借鉴 fusion/antd，对应 04 文档 P1-1）
**现状**：`scaffold` 单一。
**落地**：`ComponentMeta.snippets?: Scaffold[]`（`{title, schema, screenshot?}`），`createNode(type, snippetId?)`，组件面板一个物料多入口。

#### P1-6 SlotSetter → Vue scoped slot（借鉴 antd `JSSlot + params`）
**现状**：无插槽属性，render 类 props 无法可视化配置。
**落地**：新增 `SlotSetter`（值结构 `{type:'slot', params:[], body:PageNode[]}`），直译 Vue `#default="{params}"`。Table 的单元格/标题 render 用此。

---

### P2｜物料工程化（远期，架构级）

#### P2-1 资产包构建（借鉴 assets.json 清单+引用）
**现状**：物料内置 register。
**落地**：物料独立包，构建产出 `meta.js`（含函数，ESM）+ `assets.json`（packages + components URL + sort）；编辑器 `loadAssets(url)` 动态 import。meta 含函数所以走 JS 模块而非内联 JSON。

#### P2-2 设计态/运行态双产物（借鉴 view.js + __designMode）
**现状**：编辑器直接渲染运行组件。
**落地**：物料可选提供设计态视图（`view.tsx`），`__designMode==='design'` 时分流（如 Input 用 defaultValue 非受控，防编辑串扰）。

#### P2-3 npm 映射解耦（借鉴 `{exportName, destructuring, subName}`）
**现状**：`renderComponent` 直接持有组件引用。
**落地**：meta 用 `npm: {package, exportName, destructuring, subName}` 声明库映射，编辑器从全局库取——支持 CDN 加载第三方组件库。

#### P2-4 异构物料接入（借鉴 x6"描述对象工厂"）
**现状**：物料必须是 Vue 组件。
**落地**：物料协议允许"运行时返回描述对象"（如 ECharts option、x6 节点定义），画布当黑盒节点；meta `supports:false` 做减法。适配图表/富文本/白板类物料。

#### P2-5 meta 复用片段（借鉴 fusion-ui `common/` spread）
**落地**：`common/` 存放跨组件 meta 片段（操作按钮组、图表基础配置），`...spread` 复用，治理复杂物料的 meta 冗余。

---

## 四、ComponentMeta / PropConfig 扩展建议（TS 接口）

```ts
// === PropConfig 增强（P0 + P1） ===
type PropConfig = PropField | PropGroup;

interface PropGroup {
  type: 'group';
  title?: string | I18nText;
  display?: 'block' | 'accordion' | 'inline';
  items: PropConfig[];
}

interface PropField {
  name: string;                    // 支持点路径 'a.b.c'
  title?: string | I18nText;
  propType: PropType;
  defaultValue?: any;
  setter?: string | SetterConfig;
  setterProps?: Record<string, any> | ((node: PageNode) => Record<string, any>);
  /** 条件显示（读同节点任意属性） */
  condition?: (node: PageNode) => boolean;
  /** 支持变量绑定（自动包 MixedSetter + VariableSetter） */
  supportVariable?: boolean;
  /** 虚拟属性：不落 props，getValue/setValue 双向映射 */
  virtual?: boolean;
  getValue?: (node: PageNode) => any;
  setValue?: (node: PageNode, value: any) => void;
  description?: string | I18nText;
}

// === ComponentMeta 增强（P1 + P2） ===
interface ComponentMeta {
  // ... 已有字段
  snippets?: Scaffold[];           // 多预设（替代单一 scaffold）
  nestingRule?: { parentWhitelist?: string[]; childWhitelist?: string[] };
  supports?: { style?: boolean; events?: string[]; loop?: boolean; condition?: boolean };
  advanced?: {
    initialChildren?: (node: PageNode) => PageNode[];
    onNodeAdd?: (node: PageNode, parent: PageNode, editor: Editor) => void;
    onNodeRemove?: (node: PageNode, parent: PageNode, editor: Editor) => void;
  };
  npm?: { package: string; exportName: string; destructuring?: boolean; subName?: string };
}

interface Scaffold { title?: string; schema: Partial<PageNode>; screenshot?: string }
```

---

## 五、优先级实施路线图

```
P0（meta 表达力，1-2 周，低风险，settings-pane 感知最强）
  ├─ P0-1 属性折叠分组（PropGroup）
  ├─ P0-2 condition 条件联动（传 PageNode）
  ├─ P0-5 MixedSetter（基础设施）
  ├─ P0-3 supportVariable 变量绑定（依赖 MixedSetter）
  └─ P0-4 嵌套点路径

P1（高级能力，补齐工业级物料表达力）
  ├─ P1-1 虚拟属性 + getValue/setValue（最高价值）
  ├─ P1-4 容器三件套（nestingRule + onNodeAdd，表单/栅格容器刚需）
  ├─ P1-3 supports 能力开关
  ├─ P1-5 snippets 多预设（联动 04 文档组件面板增强）
  ├─ P1-6 SlotSetter（Vue scoped slot）
  └─ P1-2 setValue 副作用

P2（工程化，远期）
  ├─ P2-1 资产包构建 + 动态加载
  ├─ P2-3 npm 映射（第三方库解耦）
  ├─ P2-2 设计态/运行态双产物
  ├─ P2-4 异构物料接入（图表/白板）
  └─ P2-5 meta 复用片段
```

---

## 六、物料-能力映射速查表

| lowcode 物料 | 核心 meta 设计 | 借鉴项 | 本项目落地 |
|---|---|---|---|
| fusion（116） | 类型层/配置层分离、虚拟属性 `!xxx`、condition 函数、MixedSetter、容器三件套、双 meta 变体 | P0-2/0-5, P1-1/1-4 | PropConfig + ComponentMeta 扩展 |
| antd（88） | 瘦 meta+构建注入、propType+setter 双声明、supportVariable 自动包装、SlotSetter+params、点路径、events 分离 | P0-3/0-4, P1-6 | transform-meta 转换器 + SlotSetter |
| fusion-ui（28） | 业务组件 meta 加重、setter 函数遍历 document、nestingRule 正则、initialChildren、snippet 带 mock | P1-2/1-4/1-5 | 业务物料 meta 模板 |
| graph-x6（3） | 描述对象工厂、supports:false 减法、物料描述与画布执行解耦 | P2-4 | 异构物料协议 |
| 全部 | assets.json 清单+引用、双产物、npm 映射、i18n Text | P2-1/2-2/2-3 | 物料工程化 |

---

## 七、关键设计原则

1. **类型层与配置层分离**：`propType`（机器可读，服务校验/代码生成）与 `setter`（面板 UI）解耦，靠 name 关联。本项目已有雏形，强化即可。
2. **函数即配置**：`condition/setValue/getValue/onNodeAdd` 用运行时函数，表达力远超静态声明。构建保留函数（Vite/ESM 天然支持）。
3. **虚拟属性解决 API 难用**：多底层 prop 聚合为一个友好控件（getValue/setValue 双向映射），是复杂物料 meta 的核心技巧。
4. **能力归属决定 meta 形态**：能力在物料→meta 加法（运行时 setter）；能力在宿主→meta 减法（supports:false）。x6 是减法典范。
5. **容器不只是"能放"**：nestingRule 约束 + onNodeAdd 自动整理结构（表单项化、栅格分块），是工业级容器的标志。
6. **meta 是业务引导规则**：snippet 带 mock 数据、setter 遍历 document、默认值贴近真实场景——降低用户配置心智。
7. **清单式资产包**：meta 含函数不可内联 JSON，用"packages + meta 模块 URL + sort"清单，引擎动态 import。
8. **运行态/设计态分离**：设计态可非受控渲染（防编辑串扰）、可屏蔽跳转，独立打包独立演进。

---

## 八、与插件文档（04）的联动

| 本文档借鉴项 | 04 文档对应项 | 协同关系 |
|---|---|---|
| P1-5 snippets 多预设 | 04 P1-1 组件面板搜索+Snippet | snippets 是数据源，面板是消费方 |
| P0-1 属性分组 | 04 P0-1 元数据转换管线 | 分组结构可被 transducer 注入 |
| P1-3 supports 能力开关 | 04 P0-2 声明式组件动作 | supports 控制面板页签，动作控制工具栏 |
| P2-1 资产包构建 | 04 P1-1 transform 转换层 | assets.json 的 sort 驱动面板分组排序 |
| P1-4 onNodeAdd | 04 Dragon onDrop | onNodeAdd 在 drop 后触发结构整理 |

两份文档共同构成 new-assembox-editor 向 lowcode-engine 对标的**完整借鉴蓝图**：04 补编辑器扩展能力（插件），05 补物料表达力（meta）。
