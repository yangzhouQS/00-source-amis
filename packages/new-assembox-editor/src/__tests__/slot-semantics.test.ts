// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { PC_COMPONENTS_ALL } from "../scenarios/pc-desktop/component-metadata-config";
import { isSingleNodeSlot } from "../scenarios/pc-desktop/slot-accessors";
import {
  buildSlotSemantics,
  findSingleNodeSlot,
  findSlotWhitelist,
  getSlotSemantics,
  hasDeclaredSlot,
  setSlotSemantics,
} from "../scenarios/pc-desktop/slot-semantics";

/**
 * 槽位语义编译器/注册点守护测试（docs/19 设计方案 P1）。
 *
 * 等价性要求：buildSlotSemantics(PC_COMPONENTS_ALL) 注入后，
 * isSingleNodeSlot 的判定结果与历史硬编码表完全一致（7 个单节点宿主）。
 */
describe("buildSlotSemantics 编译", () => {
  it("七个单节点宿主全部编译进 singleNodeSlots（与历史硬编码表等价）", () => {
    const s = buildSlotSemantics(PC_COMPONENTS_ALL);
    for (const host of ["YqToolBar", "YqFilterItem", "FormItem", "GridItem", "Dialog", "Drawer", "YqNavigationBar"]) {
      expect(s.singleNodeSlots[host], `${host} 未声明 defaultSlot 单节点槽`).toContain("defaultSlot");
    }
  });

  it("数组槽宿主声明不进 singleNodeSlots", () => {
    const s = buildSlotSemantics(PC_COMPONENTS_ALL);
    expect(s.singleNodeSlots.YqBox).toBeUndefined();
    expect(s.singleNodeSlots.YqPanel).toBeUndefined();
    expect(s.singleNodeSlots.YqFlexLine).toBeUndefined();
  });

  it("slotRender/description/declaredSlots 索引正确", () => {
    const s = buildSlotSemantics(PC_COMPONENTS_ALL);
    expect(s.declaredSlots["YqToolBar::defaultSlot"]).toBe(true);
    expect(s.slotDescriptions["YqToolBar::defaultSlot"]).toBe("默认插槽");
    expect(s.slotDescriptions["YqFilterItem::defaultSlot"]).toBe("筛选控件");
  });

  it("纯函数：不污染全局注册点", () => {
    const before = getSlotSemantics();
    buildSlotSemantics(PC_COMPONENTS_ALL);
    expect(getSlotSemantics()).toBe(before);
  });
});

describe("注册点注入与查询", () => {
  const original = getSlotSemantics();

  afterEach(() => {
    setSlotSemantics(original); // 还原，避免污染其他测试文件
  });

  it("注入后 findSingleNodeSlot 生效；未声明返回 undefined", () => {
    setSlotSemantics(buildSlotSemantics(PC_COMPONENTS_ALL));
    expect(findSingleNodeSlot("YqFilterItem", "defaultSlot")).toBe(true);
    expect(findSingleNodeSlot("YqToolBar", "toolSlot")).toBe(false); // 已声明为数组槽
    expect(findSingleNodeSlot("YqPanel", "defaultSlot")).toBeUndefined(); // 未声明（P3 补）
    expect(findSingleNodeSlot("UnknownHost", "defaultSlot")).toBeUndefined();
  });

  it("注入后 isSingleNodeSlot 与声明一致（等价性核心断言）", () => {
    setSlotSemantics(buildSlotSemantics(PC_COMPONENTS_ALL));
    expect(isSingleNodeSlot("YqToolBar", "defaultSlot")).toBe(true);
    expect(isSingleNodeSlot("YqFilterItem", "defaultSlot")).toBe(true);
    expect(isSingleNodeSlot("FormItem", "defaultSlot")).toBe(true);
    expect(isSingleNodeSlot("GridItem", "defaultSlot")).toBe(true);
    expect(isSingleNodeSlot("Dialog", "defaultSlot")).toBe(true);
    expect(isSingleNodeSlot("Drawer", "defaultSlot")).toBe(true);
    expect(isSingleNodeSlot("YqNavigationBar", "defaultSlot")).toBe(true);
    // 数组槽/未声明
    expect(isSingleNodeSlot("YqBox", "defaultSlot")).toBe(false);
    expect(isSingleNodeSlot("YqFlexLine", "rightSlot")).toBe(false);
    expect(isSingleNodeSlot("YqToolBar", "toolSlot")).toBe(false);
    expect(isSingleNodeSlot(undefined, "defaultSlot")).toBe(false);
  });

  it("注入空语义（P3 删除回落表后的测试形态）：仅声明驱动", () => {
    setSlotSemantics(buildSlotSemantics([
      { renderType: "TestHost", name: "t", scaffold: {}, slots: [{ name: "defaultSlot", slotType: "object" }] },
    ]));
    expect(findSingleNodeSlot("TestHost", "defaultSlot")).toBe(true);
    expect(hasDeclaredSlot("TestHost", "defaultSlot")).toBe(true);
    expect(hasDeclaredSlot("TestHost", "toolSlot")).toBe(false);
    expect(findSlotWhitelist("TestHost", "defaultSlot")).toBeUndefined();
  });

  it("slotRender 白名单编译", () => {
    setSlotSemantics(buildSlotSemantics([
      { renderType: "TestHost", name: "t", scaffold: {}, slots: [{ name: "defaultSlot", slotType: "object", slotRender: ["YqFlexLine"] }] },
    ]));
    expect(findSlotWhitelist("TestHost", "defaultSlot")).toEqual(["YqFlexLine"]);
  });
});
