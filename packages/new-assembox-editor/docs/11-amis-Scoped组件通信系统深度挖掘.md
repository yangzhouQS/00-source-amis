# amis Scoped 组件通信系统深度挖掘

> 研究对象：`amis-core/src/Scoped.tsx`、`SchemaRenderer.tsx`、`WithStore.tsx`、`factory.tsx`、`renderer-event.ts`、`utils/`
> 目标：完整理解 amis 组件间通信、实例获取、方法调用的运行时机制，为 new-assembox-editor 的组件通信层提供设计参考

---

## 一、架构总览

Scoped 是 amis 运行时的**组件寻址与通信中枢**。本质上是一棵由 `IScopedContext` 节点构成的**作用域树**（scope tree），与组件树平行但独立。任何带 `name`/`id` 的组件在 mount 时把自己注册到所属 scope，从而被 `reload`/`send`/`close`/事件派发等机制按名字或 id 定位。

### Scope 树与组件注册关系

```
rootScopedContext (path='', parent=undefined)   ← 模块级单例
   │
   │  children[]
   ▼
[Scope_Page]  ← PageRenderer 的 HocScoped 创建
   │  .component = PageRenderer   ← 自身引用
   │  .components = []            ← 子组件注册表
   │
   │  PageRenderer 自身被注册到 rootScopedContext.components（父级）
   │
   │  children[]
   ▼
[Scope_Form]  ← FormRenderer 的 HocScoped 创建
   │  .component = FormRenderer
   │  .components = [Field_A, Field_B, CRUD_inside, ...]
   │
   │  FormRenderer 自身被注册到 Scope_Page.components（父级）
```

**关键设计**：每个 scope 节点是为**它的子组件**准备的注册容器；节点对应的组件**自身**注册到**父级** scope 的 `components[]`。

---

## 二、核心数据结构

```ts
interface IScopedContext {
  rendererType?: string;           // 创建该 scope 的渲染器类型
  component?: ScopedComponentType; // 创建该 scope 的组件自身
  parent?: IScopedContext;         // 父 scope
  children?: IScopedContext[];     // 子 scope

  // 注册/注销
  registerComponent(component): void;
  unRegisterComponent(component): void;

  // 查找（5 种策略）
  getComponentByName(name: string): ScopedComponentType | undefined;
  getComponentById(id: string): ScopedComponentType | undefined;
  getComponentByIdUnderCurrentScope(id, ignoreScope?): ScopedComponentType | undefined;
  getComponents(): ScopedComponentType[];
  getComponentsByRefPath(session, path): ScopedComponentType[];

  // 通信（3 种 + 动作执行）
  reload(target: string | string[], ctx: any): void;
  send(target: string | string[], values: object): void;
  close(target: string | boolean): void;
  closeById(id: string): void;
  doAction(actions: ListenerAction[], ctx: any): Promise<void>;
}
```

`ScopedComponentType` 接口（组件需要实现的方法）：
```ts
interface ScopedComponentType {
  props: {
    $path?: string;
    $schema?: any;
    name?: string;
    id?: string;
    data?: any;
    show?: boolean;
    type?: string;
    env?: RendererEnv;
  };
  context?: IScopedContext;     // 组件自身的 scope
  getData?(): any;
  setData?(data: any): void;
  receive?(values: any, subPath?: string): void;
  reload?(subPath?: string, query?: any, ctx?: any): void;
  doAction?(action: any, data: any): void;
}
```

---

## 三、组件注册的完整流程

### 3.1 模块级根 scope

```ts
const rootScopedContext = createScopedTools('');        // 全局根
export const ScopedContext = React.createContext(rootScopedContext);
```

默认值为全局根。任何未包裹在 Provider 内的组件，消费到的都是根 scope。

### 3.2 createScopedTools 工厂

```ts
function createScopedTools(path?, parent?, env?, rendererType?): IScopedContext {
  const components: Array<ScopedComponentType> = [];  // 闭包私有注册表
  const self: IScopedContext = { ... };
  if (!parent) return self;          // 根 scope
  parent.children!.push(self);       // 挂到父级 children
  return self;
}
```

`components[]` 是闭包私有数组，外部只能通过 `self` 暴露的方法访问。

### 3.3 registerComponent —— 注册到父级的核心逻辑

```ts
registerComponent(component: ScopedComponentType) {
  // 判定：当前注册的组件是不是"创建这个 scope 的组件自身"
  if (component.props.$path === path && parent) {
    self.component = component;                  // 1. 记录自身引用
    return parent.registerComponent(component);  // 2. 向上委托给父级
  }
  // 否则：是子组件，存入本地注册表
  if (!~components.indexOf(component)) {
    components.push(component);
  }
}
```

**为什么注册到父级**：避免"自己注册给自己"的循环。Form 能被 Page 找到（在 Page 的 components 里），Form 的表单项能被 Form 找到（在 Form 的 components 里）。

### 3.4 unRegisterComponent —— 对称注销

```ts
unRegisterComponent(component) {
  if (component.props.$path === path && parent) {
    // 从父级 children 移除（防泄漏）
    const idx = parent.children!.indexOf(self);
    ~idx && parent.children!.splice(idx, 1);
    return parent.unRegisterComponent(component);
  }
  const idx = components.indexOf(component);
  if (~idx) components.splice(idx, 1);
}
```

### 3.5 注册时机

- **注册**：组件构造函数（mount 前）。`context.registerComponent(this)`
- **注销**：`componentWillUnmount`。`context.unRegisterComponent(this)`

```ts
// FormRenderer 示例
class FormRendererBase extends Form {
  static contextType = ScopedContext;
  constructor(props, context: IScopedContext) {
    super(props);
    context.registerComponent(this);           // 构造期注册
  }
  componentWillUnmount() {
    this.context.unRegisterComponent(this);    // 卸载时注销
  }
}
```

---

## 四、五大查找 API 的完整算法

### 4.1 getComponentByName(name) —— 按名字/点号路径递归查找

```ts
getComponentByName(name: string) {
  // 分支 A：点号路径 "formA.fieldB"
  if (~name.indexOf('.')) {
    const paths = name.split('.');
    return paths.reduce((scope, name, idx) => {
      if (scope && scope.getComponentByName) {
        const result = scope.getComponentByName(name);
        // 非末段返回 result.context（下钻），末段返回 result
        return result && idx < paths.length - 1 ? result.context : result;
      }
      return null;
    }, this);
  }
  // 分支 B：单段名字查找
  const resolved = find(components, component =>
    filter(component.props.name, component.props.data) === name ||
    component.props.id === name
  );
  return resolved || (parent && parent.getComponentByName(name)); // 本地没找到 → 向上冒泡
}
```

**策略**：本地 `components[]` 线性扫描 → 命中即返回；未命中递归向 parent 冒泡直到根。**深度优先、向上回溯**。

**点号路径**：`a.b` 先在当前 scope 找 `a`，取 `a.context`（a 自己的 scope），再在其内找 `b`。要求中间节点必须是 isolateScope 组件。

**性能**：最坏 O(N × D)，N 为总注册组件数，D 为 scope 树深度。

### 4.2 getComponentByIdUnderCurrentScope(id, ignoreScope?) —— 当前子树遍历

```ts
getComponentByIdUnderCurrentScope(id, ignoreScope?) {
  let component = undefined;
  findTree(
    [this],                    // 以当前 scope 为根
    (item) =>
      item !== ignoreScope &&   // 跳过指定 scope
      item.getComponents().find(cmpt => {
        if (filter(cmpt.props.id, cmpt.props.data) === id) {
          component = cmpt;
          return true;
        }
        return false;
      })
  );
  return component;
}
```

**策略**：`findTree` 深度优先遍历当前 scope 子树。**不向上**。

### 4.3 getComponentById(id) —— 自底向上逐层扩大搜索

```ts
getComponentById(id: string) {
  let root: IScopedContext = this;
  let ignoreScope: IScopedContext | undefined = undefined;
  while (root) {
    const component = root.getComponentByIdUnderCurrentScope(id, ignoreScope);
    if (component) return component;
    if (!root.parent || root.parent === rootScopedContext) break;
    ignoreScope = root;   // 下一轮排除本轮已查子树
    root = root.parent;   // 向上一层
  }
  return undefined;
}
```

**策略**：**自底向上逐层扩大**。先查当前 scope 子树；未命中跳到 parent，排除已查子树（`ignoreScope`）；直到全局根。**就近优先**。

### 4.4 getComponents() —— 返回注册表副本

```ts
getComponents() {
  return components.concat();  // 浅拷贝防篡改
}
```

### 4.5 getComponentsByRefPath(session, path) —— 反向引用查找

```ts
getComponentsByRefPath(session: string, path: string): ScopedComponentType[] {
  const cmptMaps: Record<string, ScopedComponentType> = {};
  let root = this;
  while (root.parent) root = root.parent;   // 爬到全局根

  eachTree([root], (item) => {               // 遍历整棵 scope 树
    const list = item.getComponents() || [];
    for (const cmpt of list) {
      const pathKey = cmpt?.props?.$path ?? 'unknown';
      const cmptSession = cmpt?.props.env?.session ?? 'global';

      // session 过滤 + 去重
      if (cmptMaps[pathKey] || session !== cmptSession) continue;

      // 有 setData 的组件直接收录（数据消费者）
      if (cmpt?.setData) { cmptMaps[pathKey] = cmpt; continue; }

      // 扫描 schema 属性找 ${path} 纯变量引用
      for (const key of Object.keys(cmpt.props.$schema || {})) {
        const expr = cmpt.props.$schema[key];
        if (typeof expr === 'string' && isPureVariable(expr)) {
          const host = expr.substring(2, expr.length - 1).split('|')[0];
          if (host === path) { cmptMaps[pathKey] = cmpt; break; }
        }
      }
    }
  });
  return values(cmptMaps);
}
```

**用途**：数据源变化时，反查所有依赖该变量的组件并触发更新。O(全树节点 × schema 属性数)。

---

## 五、reload(target, ctx) 完整解析流程

```ts
reload(target: string | string[], ctx: any) {
  let targets = typeof target === 'string' ? splitTarget(target) : target;
  targets.forEach(name => {
    // 步骤 2：解析 ?query
    const idx2 = name.indexOf('?');
    let query = null;
    if (~idx2) {
      query = dataMapping(qsparse(name.substring(idx2 + 1)), ctx);
      name = name.substring(0, idx2);
    }
    // 步骤 3：解析 .subPath
    const idx = name.indexOf('.');
    let subPath = '';
    if (~idx) { subPath = name.substring(1 + idx); name = name.substring(0, idx); }

    // 步骤 4：路由
    if (name === 'window') {
      query ? env.updateLocation(...) : location.reload();
    } else {
      const component = this.getComponentByName(name) || this.getComponentById(name);
      component?.reload?.(subPath, query, ctx);
    }
  });
}
```

### 解析流程图

```
target: "crudA,formB?id=${row.id}.detail?q=1"
    │
    ▼ splitTarget（AST 解析，避开表达式内逗号）
["crudA", "formB?id=${row.id}.detail?q=1"]
    │ 每个 name 独立处理
    ▼
[步骤2] 找 '?' 拆 query → name="formB.detail", query={id: row.id}
[步骤3] 找 '.' 拆 subPath → name="formB", subPath="detail"
[步骤4] name === 'window' ? → No
[步骤5] getComponentByName("formB") || getComponentById("formB")
        → component.reload("detail", {id: row.id}, ctx)
```

---

## 六、send(receive, values) 完整流程

```ts
send(receive: string | string[], values: object) {
  let receives = typeof receive === 'string' ? splitTarget(receive) : receive;
  receives.forEach(name => {
    // 解析 query（合并进 values）
    // 解析 subPath
    const component = this.getComponentByName(name);
    if (component?.receive) {
      component.receive(values, subPath);   // ⚠ 调用 receive 而非 reload
    } else if (name === 'window') {
      // 合并 URL query
    }
  });
}
```

### send vs reload

| 维度 | `reload` | `send` |
|---|---|---|
| 组件接口 | `component.reload(subPath, query, ctx)` | `component.receive(values, subPath)` |
| 语义 | 重新拉取/刷新数据 | 接收外部数据（灌值） |
| 定位方式 | `getComponentByName \|\| getComponentById` | 仅 `getComponentByName` |
| window 目标 | `location.reload()` | 合并 URL query |

---

## 七、close(target) 完整流程

### 7.1 close —— 按名字关闭

```ts
close(target: string | boolean) {
  if (typeof target === 'string') {
    splitTarget(target)
      .map(name => this.getComponentByName(name))
      .filter(component => component && component.props.show)  // 过滤已关的
      .forEach(closeDialog);
  }
}
```

### 7.2 closeDialog —— 递归关闭嵌套弹窗

```ts
function closeDialog(component: ScopedComponentType) {
  // 1. 取组件自身的 scope，找内部注册的 dialog/drawer
  (component.context as IScopedContext)
    .getComponents()
    .filter(item => 
      (item.props.type === 'dialog' || item.props.type === 'drawer') && item.props.show
    )
    .forEach(closeDialog);   // ⚠ 递归：先关子级

  // 2. 最后关自己
  component.props.onClose?.();
}
```

**由内向外关闭**：深度优先递归，先关最内层弹窗，避免动画/状态错乱。

---

## 八、splitTarget —— target 字符串解析

```ts
export function splitTarget(target: string): string[] {
  const ast = memoParse(target);          // 用 amis-formula 解析为 AST
  const pos: number[] = [];
  ast.body.forEach((item: any) => {
    if (item.type === 'raw') {            // 只处理纯文本节点
      const parts = item.value.split(',');
      if (parts.length > 1) {
        // 记录每个逗号的索引位置
        parts.pop();
        let start = item.start.index;
        parts.forEach(part => {
          pos.push(start + part.length);
          start += part.length + 1;
        });
      }
    }
  });
  // 从右往左切
  // ...
  return parts;
}
```

**核心设计**：用 AST 解析而非简单 `split(',')`，**避开表达式内部的逗号**（如 `${fn(a,b),c}`）。

---

## 九、ScopedContext 的 Context 传递机制

### HocScoped —— Provider 嵌套核心

```ts
export function HocScoped<T>(ComposedComponent, rendererType?) {
  return class ScopedComponent extends React.Component {
    static contextType = ScopedContext;   // 消费父级 scope
    scoped?: IScopedContext;

    constructor(props, context: IScopedContext) {
      super(props);
      this.scoped = createScopedTools(
        this.props.$path,   // 新 scope 的 path
        context,            // parent = 父级 scope
        this.props.env,
        rendererType
      );
    }

    render() {
      return (
        <ScopedContext.Provider value={this.scoped!}>
          <ComposedComponent {...rest} ref={this.childRef} />
        </ScopedContext.Provider>
      );
    }
  };
}
```

### Provider 嵌套结构

```
<ScopedContext.Provider value={rootScopedContext}>
   <PageRenderer>                                      ← 消费 rootScopedContext
      <ScopedContext.Provider value={Scope_Page}>     ← HocScoped(Page)
         <FormRenderer>                                ← 消费 Scope_Page
            <ScopedContext.Provider value={Scope_Form}> ← HocScoped(Form)
               <FieldA>                                ← 消费 Scope_Form
```

HocScoped **同时是消费者（取父 context）和生产者（提供新 scope）**，由此逐层构建 scope 树。

---

## 十、isolateScope 的作用域边界

```ts
// factory.tsx: rendererToComponent
if (config.isolateScope) {
  component = Scoped(component, config.type);  // 强制创建新 scope
}
```

### isolateScope 对查找的影响

| 行为 | isolateScope 组件（Form/Dialog） | 普通组件 |
|---|---|---|
| 子组件注册位置 | 注册到自身的 scope | 注册到最近的上层 isolateScope scope |
| name 向上查找 | **不阻断**（本地未命中仍冒泡） | 同 |
| id 查找 | **不阻断**（自底向上逐层扩大） | 同 |
| 点号路径下钻 | **前提**：`formA.fieldB` 要求 formA 是 isolateScope | 不支持 |

**总结**：isolateScope 主要影响**注册位置**（子项挂在哪个 scope），而非查找方向。它让作用域"分层"，便于同名组件在不同 Form 内共存而通过点号路径区分。

---

## 十一、dispatchEvent 如何利用 scoped

### 事件对象携带 scoped

```ts
const rendererEvent = createRendererEvent(eventName, {
  env, nativeEvent: e, data,
  scoped    // ← 当前 scope 注入到事件上下文
});
```

### 动作执行通过 scoped 定位目标

```ts
export const getTargetComponent = (action, renderer, event, key?) => {
  let targetComponent = renderer;  // 默认自身
  if (key && event.context.scoped) {
    const func = action.componentId ? 'getComponentById' : 'getComponentByName';
    targetComponent = event.context.scoped[func](key);
  }
  return targetComponent;
};
```

### 完整事件链路

```
用户点击按钮
  → SchemaRenderer.dispatchEvent(e, data)
      scoped = this.context (按钮所在的 scope)
  → createRendererEvent → context.scoped = scoped
  → bindEvent → 按 weight 排序的 listeners
  → runActions(listener.actions, renderer, rendererEvent)
      每个 action:
        getTargetComponent(action, renderer, event, componentId/name)
          → scoped.getComponentById / getComponentByName
          → component.setData / reload / doAction
```

**scoped 是事件派发到组件动作执行的桥梁**。

---

## 十二、公式集成：GETRENDERERDATA / GETRENDERERPROP

scope 创建时注册两个 formula 全局函数，让公式表达式能跨组件取数据：

```ts
registerFunction('GETRENDERERDATA', (componentId, path?, scoped = self) => {
  const component = scoped.getComponentById(componentId);
  const data = component?.getData?.();
  return path ? getVariable(data, path) : data;
});

registerFunction('GETRENDERERPROP', (componentId, path?, scoped = self) => {
  const component = scoped.getComponentById(componentId);
  const props = component?.props;
  return path ? getVariable(props, path) : props;
});
```

公式中使用：`${GETRENDERERDATA('crud1', 'page')}` 跨组件取数据。

---

## 十三、doAction —— scope 层级动作执行

```ts
async doAction(actions: ListenerAction[], ctx: any) {
  const renderer = this.getComponents()[0];  // 取本 scope 第一个组件
  const event = createRendererEvent('embed', {
    env, data: createObject(renderer.props.data, ctx), scoped: this
  });
  await runActions(actions, renderer, event);
  if (event.prevented) return;
}
```

用于不指定具体 target、直接在当前 scope 顶层组件上跑动作链的场景。

---

## 十四、Vue3 迁移方案

### 14.1 架构映射

| amis（React） | Vue3 对应 |
|---|---|
| `React.createContext` + Provider | `provide` / `inject` |
| `static contextType = ScopedContext` | `inject(SCOPED_KEY)` |
| 组件构造函数注册 | `onMounted` 注册 / `onBeforeUnmount` 注销 |
| `component.context`（组件自身 scope） | scope 节点持有 component 引用 |
| 闭包私有 `components[]` | scope 实例的私有 Map/数组 |

### 14.2 核心 API 设计

```ts
// scoped-context.ts
interface ScopedContext {
  parent: ScopedContext | null;
  children: ScopedContext[];
  component: ComponentPublicInstance | null;
  components: Map<string, ComponentPublicInstance>;  // name/id → instance

  register(instance: ComponentPublicInstance): void;
  unregister(instance: ComponentPublicInstance): void;

  getByName(name: string): ComponentPublicInstance | undefined;
  getById(id: string): ComponentPublicInstance | undefined;
  reload(target: string, ctx?: any): void;
  send(target: string, values: any): void;
  close(target: string): void;
}

const SCOPED_KEY: InjectionKey<ScopedContext> = Symbol('scoped');
```

### 14.3 组件注册（composable）

```ts
// useScoped.ts
export function useScoped(options: {
  name?: string;
  id?: string;
  reload?: (subPath?, query?, ctx?) => void;
  receive?: (values, subPath?) => void;
}) {
  const parentScope = inject(SCOPED_KEY, null);
  const scope = createScopedContext(parentScope, options);

  onMounted(() => parentScope?.register(scope));
  onBeforeUnmount(() => parentScope?.unregister(scope));
  provide(SCOPED_KEY, scope);  // 子组件消费

  return scope;
}
```

### 14.4 组件间通信

```ts
// 在按钮的 onClick 中
const scope = inject(SCOPED_KEY)!;
scope.reload('userList?page=1', {keyword: '张三'});
scope.send('formA', {name: '李四'});
scope.close('dialogB');
```

---

## 十五、设计精髓总结

1. **闭包私有注册表 + 父子 scope 树**：注册表不可直接修改，只通过方法访问；scope 树与组件树平行但独立。

2. **向上冒泡 + 向下钻取的混合查找**：
   - name 查找：本地 → 向上冒泡（深度优先回溯）
   - id 查找：自底向上逐层扩大（就近优先，排除已查子树）
   - 点号路径：逐段下钻（要求中间节点是 isolateScope）

3. **target 字符串协议**：`name?query.subPath` 统一编码组件定位 + 参数传递 + 子路由，组件间无需直接引用。

4. **事件链 scoped 透传**：scoped 注入到 RendererEvent，动作执行时通过 scoped 定位目标组件，把"逻辑动作"映射到"组件方法"。

5. **isolateScope 控制边界**：影响注册位置（子项挂在哪个 scope），让同名组件在不同作用域内共存。

6. **AST 解析 splitTarget**：避开表达式内部逗号，保证 `${fn(a,b),c}` 不被错误拆分。

7. **递归关闭弹窗**：由内向外深度优先，先关子级弹窗再关自身，避免状态错乱。

8. **公式集成**：GETRENDERERDATA/GETRENDERERPROP 让公式跨组件取数据，底层仍是 scoped 查找。
