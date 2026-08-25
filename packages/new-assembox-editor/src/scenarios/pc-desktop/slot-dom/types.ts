/**
 * 槽位区域解析器接口（每组件一个实现，见 slot-dom/ 目录）
 *
 * 设计动机：不同多槽位组件的识别逻辑差异较大——
 * - FlexLine/Panel/ToolBar：静态类名区域 contains（简单）
 * - TabPanel：需按激活页签动态定位（tabPane[].defaultSlot）
 * - 表格族：columnSlots 列级定位（可能需几何计算）
 * 故按组件拆分独立模块，各自封装识别细节，统一本接口；
 * index.ts 注册表分发，canvas-sensor 只认 resolveSlotKeyFromDom。
 */
export type SlotRegionResolver = (containerEl: Element, hitEl: Element | null) => string | null;
