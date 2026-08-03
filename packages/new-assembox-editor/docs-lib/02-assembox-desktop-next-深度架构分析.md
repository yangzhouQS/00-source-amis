# @cs/assembox-desktop-next — PC 端低代码渲染库深度分析

> **版本**：0.1.0（重构版）
> **定位**：云阙平台 PC 端低代码渲染库
> **技术栈**：Vue 3 + TypeScript + Element Plus
> **核心依赖**：`@cs/assembox-core-next`（workspace:*）
> **tags**: `lowcode`, `renderer`, `vue3`, `element-plus`, `assembox`, `pc`, `manifest`, `nesting`, `composable`, `architecture`

---

## 目录

- [1. 包定位与架构总览](#1-包定位与架构总览)
- [2. 入口与初始化](#2-入口与初始化)
- [3. 组件注册系统](#3-组件注册系统)
- [4. 嵌套规则系统](#4-嵌套规则系统)
- [5. 组件渲染流程](#5-组件渲染流程)
- [6. Composable 设计](#6-composable-设计)
- [7. 数据交互系统](#7-数据交互系统)
- [8. 事件处理机制](#8-事件处理机制)
- [9. 外部组件接入](#9-外部组件接入)
- [10. 类型安全与声明合并](#10-类型安全与声明合并)
- [11. 错误处理与上报](#11-错误处理与上报)
- [12. 完整组件清单](#12-完整组件清单)
- [13. 公共 API 导出清单](#13-公共-api-导出清单)
- [14. 性能与扩展性](#14-性能与扩展性)

---

## 1. 包定位与架构总览

### 1.1 三层架构

```
┌───────────────────────────────────────────────────┐
│              应用层（业务项目 / demo）              │
│    app.use(AssemPlugin, config) + registerDefaults()  │
└────────────────────────┬──────────────────────────┘
                         │ provide/inject
┌────────────────────────▼──────────────────────────┐
│         @cs/assembox-desktop-next（本包）           │
│                                                    │
│  ┌─────────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ AssemPlugin │  │ Manifest │  │ Nesting SLOTS│  │
│  │ (Vue Plugin)│  │ (登记表) │  │ (嵌套白名单)  │  │
│  └──────┬──────┘  └────┬─────┘  └──────┬───────┘  │
│         │              │               │          │
│  ┌──────▼──────────────▼───────────────▼───────┐  │
│  │  AssemNodeRenderer（递归渲染 + 嵌套校验）    │  │
│  │  renderType → lookupMeta → category 校验    │  │
│  └──────────────────────┬──────────────────────┘  │
│                         │                          │
│  ┌──────────────────────▼──────────────────────┐  │
│  │  50+ 业务组件 (.vue)                        │  │
│  │  container · layout · element · lineElement │  │
│  │  columnElement + 视图层(Dialog/Drawer/Plane) │  │
│  └─────────────────────────────────────────────┘  │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │  10 个 Composable（组件统一接入层）           │ │
│  └──────────────────────────────────────────────┘ │
└────────────────────────┬──────────────────────────┘
                         │ workspace:*
┌────────────────────────▼──────────────────────────┐
│            @cs/assembox-core-next（核心库）         │
│  AssemCore · TypedEventBus · NodeRegistry          │
│  DataModel · RequestFns · SharedFns · safeEvalFn   │
│  IssueReporter · utils                              │
└────────────────────────────────────────────────────┘
```

### 1.2 核心设计理念

| 原则 | 说明 |
|---|---|
| **Manifest 单一真相源** | 所有组件的 Props/Events/Exposed 类型 + 运行时实现 + 分类，集中在 `manifest.ts` 一张表 |
| **类型/运行时分层** | `ComponentTypes`（类型层）→ `COMPONENTS`（运行时层），双向锁死 key 一致，避免循环依赖 |
| **Nesting 声明式** | 嵌套规则集中在 `nesting.ts` 的 `SLOTS` 表，模板只声明「我是谁的哪个槽」，不自己写白名单 |
| **Composable 统一** | 10 个 hook 收编旧版分散逻辑，组件 setup 调用模式完全一致 |
| **外部组件零知识接入** | `registerExternal()` 自动套适配器，外部组件写普通 Vue 组件即可 |

---

## 2. 入口与初始化

### 2.1 AssemPlugin（Vue Plugin）

**文件**: `src/index.ts`

```typescript
export const AssemPlugin: Plugin<[AssemConfig]> = {
  install(app: App, config: AssemConfig) {
    // 1. 安装默认 IssueReporter（ElMessage 弹窗，仅 error 级用户可见问题）
    if (isDefaultIssueReporter()) setIssueReporter(defaultIssueReporter);

    // 2. 创建核心引擎
    const core = new AssemCore(config);

    // 3. 用 Vue reactive 包装核心数据
    core.$dataModels = reactive(core.$dataModels);
    core.$globalVars = reactive(core.$globalVars);

    // 4. 创建事件上下文
    const eventContext = core.createEventContext(app.config.globalProperties);

    // 5. provide/inject 注入
    app.provide(ASSEM_CONTEXT_KEY, eventContext);
    app.provide(NODE_REGISTRY_KEY, core.nodeRegistry);
    app.config.globalProperties.$assemCore = core;
  }
};
```

### 2.2 初始化时序

```
应用 main.ts
  │
  ├─ app.use(AssemPlugin, { uiSkeleton, dataSource })
  │    ├─ setIssueReporter(defaultIssueReporter)   // 仅默认时安装
  │    ├─ new AssemCore(config)                     // 数据模型/请求/事件
  │    ├─ reactive($dataModels / $globalVars)
  │    └─ provide(ASSEM_CONTEXT_KEY / NODE_REGISTRY_KEY)
  │
  ├─ registerDefaults()
  │    └─ registerManifest()                        // 遍历 COMPONENTS 注册全部
  │
  ├─ registerExternal({ name: 'OrgPicker', ... })   // 可选：外部组件
  │
  └─ app.mount('#app')
       └─ AssemNodeRenderer 递归渲染 uiSkeleton
```

### 2.3 Injection Keys

```typescript
export const ASSEM_CONTEXT_KEY: InjectionKey<EventContext> = Symbol('AssemContext');
export const NODE_REGISTRY_KEY: InjectionKey<NodeRegistry> = Symbol('NodeRegistry');
```

---

## 3. 组件注册系统

### 3.1 三层注册架构

**文件**: `src/components/manifest.ts` + `src/components/component-catalog.ts`

```
manifest.ts（单一真相源）
  ├─ ComponentTypes（类型层）     ← Props / Events / Exposed，只引用类型
  │    └─ 派生 RenderTypeMapFromManifest
  │    └─ 派生 NodeEventConfigMapFromManifest
  │    └─ 派生 NodeExposedMapFromManifest
  │
  └─ COMPONENTS（运行时层）       ← { component, category }，key 与类型层双向锁死
       └─ registerManifest()     ← 遍历填入 component-catalog

component-catalog.ts（运行时目录）
  └─ componentMap = shallowReactive(Map)  ← renderType → { component, category }
       └─ registerComponent()    ← 注册（内置 + 外部统一入口）
       └─ lookupComponent()      ← 查找
       └─ lookupMeta()           ← 查找元信息
```

**为什么分两层**（manifest.ts 注释）：
- 三张类型映射由类型层派生，`IBaseNode` 依赖这些映射
- 组件的 `.vue` setup 里又用到 `IBaseNode`
- 若改由 `typeof COMPONENTS` 派生 → 形成 `类型映射 → 组件值 → 类型映射` 的闭环 → TS7022/TS2313

### 3.2 注册 API

```typescript
// 内置组件注册（manifest 自动完成）
registerManifest(): void
// 等价于 registerDefaults()

// 外部组件注册
registerExternal(def: ExternalComponentDef): void

// 底层注册（内部用）
registerComponent(name: string, component: Component, category: ComponentCategory): void
```

### 3.3 shallowReactive 的关键作用

```typescript
// component-catalog.ts
const componentMap = shallowReactive(new Map<string, ComponentMeta>());
```

**为什么必须响应式**：`AssemNodeRenderer` 在 computed 里查这张表。若用普通 Map，「注册晚于渲染」是一条不可恢复的死路——节点先挂载 → 查不到 → 渲染空 → 此后即使补注册，computed 没有依赖变化也永远不会重算。换成 `shallowReactive` 后，补注册会自动触发重渲染。

### 3.4 覆盖保护

```typescript
// 同名不同实现 → 覆盖 + 告警（有意允许的逃生口）
if (prev && prev.component !== component) {
  reportWarn('COMPONENT_OVERRIDDEN', `组件 "${name}" 被重复注册...`);
}
```

---

## 4. 嵌套规则系统

### 4.1 设计原则

**文件**: `src/components/nesting.ts`

> 嵌套规则集中在 `SLOTS` 一张表：逐组件、逐槽位写死允许的类别。判定统一发生在 `AssemNodeRenderer`——模板不再自己写白名单数组。

**关键约束**：本文件只准 `import type`，不准出现值导入（否则形成 `模板 → nesting → manifest → 模板` 的运行时循环导入）。

### 4.2 SLOTS 声明表

```typescript
export const SLOTS: Partial<Record<SlotHost, SlotMap>> = {
  // 视图层
  Plane:    { defaultSlot: ['layout', 'container'] },
  Dialog:   { defaultSlot: ['layout', 'container'] },
  Drawer:   { defaultSlot: ['layout', 'container'] },

  // 容器
  Panel:    { defaultSlot: ['layout', 'element', 'lineElement'] },
  Box:      { defaultSlot: ['layout', 'element', 'lineElement'] },
  Toolbar:  { toolSlot: ['lineElement'], filterSlot: ['lineElement'] },
  TabPanel: { defaultSlot: ['element', 'lineElement', 'layout'], labelSlot: ['lineElement'] },
  NavigationBar: { defaultSlot: ['lineElement'] },

  // 布局
  FlexBox:  { defaultSlot: ['container', 'layout', 'element', 'lineElement'] },
  FlexLine: { defaultSlot: ['lineElement'], rightSlot: ['lineElement'] },
  GridBox:  { defaultSlot: ['layout'] },
  GridItem: { defaultSlot: ['element', 'lineElement'] },

  // 元素
  Form:       { defaultSlot: ['layout', 'element'] },
  FormItem:   { defaultSlot: ['lineElement'] },
  FilterItem: { defaultSlot: ['lineElement'] },
  Card:       { headerSlot: ['lineElement', 'element'], defaultSlot: ['layout', 'element', 'lineElement'] },

  // 表格族单元格
  TableAsync/TableNext/TableReport: { columRender: ['columnElement', 'lineElement'], bottomSlot: 'any' },
  TableOnly/TableTree/TableEdit:    { columRender: ['columnElement', 'lineElement'] },

  // 列表族条目
  ListAsync/ListNext/ListOnly/ListReport: { defaultSlot: ['columnElement', 'lineElement', 'layout'] },

  // 列元素
  ButtonGroup:  { buttonOption: ['lineElement', 'columnElement'] },
  ListElement:  { defaultSlot: ['columnElement', 'lineElement', 'element'] },
};
```

### 4.3 槽位类型

| 槽位字段 | 典型宿主 | 说明 |
|---|---|---|
| `defaultSlot` | Panel/Box/FlexBox/Card | 主内容区 |
| `toolSlot` | Toolbar | 工具按钮区 |
| `filterSlot` | Toolbar | 筛选项区 |
| `headerSlot` | Card | 卡片头部 |
| `bottomSlot` | TableAsync | 分页下方 |
| `labelSlot` | TabPanel | 标签页标签 |
| `rightSlot` | FlexLine | 行右侧 |
| `columRender` | Table 族 | 单元格 |
| `buttonOption` | ButtonGroup | 按钮组子项 |

### 4.4 `'any'` vs 未登记

| 取值 | 行为 |
|---|---|
| `['lineElement']` | 只允许内联元素 |
| `'any'` | **有意**不限制，不告警 |
| 未登记（undefined） | 不设限但**告警** `NEST_SLOT_UNDECLARED`（有人加了新槽忘了登记） |

---

## 5. 组件渲染流程

### 5.1 AssemNodeRenderer

**文件**: `src/components/render/assem-node-renderer.vue`

```vue
<component
  :is="resolvedComponent"
  v-if="resolvedComponent"
  :__nodeOptions="node.__nodeOptions"
  :__nodeEvent="node.__nodeEvent"
  :__nodeStyle="node.__nodeStyle"
  :__nodeProps="node.__nodeProps"
  :__nodeId="node.__nodeId"
  :__nodeName="node.__nodeName"
  :style="node.__nodeStyle"
/>
```

**Props**:
```typescript
defineProps<{
  node: IBaseNode;           // 节点配置
  parent: SlotHost;          // 宿主组件名（如 'Panel'）
  slotName: SlotField;       // 宿主的哪个槽（如 'defaultSlot'）
}>();
```

### 5.2 渲染判定逻辑

```
1. 取 renderType → lookupMeta(renderType)
   ├─ 未找到 → reportError('UNKNOWN_RENDER_TYPE') → 不渲染
   └─ 找到 → 继续

2. 查 nesting.ts: lookupSlotGate(parent, slotName)
   ├─ 未登记 → reportWarn('NEST_SLOT_UNDECLARED') → 不校验（保持渲染）
   ├─ 'any' → 不校验
   └─ 类别数组 → isCategoryAllowed(meta.category, allowed)
      ├─ 不允许 → reportError('NEST_CATEGORY_NOT_ALLOWED') → 不渲染
      └─ 允许 → 渲染组件

3. DEV 环境：检测事件未 adaptNodeTree → reportWarn('EVENT_NOT_ADAPTED')
```

---

## 6. Composable 设计

### 6.1 十个核心 Composable

| Composable | 文件 | 职责 |
|---|---|---|
| `useEventContext()` | `use-event-context.ts` | inject 获取 EventContext（类型安全） |
| `useNodeOptions(props, ctx, defaults)` | `use-node-options.ts` | 统一节点选项 computed（3 源 + onValueRender + defaults 合并） |
| `useNodeEvents(nodeEvent, ctx)` | `use-node-events.ts` | 事件注册/触发/自动清理（dispatch + EventBus） |
| `useNodeRegister(opts)` | `use-node-register.ts` | 节点注册到 NodeRegistry（Proxy props + updateProps + patchProps） |
| `useInputValue(props, ctx)` | `use-input-value.ts` | 输入组件双向绑定（modelName → modelValue） |
| `usePermission(ctx)` | `use-permission.ts` | 权限 + 显示控制 |
| `useEditor()` | `use-editor.ts` | 编辑器环境集成（assemBoxIsEdit → AssemVueRenderer 回调） |
| `useRemoteData(ctx)` | `use-remote-data.ts` | 统一的远端数据拉取入口（loading + 信封剥离 + 错误处理） |
| `readModelValue` / `writeModelValue` | `model-value.ts` | modelName 取值/写回的唯一解析口 |

### 6.2 标准组件 setup 模式

```typescript
// 所有内置组件的 setup 结构完全一致
const ctx = useEventContext();
const options = useNodeOptions<MyProps>(props, ctx, { /* defaults */ });
const { dispatch } = useNodeEvents(props.__nodeEvent, ctx);
const { getUtilsAttr } = usePermission(ctx);
const visible = getUtilsAttr(options);
useEditor();
useNodeRegister({ type: 'MyComp', name: props.__nodeName, exposed: {...}, props: options });
```

### 6.3 useRemoteData（统一远端数据）

```typescript
const { loading, load } = useRemoteData(ctx);

async function handleLoad() {
  const payload = await load<TableData>('fetchTableData', { pageNum: 1 });
  if (!payload) return;           // 失败/取消 → null
  const { count, result } = toPaged<UserRow>(payload);
  // count + result 可直接用
}
```

**关键改进**：旧版 16 个组件各自写请求逻辑，判错 2 个、静默 return 5 个、没 catch 1 个、把信封当数据 8 个 → 全部收进 `useRemoteData`。

---

## 7. 数据交互系统

### 7.1 架构

请求完全委托给 `@cs/assembox-core-next`：

```
组件 → useRemoteData.load(fnName, params)
  → ctx.$requestFns[fnName](params)
    → createHttpFn() → transformParams() → axios()
  ← HttpResult { status, data, error, code }
  ← useRemoteData 剥信封：result.data → payload
```

### 7.2 信封剥离

```typescript
// use-remote-data.ts
async function load(fnName, params) {
  const result = await fn(params);
  if (result.error) return null;           // 失败已上报
  return result.data ?? null;              // 剥掉 HttpResult 信封
}

// 形状兜底
toRows<T>(payload): T[]      // payload → 行数组（裸数组 or {result:[]}）
toPaged<T>(payload): {count, result}  // payload → 分页结构
```

### 7.3 数据绑定

| 绑定模式 | 解析 | 写回 |
|---|---|---|
| `modelName` → `$dataModels` | `readModelValue(source, ctx, modelName)` | `writeModelValue(...)` |
| `modelName` + `__nodeProps`（表格行） | 相对行数据解析 | 写回行数据 |
| `useNodeOptions` 内部 | `content = resolveRawValue()` | `_overrides` 覆盖 |
| `useInputValue`（v-model） | `get: readModelValue` | `set: writeModelValue` |

---

## 8. 事件处理机制

### 8.1 三种事件类型

| 类型 | 触发 | 示例 |
|---|---|---|
| **内置事件** | 组件内 `dispatch('onClick', payload)` | Button 点击、Input 变化 |
| **自定义事件** | `eventBus.emitCustom('refresh')` | 跨组件联动 |
| **生命周期** | `useNodeEvents` onMounted 自动触发 | 初始化加载 |

### 8.2 dispatch 签名

```typescript
const { dispatch } = useNodeEvents(props.__nodeEvent, ctx);

// 组件内触发（类型安全：BuiltinEventMap 约束）
function handleClick() {
  dispatch('onClick', { row: props.__nodeProps });
}
```

### 8.3 事件适配链

```
JSON 配置 __nodeEvent.fn（字符串）
  → adaptNodeTree()（core-next） → handler 函数（safeEvalFn 安全校验）
  → useNodeEvents 在 onMounted 注册/触发
  → 组件 dispatch('onClick', payload) → handler(ctx, payload)
```

---

## 9. 外部组件接入

### 9.1 registerExternal

**文件**: `src/components/register-external.ts`

```typescript
// 注册一个普通 Vue 组件，无需了解节点协议
registerExternal({
  name: 'OrgPicker',
  component: OrgPicker,   // 普通 Vue 组件（modelValue / props / emit / defineExpose）
  category: 'lineElement',
});
```

### 9.2 适配器自动翻译

`createAdapter()` 自动套一层包装：

| 翻译项 | 说明 |
|---|---|
| **属性透传** | `__nodeOptions` 去除框架字段后透传为普通 props |
| **值绑定** | `modelName` → `modelValue` + `onUpdate:modelValue`（v-model） |
| **事件转接** | DSL 事件 → Vue emit 监听（事件名同名，无需映射表） |
| **权限** | `display` / `permissionSetting` → v-if |
| **实例注册** | `defineExpose` → `exposed` Proxy → NodeRegistry |
| **编辑器集成** | `useEditor()` 自动接入 |

### 9.3 框架自用字段（不透传）

```typescript
const FRAMEWORK_FIELDS = new Set([
  'renderType', 'modelName', 'content', 'display', 'permissionSetting'
]);
```

### 9.4 限制（外部组件给不了的）

- 带插槽的容器（子节点、嵌套约束）
- 自己读 `ctx`、自己发请求
- 自定义事件载荷形状（统一是 `{ value, args, row }`）

---

## 10. 类型安全与声明合并

### 10.1 Manifest 驱动的类型派生

```typescript
// manifest.ts
interface ComponentTypes {
  Button: Def<ButtonProps, { onClick?: TypedEventHandler<{row?}> }, {}>;
  Select: Def<SelectProps, {...}, { loadOptions: () => Promise<void>; ... }>;
  TableAsync: Def<TableProps, TableLikeEvents, TableLikeExposed>;
  // ...
}

// 自动派生三张映射
type RenderTypeMapFromManifest = { [K in keyof ComponentTypes]: ComponentTypes[K]['props'] };
type NodeEventConfigMapFromManifest = { [K in keyof ComponentTypes]: ComponentTypes[K]['events'] };
type NodeExposedMapFromManifest = { [K in keyof ComponentTypes]: ComponentTypes[K]['exposed'] };
```

### 10.2 augment.d.ts 声明合并

```typescript
declare module '@cs/assembox-core-next' {
  // manifest 派生的类型 + 视图层手写
  interface RenderTypeMap extends RenderTypeMapFromManifest {
    Dialog: DialogProps;
    Drawer: DrawerProps;
    Plane: PlaneProps;
  }
  interface NodeEventConfigMap extends NodeEventConfigMapFromManifest { ... }
  interface NodeExposedMap extends NodeExposedMapFromManifest { ... }
}
```

**效果**：`ctx.getNode('TableAsync::userTable')?.reloadData()` 有完整类型提示；写错事件名/参数类型在编译期报错。

---

## 11. 错误处理与上报

### 11.1 IssueReporter 体系

```
core-next: reportError/reportWarn → IssueReporter
                                    ↓
desktop-next: defaultIssueReporter
  ├─ 全部进 console（error → console.error, warn → console.warn）
  └─ 面向用户的 error 弹 ElMessage（仅 REQUEST_FAILED / EVENT_HANDLER_ERROR）
```

**用户可见 vs 开发者可见**：

| 问题码 | 收件人 | 弹 ElMessage |
|---|---|---|
| `REQUEST_FAILED` | 最终用户 | ✅ |
| `EVENT_HANDLER_ERROR` | 最终用户 | ✅ |
| `UNKNOWN_RENDER_TYPE` | 搭页面的人 | ❌（仅 console） |
| `NEST_CATEGORY_NOT_ALLOWED` | 搭页面的人 | ❌ |
| `COMPONENT_OVERRIDDEN` | 搭页面的人 | ❌ |
| `UNSAFE_FN` | 搭页面的人 | ❌ |

**宿主可覆盖**：`setIssueReporter(myReporter)`，插件不覆盖已装好的（`isDefaultIssueReporter()` 检查）。

### 11.2 边界处理

| 场景 | 处理 |
|---|---|
| 未注册的 renderType | reportError + 不渲染 |
| 嵌套类别不允许 | reportError + 不渲染 |
| 槽位未在 SLOTS 登记 | reportWarn + 不校验（保持渲染） |
| 事件 fn 字符串未 adapt | reportWarn（DEV 环境） |
| 请求函数不存在 | reportWarn + 返回 null |
| 请求失败 | core 已上报 + 返回 null（不重复弹窗） |
| modelName 未配置 | 回退到 content/nodeProps |
| 权限不足 | getUtilsAttr → false → v-if 隐藏 |
| 组件卸载 | useNodeRegister 自动注销 + useNodeEvents 自动清理 |

---

## 12. 完整组件清单

### 12.1 组件分类总览

| 分类 | 数量 | 说明 |
|---|---|---|
| container | 5 | 容器（Panel/Box/Toolbar/TabPanel/NavigationBar） |
| layout | 4 | 布局（FlexBox/FlexLine/GridBox/GridItem） |
| element | 14 | 块级元素（Form/Table×6/List×4/Chart/Card/Step/Tree/WebCamera） |
| lineElement-显示 | 8 | Button/Label/Tag/Dropdown/Image/Icon/Statistic/RawHtml |
| lineElement-输入 | 15 | Input/Select/Switch/RadioGroup/CheckboxGroup/Checkbox/DatePicker/DateRangePicker/TimePicker/InputNumber/SearchSelect/SearchTreeSelect/FormItem/FilterItem |
| columnElement | 2 | ButtonGroup/ListElement |
| 视图层 | 3 | Dialog/Drawer/Plane（不经 NodeRenderer） |
| **合计** | **51** | |

### 12.2 详细清单（含暴露方法）

| renderType | 分类 | 暴露方法 |
|---|---|---|
| **Button** | lineElement | — |
| **Input** | lineElement | — |
| **Select** | lineElement | loadOptions, setOptions, clearOptions, getOptions |
| **Label** | lineElement | — |
| **Tag** | lineElement | — |
| **Dropdown** | lineElement | — |
| **Image** | lineElement | — |
| **Icon** | lineElement | — |
| **Statistic** | lineElement | — |
| **RawHtml** | lineElement | — |
| **InputNumber** | lineElement | — |
| **Switch** | lineElement | — |
| **Checkbox** | lineElement | — |
| **CheckboxGroup** | lineElement | loadOptions, setOptions, clearOptions, getOptions |
| **RadioGroup** | lineElement | loadOptions, setOptions, clearOptions, getOptions |
| **DatePicker** | lineElement | focus, handleOpen, handleClose |
| **DateRangePicker** | lineElement | — |
| **TimePicker** | lineElement | getTimePickerInstance |
| **SearchSelect** | lineElement | — |
| **SearchTreeSelect** | lineElement | — |
| **FormItem** | lineElement | — |
| **FilterItem** | lineElement | — |
| **Form** | element | validateForm, resetFields, clearValidate, saveFormData |
| **TableAsync** | element | reloadData, setData, clearData, getData, getPaginationParams, setCurrentPage, getLoading |
| **TableNext** | element | 同 TableAsync |
| **TableOnly** | element | reloadData, setData, clearData, getData |
| **TableReport** | element | getNativeRefs, reloadData, clearData, setData, setCurrentPage |
| **TableTree** | element | reloadData, clearData, getNativeRefs, setData |
| **TableEdit** | element | growData, getNativeRefs, deleteData, deleteAllData, sumRow |
| **ListAsync** | element | getScrollRef, reloadData, setData, clearData, getData |
| **ListNext** | element | 同 ListAsync + setCurrentPage |
| **ListOnly** | element | 同 ListAsync |
| **ListReport** | element | 同 ListAsync + setCurrentPage |
| **Chart** | element | loadData, updateOption, reRender |
| **Card** | element | — |
| **Step** | element | — |
| **Tree** | element | reload |
| **WebCamera** | element | initCamera, getPhotoBase64 |
| **FlexBox** | layout | — |
| **FlexLine** | layout | — |
| **GridBox** | layout | — |
| **GridItem** | layout | — |
| **Panel** | container | — |
| **Box** | container | — |
| **Toolbar** | container | — |
| **TabPanel** | container | — |
| **NavigationBar** | container | — |
| **ButtonGroup** | columnElement | — |
| **ListElement** | columnElement | — |
| **Dialog** | 视图层 | open, close |
| **Drawer** | 视图层 | open, close |
| **Plane** | 视图层 | — |

---

## 13. 公共 API 导出清单

### 13.1 从 index.ts 导出

| 导出 | 类型 | 说明 |
|---|---|---|
| `AssemPlugin` | Vue Plugin | 安装 AssemCore + reactive 包装 + provide/inject |
| `registerDefaults()` | Function | 注册全部内置组件（遍历 manifest） |
| `registerExternal(def)` | Function | 注册外部组件（自动套适配器） |
| `defaultIssueReporter` | IssueReporter | 桌面层默认上报器（ElMessage 弹窗） |
| `ASSEM_CONTEXT_KEY` | InjectionKey | EventContext 注入键 |
| `NODE_REGISTRY_KEY` | InjectionKey | NodeRegistry 注入键 |
| `useEventContext()` | Composable | 获取事件上下文 |
| `useNodeOptions(props, ctx, defaults)` | Composable | 节点选项 computed |
| `useNodeEvents(nodeEvent, ctx)` | Composable | 事件管理（dispatch + 自动清理） |
| `useNodeRegister(opts)` | Composable | 节点注册（Proxy props + updateProps） |
| `useInputValue(props, ctx)` | Composable | 输入双向绑定 |
| `usePermission(ctx)` | Composable | 权限控制 |
| `useEditor()` | Composable | 编辑器集成 |
| `isEditorEnv()` | Function | 判断编辑器环境 |
| `useRemoteData(ctx)` | Composable | 远端数据拉取（loading + 信封剥离） |
| `toRows(payload)` | Function | payload → 行数组 |
| `toPaged(payload)` | Function | payload → 分页结构 |
| `registerComponent(name, comp, cat)` | Function | 底层组件注册 |
| `lookupComponent(name)` | Function | 查找组件 |
| `lookupMeta(name)` | Function | 查找组件元信息 |
| `AssemNodeRenderer` | Component | 递归渲染器 |
| 所有 core-next 导出 | Re-export | AssemCore/EventBus/NodeRegistry/utils 等 |

### 13.2 类型导出

```typescript
// 基础类型
type Size, LabelPosition, Justify, Align, PaddingSize, Direction, ContentType, FormItemLayout

// 组件 Props 类型（50+）
ButtonProps, InputProps, SelectProps, FormProps, TableProps, TableEditProps,
FlexBoxProps, FlexLineProps, GridBoxProps, PanelProps, BoxProps, ToolbarProps,
TabPanelProps, DialogProps, DrawerProps, PlaneProps, ChartProps, ...

// 渲染类型
ComponentCategory, ComponentMeta, SlotField, SlotHost, SlotGate
ExternalComponentDef, ManifestEntry, Def<Props, Events, Exposed>

// Manifest 派生类型
RenderTypeMapFromManifest, NodeEventConfigMapFromManifest, NodeExposedMapFromManifest
```

---

## 14. 性能与扩展性

### 14.1 性能措施

| 措施 | 位置 | 说明 |
|---|---|---|
| `shallowReactive(Map)` | component-catalog | 只跟踪键增删，不深度代理 Vue 组件对象 |
| reactive 仅包装 `$dataModels/$globalVars` | AssemPlugin | 非全量 schema 响应式 |
| Proxy 代替快照 | useNodeRegister | props 实时读取，不拷贝 |
| computed 缓存 | useNodeOptions | 内部计算结果缓存 |
| onUnmounted 自动清理 | useNodeEvents/useNodeRegister | 事件监听/注册表条目不泄漏 |
| ElMessage grouping | defaultIssueReporter | 同一文案短时间内重复只弹一次 |

### 14.2 扩展性

| 扩展点 | 方式 |
|---|---|
| 新增内置组件 | manifest.ts `ComponentTypes` 加类型 + `COMPONENTS` 加运行时 → 自动注册 + 类型派生 |
| 新增外部组件 | `registerExternal({ name, component, category })` → 零协议知识 |
| 新增嵌套规则 | nesting.ts `SLOTS` 加槽位约束 |
| 自定义 IssueReporter | `setIssueReporter(myReporter)` |
| 新增 Composable | 复用 useEventContext + useNodeRegister 模式 |
| 覆盖内置组件 | `registerComponent(name, newImpl, cat)` → 自动告警 + 替换 |

### 14.3 与旧版关键改进

| 维度 | 旧版 | 新版 |
|---|---|---|
| 组件注册 | regist-coms.ts 硬编码 4 层 | manifest.ts 单一真相源 + 类型派生 |
| 嵌套规则 | 模板各自传白名单数组 | nesting.ts SLOTS 集中声明 |
| 属性解析 | 4 个重复 computed | useNodeOptions 统一（3 源 + onValueRender） |
| 远端数据 | 16 个组件各自实现（多数有 bug） | useRemoteData 统一（7 步标准流程） |
| 外部接入 | 需手写 6 个 __ prop + 5 个 composable | registerExternal 自动适配 |
| 类型安全 | 无 | manifest 派生三张映射 + 编译期检测 |
| 错误处理 | 散落 console | IssueReporter 统一 + ElMessage 用户可见 |
| 框架耦合 | globalProperties | provide/inject + Composable |

---

**tags**: `architecture`, `vue3`, `element-plus`, `lowcode-renderer`, `manifest`, `nesting`, `composable`, `type-augmentation`, `component-system`, `event-system`, `remote-data`, `external-component`, `issue-reporter`, `permission`, `editor-integration`
