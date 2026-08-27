# ADR-0001: 数组结构编辑走通用 setter 能力下沉，不做宿主专用配置组件

- 状态：已采纳（2026-08-27）
- 关联：docs/19（插槽语义声明式配置）、YqFlexBox 格子配置迁移

## 背景

旧版编辑器（assembox-editor）为 YqFlexBox 的 `itemConfig` 格子数组写了 413 行
硬编码配置组件（FlexBoxItemConfig，desktop-setter/_custon-config/）。它内嵌了
容器属性 + 每格 10 字段表单 + itemNum↔itemConfig.length 联动 + tag 重排 +
拖拽排序。该模式侵入性大、不可复用、与 setter 体系脱节。

新版需要等价能力时面临选择：再写一个专用 setter 吃下全部逻辑，还是给通用
ArraySetter 增加两个可选能力后纯元数据声明。

## 决策

**通用能力下沉**：ArraySetter 增加两个可选 props（零默认行为变化）：

1. `rekey: (item, index) => item` —— 增删/排序后按新 index 重生成每项的键。
   动机：`itemConfig[i].tag`（item-N）是 UI 库 slot 命名键，错位即内容错挂；
   UI 库 watchEffect 会自动修正但有渲染窗口期，数据源头正确是编辑器的责任。
2. `syncLengthField: string` —— 数组长度变化回写兄弟字段（经 SETTER_CONTEXT
   的 editor.updateProps 合并写入）。动机：`itemNum` 与 `itemConfig.length`
   在 schema 中冗余并存，渲染层按 itemNum 循环读数组，不同步即崩。

YqFlexBox 的格子配置由此收敛为元数据声明（layout.ts ~60 行）：
`ArraySetter + ObjectSetter + itemConfig.items[10 字段] + rekey + syncLengthField
+ initialValue（单对象，defaultSlot: null 走空槽占位）`。

## 备选方案与取舍

- **专用 FlexBoxItemsSetter**：实现最快，但 columnSlots/tabPane/buttonGroupOptions
  等数组结构字段在后面排队，每个都写专用 setter 会重演旧版侵入模式。否决。
- **settings-pane 层联动**：面板层无字段语义，无法承载跨字段耦合。否决。

## 后果

- 正面：数组结构编辑的声明式范式确立，后续数组字段零核心代码接入；
  rekey/syncLengthField 是可选 props，存量声明零影响。
- 负面：ArraySetter 成为承载跨字段语义的核心（emit 统一产出通道），改动需
  回归全部 92 项测试；`syncLengthField` 仅顶层 props 用法生效（嵌套于
  ObjectSetter 时无兄弟字段概念，静默忽略）——文档已注明。
- 顺带修复（实现中实证的存量 bug）：`insertChildIntoOpts`/`getSlotChildrenList`
  由 direct-first 改为 indirect-first（`defaultSlot` 键重叠时 YqFlexBox/TabPanel
  的子节点在 itemConfig/tabPane 内，direct-first 会误写顶层字段成 wrapper
  不渲染的孤儿子节点）；间接容器新增 `lengthField` 声明（createEntry 追加后
  同步 itemNum，防新格子不渲染）。
