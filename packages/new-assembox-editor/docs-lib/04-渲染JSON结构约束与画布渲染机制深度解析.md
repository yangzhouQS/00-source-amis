# 渲染 JSON 结构约束与画布渲染机制深度解析

> **分析对象**：
> - 编辑器 demo 配置：`src/demo/single-table-scene.json`（112KB / 单场景）、`order-table-config.json`（271KB / 3 场景）、`ledger-config.json`（312KB / 2 场景）
> - 运行库：`assembox-packages-project/libs/assembox-core-next`（核心层，Vue 无关）+ `libs/assembox-desktop-next`（桌面渲染层）
> - 编辑器画布：`new-assembox-editor/src/scenarios/pc-desktop/*` + `src/simulator/iframe/*` + `src/designer/*`
>
> **产出**：JSON → UI 的完整映射契约、渲染库执行管线、编辑器画布（inline/iframe）渲染与交互机制

---

## 目录

- [1. 总览：三层结构一张图](#1-总览三层结构一张图)
- [2. 顶层 AssemConfig 契约](#2-顶层-assemconfig-契约)
- [3. uiSkeleton：场景与文档树](#3-uiskeleton场景与文档树)
- [4. IBaseNode：节点七字段契约](#4-ibasenode节点七字段契约)
- [5. renderType 词汇表与组件注册](#5-rendertype-词汇表与组件注册)
- [6. 子节点存放约束：直接槽位 + 间接容器](#6-子节点存放约束直接槽位--间接容器)
- [7. __nodeEvent：事件脚本契约](#7-nodeevent事件脚本契约)
- [8. dataSource：数据三件套契约](#8-datasource数据三件套契约)
- [9. 渲染库执行管线（JSON → UI）](#9-渲染库执行管线json--ui)
- [10. 节点运行时五支柱（composables）](#10-节点运行时五支柱composables)
- [11. 编辑器画布渲染机制](#11-编辑器画布渲染机制)
- [12. iframe 画布依赖装配链](#12-iframe-画布依赖装配链)
- [13. 选中 / 悬停 / 拖拽：编辑交互闭环](#13-选中--悬停--拖拽编辑交互闭环)
- [14. Schema 变更同步链（编辑器 → 画布）](#14-schema-变更同步链编辑器--画布)
- [15. 端到端示例：查询按钮的完整生命周期](#15-端到端示例查询按钮的完整生命周期)
- [16. 结构约束汇总表（速查）](#16-结构约束汇总表速查)
- [17. 版本对齐注意事项](#17-版本对齐注意事项)

---

## 1. 总览：三层结构一张图

三份 demo JSON 顶层完全一致，即 `AssemConfig`（`assembox-core-next/src/types/assem-config.ts`）：

```
┌─────────────────────────────────────────────────────────────────┐
│ AssemConfig（页面配置根）                                          │
│                                                                 │
│ ┌─────────────── uiSkeleton ───────────────┐  ┌─ routerConfig ─┐│
│ │ {                                        │  │ sceneName → {  ││
│ │   sceneName: {                           │  │   name/path/   ││
│ │     viewsProps: {                        │  │   meta.title   ││
│ │       planeOptions: IBaseNode   ←主画面树 │  │ }              ││
│ │       dialogOptions: IBaseNode[] ←弹窗树  │  └────────────────┘│
│ │       drawerOptions: IBaseNode[] ←抽屉树  │                    │
│ │       tabOptions?: IBaseNode[]            │                    │
│ │     }                                    │                    │
│ │   }, ...多场景并存                         │                    │
│ │ }                                        │                    │
│ └──────────────────────────────────────────┘                    │
│                                                                 │
│ ┌──────────────────────── dataSource ──────────────────────────┐ │
│ │ api.config           全局 api 前缀/通用配置                    │ │
│ │ requestConfig        请求名 → {url,method,paramsConfig,...}    │ │
│ │ dataModelConfig      模型名 → {表名 → {字段 → {valueType,...}}}│ │
│ │ sharedFns            函数名 → {enabled, fn: "function..."}     │ │
│ └──────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

三个 JSON 的规模对比：

| 文件 | 场景 | requestConfig | dataModelConfig | sharedFns | 特点 |
|---|---|---|---|---|---|
| single-table-scene | 1（供应商单表） | 4 项 | 4 模型 | 1 函数 | 主画面 + 1 弹窗表单 |
| order-table-config | 3（列表/详情/编辑） | 8 项 | 6 模型 | 7 函数 | 多路由页面 |
| ledger-config | 2（台账/详情） | 8 项 | 13 模型 | 15 函数 | 高级筛选 + 图表 |

---

## 2. 顶层 AssemConfig 契约

```typescript
// assembox-core-next/src/types/assem-config.ts
export interface AssemConfig {
  uiSkeleton: Record<string, unknown>;   // 场景树（key = 场景名）
  dataSource: DataSource;                // 数据三件套 + api
  routerConfig?: RouterConfig;           // sceneName → { name, path, meta:{title} }
  security?: SecurityConfig;             // encryptKey / encryptEnabled
}
```

- **编辑器侧**：`createEditor({ schema: config.uiSkeleton, routerConfig, dataSource })` —— 编辑器只吃 `uiSkeleton` 作为可编辑 schema，`routerConfig`/`dataSource` 作为运行时配置透传给画布（见 demo `main.tsx`）
- **渲染器侧**：`app.use(AssemPlugin, config)` 一次性消费整个 AssemConfig
- **routerConfig 与 uiSkeleton 的 key 一一对应**（场景名 = 路由 name）。渲染器据 `routerConfig[name].path` 构建 memory 路由；场景增删时动态 addRoute/removeRoute 保持同步（`renderer.ts` 的 `syncRouterRoutes`）

---

## 3. uiSkeleton：场景与文档树

```
uiSkeleton.singleTable.viewsProps
├── planeOptions    : IBaseNode        ← 页面主体（渲染为 <AssemViews> 的主节点）
├── dialogOptions   : IBaseNode[]      ← 弹窗文档（渲染为 <AssemDialog> 列表，常驻挂载）
└── drawerOptions?  : IBaseNode[]      ← 抽屉文档（渲染为 <AssemDrawer> 列表）
```

single-table-scene 的实际树形（缩进 = 嵌套，`<>` = 槽位）：

```
[YqFlexBox] "root"                         ← planeOptions（根，layout）
  <itemConfig[0] contentType=container>
    [YqNavigationBar] "navigation-bar2"     ← 顶部导航（routers 数组，非节点子级）
  <itemConfig[1] contentType=container>
    [YqToolBar] "supplierToolbar"           ← 工具栏容器
      <toolSlot>    Button / YqAdvancedFilter / Button     ← 右侧工具按钮区
      <filterSlot>  YqFilterItem×3 → Input / Select        ← 筛选项区
      <defaultSlot> YqFlexLine → Button×3                  ← 常规按钮区
  <itemConfig[2] contentType=container>
    [YqBox] "tableBox"
      <defaultSlot> [YqTableAsync] "singleTable"           ← 异步表格

dialogOptions:
[Dialog] "paymentDialog"                   ← 弹窗（exposed: open/close）
  <defaultSlot> [YqFlexBox] "dialog-layout"
    <itemConfig[0]>
      [YqBox] → [Form] "payment-form"      ← 表单（exposed: validateForm/resetFields/saveFormData）
        <defaultSlot> [GridBox] → [GridItem]×8 → [FormItem] → Input/Select/DatePicker...
    <itemConfig[1]>
      [YqFlexLine] "button-line"           ← 取消/提交按钮行
```

**关键认知**：

1. 弹窗/抽屉是**独立文档树**，不挂在 planeOptions 下；编辑器 `PcSchemaOps.walk` 同时遍历 `planeOptions` 与 `DOCUMENT_ARRAYS = ["dialogOptions", "drawerOptions", "tabOptions"]`（`slot-accessors.ts:106`）
2. 根节点约束：`plane.vue` 渲染 planeOptions 时白名单为 `['layout', 'container']` —— **根必须是布局或容器类**（demo 全部用 YqFlexBox::root）
3. Dialog 的 defaultSlot 白名单为 `['layout', 'container']`；Panel 内容区白名单由 `options.contentType` 决定（默认 `element` → 允许 element + lineElement）

---

## 4. IBaseNode：节点七字段契约

每个节点的固定形态（`assembox-core-next/src/types/base-node.ts`）：

```jsonc
{
  "__nodeName": "btn-search",              // ① 人类可读名（寻址键，getNode 回退路径用它）
  "__nodeId": "Button::btn-search",        // ② 设计期 ID，格式 `${renderType}::${__nodeName}`
  "__nodeType": "renderNode",              // ③ 节点类型标记（isNode() 判定依据）
  "__nodeKey": ["slotName", 0],            // ④ 可选 [所在槽数组名, 下标]
  "__nodeEvent": { ... },                  // ⑤ 事件脚本表（见第 7 章）
  "__nodeOptions": {                       // ⑥ 核心：渲染属性 + 子槽位（见第 6 章）
    "renderType": "Button",                //    ← 决定渲染哪个组件
    ...组件 props,
    "defaultSlot" / "itemConfig" / ...     //    ← 子节点藏在这里
  },
  "__nodeStyle": { "marginTop": "8px" },   // ⑦ 可选行内样式（NodeRenderer :style 直挂宿主元素）
  "__nodeProps": null                      // ⑧ 可选外部数据注入（表格单元格传 scope.row）
}
```

三条铁律：

1. **`renderType` 是唯一的组件寻址键**，必须能在渲染库组件注册表（`components/registry.ts` 的 componentMap / 最新版 `manifest.ts`）中命中，否则 NodeRenderer 报 `UNKNOWN_RENDER_TYPE` 直接不渲染
2. **`__nodeId` 可省略**：`adaptNodeTree` 的 `fillDerivedNodeId` 会按 `renderType::__nodeName` 补全（`adapt-node-tree.ts:92`）；编辑器侧 `PcSchemaOps.genNodeId` 则生成 `Type::${base36时间戳+计数}` —— 两套生成策略并存，设计期 ID 稳定、运行时 ID 带随机后缀防碰撞
3. **`__nodeType === "renderNode"` 是节点判定**：编辑器 `isNode()` 用它区分「节点对象」与「普通配置对象」（如 itemConfig 数组项本身不是节点，其 defaultSlot 才是）

### 4.1 运行时 ID 与设计期 ID 的解析（NodeRegistry.resolve）

渲染组件挂载时 `useNodeRegister` 会生成**运行时 ID**：`Type::name-xxxx`（4 位随机后缀，`node-registry.ts:21`）。事件脚本里的 `ctx.getNode('YqAdvancedFilter::btn-filter')` 是**设计期 ID**（无后缀），解析走两段（`node-registry.ts:217`）：

```
resolve(nodeId):
  1. 精确命中 _store（运行时 ID）→ 直接返回
  2. 拆 "Type::name" → findOne({ name, type }) → 按 name+type 索引回退命中
```

所以 `__nodeName` 在同类型组件内**必须唯一**，否则 getNode 回退路径会命中错误实例。

---

## 5. renderType 词汇表与组件注册

### 5.1 五类 ComponentCategory（`components/registry.ts`）

| category | 语义 | 示例 renderType |
|---|---|---|
| `layout` | 布局（可嵌任意子类型） | YqFlexBox、YqFlexLine、GridBox、GridItem |
| `container` | 容器 | YqBox、YqPanel、YqToolBar、TabPanel、YqNavigationBar |
| `element` | 块级元素 | YqTableAsync、Form、Chart、YqListAsync、Step |
| `lineElement` | 内联元素 | Button、Input、Select、FormItem、YqFilterItem、Tag |
| `columnElement` | 列元素（表格单元格） | ListElement、ButtonGroup |

### 5.2 contentType → 白名单（父槽位对子类别的约束）

```
ALLOWED_CATEGORIES = {
  container:     ['container'],
  element:       ['element', 'lineElement'],
  lineElement:   ['lineElement'],
  columnElement: ['columnElement', 'lineElement'],
  flexBox:       ['layout'],
  gridBox:       ['layout'],
}
```

这条表被三处共用：渲染库 NodeRenderer 的 `allowedCategories` props（违规报 `NEST_CATEGORY_NOT_ALLOWED` 不渲染）、FlexBox itemConfig 的 `item.contentType`、编辑器侧 `nesting-rules.ts`（拖拽前置校验）。

### 5.3 renderType 命名版本说明（重要）

demo JSON 与编辑器 `nesting-categories.ts` 使用 **Yq 前缀词汇表**（源自 `@cs/element-plus-ui` 组件库的 Yq* 包装组件）。渲染库的组件登记表经历了演进：

- **旧结构**：`register-defaults.ts` 逐条 `registerComponent('FlexBox', ...)`（无前缀）
- **新结构**（manifest 单一真相源，commit `037a36e` 引入、`2c98dd9` 批量加 Yq 前缀）：`components/manifest.ts` 的 `COMPONENTS` 表登记 `YqFlexBox: def<Props, Events, Exposed>({ component, category })`，运行时注册、RenderTypeMap/NodeEventConfigMap/NodeExposedMap 三张类型映射全部由它派生，`registerDefaults()` 退化为 `registerManifest()` 一行

最新 manifest（`06fd841`）登记的 renderType 全集：

```
layout:      YqFlexBox YqFlexLine GridBox GridItem
container:   YqBox YqToolBar YqAdvancedFilter TabPanel YqPanel YqNavigationBar
lineElement: YqLabel Tag FilterSummary Image Icon RawHtml UiSkeletonBlockSlot(placeholder)
             Dropdown Button YqBasisCommonSelectApi YqDictionarySelect YqDictionaryTree
             InputNumber Switch Checkbox CheckboxGroup RadioGroup DatePicker
             YqDateRangePicker TimePicker YqSearchSelect YqSearchTreeSelect Input Select
             YqFileImageCardUpload YqFileSimpleUpload YqFileTableUpload FormItem YqFilterItem
element:     YqTableAsync YqTableOnly YqTableReport YqTableTree YqTableEdit
             YqListAsync YqListOnly YqListReport YqSearchTreePanel YqImageCardPreview
             YqOrganizationTreePanel YqOrganizationTreeSelect YqSelectComMaterial
             Chart Step Form
columnElement: ListElement
```

> ⚠️ 当前 workspace 中 `assembox-desktop-next` 的 checkout 停在 manifest 引入之前的状态（register-defaults 无前缀版）。编辑器 `__tests__/nesting-categories.test.ts` 是**对齐守护测试**：逐条比对静态表与 `registerDefaults()` 后的运行时注册表，任何一侧漂移立即红。详见第 17 章。

---

## 6. 子节点存放约束：直接槽位 + 间接容器

**这是整个 JSON 结构中最核心、也最易踩坑的约束**。子节点不在独立的 `children` 字段，而是**分散藏在 `__nodeOptions` 的特定字段里**，且有两种存放模式。编辑器侧 `scenarios/pc-desktop/slot-accessors.ts` 是这个契约的单一真相源：

### 6.1 直接槽位（DIRECT_SLOTS）：`__nodeOptions[field] = node | node[]`

| field | slotKey | label | 典型宿主 |
|---|---|---|---|
| `defaultSlot` | defaultSlot | 内容区 | Panel/Box/Form/FormItem/Dialog/FlexLine(左) |
| `toolSlot` | toolSlot | 工具栏 | YqToolBar（按钮区）/ YqPanel（头部工具） |
| `filterSlot` | filterSlot | 筛选项 | YqToolBar（筛选区） |
| `headerSlot` | headerSlot | 头部 | Dialog |
| `bottomSlot` | bottomSlot | 底部 | 表格（合计行区） |
| `labelSlot` | labelSlot | 标签 | FormItem |
| `rightSlot` | rightSlot | 右侧 | YqFlexLine（右区） |

值形态允许**单对象或数组**（Panel 的 `normalizedSlots` 会归一化为数组）。

### 6.2 间接容器（INDIRECT_CONTAINERS）：`__nodeOptions[arrayField][i][childProp] = node`

| arrayField | childProp | slotKey | 宿主 | removeMode | 插入语义 |
|---|---|---|---|---|---|
| `itemConfig` | defaultSlot | defaultSlot | YqFlexBox（栅格项） | set-null（保留壳） | 优先填空项，否则 createEntry 新建 `{isFixed,size,paddingSize,clearPadding,isHidden,contentType,defaultSlot}` |
| `tabPane` | defaultSlot | defaultSlot | TabPanel | set-null | createEntry `{renderType:'TabPanelItem',label:'新标签',name:tempId,...}` |
| `buttonGroupOptions` | buttonOption | buttonOption | ButtonGroup | splice-entry（删整项） | createEntry `{tooltipOption:{},buttonOption:node}` |
| `columnSlots` | columRender | columRender | 表格自定义列 | set-null | createEntry `{code:tempId,propName:'新列',columRender:node}` |

以 demo 的 YqFlexBox root 为例，`itemConfig` 数组项是**纯配置壳**（isFixed/size/contentType...），真正的节点在每项的 `defaultSlot`：

```jsonc
"__nodeOptions": {
  "renderType": "YqFlexBox",
  "isRow": true, "itemNum": 1, "width": "100%", "height": "100%",
  "itemConfig": [
    { "isFixed": false, "size": ..., "contentType": "container", "defaultSlot": { /* YqNavigationBar 节点 */ } },
    { "isFixed": false, "size": ..., "contentType": "container", "defaultSlot": { /* YqToolBar 节点 */ } },
    { "isFixed": false, "size": ..., "contentType": "container", "defaultSlot": { /* YqBox 节点 */ } }
  ]
}
```

渲染侧对应（`flex-box-assem.vue`）：每个 itemConfig 项渲染为一个具名插槽 `item-${idx+1}`，内容是 `<NodeRenderer :node="item.defaultSlot" :allowedCategories="resolveAllowedCategories(item.contentType)"/>` —— **itemConfig 项的 contentType 决定该栅格内允许放什么类别的组件**。

### 6.3 编辑器遍历/操作 API（`slot-accessors.ts`）

| 函数 | 作用 |
|---|---|
| `forEachChild(node, visitor)` | 统一遍历直接槽位 + 间接容器子节点（walk/大纲树/查找的基础） |
| `locateChild(opts, nodeId, getNodeId)` | 定位子节点：返回 `{slotKey, index, swapArr, container}`（moveUp/Down/remove 共用） |
| `removeChildFromOpts` | 按 removeMode 删除（set-null 留壳 / splice-entry 删整项） |
| `insertChildIntoOpts` | 按 slotKey 插入（itemConfig 优先填 defaultSlot 为空的壳；其余 createEntry） |
| `getSlotChildrenList` | 提取某槽位全部子节点 |
| `getNodeSlots` | 列出节点拥有的槽位（属性面板/大纲用） |

---

## 7. `__nodeEvent`：事件脚本契约

### 7.1 JSON 形态（字符串函数）

```jsonc
"__nodeEvent": {
  "onClick": {
    "enabled": true,
    "fn": "function(ctx) { var t = ctx.getNode('YqAdvancedFilter::btn-filter'); t.exposed.clearFilterState(); ctx.$dataModels.advancedFilter.singleTable = []; ctx.$sharedFns.searchTable(ctx); }"
  }
}
```

兼容旧格式 `{ isOn: boolean, fn }`。`adaptNodeTree.adaptEvents`（core-next）把 `fn` 字符串经 `safeEvalFn` 编译为 `{ enabled, handler }` 函数引用；**解析失败强制 `enabled:false`**（防 dispatch 抛 TypeError）。

### 7.2 事件分两类（`use-node-events.ts`）

1. **内置事件**（`BuiltinEventMap`：onClick/onChange/onMounted/onCurrentChange/onSearch/...）：组件原生触发点调用 `dispatch('onClick', payload)` → 有 `enabled` 才执行 handler
2. **自定义事件**（`isCustomEvent` 判定）：onMounted 时自动注册到 `TypedEventBus.onCustom(name)`，任何脚本可 `ctx.$assemCore.eventBus.emitCustom(name, args)` 触发，onUnmounted 自动退订

`onMounted` 事件由 composable 在挂载钩子自动触发（组件无需 dispatch）。

### 7.3 EventContext：脚本里能摸到的一切

`AssemCore.createEventContext()`（`assem-core.ts:112`）注入给每个 handler 的 `ctx`：

| 成员 | 来源 | 用途 |
|---|---|---|
| `$assemCore` | AssemCore 实例 | eventBus、uiSkeleton 等一切 |
| `$dataModels` | dataModelConfig 构建（**Vue reactive 包装**） | 读写数据模型：`ctx.$dataModels.state.singleTable.selectedRow = row` |
| `$requestFns` | requestConfig 编译 | `ctx.$requestFns.queryPayments(params)` |
| `$sharedFns` | sharedFns 编译 | `ctx.$sharedFns.searchTable(ctx)` |
| `$globalVars` | 全局变量（$context 组织/权限 + $router + 宿主注入） | `ctx.$globalVars.$context.orgId` |
| `$utils` / `$vueGlobal` | core 工具 / Vue 全局属性 | dayjs/cloneDeep 等 |
| `getNode(idOrName)` | NodeRegistry.resolve | `getNode('Dialog::paymentDialog').exposed.open()` |
| `find/findOne` | 按 name/type 查 | `find({type:'Input'})` |

### 7.4 组件反向控制：updateProps / patchProps

demo 中 YqTableAsync 的 `onCurrentChange` 脚本演示了**脚本驱动 UI**：

```js
const btnEdit = ctx.getNode('Button::btn-edit');
btnEdit?.updateProps({ disabled: selectedRow.isBlackList === 0 });  // 浅合并 props
entry.patchProps('itemConfig.0.isHidden', true)                     // 按路径精确改
```

链路：`NodeRegistry entry.updateProps` → `useNodeRegister` 写回 `useNodeOptions` 的响应式 computed → setter 合入 `_overrides`（reactive）→ computed 重算 → 组件 props 更新。`entry.props` 是 Proxy（`use-node-register.ts:63`），读到的永远是最新值。

---

## 8. dataSource：数据三件套契约

### 8.1 requestConfig → $requestFns

```jsonc
"requestConfig": {
  "queryPayments": {
    "url": "/demo/payment-module/getMany",
    "method": "POST",
    "description": "查询客户列表",
    "paramsConfig": {
      "advancedFilterModelName": "advancedFilter.singleTable",
      "paramsType": "...",
      "dataModelName": "filter.singleTable",     // ← 参数取自哪个数据模型
      "paramsModel": { ...字段映射... }
    },
    "beforeReq": { "enabled": false, "fn": "" },  // 请求前拦截（改 axiosConfig）
    "afterReq":  { "enabled": false, "fn": "" }   // 响应后拦截（改 data）
  }
}
```

- `AssemCore._initRequestFns` 对每项 `createHttpFn(config, api, ctx)`（`request/executor.ts`）：`transformParams` 按 paramsConfig 从 `$dataModels` 取参拼 axiosConfig → beforeReq → axios → afterReq → 统一 `HttpResult {error,data,code,status,message}`
- 路径参数支持 `:orgId/:id` 形式（updatePayment/deletePayment）
- **组件按名引用**：表格节点 `__nodeOptions.requestFn: "queryPayments"` → `ctx.$requestFns['queryPayments']`

### 8.2 dataModelConfig → $dataModels

```jsonc
"dataModelConfig": {
  "filter":      { "description": "查询过滤器", "singleTable": { "paymentCode": {"valueType":"string","defaultValue":"","isSkipVal":false}, ... } },
  "editForm":    { "singleTable": { "orgId": {"valueType":"number","defaultValue":0}, ...24 字段 } },
  "state":       { "singleTable": { "selectedRow": {"valueType":"object","defaultValue":null}, "isEdit": {"valueType":"boolean","defaultValue":false}, ... } },
  "advancedFilter": { "singleTable": [] }       // ← 数组模型（列表型）
}
```

- `buildDataModel`（`data-model-builder.ts`）：跳过 `description` 键；数组配置 → `[]`；对象配置 → 逐字段按优先级取值 **全局上下文($context.orgId 等) > 注入数据 > defaultValue > valueType 兜底**（number/boolean→null，list→[]，object→{}）
- `modelName` 点分路径寻址：节点 `__nodeOptions.modelName: "filter.singleTable.paymentCode"` → `getNestedValue($dataModels, modelName)`
- `AssemPlugin.install` 用 `reactive()` 包装 `$dataModels` —— 脚本改模型 → 输入框等绑定组件自动更新

### 8.3 sharedFns → $sharedFns

```jsonc
"sharedFns": {
  "searchTable": { "enabled": true, "fn": "function(ctx, payload) { var t = ctx.getNode('YqTableAsync::singleTable'); ... t.exposed.reloadData(...); }" }
}
```

`initSharedFns` 把函数字符串 safeEvalFn 化；`enabled:false` 跳过。ledger-config 的 15 个共享函数（searchTable/resetTable/normalSearch/refreshCharts...）就是页面的「控制器层」——按钮 onClick 只做一行 `ctx.$sharedFns.listSearchTable(ctx)`。

---

## 9. 渲染库执行管线（JSON → UI）

### 9.1 启动装配（`AssemPlugin.install`，`desktop-next/src/index.ts`）

```
app.use(AssemPlugin, config)
  1. core = new AssemCore(config)            ← 构建 $dataModels/$requestFns/$sharedFns/eventBus/nodeRegistry
  2. core.$dataModels = reactive(...)        ← Vue 响应式包装（$globalVars 同）
  3. eventContext = core.createEventContext(app.config.globalProperties)
  4. app.provide(ASSEM_CONTEXT_KEY, eventContext)
     app.provide(NODE_REGISTRY_KEY, core.nodeRegistry)
  5. globalProperties.$assemCore = core      ← 兼容通道
```

编辑器画布的根组件（PcRenderer / IframeCanvasRenderer 同构）：

```ts
createApp({
  setup: () => {
    const viewsProps = computed(() => schema[activeScene.name]?.viewsProps)  // 场景切换响应式
    return () => h(AssemViews, { viewsProps: vp })   // AssemViews = plane.vue
  }
})
.use(router)                 // memory 路由（NavigationBar 依赖）
.use(AssemPlugin, config)    // ↑ 上述装配
.use(ElementPlus)
+ registerDefaults()         // manifest 组件注册
→ app.mount(container)
```

### 9.2 递归渲染（plane.vue → NodeRenderer → 业务组件）

```
<AssemViews :viewsProps>
  ├─ <NodeRenderer :node="planeOptions" allowedCategories=['layout','container']>
  │     │
  │     │  resolvedComponent = computed:
  │     │    renderType = node.__nodeOptions.renderType
  │     │    meta = lookupMeta(renderType)             ← 注册表查组件 + category
  │     │    未命中 → reportError(UNKNOWN_RENDER_TYPE) → 不渲染
  │     │    白名单校验 isCategoryAllowed(meta.category, allowedCategories)
  │     │      违规 → reportError(NEST_CATEGORY_NOT_ALLOWED) → 不渲染
  │     ↓
  │    <component :is="meta.component"
  │        :__nodeOptions :__nodeEvent :__nodeStyle :__nodeProps
  │        :__nodeId :__nodeName :style="node.__nodeStyle" />
  │
  ├─ <AssemDialog v-for="dialogOptions" .../>   ← 弹窗常驻（v-model 受 options.open 控制）
  └─ <AssemDrawer v-for="drawerOptions" .../>
```

每个**容器/布局组件**（Panel/FlexBox/FlexLine/Toolbar/Dialog/Table...）在自己的模板里继续 `<NodeRenderer :node="options.xxxSlot" :allowedCategories=...>`，形成**由 JSON 树驱动的递归下降渲染**。白名单由各宿主组件硬编码或经 `resolveAllowedCategories(options.contentType)` 查表。

### 9.3 响应式更新模型

- **结构变更**：编辑器对 schema 树的原地增删改（reactive 代理下）→ 各容器组件 computed（options.value.xxxSlot / normalizedSlots）自动重算 → NodeRenderer 重新解析子树。`PcRenderer.setSchema` 用「delete 旧 key + 拷新 key」的 in-place 方式保持同一 reactive 引用
- **props 变更**：`useNodeOptions` 的 computed getter 每次重算（nodeOpts 展开 + defaultsDeep + overrides 合并），`__nodeOptions` 一变即触发
- **表格单元格注入**：`table-async.vue` 渲染 columnSlots 时 `<NodeRenderer :node="{...item.columRender, __nodeProps: scope.row}">` —— **行数据经 `__nodeProps` 注入**，组件内 `useInputValue` 优先读写 `__nodeProps[modelName]`（行内编辑写回行对象而非全局模型）

---

## 10. 节点运行时五支柱（composables）

每个业务组件 setup 中的标准组合（以 input.vue 为例）：

```ts
const ctx = useEventContext();                      // ① inject(ASSEM_CONTEXT_KEY)
const options = useNodeOptions<InputProps>(props, ctx, defaults);  // ② props 合并层
const inputValue = useInputValue(props, ctx);       // ③ v-model 双向绑定（仅输入类）
const { dispatch } = useNodeEvents(props.__nodeEvent, ctx);        // ④ 事件
const { getUtilsAttr } = usePermission(ctx);        //    display/permissionSetting 显隐
useEditor();                                        // ⑤ 编辑器环境桥（见 11.3）
useNodeRegister({ type: 'Input', name: props.__nodeName, props: options });  // ⑥ 注册进 NodeRegistry
```

### useNodeOptions 合并优先级（`use-node-options.ts`）

```
get():
  renderHandler(onValueRender.enabled) 存在 → handler(ctx,{value:raw}) 结果 + nodeOpts 合并
  否则 nodeOpts 非空：
    有 modelName → { ...nodeOpts, content: getNestedValue($dataModels|__nodeProps, modelName) }
    无 modelName → nodeOpts（content 即静态配置）
  否则 → { ...defaults, content: raw }
  最后：defaultsDeep(cloneDeep(结果), defaults + {display:true, permissionSetting:''})
       再覆盖 _overrides（updateProps 写入的运行时补丁，reactive）
set(val) → 合入 _overrides（不回写 JSON，运行时态）
```

三个取值源 `source`：`'model'`（默认，modelName 路径）、`'nodeProps'`、`'content'`（纯内容型组件）。

---

## 11. 编辑器画布渲染机制

编辑器对渲染库是**零侵入复用**：画布里跑的就是生产渲染器 + 一层编辑态增强。两种模式：

### 11.1 模式一：inline 同 DOM（PcRenderer，`scenarios/pc-desktop/renderer.ts`）

```
DesignerHost.onMounted
  → PcRenderer.mount(canvasEl, store.schema, { routerConfig, dataSource, globalVars })
      createApp + buildSceneRouter(memory) + AssemPlugin + registerDefaults
      window.assemBoxIsEdit = true                    ← 声明编辑环境
      window.assemVueRenderer = { onMountedInstance: 首次触发 readyCbs, ... }
      bindCanvasEvents(container)                     ← mousedown 选中/mouseover 悬停（捕获阶段）
  → editor.dragon.addSensor(new CanvasSensor({...}))  ← 拖拽感应区
```

要点：
- **schema 同一引用**：Store 的 reactive schema 直接作为 uiSkeleton 传给 AssemPlugin —— 编辑器 commit 的原地修改即时反映到画布（「响应式桥接」）
- 选中用 **mousedown 优先**（disabled 元素不冒泡 click 但会触发 mousedown），click 仅 stopPropagation 防透传

### 11.2 模式二：iframe 隔离（PcIframeRenderer ⇄ IframeCanvasRenderer）

```
Host 侧（编辑器进程）                          iframe 侧（canvas.html 进程）
────────────────────────                      ────────────────────────────
PcIframeRenderer.mount()
  iframe.src="/canvas.html"
  win.__ASSEM_HOST__ = {回调, assets}  ──→    iframe-renderer-entry.ts bootstrap():
  轮询 win.__ASSEM_RENDERER__ (30ms×10s)        1. 等 __ASSEM_HOST__
        │                                       2. window.Vue = ESM Vue（单实例！）
        │                                       3. 按 assets.js 顺序 loadScript
        │                                          按 assets.css loadStyle
        │                                       4. new IframeCanvasRenderer(host, assets)
        ▼                                       5. win.__ASSEM_RENDERER__ = renderer
  onConnected(api):
    api.setRuntime({routerConfig,dataSource,globalVars})
    api.init(deepClone(schema), designMode) ──→ init: syncSchema → adaptNodeTree → mount
                                                 （app 装配同 inline + assets 插件注册）
                                                 nextTick 后 hostCallbacks.onReady()
```

**同源直引模型**（无 postMessage）：

- Host→iframe：直接调 `win.__ASSEM_RENDERER__.xxx()`（init/setSchema/setScene/setDesignMode/setDraggingState/updateNode）
- iframe→Host：`win.__ASSEM_HOST__` 回调（onReady/onClick/onHover/onError）
- **DOM 查询走 `iframe.contentDocument`（同步）**：getNodeElement/getRect/resolveFromElement
- **schema 深拷贝下发**（structuredClone 优先）：两侧引用彻底独立，Host commit 后必须显式 `setSchema(deepClone(...))` 全量同步
- iframe 内 `IframeCanvasRenderer.syncSchema` 每次都过 `adaptNodeTree`（fn 字符串→handler 编译 + __nodeId 补全）

### 11.3 编辑态 DOM 标记契约（渲染库 useEditor ↔ 画布）

渲染库每个组件 setup 调 `useEditor()`（`use-editor.ts`）：检测 `window.assemBoxIsEdit`，是编辑环境则在 onMounted/onUpdated（nextTick 后）回调 `window.AssemVueRenderer.onMountedInstance/onUpdatedInstance(instance)`。

iframe 模式的 `IframeCanvasRenderer.markInstance`（iframe-canvas-renderer.ts:367）：

```ts
const nodeId = instance?.props?.__nodeId;     // NodeRenderer 透传下来的设计期 ID
if (designMode === 'preview') return;         // 预览不打标
el = instance.proxy.$el; el.setAttribute("data-editor-id", nodeId);
```

由此建立 **JSON 节点 ↔ DOM 元素** 的锚点：

| 属性 | 含义 | 消费方 |
|---|---|---|
| `data-editor-id` | 节点根元素标记（= __nodeId） | getNodeElement / nodeIdFromElement（closest 上溯）/ 选中 / BemTools 定位 |
| `data-slot-host` | 槽位宿主标记（= 容器 nodeId） | getSlotMarkers（槽位矩形） |
| `data-slot-key` | 槽位键 | resolveFromElement 判定悬停落在哪个插槽 |
| `body[data-design-mode]` | design/preview 全局态 | CSS 抑制画布交互 + markInstance 开关 |

`onUpdatedInstance` 复打标记解决 **re-render 丢标记**问题（Vue 重渲染可能替换根元素）；inline 模式的 PcRenderer 也通过同一 `assemVueRenderer` 契约驱动 ready（首次 onMountedInstance → SIMULATOR_READY）。

---

## 12. iframe 画布依赖装配链

demo 的 `module-dependencies-sample.ts`（旧版扁平格式）→ 画布实际加载的完整归一化链：

```
createEditor({ renderDependencies: moduleDependenciesSample })
  → normalizeRenderDependencies(protocol.ts)
      · 过滤 vue/vue.global（防双 Vue 实例——iframe 已持 ESM Vue 并挂 window.Vue）
      · HOST_SCRIPT_ASSET_MAP 按 packageName/url 补全 global/asPlugin/asIcons
        （element-plus-js→ElementPlus+asPlugin；icons-vue→asIcons；element-plus-ui→asPlugin；
          vue3-biz-components-library→asPlugin；js-web-framework→仅挂全局…）
      · fileUrl 去重、保持顺序（element 家族→framework→biz-lib→本地 UMD→better-print）
  → mergeAssets(宿主清单, DEFAULT_PC_ASSETS)    ← 宿主项优先、内置兜底（js 按 src+global 去重，css 按库家族去重）
  → PcIframeRenderer mount 时 win.__ASSEM_HOST__.assets 下发
  → entry 按序 loadScript → IframeCanvasRenderer.mount 内按标记注册：
      asPlugin    → app.use(target, pluginOptions)      （ElementPlus 默认注入中文 locale）
      asIcons     → 遍历全局注册为全局组件
      bootstrap   → new target[ctorPath](args)           （宿主框架构造）
      components  → app.component(别名)                  （box/Box 别名）
      externals   → registerExternal(renderType, 全局取组件, category)  ← 补内置未含组件
```

本地 UMD（`/@cs/assembox-desktop-next/dist/index.umd.cjs` → global `AssemBoxDesktopNext`）加载后，`IframeCanvasRenderer` 的 `desktopNext()` 优先取 UMD 全局、ESM 兜底 —— **保证画布与 Host 可运行不同版本构建产物，但单实例**。

---

## 13. 选中 / 悬停 / 拖拽：编辑交互闭环

### 13.1 选中与悬停

```
用户点击画布元素
  → (iframe) capture click → nodeIdFromEl(e.target.closest('[data-editor-id]'))
  → hostCallbacks.onClick(nodeId, e) → PcIframeRenderer.clickCb
  → Editor.handleClick → editor.select(id)
      → store.select → bus ACTIVE_CHANGE → rebuildPanels()（右侧 setter 面板重建）
  → BemTools 依据 renderer.getRect(nodeId) 画选中框（iframe 模式叠加 iframe 偏移）
悬停同理（mouseover → HOVER_CHANGE → 悬停框）
```

### 13.2 拖拽（自模拟 Dragon 引擎）

```
组件面板 mousedown → editor.startComponentDrag(e, renderType)
  → dragon.boost({type:'nodeData', data})
  → mousemove 注册到 host doc + 所有 sensor doc（跨 iframe）
  → 抖动判定 >4px → dragging
  → chooseSensor（全局坐标命中 CanvasSensor.getBounds）
  → sensor.locate(target, x, y):
      1. findContainerEl：closest('[data-editor-id]') 上溯最近容器
      2. 槽位识别：
         a) renderer.resolveFromElement → data-slot-host/data-slot-key
         b) 场景档案 resolveSlotKeyFromDom（slot-dom-rules.ts）：
            SLOT_DOM_RULES 按组件类名几何解析（YqFlexLine→.yq-flex_line_left/right；
            YqPanel→.panel-content/.header-tool .tool-content；YqToolBar→.yq-filter-content/.yq-tool-slot）
            —— 悬停时解析而非 mounted 写标记，天然跟随 re-render
         c) 兜底 defaultSlot
      3. 嵌套校验 nestingRules.canNest(parentRenderType, slotKey, childRenderType)
         （编辑器静态表 RENDER_TYPE_CATEGORIES + contentType 白名单）
      4. computeInsertIndex：schema 子节点 → renderer.getNodeElement 取 rect
         → detectMainAxis（水平/纵向判定）→ 前后插入索引 + 指示线
  → mouseup → dragon.onDrop
      → Editor.wireDragon.onDrop：
          嵌套校验兜底 → catalog.getComponents().find(renderType) 取 scaffold
          → schemaOps.createNode(cloneSchema(scaffold)) → editor.insert(...)（BEFORE_INSERT 可拦截）
```

---

## 14. Schema 变更同步链（编辑器 → 画布）

```
任意编辑操作（拖放/属性面板/大纲/源码）
  → editor.insert/update/move/remove（BEFORE_* 可拦截）
  → store.commit(label, mutator):
       pushHistory(cloneSchema 快照, 上限50)     ← 撤销栈
       mutator(state.schema)（原地改 reactive schema）
       triggerRef(schemaRef)                    ← 通知面板组件
  → syncRenderer():
       inline : renderer.setSchema(store.schema)（同引用，in-place key 同步 → 响应式 diff）
       iframe : renderer.setSchema(deepClone(schema))
                  → api.setSchema → syncSchema(adaptNodeTree 编译) → reactive 替换 → 重渲染
                  → onUpdatedInstance 复打 data-editor-id
  → AFTER_* 事件 / HISTORY_CHANGE
undo/redo：替换整个 schema 引用 → setSchema 全量同步
场景切换：setScene → store.setActiveScene + renderer.setScene（activeScene.name 响应式 + router.push）
```

属性更新有增量快路径：`editor.update` 额外调 `renderer.updateNode(nodeId, patch)`（iframe 侧 findNodeById + Object.assign __nodeOptions/__nodeEvent/__nodeStyle），未连接时回退全量 setSchema。

---

## 15. 端到端示例：查询按钮的完整生命周期

以 single-table-scene 的 `[Button] "btn-search"` 为例：

```
① 装配   AssemPlugin.install(config)
           $dataModels.filter.singleTable.paymentCode = ""（reactive）
           $requestFns.queryPayments = createHttpFn(...)（参数源 filter.singleTable）
           $sharedFns.searchTable = safeEvalFn(fn 字符串)

② 渲染   planeOptions → YqFlexBox → itemConfig[1].defaultSlot → YqToolBar
           → toolSlot → NodeRenderer(Button) → input... 即 button.vue
           useNodeOptions: content="查询" plain icon=Search（defaultsDeep 补全）
           useNodeRegister: NodeRegistry 注册 Input...Button::btn-search-xxxx
           useEditor: data-editor-id="Button::btn-search" 落到根元素

③ 输入   用户在 filterSlot 的 Input 输入付款单号
           useInputValue.set → setNestedValue($dataModels, 'filter.singleTable.paymentCode', v)
           （reactive → 任何依赖该模型的组件同步更新）

④ 点击   button.vue @click → dispatch('onClick')
           handler(ctx) 执行：
             ctx.getNode('YqAdvancedFilter::btn-filter').exposed.clearFilterState()
             ctx.$dataModels.advancedFilter.singleTable = []
             ctx.$sharedFns.searchTable(ctx)
               └→ getNode('YqTableAsync::singleTable').exposed.reloadData(...)
                    └→ ctx.$requestFns.queryPayments(分页+filter.singleTable 参数)
                         └→ transformParams → beforeReq → axios → afterReq → setData(tableData)
                            （reactive → yq-table-async 重渲染行）

⑤ 编辑态 同一画布内：点击该按钮 → data-editor-id 命中 → editor.select
           → 右侧 SettingsPane 按 catalog 元数据渲染 setter（content/plain/icon）
           → StringSetter 改 content → editor.updateProps → store.commit
           → renderer.updateNode 增量 → 按钮 JSON 与 UI 同步变更，进入撤销栈
```

---

## 16. 结构约束汇总表（速查）

| # | 约束 | 来源/校验点 |
|---|---|---|
| 1 | 顶层必须 `uiSkeleton` + `dataSource`，routerConfig 的 key 与 uiSkeleton 场景一致 | AssemConfig；EditorRouter/渲染器建路由 |
| 2 | 场景值必须是 `{ viewsProps: { planeOptions, dialogOptions?, drawerOptions? } }` | plane.vue props；PcSchemaOps.walk |
| 3 | planeOptions 类别必须是 layout/container | plane.vue 白名单 |
| 4 | 节点必须有 `__nodeOptions.renderType` 且注册表可命中 | NodeRenderer UNKNOWN_RENDER_TYPE |
| 5 | `__nodeId` 格式 `renderType::__nodeName`，可省略（自动补全）；同类型内 __nodeName 唯一 | adaptNodeTree / NodeRegistry.resolve 回退 |
| 6 | `__nodeType:"renderNode"` 是节点判定标记 | isNode()（编辑器） |
| 7 | 子节点只能放直接槽位 7 字段或间接容器 4 处，值形态 node/node[] | slot-accessors DIRECT_SLOTS/INDIRECT_CONTAINERS |
| 8 | itemConfig 项是配置壳（contentType/size...），节点在其 defaultSlot；contentType 决定白名单 | flex-box-assem / ALLOWED_CATEGORIES |
| 9 | 父槽位类别白名单：container←container；element←element+lineElement；lineElement←lineElement；columnElement←columnElement+lineElement；flexBox/gridBox←layout | registry.ALLOWED_CATEGORIES + NodeRenderer 校验 + 编辑器 nestingRules |
| 10 | `__nodeEvent.* = {enabled, fn:string}`（兼容 isOn）；fn 编译失败强制禁用 | adaptEvents |
| 11 | 事件脚本函数签名 `function(ctx, payload)`；ctx 只暴露 EventContext 成员 | createEventContext |
| 12 | `__nodeOptions.modelName` 为点分路径，根于 dataModelConfig 的模型名 | useInputValue/useNodeOptions |
| 13 | requestFn 值必须是 requestConfig 的 key | table-async loadData |
| 14 | sharedFns 项 `enabled:false` 不编译 | initSharedFns |
| 15 | 函数型属性（formatter/beforeReq/afterReq/fn...）可为字符串，adaptNodeTree 统一编译 | FUNCTION_PROPS 表 |
| 16 | dialogOptions/drawerOptions/tabOptions 为节点数组文档树，不挂在 planeOptions 下 | DOCUMENT_ARRAYS |
| 17 | `__nodeProps` 用于外部数据注入（表格单元格 scope.row），优先级高于 $dataModels | useInputValue/useNodeOptions |
| 18 | __nodeStyle 同时作为组件内样式配置与根元素 :style | NodeRenderer :style |

---

## 17. 版本对齐注意事项

分析过程中确认的版本漂移（当前 workspace 状态）：

1. **渲染库双副本辨析（2026-08 勘误）**：本机存在两份 `assembox-packages-project`——workspace（`00-source-amis/` 内）指向的副本是**新版**（`components/manifest.ts` + Yq 前缀词汇表 + `use-table-persist-config` 等），与编辑器 `nesting-categories.ts` 及三份 demo JSON 对齐（守护测试 `nesting-categories.test.ts` 通过已验证）；外层 `2027project/assembox-packages-project` 副本为旧版（无 manifest、无前缀注册），其 git refs 中含 manifest 演进线（`037a36e`→`2c98dd9`→`06fd841`），仅作历史参考，勿据其得出「版本漂移」结论。安装/构建注意：libs 的 `prepare` 为 `tsc`（emit d.ts）+ `vite build`（仅产物不含 d.ts），跳脚本安装后需补跑两步才能同时获得 `dist/index.js` 与 `dist/index.d.ts`
2. **静态表同步义务**：渲染库新增组件/调整 category 必须同步编辑器 `RENDER_TYPE_CATEGORIES`（守护测试强制）；升级 UI 库改类名必须同步 `slot-dom-rules.ts` 的 SLOT_DOM_RULES（无测试守护，靠注释约定）
3. **两套 nodeId 生成策略并存**：设计期 `renderType::name`（JSON 内稳定、脚本 getNode 寻址）与运行时 `Type::name-xxxx`（NodeRegistry 注册防碰撞）。编辑器新建节点用 `genNodeId`（时间戳 base36），粘贴/复制走 `regenerateNodeIds` 全子树换新 —— 两套 ID 靠 `resolve()` 的两段解析弥合，**__nodeName 唯一性是该机制的正确性前提**
4. **`public/@cs/assembox-desktop-next` 目前仅占位 package.json**（无 dist 产物）：本地 UMD 依赖样例（`/@cs/assembox-desktop-next/dist/index.umd.cjs`）需先构建拷贝才能生效；缺省时 IframeCanvasRenderer 回退 Vite ESM 解析（dev 可用，但与 CDN 全局包的装配语义有差异）

---

## 附：关键源码索引

| 主题 | 文件 |
|---|---|
| 节点契约类型 | `assembox-core-next/src/types/base-node.ts`、`node-id.ts`、`node-style.ts` |
| 核心装配 | `core/assem-core.ts`（AssemCore/createEventContext） |
| JSON→运行时编译 | `core/adapt-node-tree.ts`（事件/函数属性/__nodeId 补全）、`core/safe-eval.ts` |
| 数据构建 | `core/data-model-builder.ts`、`core/shared-fn-loader.ts`、`request/executor.ts` |
| 节点注册表 | `core/node-registry.ts`（运行时 ID/resolve 两段解析/updateProps/patchProps） |
| 组件注册表 | `desktop-next/src/components/registry.ts`（category/白名单）、`register-defaults.ts`（旧）、`components/manifest.ts`（新，git 06fd841） |
| 递归渲染 | `components/render/NodeRenderer.vue`、`components/layer/plane.vue`（AssemViews） |
| 容器实现参考 | `layout/flex-box-assem.vue`（itemConfig 插槽）、`layout/flex-line-assem.vue`（defaultSlot/rightSlot）、`block-contanier/panel/index.vue`（contentType 白名单）、`layer/dialog-page.vue`（exposed open/close）、`element-container/.../table-async.vue`（requestFn/columnSlots/__nodeProps） |
| 节点运行时 | `composables/use-node-options.ts`、`use-input-value.ts`、`use-node-events.ts`、`use-node-register.ts`、`use-editor.ts`、`use-permission.ts` |
| 编辑器槽位契约 | `new-assembox-editor/src/scenarios/pc-desktop/slot-accessors.ts`（单一真相源） |
| 编辑器树操作 | `scenarios/pc-desktop/schema-ops.ts`（PcSchemaOps） |
| inline 画布 | `scenarios/pc-desktop/renderer.ts`（PcRenderer） |
| iframe 画布 | `simulator/iframe/pc-iframe-renderer.ts`（Host）、`iframe-canvas-renderer.ts`（内侧）、`iframe-renderer-entry.ts`（入口）、`protocol.ts`（协议+依赖归一化）、`canvas.html` |
| 嵌套/槽位识别 | `scenarios/pc-desktop/nesting-categories.ts`、`nesting-rules.ts`、`slot-dom-rules.ts` |
| 拖拽 | `designer/dragon.ts`、`drag/canvas-sensor.ts`、`designer/designer-host.tsx` |
| 守护测试 | `src/__tests__/nesting-categories.test.ts`、`slot-dom-rules.test.ts`、`render-dependencies.test.ts` |
