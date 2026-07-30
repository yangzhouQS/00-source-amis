# amis 优秀设计借鉴分析

> 研究范围：amis-core（渲染器/Store/Scoped）、amis-editor-core（面板/Builder/插件）、amis-editor（插件实现/ae 控件/tpl/DSBuilder）、amis-ui、amis-theme-editor-helper
> 配套文档：`04`（lowcode 插件）、`05`（lowcode 物料）、`06`（amis 插件系统）
> 目标：提炼 amis 的优秀设计理念，为 new-assembox-editor 后续迭代提供参考

---

## 一、最高价值设计（强烈推荐借鉴）

### 1. 配置片段工厂（getSchemaTpl / setSchemaTpl）★★★★★

**问题**：当前每个组件的 `props[]`（PropConfig 数组）全量手写，大量重复（label/placeholder/visible/disabled/layout...）。

**amis 方案**：三层 DRY 复用
```
层1：ae-* 控件（原子能力：APIControl/OptionControl/ValidationControl/EventControl）
层2：tpl 片段（setSchemaTpl('label', schema) 全局注册，getSchemaTpl('label', patch) 参数化取用）
层3：插件 panelBodyCreator 编排（getSchemaTpl('tabs', [getSchemaTpl('collapseGroup', [...])])）
```

**关键机制**：
- `setSchemaTpl(name, value | (patch, options) => schema)` — 全局注册
- `getSchemaTpl(name, patch, options)` — 取用，patch 合并
  - value 是函数：`tpl(patch, options)` 调用，patch 作入参
  - value 是对象：`{...tpl, ...patch}` 浅合并
- 片段可引用片段（`getSchemaTpl('source')` 内部调 `getSchemaTpl('apiControl')`），递归组合

**收益**：100+ 组件的面板维护成本趋近 O(1)。`label`/`placeholder`/`visible`/`api` 等几乎每个组件都要的配置，一处定义全局复用。要给所有"选项"配置加新功能，只改 `options.tsx` 一处。

**Vue3 迁移建议**：建立 `defineConfigFragment(name, factory)` + `getConfigFragment(name, overrides)` 注册中心。

---

### 2. Schema 驱动的配置面板（自举渲染）★★★★★

**amis 精髓**：配置面板本身用 amis Schema 声明，由 `<SchemaForm>` 渲染——**用 amis 渲染 amis 编辑器**。

- `panelBodyCreator(context)` 返回标准 amis Schema（`{type:'form', body:[...], submitOnChange:true}`）
- 双向绑定：`onChange` 自动写回 schema props
- `pipeIn/pipeOut` 做数据双向转换
- `diff(value, newValue)` 只有真变化才触发更新
- `submitOnChange:true` 实时保存

**面板渲染链路**：
```
Plugin.panelBodyCreator(context) → SchemaCollection
  ↓
manager.makeSchemaFormRender({body, definitions, pipeOut})
  ↓ 返回 render(props) 函数
  ↓
SchemaForm 构造 {type:'form', body:[...], submitOnChange:true}
  ↓
amis render(schema, props, env) 渲染（自举）
```

**Vue3 迁移**：当前 PropConfig 已是声明式，但缺"面板渲染自举"和"片段复用"。可实现 schema-driven 的配置面板渲染器。

---

### 3. 事件/动作声明 + 跨组件编排 ★★★★★

**amis 方案**：

```ts
// 插件静态声明组件的事件能力和动作能力
class ButtonPlugin extends BasePlugin {
  events: RendererPluginEvent[] = [
    {eventName: 'click', eventLabel: '点击', dataSchema: [...]}
  ];
  actions: RendererPluginAction[] = [
    {actionLabel: '提交表单', actionType: 'submit', ...getActionCommonProps('submit')},
    {actionLabel: '变量赋值', actionType: 'setValue', ...}
  ];
}
```

编辑器全局收集所有插件的 events/actions 成 `pluginActions/pluginEvents`，`EventControl` 控件做跨组件联动编排：
- 选事件 → 添加动作 → 选目标组件 → 配参数
- 动作拖拽排序（Sortable.js）
- 常用动作记忆（localStorage）
- 最终产出 `onEvent: {click: {actions: [{actionType:'setValue', componentId:'xxx', args:{...}}]}}`

**动作参数 schema**：`COMMON_ACTION_SCHEMA_MAP` 集中管理公共动作（setValue/reload/show/hide...），插件只需声明 actionType。

**当前差距**：new-assembox-editor 有 EventConfig 但无编排 UI、无动作执行引擎、无跨组件通信。

---

### 4. 数据契约 buildDataSchemas + 作用域链 ★★★★★

**amis 方案**：每个组件通过 `buildDataSchemas(node)` 向 JSONSchema 作用域链声明自己暴露的数据结构。

```ts
// Table 的数据契约（递归聚合列字段）
async buildDataSchemas(node, region, trigger) {
  let itemsSchema = {type:'object', properties:{}};
  // 递归调用每个子组件的 buildDataSchemas 聚合字段定义
  while (cells.length) {
    const tmp = await child.plugin.buildDataSchemas(child, region, trigger, node);
    itemsSchema.properties[child.name] = {...tmp, $id: `${child.id}-${child.type}`};
  }
  return {
    type:'object',
    properties: {
      rows: {type:'array', title:'数据列表', items: itemsSchema},
      selectedItems: {type:'array', title:'已选中行', items: itemsSchema}
    }
  };
}
```

**关键设计**：
- **`$id` 稳定标识**（`节点id-节点type`）+ removeSchema/addSchema 去重
- **递归聚合**：Table 不直接知道列字段，递归调子组件
- **trigger 感知**：表格列内联动时自动建立"当前行"子作用域
- **跨层级收集**：通过 source 表达式向上查找父作用域字段定义

**运行时动态注入**：`rendererBeforeDispatchEvent` 监听接口返回，把实际数据加入作用域。

**当前差距**：完全缺失。这是公式/变量选择的基础设施。

---

### 5. 面板三层骨架 ★★★★★

**amis 统一范式**：`tabs → collapseGroup → body`

```
属性 Tab → 折叠组 [基本/状态/外观/数据源] → 配置项数组
外观 Tab → 折叠组 [布局/样式/自定义] → 配置项
事件 Tab → EventControl
```

**工厂函数**：
- `getSchemaTpl('tabs', config)` — 扁平化 body + 自动 p-none
- `getSchemaTpl('collapseGroup', config)` — 折叠面板组，activeKey 自动计算
- `config.filter(Boolean)` — 支持条件渲染写法
- `flatten(body)` — 自动展开嵌套数组

**当前差距**：settings-pane 的 PropConfig 是扁平列表，无折叠分组。

---

## 二、高价值设计（推荐借鉴）

### 6. __super 原型链数据作用域 ★★★★☆

**amis**：`createObject(superData, ownData)` 用 `Object.create(superData)` 实现"可读父级、写隔离自身"的层级数据域。

```ts
function createObject(superProps, props) {
  const obj = superProps
    ? Object.create(superProps, {
        __super: {value: superProps, writable: false, enumerable: false}
      })
    : Object.create(Object.prototype);
  props && Object.keys(props).forEach(key => obj[key] = props[key]);
  return obj;
}
```

子组件读变量时自动沿 `__super` 链向上查找。dialog/drawer 场景用 `createObjectFromChain(chain[])` 拼接数据上下文。

**Vue3 迁移**：用 `Proxy` + `reactive` 替代——天然支持"读穿透、写隔离"，响应式免费，比 amis 的 frozen+clone 更简洁。

---

### 7. Scoped 组件通信（reload/send/close）★★★★☆

**amis**：声明式 target 字符串定位组件，组件间无需直接引用。

```ts
// 刷新目标组件（支持 query 变量替换 + subPath 路由）
scope.reload('userList?page=1&name=${name}', ctx);
// 向目标组件发送数据
scope.send('formA', {name: '张三'});
// 关闭弹窗
scope.close('dialogB');
```

**组件查找 API**：
| API | 策略 |
|---|---|
| `getComponentByName(name)` | 本作用域 → 向上递归 parent；支持 `a.b.c` 点号路径 |
| `getComponentById(id)` | 从当前 scope 逐层向上到 root |
| `getComponentByIdUnderCurrentScope(id)` | 只在当前 scope 子树内 |

**Vue3 迁移**：`provide/inject` + 组件实例注册表（Map<name, instance>）。

---

### 8. xxxOn 表达式约定 ★★★★☆

**amis**：schema 属性加后缀即变表达式：

| 后缀 | 处理 | 示例 |
|---|---|---|
| `xxxOn` | 布尔条件求值 | `visibleOn: "this.status == 1"` |
| `xxxExpr` | 模板字符串渲染 | `classNameExpr: "bg-${type}"` |
| `xxxClassName` | 类名对象递归求值 | `{active: "this.active"}` |

`getExprProperties(schema, data)` 遍历 schema 所有属性，正则匹配后缀，求值后生成最终 props。配合 MobX `reaction` 实现**响应式**（表达式结果随 store.data 自动更新）。

**Vue3 迁移**：`computed` 天然响应式，`resolveExprProps(schema, data)` 自动求值，代码量比 amis 减半（无需手动 reaction + stringify 比对）。

---

### 9. filterProps 编辑态 mock ★★★★☆

| 场景 | mock 内容 | 原因 |
|---|---|---|
| Table/Cards/List 无数据 | 根据 columns 定义生成假数据行 | 空容器无法预览样式 |
| Dialog/Drawer 编辑态 | `InlineModal` 内联化展示 | 弹窗默认不显示，无法选中 |
| 有数据时 | `slice(0, 3)` 限流 | 大数据卡死编辑器 |
| Form | 规范化 rules 结构 | 编辑态需序列化 |

**关键**：mock 结果缓存在 `node.state` 避免重复计算。

---

### 10. DSBuilder 多数据源抽象 ★★★★☆

```
DSBuilderInterface（接口）→ DSBuilder（抽象类）→ ApiDSBuilder（具体）
registerDSBuilder(ApiDSBuilder)  // 注册制，零侵入扩展
DSBuilderManager                 // 每插件持有一个，管理多 builder
```

核心能力：
- `match(schema)` — 反查当前 schema 用哪个 builder
- `makeSourceSettingForm()` — 生成数据源配置表单
- `buildInsertSchema/buildEditSchema/buildViewSchema` — 各场景 schema 构建
- `guessCRUDScaffoldConfig` — 从已有 schema 反推配置
- `getContextFields/getAvailableContextFields` — 数据联动字段

---

### 11. 渲染器注册三表 + weight ★★★☆☆

| 表 | 类型 | 用途 | 复杂度 |
|---|---|---|---|
| `renderers` | 有序数组 | path 正则匹配（weight 小优先） | O(n) |
| `renderersTypeMap` | 哈希映射 | type 直接映射 | **O(1)** |
| `renderersMap` | 标记表 | 存在性判断 | O(1) |

`resolveRenderer` 先查 typeMap（O(1)），未命中才走 weight 排序数组。缓存策略只缓存纯正则结果。

`@Renderer` 装饰器流程：校验 → 冲突检测 → 合并/插入 → 组件增强（HocStoreFactory + Scoped）→ 更新三表 + alias 处理。

---

## 三、中等价值设计

### 12. 统一状态控件 ae-StatusControl ★★★☆☆

disabled/visible/hidden/static 统一一个控件，支持"静态布尔值 + 表达式（xxxOn）"双模式。避免每个状态属性单独写 switch + 表达式。

### 13. SwitchMore「开关+展开」控件 ★★★☆☆

把"是否启用某特性"和"该特性的详细配置"合并为一个控件，消除 `{type:'switch'} + {visibleOn}` 样板。

### 14. 基类插件叠加（ItemPlugin）★★★☆☆

不绑定 rendererName 的"基类插件"通过 `buildEditorPanel` 钩子为同类组件（如表单项）注入通用配置面板。具体插件用 `notRenderFormZone = true` 退出基类面板。

### 15. 内核/内容分层 ★★★☆☆

`amis-editor-core`（框架/协议）与 `amis-editor`（150+ 具体插件）完全分离。内核不含任何具体组件的面板定义，通过 `registerEditorPlugin()` + side-effect import 注入内容。

### 16. 面板多重身份 multifactor ★★★☆☆

一个节点对应多个配置面板时（如 CRUD 既是 CRUD 又是 Table），递归 `collectPanels` 收集同 id 子节点的面板，以 `sub-config` key 追加。

### 17. hackIn 原型劫持注入 Region ★★☆☆☆

容器组件通过原型方法替换注入可拖拽 Region。**Vue3 应避免**，改用高阶组件/渲染函数包装。

---

## 四、Store 状态管理（MST 设计，参考了解）

### StoreType 继承树

```
StoreNode（基础：树形结构 + 生命周期）
  └ iRendererStore（数据域核心：data/__super/upStreamData）
      ├ ServiceStore（接口交互：fetching/saving/fetchData/saveRemote）
      │   ├ RootStore（全局变量 + downStream 注入 global/context/query）
      │   ├ FormStore（字段级管理：items/valid/errors/setValues 联动重置）
      │   └ CRUDStore（分页选择：page/perPage/total/query/selectedItems）
```

不同 StoreType 决定**数据如何被读取、写入、与父级同步**。

### Store 注入与数据同步

`HocStoreFactory`（WithStore.tsx）的 `componentDidUpdate` 是多分支数据同步状态机：
- `extendsData === false`（独立数据域）→ initData 合并
- `scope === data`（嵌套场景）→ createObject
- `data.__super` 存在 → extendObject + syncDataFromSuper
- trackExpression 变化 → 细粒度订阅

### Vue3 对比

| amis（React + MST） | Vue3 对应 |
|---|---|
| MST Store 树 | Pinia store 树 / reactive 嵌套 |
| `__super` 原型链（frozen + clone） | Proxy + reactive（响应式免费） |
| MobX reaction（手动订阅 + stringify） | computed / watch（自动依赖追踪） |
| React Context | provide / inject |

**核心启示**：Vue3 的响应式系统可大幅简化 amis 中因 React + MST frozen 特性带来的 clone/reaction 复杂度。

---

## 五、动作系统（22 个动作类型）

### Action 注册与执行

```ts
registerAction('ajax', new AjaxAction());  // 插件式注册
runActions(actions, renderer, event);       // 统一调度
```

**Action 分类**：

| 分类 | 动作 |
|---|---|
| 逻辑控制 | loop/break/continue/switch/parallel/wait |
| 组件交互 | setValue/reload/validateFormItem/show/hidden/disabled |
| 接口 | ajax/download |
| UI | dialog/drawer/closeDialog/toast/copy/email/link/print |
| 事件 | broadcast/setEventData/preventDefault/stopPropagation |
| 页面 | goBack/refresh/goPage |
| 自定义 | custom（执行 script） |

**RendererEvent 上下文**：
- `preventDefault()` — 阻止组件原有行为
- `stopPropagation()` — 阻止后续动作
- `setData(data)` — 动作链间传递数据（如 ajax 结果供后续用）
- `pendingPromise[]` / `allDone()` — 异步等待

---

## 六、DSBuilder 数据源构建器（详细设计）

### 三层结构

```
DSBuilderInterface（接口，定义全生命周期方法契约）
  ▲ implements
DSBuilder<T>（抽象类，公共逻辑）
  ▲ extends
ApiDSBuilder（具体实现，默认 builder）

DSBuilderManager（每 Plugin 持有一个，管理多 builder）
```

### 核心方法

| 方法组 | 能力 |
|---|---|
| 元信息 | name/order/features（List/Insert/Edit/View/Delete）/isDefault |
| 匹配 | match(schema, key) — 判断属于哪个 builder |
| 字段 | getContextFields / getAvailableContextFields — 数据联动 |
| 配置表单 | makeSourceSettingForm / makeFieldsSettingForm |
| 场景构建 | buildInsertSchema/buildEditSchema/buildViewSchema |
| CRUD 专属 | buildCRUDColumnsSchema/buildCRUDFilterSchema |
| 脚手架 | buildFormSchema/buildCRUDSchema |
| 还原 | guessCRUDScaffoldConfig/guessFormScaffoldConfig |

**协作模式**：面板用 `getDSSelectorSchema()` 生成"数据来源"单选 + 每个 builder 一组配置，`visibleOn` 切换。新增数据源只需 `registerDSBuilder(new DBDSBuilder)`，无需改 Form 插件。

---

## 七、面板系统设计（补充细节）

### 两级面板组织

```
右侧侧边栏 RightPanels（PanelItem[]）
├── Tab "属性"        ← 第一级：PanelItem（buildEditorPanel 贡献）
│   └── collapseGroup（折叠组）
│       ├── Collapse "基本"
│       └── Collapse "状态"
├── Tab "外观"
└── Tab "事件"
```

### PanelItem 类型

```ts
interface PanelItem {
  key: string;              // 唯一标识
  icon / pluginIcon;        // 双图标体系
  title;                    // 标题
  component?: Component;    // 方式A：自定义组件
  render?: (props) => JSX;  // 方式B：渲染函数（主路径）
  order: number;            // 全局排序
  position?: 'left'|'right';
}
```

### 面板重建链路

```
选中节点 → activeId 变化 → buildPanels → collectPanels(node)
  → 遍历 plugins 调 buildEditorPanel → setPanels（整体替换）
  → RightPanels 自动重渲染
```

面板是 **derived state**，每次选中重建，不缓存。配合 Tab 懒挂载保证性能。

---

## 八、配置片段高频清单（100+ 片段分类）

| 类别 | 高频片段 | 用途 |
|---|---|---|
| 容器结构 | tabs/collapseGroup/collapse/divider | 面板骨架 |
| 表单项 | formItemName/label/placeholder/required/description | 几乎每个表单组件都用 |
| 状态 | disabled/readonly/visible/hidden/static | 统一 ae-StatusControl |
| 公式 | formulaControl/textareaFormulaControl/expression | 公式编辑器 |
| API | apiControl/source/initFetch/interval | 数据源配置 |
| 选项 | options/multiple/menuTpl | 选项编辑 |
| 校验 | validations/validationErrors | 校验规则 |
| 布局 | layout:position/layout:flex/layout:inset | 20+ 布局片段 |
| 样式 | theme:base/theme:font/theme:border/theme:paddingAndMargin | 主题令牌系统 |
| 事件 | eventControl/status | 事件编排 |

---

## 九、优先级路线图

```
第一优先（配置面板体验）：
  ├─ 配置片段工厂（getSchemaTpl / setSchemaTpl）
  ├─ 面板三层骨架（tabs → collapseGroup → body）
  └─ filterProps 编辑态 mock

第二优先（联动基础）：
  ├─ 数据契约 buildDataSchemas + 作用域链
  ├─ xxxOn 表达式约定 + computed 求值
  └─ Scoped 组件通信（reload/send/close）

第三优先（事件编排）：
  ├─ events/actions 声明 + 全局收集
  ├─ EventControl 编排控件
  └─ 动作执行引擎（registerAction + runActions）

第四优先（数据源/扩展）：
  ├─ DSBuilder 多数据源抽象
  ├─ 统一状态控件
  └─ SwitchMore 复合控件
```

---

## 十、核心设计理念总结

1. **声明优先于命令**：xxxOn 后缀约定、onEvent 配置驱动 actions、schema 即配置——让用户用 JSON 描述行为而非写代码。

2. **树形同构的三个维度**：组件树（React）、Store 树（MST）、Scoped 树（Context）三者同构但独立，分别管渲染、状态、通信。

3. **三级 DRY 复用**：控件原子层 → tpl 片段层 → 插件编排层。新物料 80% 配置靠组合现有片段完成。

4. **自举渲染**：配置面板本身用 amis Schema 声明、用 amis 渲染——编辑器是自身的用户。

5. **注册表解耦**：内核定义协议，物料通过注册注入。`rendererName` 是绑定唯一钥匙。

6. **原型链数据作用域**：`Object.create` 巧妙实现"可读父级、写隔离自身"的数据继承，是整个数据流的基础设施。

**对 Vue3 的最大启示**：充分利用 Vue3 响应式系统（reactive/computed/provide-inject）可大幅简化 amis 中因 React + MST frozen 特性带来的 clone/reaction 复杂度，同时保留"声明式 schema + 插件式渲染器 + 作用域通信"的核心架构优势。

---

## 十一、与配套文档的关系

| 文档 | 主题 | 本文增量 |
|---|---|---|
| `04-lowcode插件设计借鉴分析.md` | lowcode 插件（factory + skeleton） | — |
| `05-lowcode物料meta设计借鉴分析.md` | lowcode 物料 meta（PropConfig/ComponentMeta） | — |
| `06-amis插件系统设计借鉴分析.md` | amis 插件系统（PanelDock/Dock/调度） | — |
| `09-编辑器骨架灵活化设计.md` | 骨架/面板（浮动固定/FocusTracker） | — |
| **本文 10** | **amis 运行时 + 编辑器内核 + 配置体系** | **配置片段工厂/数据契约/事件编排/DSBuilder/Store/Scoped/动作系统** |
