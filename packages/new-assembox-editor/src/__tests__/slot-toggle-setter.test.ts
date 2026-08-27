// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { countSlotChildren, nextSlotValue } from "../setters/slot-toggle-setter";

/**
 * SlotToggleSetter 槽位启停语义守护（docs/19 槽位三态：null / [] / [node]）。
 *
 * 渲染层契约：wrapper useNodeOptions 默认三槽 null（未启用态）；
 * Array.isArray(v) ? v : [] 与 v-if="options.defaultSlot" 对三态全兼容。
 */
describe("nextSlotValue（启停下一个值）", () => {
  it("禁用 → null（渲染层未启用态，区域随 v-if 消失）", () => {
    expect(nextSlotValue(false, { slotType: "array" })).toBeNull();
    expect(nextSlotValue(false, { slotType: "object", slotRender: ["YqFlexLine"] })).toBeNull();
    expect(nextSlotValue(false, undefined)).toBeNull();
  });

  it("启用 array 槽 → []（启用・空，画布出占位区）", () => {
    expect(nextSlotValue(true, { slotType: "array" })).toEqual([]);
  });

  it("启用 object 槽 → 白名单首项 scaffold 节点（YqToolBar.defaultSlot → YqFlexLine）", () => {
    const node = { __nodeId: "n1", __nodeOptions: { renderType: "YqFlexLine" } };
    const r = nextSlotValue(
      true,
      { slotType: "object", slotRender: ["YqFlexLine"] },
      { createScaffoldNode: () => node },
    );
    expect(r).toBe(node);
  });

  it("object 槽无白名单/无工厂 → null（无法造默认节点，保持未启用）", () => {
    expect(nextSlotValue(true, { slotType: "object" })).toBeNull();
    expect(
      nextSlotValue(true, { slotType: "object", slotRender: ["YqFlexLine"] }),
    ).toBeNull();
  });

  it("无槽位声明 → null（未配置的 setter 兜底不产生脏数据）", () => {
    expect(nextSlotValue(true, undefined)).toBeNull();
  });
});

describe("countSlotChildren（状态文案计数）", () => {
  it("null/undefined → 0；数组 → 长度；单节点 → 1", () => {
    expect(countSlotChildren(null)).toBe(0);
    expect(countSlotChildren(undefined)).toBe(0);
    expect(countSlotChildren([])).toBe(0);
    expect(countSlotChildren([{}, {}])).toBe(2);
    expect(countSlotChildren({ __nodeId: "n1" })).toBe(1);
  });
});
