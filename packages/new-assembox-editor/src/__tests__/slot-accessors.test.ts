// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest";
import { PC_COMPONENTS_ALL } from "../scenarios/pc-desktop/component-metadata-config";
import {
  canInsertIntoSlot,
  getSlotChildrenList,
  insertChildIntoOpts,
  isSingleNodeSlot,
  removeChildFromOpts,
} from "../scenarios/pc-desktop/slot-accessors";
import { buildSlotSemantics, setSlotSemantics } from "../scenarios/pc-desktop/slot-semantics";

/**
 * 单节点槽语义（宿主维度）守护测试。
 *
 * 背景：YqToolBar.defaultSlot 等渲染层 wrapper 硬编码以单个节点直渲
 * （`:node="options.defaultSlot"`，无 v-for）。通用数组槽归一会把值数组化，
 * wrapper 取 `options.defaultSlot.__nodeOptions` 得 undefined → 子组件
 * useNodeOptions 解构崩溃（"Cannot destructure property 'renderType'"）。
 *
 * 语义唯一来源：component-metadata-config 的 slots 声明（slotType: "object"），
 * 经 slot-semantics 注入（docs/19）。单测显式注入，不依赖时序。
 */
beforeAll(() => {
  setSlotSemantics(buildSlotSemantics(PC_COMPONENTS_ALL));
});
const genId = (() => {
  let n = 0;
  return () => `id-${++n}`;
})();

function node(id: string, renderType = "Button"): any {
  // __nodeType 必带：indirect 分支的 isNode 过滤依赖它（真实节点结构）
  return { __nodeId: id, __nodeType: "renderNode", __nodeOptions: { renderType }, __nodeEvent: {} };
}

describe("isSingleNodeSlot / canInsertIntoSlot", () => {
  it("已知单节点宿主（wrapper :node 直渲）全部登记", () => {
    expect(isSingleNodeSlot("YqToolBar", "defaultSlot")).toBe(true);
    expect(isSingleNodeSlot("YqFilterItem", "defaultSlot")).toBe(true);
    expect(isSingleNodeSlot("FormItem", "defaultSlot")).toBe(true);
    expect(isSingleNodeSlot("GridItem", "defaultSlot")).toBe(true);
    expect(isSingleNodeSlot("Dialog", "defaultSlot")).toBe(true);
    expect(isSingleNodeSlot("Drawer", "defaultSlot")).toBe(true);
    expect(isSingleNodeSlot("YqNavigationBar", "defaultSlot")).toBe(true);
  });

  it("数组槽宿主（v-for 消费）不登记", () => {
    expect(isSingleNodeSlot("YqPanel", "defaultSlot")).toBe(false);
    expect(isSingleNodeSlot("YqBox", "defaultSlot")).toBe(false);
    expect(isSingleNodeSlot("Form", "defaultSlot")).toBe(false);
    expect(isSingleNodeSlot("GridBox", "defaultSlot")).toBe(false);
    expect(isSingleNodeSlot("YqFlexLine", "defaultSlot")).toBe(false);
    expect(isSingleNodeSlot("YqFlexLine", "rightSlot")).toBe(false);
    expect(isSingleNodeSlot("YqToolBar", "toolSlot")).toBe(false);
    expect(isSingleNodeSlot(undefined, "defaultSlot")).toBe(false);
  });

  it("单节点槽空 → 可插入；已占用 → 不可插入", () => {
    const opts = { renderType: "YqFilterItem", defaultSlot: null };
    expect(canInsertIntoSlot(opts, "defaultSlot")).toBe(true);
    opts.defaultSlot = node("s1", "Select");
    expect(canInsertIntoSlot(opts, "defaultSlot")).toBe(false);
  });

  it("数组槽恒可插入", () => {
    const opts = { renderType: "YqPanel", defaultSlot: [node("a")] };
    expect(canInsertIntoSlot(opts, "defaultSlot")).toBe(true);
  });
});

describe("insertChildIntoOpts 单节点槽分支", () => {
  it("空槽插入 → 存为单节点（非数组），渲染层 wrapper 契约", () => {
    const opts = { renderType: "YqFilterItem", defaultSlot: null };
    const n = node("s1", "Select");
    const r = insertChildIntoOpts(opts, "defaultSlot", n, undefined, genId);
    expect(r).toBe(n);
    expect(opts.defaultSlot).toBe(n); // 关键：不是 [n]
  });

  it("已占用 → 拒绝插入且不改动原值（防数组化崩溃）", () => {
    const occupied = node("s1", "Select");
    const opts = { renderType: "YqFilterItem", defaultSlot: occupied };
    const r = insertChildIntoOpts(opts, "defaultSlot", node("i1", "Input"), undefined, genId);
    expect(r).toBeUndefined();
    expect(opts.defaultSlot).toBe(occupied);
  });

  it("其他宿主 defaultSlot 仍按数组槽归一（不影响 Panel/Box/Form）", () => {
    const opts = { renderType: "YqPanel", defaultSlot: null };
    insertChildIntoOpts(opts, "defaultSlot", node("a"), undefined, genId);
    insertChildIntoOpts(opts, "defaultSlot", node("b"), undefined, genId);
    expect(Array.isArray(opts.defaultSlot)).toBe(true);
    expect(opts.defaultSlot).toHaveLength(2);
  });
});

describe("getSlotChildrenList / removeChildFromOpts 单节点槽兼容", () => {
  it("单节点值读作 [node]；移除后置 null", () => {
    const s1 = node("s1", "Select");
    const opts = { renderType: "YqFilterItem", defaultSlot: s1 };
    expect(getSlotChildrenList(opts, "defaultSlot")).toEqual([s1]);
    const removed = removeChildFromOpts(opts, "s1", n => n.__nodeId);
    expect(removed).toBe(s1);
    expect(opts.defaultSlot).toBeNull();
  });
});

describe("间接容器宿主路由（defaultSlot 键重叠，indirect-first）", () => {
  it("YqFlexBox：defaultSlot 插入走 itemConfig 空壳填充，不产生顶层 defaultSlot 孤儿字段", () => {
    const opts = {
      renderType: "YqFlexBox",
      itemConfig: [
        { tag: "item-1", defaultSlot: node("a", "YqBox") },
        { tag: "item-2", defaultSlot: null },
      ],
    };
    const btn = node("b1", "Button");
    const r = insertChildIntoOpts(opts, "defaultSlot", btn, undefined, genId);
    expect(r).toBe(btn);
    // 填的是空壳 item-2，顶层不出现 defaultSlot 字段（wrapper 不渲染它）
    expect(opts.itemConfig[1].defaultSlot).toBe(btn);
    expect("defaultSlot" in opts).toBe(false);
  });

  it("YqFlexBox 无空壳时 createEntry 造新格子（追加）+ itemNum 冗余字段同步", () => {
    const opts: any = {
      renderType: "YqFlexBox",
      itemNum: 1,
      itemConfig: [{ tag: "item-1", defaultSlot: node("a", "YqBox") }],
    };
    insertChildIntoOpts(opts, "defaultSlot", node("b1", "Button"), undefined, genId);
    expect(opts.itemConfig).toHaveLength(2);
    expect(opts.itemConfig[1].defaultSlot.__nodeOptions.renderType).toBe("Button");
    expect(opts.itemNum).toBe(2); // 渲染层按 itemNum 循环，必须同步
  });

  it("getSlotChildrenList：YqFlexBox defaultSlot 返回各格内容合集（供插入索引计算）", () => {
    const a = node("a", "YqBox");
    const b = node("b", "Button");
    const opts = {
      renderType: "YqFlexBox",
      defaultSlot: [node("dirty", "Tag")], // 顶层脏数据应被忽略（wrapper 不渲染）
      itemConfig: [
        { tag: "item-1", defaultSlot: a },
        { tag: "item-2", defaultSlot: b },
      ],
    };
    expect(getSlotChildrenList(opts, "defaultSlot")).toEqual([a, b]);
  });

  it("直接槽宿主不受影响（YqBox.defaultSlot 仍走直接数组）", () => {
    const opts: any = { renderType: "YqBox", defaultSlot: null };
    const n1 = node("x1", "Button");
    insertChildIntoOpts(opts, "defaultSlot", n1, undefined, genId);
    expect(Array.isArray(opts.defaultSlot)).toBe(true);
    expect(opts.defaultSlot[0]).toBe(n1);
  });
});

describe("TabPanel 页签插入路由（active-pane-first）", () => {
  it("activeName 匹配的空页签优先填充（非第一个空页签）", () => {
    const btn = node("btn1", "Button");
    const opts: any = {
      renderType: "TabPanel",
      activeName: "tab-2", // 用户当前看到的是第 2 个页签
      tabPane: [
        { name: "tab-1", label: "页签1", defaultSlot: null },
        { name: "tab-2", label: "页签2", defaultSlot: null },
      ],
    };
    insertChildIntoOpts(opts, "defaultSlot", btn, undefined, genId);
    // 应填 tab-2（active pane），不是 tab-1（first empty）
    expect(opts.tabPane[1].defaultSlot).toBe(btn);
    expect(opts.tabPane[0].defaultSlot).toBeNull();
  });

  it("active 页签已占用 → 第一个空页签兜底", () => {
    const btn = node("btn2", "Button");
    const occupied = node("old", "GridBox");
    const opts: any = {
      renderType: "TabPanel",
      activeName: "tab-1",
      tabPane: [
        { name: "tab-1", defaultSlot: occupied },
        { name: "tab-2", defaultSlot: null },
      ],
    };
    insertChildIntoOpts(opts, "defaultSlot", btn, undefined, genId);
    expect(opts.tabPane[1].defaultSlot).toBe(btn);
  });

  it("全部已占用 → createEntry 追加新页签", () => {
    const btn = node("btn3", "Button");
    const opts: any = {
      renderType: "TabPanel",
      activeName: "tab-1",
      tabPane: [{ name: "tab-1", defaultSlot: node("a", "GridBox") }],
    };
    insertChildIntoOpts(opts, "defaultSlot", btn, undefined, genId);
    expect(opts.tabPane).toHaveLength(2);
    expect(opts.tabPane[1].defaultSlot).toBe(btn);
    expect(opts.tabPane[1].name).toBeTruthy();
  });

  it("activeName 未命中任何页签（脏数据）→ 第一个空页签兜底", () => {
    const btn = node("btn4", "Button");
    const opts: any = {
      renderType: "TabPanel",
      activeName: "nonexistent",
      tabPane: [
        { name: "tab-1", defaultSlot: null },
        { name: "tab-2", defaultSlot: null },
      ],
    };
    insertChildIntoOpts(opts, "defaultSlot", btn, undefined, genId);
    expect(opts.tabPane[0].defaultSlot).toBe(btn);
  });
});
