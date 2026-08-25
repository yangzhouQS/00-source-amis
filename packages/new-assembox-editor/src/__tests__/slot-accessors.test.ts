// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  canInsertIntoSlot,
  getSlotChildrenList,
  insertChildIntoOpts,
  isSingleNodeSlot,
  removeChildFromOpts,
} from "../scenarios/pc-desktop/slot-accessors";

/**
 * 单节点槽语义（宿主维度）守护测试。
 *
 * 背景：YqToolBar.defaultSlot 的渲染层 wrapper（assem-yq-tool-bar.vue）硬编码
 * 以单个 AssemYqFlexLine 渲染。通用数组槽归一会把值数组化，wrapper 取
 * `options.defaultSlot.__nodeOptions` 得 undefined → 子组件 useNodeOptions
 * 解构崩溃（"Cannot destructure property 'renderType'"）。
 * slot-accessors 以 (宿主 renderType, slotKey) 表达单节点语义。
 */
const genId = (() => {
  let n = 0;
  return () => `id-${++n}`;
})();

function node(id: string, renderType = "Button"): any {
  return { __nodeId: id, __nodeOptions: { renderType }, __nodeEvent: {} };
}

describe("isSingleNodeSlot / canInsertIntoSlot", () => {
  it("YqToolBar.defaultSlot 是单节点槽；其他宿主 defaultSlot 不是", () => {
    expect(isSingleNodeSlot("YqToolBar", "defaultSlot")).toBe(true);
    expect(isSingleNodeSlot("YqPanel", "defaultSlot")).toBe(false);
    expect(isSingleNodeSlot("YqToolBar", "toolSlot")).toBe(false);
    expect(isSingleNodeSlot(undefined, "defaultSlot")).toBe(false);
  });

  it("单节点槽空 → 可插入；已占用 → 不可插入", () => {
    const opts = { renderType: "YqToolBar", defaultSlot: null };
    expect(canInsertIntoSlot(opts, "defaultSlot")).toBe(true);
    opts.defaultSlot = node("f1", "YqFlexLine");
    expect(canInsertIntoSlot(opts, "defaultSlot")).toBe(false);
  });

  it("数组槽恒可插入", () => {
    const opts = { renderType: "YqPanel", defaultSlot: [node("a")] };
    expect(canInsertIntoSlot(opts, "defaultSlot")).toBe(true);
  });
});

describe("insertChildIntoOpts 单节点槽分支", () => {
  it("空槽插入 → 存为单节点（非数组），渲染层 wrapper 契约", () => {
    const opts = { renderType: "YqToolBar", defaultSlot: null };
    const n = node("f1", "YqFlexLine");
    const r = insertChildIntoOpts(opts, "defaultSlot", n, undefined, genId);
    expect(r).toBe(n);
    expect(opts.defaultSlot).toBe(n); // 关键：不是 [n]
  });

  it("已占用 → 拒绝插入且不改动原值（防数组化崩溃）", () => {
    const occupied = node("f1", "YqFlexLine");
    const opts = { renderType: "YqToolBar", defaultSlot: occupied };
    const r = insertChildIntoOpts(opts, "defaultSlot", node("f2", "YqFlexLine"), undefined, genId);
    expect(r).toBeUndefined();
    expect(opts.defaultSlot).toBe(occupied);
  });

  it("其他宿主 defaultSlot 仍按数组槽归一（不影响 Panel/Box）", () => {
    const opts = { renderType: "YqPanel", defaultSlot: null };
    insertChildIntoOpts(opts, "defaultSlot", node("a"), undefined, genId);
    insertChildIntoOpts(opts, "defaultSlot", node("b"), undefined, genId);
    expect(Array.isArray(opts.defaultSlot)).toBe(true);
    expect(opts.defaultSlot).toHaveLength(2);
  });
});

describe("getSlotChildrenList / removeChildFromOpts 单节点槽兼容", () => {
  it("单节点值读作 [node]；移除后置 null", () => {
    const f1 = node("f1", "YqFlexLine");
    const opts = { renderType: "YqToolBar", defaultSlot: f1 };
    expect(getSlotChildrenList(opts, "defaultSlot")).toEqual([f1]);
    const removed = removeChildFromOpts(opts, "f1", n => n.__nodeId);
    expect(removed).toBe(f1);
    expect(opts.defaultSlot).toBeNull();
  });
});
