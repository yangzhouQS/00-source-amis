# @cs/assembox-desktop-next — 深度架构分析

> **版本**：0.1.0
> **定位**：云阙平台 PC 端低代码渲染库（重构版）
> **依赖**：`@cs/assembox-core-next`（框架无关核心） + Vue 3 + Element Plus
> **tags**: `lowcode`, `renderer`, `vue3`, `element-plus`, `assembox`, `pc`, `architecture`

---

## 目录

- [1. 包定位与整体架构](#1-包定位与整体架构)
- [2. 入口与初始化流程](#2-入口与初始化流程)
- [3. 组件系统](#3-组件系统)
- [4. 布局与嵌套规则系统](#4-布局与嵌套规则系统)
- [5. 数据交互系统](#5-数据交互系统)
- [6. 事件处理机制](#6-事件处理机制)
- [7. Composable 设计](#7-composable-设计)
- [8. 类型安全与声明合并](#8-类型安全与声明合并)
- [9. 完整组件清单](#9-完整组件清单)
- [10. 公共 API 导出清单](#10-公共-api-导出清单)
- [11. 模块依赖关系](#11-模块依赖关系)
- [12. 编辑器集成](#12-编辑器集成)
- [13. 错误处理与边界](#13-错误处理与边界)
- [14. 性能与扩展性](#14-性能与扩展性)

---

## 1. 包定位与整体架构

### 1.1 设计理念

```
┌──────────────────────────────────────────────────┐
│            应用层（desktop-demo / 业务项目）       │
│   app.use(AssemPlugin, config) + registerDefaults() │
└───────────────────────┬──────────────────────────┘
                        │ provide/inject
┌───────────────────────▼──────────────────────────┐
│         @cs/assembox-desktop-next（本包）          │
│  ┌──────────────┐  ┌───────────┐  ┌───────────┐  │
│  │ AssemPlugin  │  │ Composables│  │ Registry  │  │
│  │ (Vue Plugin) │  │ (7个hook)  │  │ (注册表)   │  │
│  └──────┬───────┘  └─────┬─────┘  └─────┬─────┘  │
│         │                │              │         │
│  ┌──────▼──────────────────────────────────▼───┐  │
│  │           NodeRenderer（递归渲染）           │  │
│  │  renderType → lookupMeta → category 校验   │  │
│  └──────────────────┬─────────────────────────┘  │
│                     │                             │
│  ┌──────────────────▼─────────────────────────┐  │
│  │           40+ 业务组件 (.vue)               │  │
│  │  container · layout · element · lineElement│  │
│  └────────────────────────────────────────────┘  │
└───────────────────────┬──────────────────────────┘
                        │ workspace:*
┌───────────────────────▼──────────────────────────┐
│           @cs/assembox-core-next（核心库）         │
│  AssemCore · TypedEventBus · NodeRegistry         │
│  DataModel · RequestFns · SharedFns · safeEvalFn  │
└──────────────────────────────────────────────────┘
```

### 1.2 三层架构

| 层 | 职责 | 技术栈 |
|---|---|---|
| **core-next** | 框架无关引擎（数据模型/请求/事件/注册/安全执行） | 纯 TS + axios + crypto-js |
| **desktop-next**（本包） | Vue 渲染适配 + 40+ PC 组件 + Composable | Vue 3 + Element Plus |
| **应用层** | 路由配置 + 页面 JSON + 安装插件 | Vue Router + 业务代码 |

---

## 2. 入口与初始化流程

### 2.1 AssemPlugin（Vue Plugin）

**文件**: `src/index.ts`

```typescript
export const AssemPlugin: Plugin<[AssemConfig]> = {
  install(app: App, config: AssemConfig) {
    // 1. 创建核心引擎
    const core = new AssemCore(config);
    
    // 2. 用 Vue reactive 包装核心数据（实现响应式）
    core.$dataModels = reactive(core.$dataModels);
    core.$globalVars = reactive(core.$globalVars);
    
    // 3. 创建事件上下文（getNode/find/findOne + $dataModels 等）
    const eventContext = core.createEventContext(
      app.config.globalProperties
    );
    
    // 4. provide/inject 注入（替代全局属性）
    app.provide(ASSEM_CONTEXT_KEY, eventContext);
    app.provide(NODE_REGISTRY_KEY, core.nodeRegistry);
    
    // 5. 兼容全局属性
    app.config.globalProperties.$assemCore = core;
  }
};
```

### 2.2 初始化时序

```
应用 main.ts
  │
  ├─ app.use(AssemPlugin, { uiSkeleton, dataSource })
  │    └─ new AssemCore(config)
  │         ├─ buildDataModels() → $dataModels
  │         ├─ initSharedFns()   → $sharedFns
  │         └─ createHttpFn()    → $requestFns
  │    └─ reactive($dataModels / $globalVars)
  │    └─ provide(ASSEM_CONTEXT_KEY / NODE_REGISTRY_KEY)
  │
  ├─ registerDefaults()
  │    └─ registerComponent('Button', AssemButton, 'lineElement')
  │    └─ ... (40+ 组件)
  │
  └─ app.mount('#app')
       └─ NodeRenderer 递归渲染 uiSkeleton
```

### 2.3 Injection Keys

```typescript
// src/constants.ts
export const ASSEM_CONTEXT_KEY: InjectionKey<EventContext> = Symbol('AssemContext');
export const NODE_REGISTRY_KEY: InjectionKey<NodeRegistry> = Symbol('NodeRegistry');
```

---

## 3. 组件系统

### 3.1 组件注册机制

**文件**: `src/components/registry.ts`

```typescript
// 注册
registerComponent(name: string, component: Component, category: ComponentCategory): void

// 查询
lookupComponent(name: string): Component | undefined
lookupMeta(name: string): ComponentMeta | undefined
getComponentMap(): ReadonlyMap<string, ComponentMeta>
```

**注册流程**:
```typescript
import { registerComponent } from './components/registry';

registerComponent('Button', AssemButton, 'lineElement');
// 内部: componentMap.set('Button', { component: AssemButton, category: 'lineElement' })
```

### 3.2 组件属性定义方式

所有组件统一接收 `IBaseNode` 标准 props：

```typescript
// 组件 defineProps
const props = defineProps<{
  __nodeOptions?: Record<string, unknown>;    // 渲染配置
  __nodeEvent?: Record<string, { enabled: boolean; handler: Function }>;  // 事件
  __nodeProps?: unknown;                       // 外部数据（表格行等）
  __nodeId?: string;                           // 节点 ID
  __nodeName?: string;                         // 节点名称
  __nodeStyle?: Record<string, unknown>;       // 样式
}>();
```

**属性解析通过 `useNodeOptions` 统一处理**：
- `modelName` 模式：从 `$dataModels` 解析值
- `nodeProps` 模式：从 `__nodeProps` 解析
- `content` 模式：直接取 `__nodeOptions.content`
- 支持 `onValueRender` 动态计算
- 与 `defaults` 做 `defaultsDeep` 合并

### 3.3 组件数据模型

```typescript
// 配置驱动（JSON）
{
  __nodeOptions: {
    renderType: 'Input',
    modelName: 'formModel.userName',  // 绑定到 $dataModels.formModel.userName
    placeholder: '请输入',
    // ...
  }
}

// useNodeOptions 解析后
const options = useNodeOptions<InputProps>(props, ctx, {
  placeholder: '',
  disabled: false,
  clearable: true,
  // ...
});
// options.value.placeholder === '请输入'
// options.value.modelName 读取 $dataModels.formModel.userName
```

### 3.4 组件间通信

| 方式 | 场景 | 实现 |
|---|---|---|
| **getNode(id)** | 跨节点调用方法 | `ctx.getNode('TableAsync::supplierTable')` → exposed.reloadData() |
| **$dataModels** | 数据共享 | 组件 A 写 `model.field`，组件 B 读 `model.field` |
| **EventBus** | 自定义事件 | `eventBus.emitCustom('refresh-table')` → 组件 B `onCustom('refresh-table')` |
| **$requestFns** | 共享请求 | 组件 A 调 `ctx.$requestFns.fetchUser()` |
| **$sharedFns** | 共享工具 | `ctx.$sharedFns.formatDate()` |

### 3.5 组件暴露方法

通过 `useNodeRegister` 的 `exposed` 参数：

```typescript
// Dialog 组件
useNodeRegister({
  type: 'Dialog',
  name: props.__nodeName,
  exposed: {
    open: () => { visible.value = true; },
    close: () => { visible.value = false; },
  },
  props: options,
});

// 外部调用
ctx.getNode('Dialog::userDialog')?.open();
```

---

## 4. 布局与嵌套规则系统

### 4.1 组件分类体系

```typescript
type ComponentCategory =
  | 'container'      // 容器（Panel, Box, Toolbar, TabPanel, NavigationBar）
  | 'layout'         // 布局（FlexBox, FlexLine, GridBox, GridItem）
  | 'element'        // 块级元素（Table, Form, Chart, Tree, Card...）
  | 'lineElement'    // 内联元素（Button, Input, Select, Label...）
  | 'columnElement'; // 列元素（ButtonGroup, ListElement）
```

### 4.2 嵌套规则白名单

**文件**: `src/components/registry.ts`

```typescript
const ALLOWED_CATEGORIES: Record<string, ComponentCategory[]> = {
  container:    ['container'],              // 容器只能嵌套容器
  element:      ['element', 'lineElement'], // 块级元素位可放块级+内联
  lineElement:  ['lineElement'],            // 内联位只能放内联
  columnElement:['columnElement', 'lineElement'], // 列位可放列元素+内联
  flexBox:      ['layout'],                 // FlexBox 子项只能是布局组件
  gridBox:      ['layout'],                 // GridBox 子项只能是布局组件
};
```

**嵌套示例**:
```
Plane → FlexBox
  ├─ item-1 (FlexLine)
  │    └─ Toolbar (container)
  │         └─ Button (lineElement) ✓
  ├─ item-2 (FlexLine)
  │    └─ Panel (container)
  │         └─ TableAsync (element) ✓
  └─ item-3 (FlexLine)
       └─ Box (container)
            └─ Input (lineElement) ✓
```

### 4.3 NodeRenderer 渲染流程

```vue
<!-- NodeRenderer.vue -->
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

<script setup>
const resolvedComponent = computed(() => {
  const renderType = node.__nodeOptions?.renderType;
  const meta = lookupMeta(renderType);
  // 白名单校验
  if (allowedCategories && !isCategoryAllowed(meta.category, allowedCategories)) {
    reportError('NEST_CATEGORY_NOT_ALLOWED', '...');
    return undefined;
  }
  return meta.component;
});
</script>
```

---

## 5. 数据交互系统

### 5.1 HTTP 请求架构

请求完全委托给 `@cs/assembox-core-next`：

```
组件 → ctx.$requestFns.fetchUser() → createHttpFn() → axios()
                                              ↓
                                    transformParams()
                                    ├─ 路由参数替换
                                    ├─ body/query/path 分类
                                    ├─ 分页参数合并
                                    └─ headers 设置（含加密）
```

### 5.2 组件中的请求方式

```typescript
// 在事件 handler 中
const ctx = useEventContext();

async function handleLoad() {
  const result = await ctx.$requestFns.fetchUserList({
    pageNum: 1,
    pageSize: 20,
    // ...
  });
  if (result.status === 'success') {
    // result.data
  }
}
```

### 5.3 请求拦截

通过 `RequestConfig` 配置（非代码）：

```jsonc
{
  "beforeReq": {
    "enabled": true,
    "fn": "function(config){ config.headers.token='xxx'; return config; }"
  },
  "afterReq": {
    "enabled": true,
    "fn": "function(result){ /* 数据转换 */ return result; }"
  }
}
```

> `fn` 字符串经 `safeEvalFn` 安全校验后执行。

---

## 6. 事件处理机制

### 6.1 事件分类

| 类型 | 触发方式 | 示例 |
|---|---|---|
| **内置事件** | 组件内 `dispatch('onClick', payload)` | Button 点击、Input 变化 |
| **自定义事件** | `eventBus.emitCustom('refresh')` | 跨组件联动 |
| **生命周期** | onMounted 自动触发 | 初始化加载 |

### 6.2 useNodeEvents

```typescript
const { dispatch } = useNodeEvents(props.__nodeEvent, ctx);

// 组件内触发
function handleClick() {
  dispatch('onClick', { row: props.__nodeProps });
}
```

**处理流程**:
1. `adaptNodeTree`（core-next）将 JSON 中的 `__nodeEvent.fn` 字符串 → `handler` 函数
2. `useNodeEvents` 在 `onMounted` 自动：
   - 触发 `onMounted` 事件
   - 注册自定义事件到 `eventBus`
3. `onUnmounted` 自动清理所有自定义事件监听

### 6.3 事件类型安全

通过 `augment.d.ts` 声明合并 `NodeEventConfigMap`：

```typescript
declare module '@cs/assembox-core-next' {
  interface NodeEventConfigMap {
    Button: {
      onClick?: TypedEventHandler<{ row?: unknown }>;
      onMounted?: TypedEventHandler<void>;
    };
  }
}
```

---

## 7. Composable 设计

### 7.1 七个核心 Composable

| Composable | 替代旧版 | 职责 |
|---|---|---|
| `useEventContext()` | `eventArgs()` | 获取 EventContext（provide/inject） |
| `useNodeOptions(props, ctx, defaults)` | 4个 computed 合并 | 统一的节点选项 computed（model/nodeProps/content 三源 + onValueRender + defaults 合并） |
| `useNodeEvents(nodeEvent, ctx)` | `enrollOnEvent` | 事件注册/触发/自动清理 |
| `useNodeRegister(opts)` | `compsInit()` | 节点注册到 NodeRegistry（自动注销 + Proxy props + updateProps + patchProps） |
| `useInputValue(props, ctx)` | `inputValueComputed` | 输入组件双向绑定（model/nodeProps 双源） |
| `usePermission(ctx)` | `getPermission` | 权限 + 显示控制 |
| `useEditor()` | `editorHook()` | 编辑器环境集成（上报 mount/update/unmount） |

### 7.2 标准组件模板

```vue
<script setup>
// 1. 注入上下文
const ctx = useEventContext();

// 2. 解析属性（带默认值）
const options = useNodeOptions<MyProps>(props, ctx, {
  disabled: false,
  placeholder: '',
});

// 3. 绑定事件
const { dispatch } = useNodeEvents(props.__nodeEvent, ctx);

// 4. 权限控制
const { getUtilsAttr } = usePermission(ctx);
const visible = getUtilsAttr(options);

// 5. 编辑器集成
useEditor();

// 6. 注册节点（暴露方法 + props 引用）
useNodeRegister({
  type: 'MyComponent',
  name: props.__nodeName || '',
  exposed: { reload, getData },
  props: options,
});
</script>
```

---

## 8. 类型安全与声明合并

### 8.1 三大声明合并接口

**文件**: `src/types/augment.d.ts`

```typescript
declare module '@cs/assembox-core-next' {
  // 1. 组件 Props 类型映射
  interface RenderTypeMap {
    Button: ButtonProps;
    Input: InputProps;
    TableAsync: TableAsyncProps;
    // ...
  }

  // 2. 组件事件配置映射
  interface NodeEventConfigMap {
    Button: {
      onClick?: TypedEventHandler<{ row?: unknown }>;
      onMounted?: TypedEventHandler<void>;
    };
    // ...
  }

  // 3. 组件暴露方法映射
  interface NodeExposedMap {
    Dialog: { open: () => void; close: () => void };
    TableAsync: {
      reloadData: (opts?) => Promise<void>;
      setData: (data) => void;
      // ...
    };
  }
}
```

### 8.2 类型推导链

```
augment.d.ts 声明合并
  → RenderTypeMap[renderType] 自动推导组件 props 类型
  → NodeEventConfigMap[renderType] 自动推导事件参数类型
  → NodeExposedMap[type] 自动推导 getNode() 返回类型
  → 编译期检测：错误的事件名 / 错误的参数类型 / 不存在的暴露方法
```

---

## 9. 完整组件清单

### 9.1 容器组件（container）— 5 个

| 名称 | renderType | 文件 | 暴露方法 |
|---|---|---|---|
| 面板 | `Panel` | `block-contanier/panel/` | — |
| 盒子 | `Box` | `block-contanier/box/` | — |
| 工具栏 | `Toolbar` | `block-contanier/toolbar/` | — |
| 选项卡 | `TabPanel` | `block-contanier/tabpanel/` | — |
| 导航栏 | `NavigationBar` | `element-container/block-element/navigation-bar.vue` | — |

### 9.2 布局组件（layout）— 4 个

| 名称 | renderType | 文件 |
|---|---|---|
| 弹性布局 | `FlexBox` | `layout/flex-box-assem.vue` |
| 弹性行 | `FlexLine` | `layout/flex-line-assem.vue` |
| 网格布局 | `GridBox` | `layout/grid-box.vue` |
| 网格项 | `GridItem` | `layout/grid-item.vue` |

### 9.3 块级元素（element）— 14 个

| 名称 | renderType | 文件 | 暴露方法 |
|---|---|---|---|
| 表单 | `Form` | `block-element/form.vue` | validateForm, resetFields, saveFormData |
| 报表表格 | `TableReport` | `block-element/table/` | reloadData, setData, clearData |
| 异步表格 | `TableAsync` | `block-element/table/` | reloadData, setData, getData, getPaginationParams |
| 静态表格 | `TableOnly` | `block-element/table/` | reloadData, setData |
| 编辑表格 | `TableEdit` | `block-element/table/` | growData, deleteData, sumRow |
| 树形表格 | `TableTree` | `block-element/table/` | reloadData, clearData |
| 异步列表 | `ListAsync` | `block-element/list/` | reloadData, setData, clearData |
| 静态列表 | `ListOnly` | `block-element/list/` | reloadData, setData |
| 报表列表 | `ListReport` | `block-element/list/` | reloadData, setCurrentPage |
| 图表 | `Chart` | `block-element/chart/` | loadData, updateOption, reRender |
| 卡片 | `Card` | `block-element/card.vue` | — |
| 步骤条 | `Step` | `block-element/step.vue` | — |
| 树形控件 | `Tree` | `block-element/tree.vue` | reload |
| 网络摄像头 | `WebCamera` | `block-element/web-camera.vue` | initCamera, getPhotoBase64 |

### 9.4 内联元素（lineElement）— 23 个

**显示类**：Button, Label, Tag, Dropdown, Image, Icon, Statistic, RawHtml

**输入类**：Input, Select, Switch, RadioGroup, CheckboxGroup, Checkbox, DatePicker, TimePicker, InputNumber, FormItem, FilterItem, SearchSelect, SearchTreeSelect, DateRangePicker

### 9.5 列元素（columnElement）— 2 个

| 名称 | renderType | 文件 |
|---|---|---|
| 按钮组 | `ButtonGroup` | `column-element/button-group.vue` |
| 列表元素 | `ListElement` | `column-element/list-element.vue` |

### 9.6 视图层组件（不经 NodeRenderer 注册）— 3 个

| 名称 | renderType | 文件 | 暴露方法 |
|---|---|---|---|
| 对话框 | `Dialog` | `layer/dialog-page.vue` | open, close |
| 抽屉 | `Drawer` | `layer/drawer-page.vue` | open, close |
| 平面 | `Plane` | `layer/plane.vue` | — |

---

## 10. 公共 API 导出清单

### 10.1 从 index.ts 导出

| 导出 | 类型 | 来源 | 说明 |
|---|---|---|---|
| `AssemPlugin` | Vue Plugin | `./index.ts` | Vue 插件，install 时创建 AssemCore |
| `registerDefaults()` | Function | `./register-defaults.ts` | 注册 40+ 内置组件 |
| `ASSEM_CONTEXT_KEY` | InjectionKey | `./constants.ts` | EventContext 注入键 |
| `NODE_REGISTRY_KEY` | InjectionKey | `./constants.ts` | NodeRegistry 注入键 |
| `useEventContext` | Composable | `./composables/` | 获取事件上下文 |
| `useNodeOptions` | Composable | `./composables/` | 节点选项 computed |
| `useNodeEvents` | Composable | `./composables/` | 事件管理 |
| `useNodeRegister` | Composable | `./composables/` | 节点注册 |
| `useInputValue` | Composable | `./composables/` | 输入双向绑定 |
| `usePermission` | Composable | `./composables/` | 权限控制 |
| `useEditor` | Composable | `./composables/` | 编辑器集成 |
| `isEditorEnv` | Function | `./composables/` | 判断是否编辑器环境 |
| `registerComponent` | Function | `./components/registry.ts` | 注册组件 |
| `lookupComponent` | Function | `./components/registry.ts` | 查找组件 |
| `lookupMeta` | Function | `./components/registry.ts` | 查找组件元信息 |
| `NodeRenderer` | Component | `./components/render/` | 递归渲染器 |
| 所有 core-next 导出 | Re-export | `@cs/assembox-core-next` | AssemCore/EventBus/NodeRegistry 等 |

### 10.2 类型导出

```typescript
// 基础类型
type Size, LabelPosition, Justify, Align, PaddingSize, Direction, ContentType

// 组件 Props 类型
ButtonProps, InputProps, SelectProps, PanelProps, BoxProps, ToolbarProps,
FlexBoxProps, FlexLineProps, GridBoxProps, TabPanelProps, DialogProps,
DrawerProps, FormProps, FormItemProps, FilterItemProps, ...

// 渲染类型
ElementRenderProps, LineElementRenderProps, ColumElementRenderProps,
ContainerRenderProps, RegistryEntry, ComponentMeta, ComponentCategory

// 组件分类常量
ALLOWED_CATEGORIES, resolveAllowedCategories, isCategoryAllowed
```

---

## 11. 模块依赖关系

```
index.ts
  ├─ AssemPlugin ──────► @cs/assembox-core-next (AssemCore)
  │                      └─ reactive($dataModels, $globalVars)
  │
  ├─ registerDefaults ──► components/registry.ts
  │                      └─ 40+ registerComponent()
  │
  ├─ Composables ───────► @cs/assembox-core-next (EventContext, NodeRegistry, utils)
  │   useEventContext     └─ inject(ASSEM_CONTEXT_KEY)
  │   useNodeOptions      └─ EventContext.$dataModels + utils.getNestedValue
  │   useNodeEvents       └─ AssemCore.eventBus
  │   useNodeRegister     └─ inject(NODE_REGISTRY_KEY) → registry.register()
  │   useInputValue       └─ EventContext.$dataModels
  │   usePermission       └─ EventContext.$globalVars.$context.permissions
  │   useEditor           └─ window.AssemVueRenderer (编辑器环境)
  │
  ├─ Components ─────────► Composables (组合使用)
  │   button.vue          └─ useEventContext + useNodeOptions + useNodeEvents
  │                         + usePermission + useEditor + useNodeRegister
  │
  └─ NodeRenderer ───────► registry.lookupMeta() → category 校验 → render
```

---

## 12. 编辑器集成

### 12.1 isEditorEnv / useEditor

```typescript
// 判断是否编辑器环境
export function isEditorEnv(): boolean {
  return typeof window !== 'undefined' && !!window.assemBoxIsEdit;
}

// 编辑器集成 hook
export function useEditor(): void {
  if (!isEditorEnv()) return;  // 生产环境 no-op
  
  onMounted(() => {
    nextTick(() => window.AssemVueRenderer?.onMountedInstance(getCurrentInstance()));
  });
  // onUpdated / onUnmounted 同理
}
```

### 12.2 与 new-assembox-editor 的契约

| 编辑器侧 | desktop-next 侧 | 通信方式 |
|---|---|---|
| `window.assemBoxIsEdit = true` | `isEditorEnv()` 检测 | 全局变量 |
| `window.AssemVueRenderer` | `useEditor()` 调用 | 回调接口 |
| 编辑器拖拽 → 修改 JSON | NodeRenderer 重新渲染 | 响应式 schema |

---

## 13. 错误处理与边界

### 13.1 运行时问题上报

通过 `@cs/assembox-core-next` 的 `IssueReporter`：

```typescript
import { reportError, reportWarn } from '@cs/assembox-core-next';

// NodeRenderer 中未注册的组件
reportError('UNKNOWN_RENDER_TYPE', `未注册的组件类型: "${renderType}"`, { renderType });

// 嵌套规则违反
reportError('NEST_CATEGORY_NOT_ALLOWED', `组件不允许在当前位置渲染`, { ... });
```

### 13.2 安全执行

事件函数字符串经 `safeEvalFn` 校验：
- 拦截 `eval()`, `Function()`, `import()`, `__proto__` 等 7 种危险模式
- 解析失败返回 `null`，事件自动禁用

### 13.3 边界处理

| 场景 | 处理 |
|---|---|
| 未注册的 renderType | reportError + 不渲染 |
| 嵌套类别不允许 | reportError + 不渲染 |
| 事件 handler 解析失败 | enabled 强制设 false |
| modelName 未配置 | 回退到 content/nodeProps |
| 权限不足 | getUtilsAttr 返回 false → v-if 隐藏 |
| 组件卸载 | useNodeRegister 自动注销 + useNodeEvents 自动清理监听 |

---

## 14. 性能与扩展性

### 14.1 性能措施

| 措施 | 位置 |
|---|---|
| reactive 只包装 $dataModels/$globalVars（非全量 schema） | AssemPlugin.install |
| Proxy 代替快照（props 实时读取，不拷贝） | useNodeRegister |
| computed 缓存（useNodeOptions 内部） | useNodeOptions |
| onUnmounted 自动清理（事件监听/注册表条目） | useNodeEvents/useNodeRegister |
| NodeRegistry 多维索引（name/type/精确ID） | @cs/assembox-core-next |

### 14.2 扩展性

| 扩展点 | 方式 |
|---|---|
| 新增组件 | `registerComponent('MyComp', MyCompVue, 'element')` |
| 新增事件类型 | `declare module { interface NodeEventConfigMap { MyComp: {...} } }` |
| 新增暴露方法 | `declare module { interface NodeExposedMap { MyComp: {...} } }` |
| 新增 Props 类型 | `declare module { interface RenderTypeMap { MyComp: MyProps } }` |
| 自定义 IssueReporter | `setIssueReporter(myReporter)` |
| 注入全局方法 | `app.config.globalProperties.$myMethod = ...` |
| 自定义 Composable | 复用 useEventContext + useNodeRegister 模式 |

### 14.3 与旧版对比（关键改进）

| 维度 | 旧版 (assembox-desktop) | 新版 (assembox-desktop-next) |
|---|---|---|
| 框架耦合 | Vue 全局 mixin + globalProperties | provide/inject + Composable |
| 组件注册 | regist-coms.ts 硬编码 4 层映射 | registerComponent + category 白名单 |
| 属性解析 | 4 个重复 computed 函数 | useNodeOptions 统一（3 源 + onValueRender） |
| 事件 | enrollOnEvent + enrollOnCustomEvent 分散 | useNodeEvents 统一（dispatch + 自动清理） |
| 注册 | compsInit（手动 setExposed） | useNodeRegister（Proxy props + updateProps + patchProps） |
| 类型安全 | 无 | 声明合并（RenderTypeMap + NodeEventConfigMap + NodeExposedMap） |
| 核心解耦 | AssemCore 内嵌 Vue reactive | 框架无关 core-next + desktop-next reactive 包装 |
| 安全 | 裸 new Function | safeEvalFn 黑名单拦截 |

---

**tags**: `architecture`, `vue3`, `element-plus`, `lowcode-renderer`, `composable`, `registry`, `provide-inject`, `type-augmentation`, `component-system`, `event-system`, `permission`, `editor-integration`
