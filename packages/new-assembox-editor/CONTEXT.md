# CONTEXT.md — new-assembox-editor 领域术语表

本文件是术语表（glossary），不是规范或实现笔记。实现决策见 docs/adr/，机制文档见 docs/01-19。

## 术语

- **格子（item）**：YqFlexBox 内的子区域，schema 存于 `itemConfig[]` 数组项。
  每格通过 `defaultSlot`（单节点）持有内容。区别于 GridBox 的 GridItem（后者是真实子节点）。
- **tag（子项标识）**：格子的 `item-N` 命名键，UI 库（flex-box）用它命名 slot、
  wrapper 按它渲染格子内容。**错位即内容错挂**——增删/排序后必须按新 index 重排。
- **间接容器（indirect container）**：子节点嵌套在 `__nodeOptions[数组字段][i][子属性]`
  中的槽位形态（itemConfig/tabPane/columnSlots/buttonGroupOptions），与直接槽位
  （`__nodeOptions[field]`）相对。YqFlexBox/TabPanel 的槽位键与直接槽键 `defaultSlot`
  重叠，路由必须间接优先（ADR-0001）。
- **单节点槽（single-node slot）**：渲染层 wrapper 以 `:node="options.xxxSlot"`
  直渲单个节点的槽位（docs/19 声明 `slotType: "object"`）。数组化写入会让
  wrapper 取 `.__nodeOptions` 得 undefined 而崩溃。
- **孤儿子节点（orphan child）**：被误写到宿主顶层槽字段、但 wrapper 不渲染
  该字段的子节点（direct-first 路由 bug 的产物，已修复）。
- **冗余长度字段（lengthField）**：schema 中与间接容器数组长度冗余存在的计数字段
  （如 `itemNum` ↔ `itemConfig.length`），渲染层按它循环读数组，写入侧必须同步。
- **contentType（已废弃）**：旧版"选类型→塞 scaffold"机制的遗留字段。新版
  wrapper 与 UI 库均不消费；内容获取统一走"空槽占位 + 拖拽投放"范式。
