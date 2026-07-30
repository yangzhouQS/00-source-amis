# amis __super 原型链数据作用域 — 深度挖掘

> 研究对象：`amis-core/src/utils/object.ts`、`utils/getVariable.ts`、`store/iRenderer.ts`、`store/root.ts`、`WithStore.tsx`、`utils/helper.ts`
> 验证项目：`vue3-examples/src/data-scope/data-scope.ts` + `data-scope-demo.tsx`（10 组验证全部通过）
> 配套文档：`10-amis优秀设计借鉴分析.md`（概览）、`11-amis-Scoped组件通信系统深度挖掘.md`（通信层）、本文聚焦**数据层**

---

## 一、核心心智模型

amis 的"数据作用域"并非靠 Vue/Pinia 那样的响应式注入，而是**用 JavaScript 原生原型链（`Object.create`）+ 一个不可枚举的 `__super` 反向指针**模拟出"组件树作用域栈"。

```
读取（getVariable）  →  沿原型链向上查找（in / data[key]）
写入（setVariable）  →  原型属性遮蔽，只落在自身层（data[key] = v）
克隆（cloneObject）  →  新对象的原型指向原 __super，链结构不丢
折叠/展开链          →  createObjectFromChain / extractObjectChain
父→子同步            →  syncDataFromSuper（按 key 复制，非链共享）
```

整套系统的基石全部集中在 `utils/object.ts`（231 行）和 `utils/getVariable.ts`（23 行）。

---

## 二、createObject — 原型链的诞生

### 函数签名

```ts
createObject(superProps?, props?, properties?) => object
```

### 逐行实现

```ts
export function createObject(superProps, props, properties) {
  // ① 冻结防御：若父级被 Object.freeze，不能直接当原型
  if (superProps && Object.isFrozen(superProps)) {
    superProps = cloneObject(superProps);
  }

  // ② 核心：Object.create 构造原型链
  const obj = superProps
    ? Object.create(superProps, {
        ...properties,
        __super: {
          value: superProps,
          writable: false,
          enumerable: false   // ★ 关键：不可枚举
        }
      })
    : Object.create(Object.prototype, properties);

  // ③ 把 props 浅拷贝为新对象的 own properties
  props && isObject(props) &&
    Object.keys(props).forEach(key => (obj[key] = props[key]));

  return obj;
}
```

### 关键设计意图

| 设计点 | 机制 | 为什么这么做 |
|---|---|---|
| `Object.create(superProps)` | superProps 成为 `[[Prototype]]` | 原生实现"读继承"：`obj.foo` 找不到自身就自动向上找，零运行时开销 |
| `__super.enumerable = false` | `Object.keys` / `JSON.stringify` 看不到 `__super` | **序列化安全**：提交表单、打印数据时不泄漏链结构；**diff 安全**：浅比较只比 own keys |
| `__super.writable = false` | 防止运行时被改写 | 链结构是数据作用域骨架，被篡改会污染子树 |
| `Object.isFrozen` 防御 | 冻结对象先 cloneObject | frozen 对象作为原型时子对象写继承属性会失败 |

> **可迁移模式**：任何需要"作用域栈 / 作用域链"的场景（模板引擎数据上下文、低代码运行时），都可以用「`Object.create` 建原型 + 不可枚举 `__super` 反向指针」这一组合，比维护 `scopeChain: Array` 在读取时手动 reduce 要高效得多。

---

## 三、getVariable — 沿原型链查找

### 函数签名

```ts
getVariable(data, key, canAccessSuper = true) => any
```

### 核心实现

```ts
export function getVariable(data, key, canAccessSuper = true) {
  if (!data || !key) return undefined;

  // 单层 key
  if (canAccessSuper ? key in data : data.hasOwnProperty(key)) {
    return data[key];
  }

  // 点号路径 a.b.c，逐层 reduce
  return keyToPath(key).reduce(
    (obj, key) =>
      obj && typeof obj === 'object' &&
      (canAccessSuper ? key in obj : obj.hasOwnProperty(key))
        ? obj[key]
        : undefined,
    data
  );
}
```

### canAccessSuper 双面语义

| `canAccessSuper` | 判定操作符 | 语义 | 典型调用方 |
|---|---|---|---|
| `true`（默认） | `key in data` | **穿透原型链**，子可读父 | 模板 `${xxx}` 解析、dataMapping |
| `false` | `data.hasOwnProperty(key)` | **仅自身层**，屏蔽父级 | changeValue 里取 origin（避免误判继承值为"已存在"） |

### keyToPath 路径解析

```
'a.b[1].c' → ['a','b','1','c']
'a["x y"]' → ['a','x y']
```

> **设计精髓**：getVariable 把"原型链穿透"和"路径解构"正交分离——单层用 `in`，多层用 `reduce + in`，逻辑高度统一。

---

## 四、setVariable / deleteVariable — 写隔离机制

### 写隔离的本质：JavaScript 原型属性遮蔽

这是整个系统最精妙的部分。JavaScript 的**赋值（put）语义**与**读取（get）语义**不对称：

| 操作 | 行为 |
|---|---|
| 读取 `obj[key]`（无 own） | 沿 `[[Prototype]]` 向上找 |
| **赋值 `obj[key] = v`**（key 在原型上有，但无 setter） | **在 obj 自身创建新 own 属性**，原型不变 |

所以当父级有 `name`，子级 `setVariable(child, 'name', x)`：
- `key in data` → true（继承自父）
- `data[key] = value` → 在 child 自身写入，**遮蔽**了父级的 name
- 父级的 `name` 毫发无损 ✅

**完全借力语言特性，无需任何额外代码。**

### setVariable 嵌套路径处理

```ts
export function setVariable(data, key, value) {
  data = data || {};

  if (key in data) {
    data[key] = value;   // 属性遮蔽
    return;
  }

  // 嵌套路径：逐层浅拷贝，保证不可变更新
  const parts = keyToPath(key);
  const last = parts.pop();
  while (parts.length) {
    // 纯对象 → {...data[key]} 浅拷贝到自身
    // 数组 → concat() 复制
    // 非对象 → 强转 {}
    data = data[key] = isPlainObject(data[key]) ? {...data[key]} : {};
  }
  data[last] = value;
}
```

### deleteVariable 只删自身层

```ts
export function deleteVariable(data, key) {
  if (data.hasOwnProperty(key)) {   // ★ hasOwnProperty 保证只删自身
    delete data[key];
  }
}
```

---

## 五、链的折叠与展开

### extractObjectChain（对象 → 链数组）

```ts
export function extractObjectChain(value) {
  const result = value ? [value] : [];
  while (value?.__super) {
    result.unshift(value.__super);   // unshift：结果[0] 是最顶层
    value = value.__super;
  }
  return result;  // [顶层, ..., 中间层, value自身]
}
```

### createObjectFromChain（链数组 → 嵌套原型）

```ts
export function createObjectFromChain(chain) {
  return chain.filter(item => item).reduce((proto, value) => {
    proto = proto || Object.prototype;
    if (Object.isFrozen(proto)) proto = cloneObject(proto);
    return Object.assign(
      Object.create(proto, {
        __super: {value: proto, writable: false, enumerable: false}
      }),
      value
    );
  }, null);
}
```

reduce 的累积值 `proto` 恰好是上一轮创建的对象，天然形成嵌套。

### injectObjectChain（向链中插入一层）

```ts
export function injectObjectChain(obj, value) {
  const chain = extractObjectChain(obj);
  chain.splice(chain.length - 1, 0, value);  // 插在自身层前面
  return createObjectFromChain(chain);
}
```

### 真实使用场景：dialog 数据拼接

dialog 打开时，把"当前上下文 + 附加参数 + 全局变量"折叠成一条新链：

```ts
openDialog(ctx, additional) {
  const chain = extractObjectChain(ctx);
  if (chain.length === 1) chain.unshift(self.data);     // 补上当前 data
  if (additional) chain.splice(chain.length - 1, 0, additional);  // 插入附加层
  const data = createObjectFromChain(chain);
  // 再叠一层全局变量
  self.dialogData = createObjectFromChain([top.downStream, data]);
}
```

---

## 六、syncDataFromSuper — 父→子数据同步

注意：这一步**不是链共享**，而是**按 key 复制**。这是 amis 数据流的"软同步"层。

### 同步策略矩阵

| Store 类型 | force | 同步的 keys | 行为 |
|---|---|---|---|
| FormStore | 任意 | formItem.name 顶级 + 自身 keys | **字段级定向同步**：只有表单项关心的字段会被父级覆盖 |
| 非 FormStore | true | 自身全部 keys | 全量同步 |
| 非 FormStore | false | 空 | **不同步** |

### 为什么 FormStore 特殊

表单有大量 FormItem，每个有 `name`（如 `user.name`）。FormStore 希望父级同名变量变化时**只刷新那些恰好对应某个表单项的字段**，避免无关字段被父级意外覆盖（如表单临时输入被父级旧值冲掉）。

### 核心区分

- **原型链（读继承）**：子组件读父值，零成本，但只读
- **syncDataFromSuper（写同步）**：父值变化时把值"抄"到子自身层，保障 `hasOwnProperty` 类调用正确

两者互补——前者零成本但只读，后者保证 `getPristineValueByName(name, false)` 也能拿到最新父值。

---

## 七、RootStore.downStream — 全局变量注入到链顶

```ts
get downStream() {
  const chain = extractObjectChain(self.data);

  chain.unshift(self.globalData);          // {global, globalState}
  self.context && chain.unshift(self.context);  // __page 等
  (self.query || self.params) &&
    chain.splice(chain.length - 1, 0, {query, params});

  return createObjectFromChain(chain);
}
```

### 注入后链的形态（从顶到底）

```
[context]        ← 业务上下文（最顶，优先级最低）
[globalData]     ← global(全局变量值) + globalState(表单态)
[query/params]   ← URL query + params
[self.data]      ← 优先级最高
```

越靠下的层优先级越高（原型链就近覆盖）。

### 双态机制（临时/正式）

| 视图 | 数据源 | 用途 |
|---|---|---|
| `nextGlobalData` | `globalVarTempStates`（临时） | 触发 reaction，一轮 RAF 后转正 |
| `downStream` | `globalVarStates`（正式） | 子树实际读取的数据域 |

**为什么分两态**：让"需要重新渲染的组件"能感知到 `props.data !== prevProps.data`。临时态先变，等渲染完成后再转正，避免渲染中途数据链抖动导致 diff 失效。

---

## 八、数据作用域在组件树中的流转

```
1. Page 渲染
   root.downStream → Page.props.data（含 global/context/query）
   Page store.initData(extendObject(props.data, ...))
   → PageStore.data 原型链含全局层

2. Form 作为 Page 子组件
   Form.props.data = PageStore.data
   Form store.initData → FormStore.data 原型指向 PageStore.data
   → Form 能 ${global.xxx}、${__query.id} 读取全局/URL

3. 用户在 FormItem 输入
   FormItem 调 formStore.changeValue('user.name', v)
   → cloneObject(data) + setVariable → 仅 FormStore.data 自身层变化
   → PageStore.data 不受影响 ✅（写隔离）

4. Page 数据变化（如 initApi 刷新）
   WithStore 检测 isSuperDataModified → syncDataFromSuper
   → 把变化的字段复制到 FormStore.data 自身层
```

### iRendererStore 关键操作的链行为

| 操作 | 链行为 |
|---|---|
| `initData(data)` | 设 data 为新链顶（data.__super 指向父级） |
| `updateData(values)` | `extendObject(self.data, values)` — clone + 合并，保留 __super |
| `changeValue(name, v)` | `cloneObject(self.data)` + `setVariable` — 克隆后写自身 |
| `openDialog(ctx)` | `extractObjectChain → splice → createObjectFromChain` — 拼接弹窗链 |

---

## 九、Vue3 迁移方案

### 关键挑战

| 挑战 | 说明 |
|---|---|
| Vue3 `reactive()` 自身是 Proxy | 与"继承 Proxy"叠加会导致两层 Proxy 嵌套 |
| 原型链穿透不建立响应式依赖 | `getVariable(data, 'parentField')` 读取不触发 Vue track |
| Proxy 性能 | get/has trap 每次都是函数调用，远慢于 `[[Prototype]]` 查找 |

### 推荐方案：保留 Object.create + shallowRef 桥接

```ts
class DataScope {
  readonly data = shallowRef<Record<string, any>>({});

  get(name: string) { return getVariable(this.data.value, name, true); }
  getOwn(name: string) { return getVariable(this.data.value, name, false); }

  set(name: string, value: any) {
    const next = cloneObject(this.data.value);  // 克隆保留原型链
    setVariable(next, name, value);              // 写隔离
    this.data.value = next;                       // ★ 引用替换 → 触发响应式
  }

  update(values: Record<string, any>) {
    this.data.value = extendObject(this.data.value, values);
  }

  createChild(childData = {}) {
    return new DataScope(childData, this);
  }
}
```

**为什么 shallow 而非 deep reactive**：amis 的 data 是每次 changeValue 都生成新顶层对象的不可变模型，shallowRef 监听引用替换即可。deep reactive 反而会递归代理整条链（含 `__super`），开销巨大。

### 方案对比

| 方案 | 做法 | 响应式 | 改造成本 | 推荐度 |
|---|---|---|---|---|
| **A. 保留 Object.create + shallowRef** | 数据链对象不变，外层 shallowRef 桥接 | 引用变更触发 | 低 | ★★★★★ |
| B. Object.create + markRaw | 数据链用 markRaw 跳过 reactive | 同 A | 低 | ★★★★ |
| C. 全量 Proxy 继承 | 用 Proxy 模拟 __super 链 | 原生 track/trigger | 极高 | ★ |

**结论**：`Object.create` 原型链方案与 Vue3 **不冲突，且无需替换**。最佳实践是「保留原型链数据模型 + `shallowRef` 桥接响应式」，既复用 amis 全部工具函数（getVariable/setVariable/dataMapping/syncDataFromSuper 零改动），又获得 Vue 的组件级响应式更新。

---

## 十、Vue3 验证结果（10 组全部通过 ✅）

> 验证项目：`vue3-examples/src/data-scope/data-scope.ts` + `data-scope-demo.tsx`

| # | 验证场景 | 验证项 | 结果 |
|---|---|---|---|
| 1 | **createObject 原型链读取** | 自身层读取 / 穿透读取父级 / __super 指向 / 不可枚举 | ✅ |
| 2 | **写隔离（赋值遮蔽）** | 子写入继承属性遮蔽父级 / 子写新属性不影响父 | ✅ |
| 3 | **getVariable canAccessSuper** | 穿透读取 / 仅自身层 / 点号路径 / 不存在返回 undefined | ✅ |
| 4 | **deleteVariable** | 只删自身层 / 删继承属性后穿透父级 | ✅ |
| 5 | **链折叠/展开** | extractObjectChain 链长度+顺序 / createObjectFromChain 读取 / injectObjectChain 插入 | ✅ |
| 6 | **cloneObject / extendObject** | 克隆保留 __super / 改克隆不影响原始 / extend 合并+保留链 | ✅ |
| 7 | **DataScope 响应式** | set 触发引用替换 / update 批量更新 / delete | ✅ |
| 8 | **DataScope 父子继承** | 子穿透读父 / 自身遮蔽 / getOwn 仅自身 / 子改不影响父 | ✅ |
| 9 | **isObjectShallowModified** | 相同 → false / 值不同 → true / key 数不同 / 忽略指定 key | ✅ |
| 10 | **DataScope.fromChain 弹窗场景** | 全局层穿透 / 页面层穿透 / 表单自身层 / 优先级 | ✅ |

### 验证架构

```
vue3-examples/src/
├── data-scope/
│   └── data-scope.ts          ← 核心实现（~320 行）
│       ├─ createObject         ← 原型链创建
│       ├─ extractObjectChain   ← 链展开
│       ├─ createObjectFromChain ← 链折叠
│       ├─ injectObjectChain    ← 链插入
│       ├─ cloneObject/extendObject ← 克隆/合并（保留链）
│       ├─ getVariable          ← 原型链穿透读取
│       ├─ setVariable          ← 写隔离赋值
│       ├─ deleteVariable       ← 仅删自身层
│       ├─ isObjectShallowModified ← 自身层浅比较
│       └─ DataScope 类         ← shallowRef 响应式桥接
└── data-scope-demo.tsx        ← 10 组验证（全部通过）
```

---

## 十一、完整工具函数索引

| 函数 | 签名 | 用途 |
|---|---|---|
| `createObject` | `(superProps?, props?, properties?) => object` | 建原型链 + __super 指针 |
| `extractObjectChain` | `(value) => object[]` | 对象 → 链数组（顶到自身） |
| `createObjectFromChain` | `(chain) => object` | 链数组 → 嵌套原型对象 |
| `injectObjectChain` | `(obj, value) => object` | 在自身层前插一层 |
| `cloneObject` | `(target, persistOwnProps=true) => object` | 克隆自身层、保留 __super |
| `extendObject` | `(target, src?, persistOwnProps=true) => object` | clone + 浅合并 |
| `getVariable` | `(data, key, canAccessSuper=true) => any` | 沿链读 |
| `setVariable` | `(data, key, value) => void` | 写隔离赋值 |
| `deleteVariable` | `(data, key) => void` | 仅删自身层 |
| `isObjectShallowModified` | `(prev, next, ignoreKeys?) => boolean` | 自身层浅比较 |
| `syncDataFromSuper` | `(data, superObj, prevSuperObj, store, force) => any` | 父→子按 key 同步 |

---

## 十二、设计精髓总结

1. **读继承 / 写隔离的零成本实现**：完全借力 JS 原型链（Object.create + 赋值遮蔽），无需自实现 get/set 转发——这是整套系统简洁的根本原因。

2. **`__super` 不可枚举是协同设计的支点**：它让 `Object.keys`、`JSON.stringify`、`isObjectShallowModified` 全部自动忽略链结构，序列化与 diff 天然安全。

3. **链折叠/展开是数据拼接的通用语言**：dialog/drawer/全局变量/tag 层/临时层，全部归约为 `extractObjectChain → 修改数组 → createObjectFromChain` 三步，模式高度统一。

4. **读同步(原型链) vs 写同步(syncDataFromSuper) 正交**：原型链让子组件免费读父值；syncDataFromSuper 在父值变化时把值"抄"到子自身层——两者覆盖不同访问语义。

5. **双态(临时/正式)全局变量 + RAF 转正**：解决渲染中数据链抖动导致的 diff 失效。

6. **迁移 Vue3 无需推翻原型链**：`shallowRef` + `watch + isObjectShallowModified` 桥接即可，全量 Proxy 替换得不偿失。

---

## 十三、与配套文档的关系

| 文档 | 主题 | 本文增量 |
|---|---|---|
| `10-amis优秀设计借鉴分析.md` | amis 设计概览（6-11 节涉及数据作用域） | — |
| `11-amis-Scoped组件通信系统深度挖掘.md` | Scoped 通信（组件间 reload/send/close） | — |
| **本文 12** | **__super 原型链数据作用域（数据层）** | **createObject 逐行/读写隔离/链折叠展开/syncDataFromSuper/RootStore.downStream/Vue3 迁移验证** |

三份文档构成 amis 运行时的完整剖析：**Scoped（组件通信层）+ __super 原型链（数据作用域层）+ 渲染器注册（渲染层）**。
