# assembox 页面 Schema 结构深度分析

> 分析对象：`assembox/packages/desktop-demo/src/modules/*/config/*.json`
> 共 10+ 份真实业务配置（box/single-table/report/receive-order/order-items/lc-lease-contract/lc-waste-manage 等）
> 目的：评估当前「复杂嵌套结构」对**渲染、组件交互、事件绑定、编辑器实现**的影响，并给出改进方向。

---

## 一、Schema 模型概览

所有配置以 `uiSkeleton` 为根，采用统一的「节点包装」模型，每个 UI 节点形如：

```jsonc
{
  "__nodeId": "01111311161",   // 节点 id（应为唯一，实则大量重复）
  "__nodeName": "button",       // 节点名
  "__nodeType": "baseNode",     // 节点类型：baseNode | renderNode
  "__nodeOptions": { ... },     // 节点配置（属性 / 子节点 / 布局）
  "__nodeEvent": {              // 事件（代码字符串）
    "onClick": { "isOn": true, "fn": "function(){ ... }" }
  }
}
```

并辅以双层数据：
- `dataSource`：api 列表 + requestConfig（请求参数模型）+ sharedFns（全局函数）
- 布局容器：`flexbox` / `flexBoxOptions` → `itemConfig[]` → 每个 item 的 `defaultSlot`

### 渲染双层模型

每个可视组件被建模为**两层节点**：

```
renderNode（渲染选择器）        baseNode（组件实例）
__nodeName: elementRender       __nodeName: button
__nodeOptions.renderType:"button"  __nodeOptions: { type, content, icon... }
   └─ elementOptions ───────────────►  (真正的组件节点)
```

容器同理：`containerRender` → `renderType:"panel"/"box"` → `containerOptions` → baseNode。
页面级：`planeOptions` / `pageRenderOptions` / `pageOptions` / `flexBoxOptions`。

---

## 二、核心问题（附实测证据）

### 2.1 ❌ 节点 ID 不唯一（致命）

`__nodeId` 本应是节点唯一标识（编辑器选区、DOM 标记、事件寻址都依赖它），但实测**大量重复**：

| 文件 | __nodeId 总数 | 唯一数 | 重复 |
|---|---|---|---|
| box.json | 19 | 13 | **6** |

box.json 中 `"5"` 出现 3 次、`"4"` 2 次、`"011121113"` 2 次、`"01111311161"` 2 次、`"42"` 2 次。

**影响**：
- 编辑器按 id 选中/高亮会命中多个节点 → 选区错乱；
- DOM 标记（旧版用 Symbol / data 属性）冲突；
- `this.$exposeds.get('01112skk')` 这类按 id 跨节点引用（实测 **212 处**）会指向错误目标；
- 撤销/重做、复制粘贴难以正确维护 id 唯一性。

**根因**：id 由人工/拼接生成（`01111311161` 这种「父 id + 序号」字符串拼接），无全局唯一性校验。

### 2.2 ❌ 包装层 / 间接层爆炸

渲染一个按钮要穿越 **8–10 层**：

```
uiSkeleton
└ planeOptions (plane)
  └ pageRenderOptions (pageRender)
    └ pageOptions (page)
      └ flexbox.itemConfig[0].defaultSlot
        └ containerRender (renderType:box)
          └ containerOptions (box)
            └ defaultSlot
              └ elementRender (renderType:button)
                └ elementOptions (button baseNode)  ← 真正的按钮
```

每层都是 `{__nodeId, __nodeName, __nodeType, __nodeOptions}` 的重复包装。**真正的业务属性（type/content/icon）埋在最深处**。

**影响**：
- 渲染器必须递归剥离 3–4 层包装才能拿到组件 → 渲染逻辑臃肿、易错；
- 编辑器「属性面板」要深挖 `__nodeOptions.elementOptions.__nodeOptions` 才能读写属性；
- diff/序列化体积膨胀，JSON 噪声占比极高（有效信息 < 20%）；
- 单个简单页面 JSON 达数百～数千行。

### 2.3 ❌ 双层节点模型冗余（renderNode + baseNode）

每个组件同时存在「渲染选择器节点」和「组件实例节点」：

```jsonc
{ "renderType": "button",          // renderNode：告诉渲染器用什么渲染器
  "elementOptions": {
    "__nodeName": "button",         // baseNode：组件本身
    "__nodeOptions": { "content": "保存" } } }
```

`renderType` 与 `__nodeName` 信息**重复**（renderType=button ↔ __nodeName=button），且要靠 `renderType` 决定真正的组件藏在 `elementOptions`/`containerOptions`/`pageOptions`/`planeOptions` 哪个键下。

**实测 renderType 变体 30+**：button(238)、input(168)、box(94)、formItem(89)、panel(87)、filterItem(65)、label(56)、tag(54)、form(37)、condationTag(35)、toolbar(33)、datePicker(29)… 渲染器需对每种 renderType 写分支找配置键。

**影响**：渲染器充满 `switch(renderType)`；新增组件要同时改 renderType 枚举 + 选项键约定；心智负担大。

### 2.4 ❌ 子节点表示极不一致（defaultSlot 三态）

`defaultSlot` 在不同上下文含义不同，解析器无法统一处理：

```jsonc
// 形态 A：单子节点（对象）
"defaultSlot": { "__nodeId":..., "renderType":"button", ... }

// 形态 B：多子节点（数组）
"defaultSlot": [ {...}, {...} ]

// 形态 C：布局配置 + 嵌套 defaultSlot（最混乱）
"defaultSlot": {
  "leftWidth": "200px",        // 这是布局属性！
  "leftPadding": true,
  "defaultSlot": [ {...} ]     // 真正的子节点在同名键里
}
```

形态 C 中 `defaultSlot` 既是「插槽容器配置」又内嵌一个叫 `defaultSlot` 的数组 —— **同名键两层含义**，递归解析极易死循环或漏解析。

**影响**：渲染器无法用统一规则遍历子树；编辑器拖拽插入时不知该塞对象还是数组；极易出 bug。

### 2.5 ❌ 布局与内容深度交织

`flexbox`/`flexBoxOptions`（布局）与组件节点（内容）**同层混排**，且布局配置内嵌 `itemConfig[].defaultSlot`（内容）：

```
page.__nodeOptions.flexbox.itemConfig[i].defaultSlot → 内容节点
                                              ↑
                              itemConfig[i] 还带 isFixed/size/paddingSize（布局）
```

布局（栅格/间距/固定列）与组件树未分层，导致：
- 调整布局会改动内容节点所在路径；
- 换皮肤/换布局方案需重写整棵子树；
- 编辑器难以独立编辑「布局属性」与「组件属性」。

### 2.6 ❌ 事件为代码字符串 + 魔法 id 跨节点引用

```jsonc
"__nodeEvent": {
  "onClick": { "isOn": true,
    "fn": "function(){ this.$exposeds.get('01112skk').model.drawerShow.value = true; }" }
}
```

实测全量：**393 处** `"fn":"function..."` 代码字符串；**212 处** `this.$exposeds.get('id')` 跨节点引用。

**影响**：
- **安全**：`new Function()` 执行任意代码，XSS/注入风险；
- **可读/可维护**：业务逻辑散落在 JSON 字符串里，无类型、无静态检查、无 IDE 支持；
- **可校验性差**：schema 无法校验事件意图，无法做动作编排；
- **脆弱**：`$exposeds.get('01112skk')` 依赖魔法 id（而 id 还会重复，见 2.1）→ 改 id 即全线失效；
- **跨端不可复用**：PC/Mobile 各一套事件编辑器，代码字符串无法跨端。

### 2.7 ❌ UI 与数据源强耦合

`uiSkeleton`（UI 树）与 `dataSource`（api/requestConfig/sharedFns）塞在**同一个 JSON**：

```jsonc
{ "uiSkeleton": {...数千行 UI...},
  "dataSource": { "api":{...}, "requestConfig":{...}, "sharedFns":{...} } }
```

**影响**：UI 与数据契约无法独立演进；接口联调与 UI 搭建互相阻塞；无法复用同一 UI 接不同数据源。

### 2.8 ❌ 魔法键污染 + 体积失控

每个节点重复 4 个 `__` 前缀键（`__nodeId/__nodeName/__nodeType/__nodeOptions`），有效信息被噪声淹没。实测文件体积：

| 文件 | 行数 |
|---|---|
| lc-lease-contract.json | **7294** |
| lc-waste-manage.json | **6242** |
| single-table copy.json | **5333** |
| receive-order.json | **4510** |
| single-table.json | 2824 |

单文件数千行，**人工无法阅读/审查/合并**，git diff 噪声巨大。

---

## 三、对四大场景的影响评估

### 3.1 渲染（Rendering）

| 维度 | 评价 |
|---|---|
| 渲染逻辑 | ❌ 需层层剥离 renderNode→baseNode + switch(renderType) 找选项键，复杂易错 |
| 子节点遍历 | ❌ defaultSlot 三态（对象/数组/混合）无法统一递归 |
| 性能 | ❌ 深嵌套 + 包装层导致渲染递归深、JSON 解析慢、patch 粒度粗 |
| 容器/区域 | ❌ 无显式 region 概念，靠 defaultSlot 隐式约定，拖拽投放难判定 |

### 3.2 组件交互（Component Interaction）

| 维度 | 评价 |
|---|---|
| 属性读写 | ❌ 属性埋在 `elementOptions.__nodeOptions`，深路径，易错 |
| 布局编辑 | ❌ 布局与内容交织，独立编辑布局困难 |
| 数据绑定 | ⚠️ modelName 点路径（376 处）可用，但与 UI 耦合、无类型校验 |
| 组件寻址 | ❌ id 重复 + `$exposeds.get(id)` 魔法引用，脆弱 |

### 3.3 事件绑定（Event Binding）

| 维度 | 评价 |
|---|---|
| 表达形式 | ❌ 代码字符串（393 处），不可声明、不可校验、不可编排 |
| 安全 | ❌ new Function 执行任意代码 |
| 跨节点联动 | ❌ 魔法 id 硬编码（212 处），id 重复即错乱 |
| 可视化编辑 | ❌ 只能 Monaco 手写代码，无动作编排器 |

### 3.4 编辑器渲染/实现（Editor）

| 维度 | 评价 |
|---|---|
| 节点选中/DOM 标记 | ❌ id 重复导致选中/高亮错乱 |
| 属性面板 | ❌ 深挖多层 __nodeOptions，属性 schema 难以声明式驱动 |
| 大纲树 | ⚠️ 可构建，但包装层（renderNode）污染树结构，需过滤 |
| 拖拽投放 | ❌ 无 region，defaultSlot 三态，投放位置难计算 |
| 撤销/重做 | ⚠️ 整树深拷贝，体积大、性能差 |
| 序列化/diff | ❌ 噪声多、文件巨大、不可读 |

---

## 四、设计合理性结论

**总体评价：该 Schema 模型设计不合理，属于「能用但难维护、难扩展、难编辑」的早期试错设计。**

核心症结：
1. **双层节点模型（renderNode+baseNode）** 引入冗余间接层，本可单层；
2. **id 非唯一** 动摇了编辑器与跨节点引用的根基；
3. **defaultSlot 三态 + 布局/内容交织** 破坏了树的规整性；
4. **事件代码字符串 + 魔法 id** 牺牲了安全、可校验、可编排；
5. **UI/数据耦合 + 魔法键 + 体积失控** 拖累整个研发链路。

它在「快速堆叠业务页面」时勉强可行，但**严重阻碍**渲染性能、编辑器体验、跨端复用与长期维护。

---

## 五、改进方向（对齐 new-assembox-editor 的 amis 风格 Schema）

新版编辑器已采用 **amis 风格标准化 Schema**，针对性解决上述全部问题：

### 5.1 单层节点 + 标准 id

```jsonc
{ "type": "button", "$$id": "btn_a3f9",  // type 即组件类型，单层；$$id 全局唯一（编辑器保证）
  "props": { "type": "primary", "text": "保存" } }   // 属性扁平，无需深挖
```
- `type` 直接 = 组件（取消 renderType+双层模型）；
- `$$id` 由编辑器 `genNodeId()` 保证唯一，杜绝重复；
- `props` 扁平，属性面板声明式驱动。

### 5.2 统一子节点（body 数组）+ 显式 region

```jsonc
{ "type": "container", "$$id": "c1",
  "body": [ { "type": "button", "$$id": "b1" } ] }   // 子节点恒为数组
```
- `body` 永远是数组，渲染器统一 `map`；
- 复杂容器用 `regions` 声明可投放区，拖拽投放清晰；
- 布局属性进 `props`/`style`，与内容树分层。

### 5.3 声明式事件/动作（取代代码字符串）

```jsonc
{ "onEvent": { "click": { "actions": [
    { "actionType": "setVar", "args": { "key": "drawerShow", "value": true } },
    { "actionType": "emit", "componentId": "drawer_1" }   // 按 $$id 引用，唯一可靠
] } } }
```
- 动作声明式、可校验、可编排、跨端复用；
- 按 `$$id`（唯一）引用目标，取代魔法 id；
- 安全：动作白名单注册执行，无 `new Function` 任意代码。

### 5.4 UI 与数据分离

```
page.schema          // 纯 UI 树（type/$$id/body/props/style/onEvent）
page.datasource      // api/requestConfig（独立契约）
```
- UI 与数据独立演进、独立联调、可复用。

### 5.5 收益对照

| 问题（旧） | 新方案 | 收益 |
|---|---|---|
| id 重复 | `$$id` 编辑器保证唯一 | 选区/引用可靠 |
| 双层包装爆炸 | 单层 `type` 节点 | 渲染/属性面板简化 ~70% |
| defaultSlot 三态 | `body` 恒数组 + region | 子树遍历统一 |
| 布局/内容交织 | 布局入 props/style | 可独立编辑 |
| 事件代码字符串 | `onEvent.actions` 声明式 | 安全/可校验/可编排 |
| 魔法 id 引用 | `$$id` 引用 | 不脆弱 |
| UI/数据耦合 | 分离 | 独立演进 |
| 文件数千行 | 扁平 schema | 体积↓、可读↑ |

---

## 六、迁移建议

1. **保留旧 JSON 作为只读存量**，新版编辑器加载时经「转换器」转为 amis 风格 schema 再编辑；
2. 转换器职责：
   - 剥离 renderNode/baseNode 双层 → 单层 `type`；
   - `__nodeId` 去重 → 重分配 `$$id`；
   - defaultSlot 三态归一 → `body` 数组；
   - `__nodeEvent.fn` 代码字符串 → 尽量提取为 `onEvent.actions`（无法自动转的降级为 `script` 动作）；
   - `$exposeds.get('id')` → 映射到新 `$$id`；
3. 新建页面直接用新 schema，逐步替换存量。

> 转换器可作为 new-assembox-editor 的一个工具模块（`schema-converters/legacy-assem-to-amis.ts`）实现。
