// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Editor } from "../core/editor";
import type { DragObject } from "../designer/drag/types";
import { PcNestingRules } from "../scenarios/pc-desktop/nesting-rules";
import { PcSchemaOps } from "../scenarios/pc-desktop/schema-ops";
import { PC_COMPONENTS_ALL } from "../scenarios/pc-desktop/component-metadata-config";
import { buildSlotSemantics, setSlotSemantics } from "../scenarios/pc-desktop/slot-semantics";
import { buildDragSnapshot, canDropFor, computeDropMode } from "../plugins/outline-pane/tree-drag";

/**
 * 大纲树拖拽统一到 Dragon（三期）纯函数守护测试
 * 覆盖：computeDropMode 三段边界 / 快照构建 / canDropFor 守卫矩阵
 * （Q1 间接容器 before/after 拒绝、Q2 单节点槽占用、Q3 node 跨场景拒绝）
 */
beforeAll(() => {
  setSlotSemantics(buildSlotSemantics(PC_COMPONENTS_ALL));
});

function node(id: string, renderType: string, extra: Record<string, any> = {}): any {
  return {
    __nodeId: id,
    __nodeType: "renderNode",
    __nodeOptions: { renderType, ...extra },
    __nodeEvent: {},
  };
}

// ── 夹具：双场景 ────────────────────────────────────────────
// main 场景 root(YqPanel)
//   ├─ toolbar(YqToolBar) defaultSlot: flexline1   ← 单节点槽已占用
//   ├─ toolbarEmpty(YqToolBar) defaultSlot: null   ← 单节点槽空
//   ├─ flexbox(YqFlexBox) itemConfig[{defaultSlot: btnA }] ← 间接容器格子子节点
//   ├─ btnB(Button)
//   └─ panelInner(YqPanel) defaultSlot: [btnD]
// second 场景 root2(YqPanel) defaultSlot: [btnC]
const btnA = node("btnA", "Button");
const flexline1 = node("flexline1", "YqFlexLine");
const toolbar = node("toolbar", "YqToolBar", { defaultSlot: flexline1 });
const toolbarEmpty = node("toolbarEmpty", "YqToolBar", { defaultSlot: null });
const flexbox = node("flexbox", "YqFlexBox", {
  itemConfig: [{ isFixed: false, paddingSize: "base", defaultSlot: btnA }],
});
const btnB = node("btnB", "Button");
const btnD = node("btnD", "Button");
const panelInner = node("panelInner", "YqPanel", { defaultSlot: [btnD] });
const root = node("root", "YqPanel", {
  defaultSlot: [toolbar, toolbarEmpty, flexbox, btnB, panelInner],
});
const btnC = node("btnC", "Button");
const root2 = node("root2", "YqPanel", { defaultSlot: [btnC] });

const schema = {
  main: { viewsProps: { planeOptions: root } },
  second: { viewsProps: { planeOptions: root2 } },
};

const editor = {
  store: { schema },
  schemaOps: new PcSchemaOps(),
  nestingRules: new PcNestingRules(),
} as unknown as Editor;

const dragNode = (nodeId: string): DragObject => ({ type: "node", nodeId, title: nodeId });
const dragData = (renderType: string): DragObject => ({
  type: "nodeData",
  data: { renderType, name: renderType },
});

/** 构造带 rect 的行元素（jsdom getBoundingClientRect 恒零，需 stub） */
function rowEl(top: number, height: number): HTMLElement {
  const el = document.createElement("div");
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    top, height, bottom: top + height, left: 0, right: 100, width: 100, y: top, x: 0, toJSON: () => ({}),
  } as DOMRect);
  return el;
}

describe("computeDropMode 三段边界", () => {
  it("上 25% before / 中 50% inner / 下 25% after", () => {
    const el = rowEl(0, 100);
    expect(computeDropMode(el, 10)).toBe("before");
    expect(computeDropMode(el, 24)).toBe("before");
    expect(computeDropMode(el, 26)).toBe("inner");
    expect(computeDropMode(el, 50)).toBe("inner");
    expect(computeDropMode(el, 74)).toBe("inner");
    expect(computeDropMode(el, 76)).toBe("after");
    expect(computeDropMode(el, 90)).toBe("after");
  });
});

describe("buildDragSnapshot", () => {
  it("场景分组 + sceneOf 映射 + 根集合", () => {
    const snap = buildDragSnapshot(editor);
    expect(snap.nodes.map(n => n.id)).toEqual(["__scene__main", "__scene__second"]);
    expect(snap.sceneOf.get("btnB")).toBe("main");
    expect(snap.sceneOf.get("btnC")).toBe("second");
    expect(snap.sceneOf.get("btnA")).toBe("main"); // 间接容器格子子节点也在树内
    expect(snap.rootIds.has("root")).toBe(true);
    expect(snap.rootIds.has("root2")).toBe(true);
    expect(snap.rootIds.has("btnB")).toBe(false);
  });
});

describe("canDropFor 守卫矩阵", () => {
  const snap = buildDragSnapshot(editor);

  it("场景分组头不可作为目标", () => {
    expect(canDropFor(editor, dragData("Button"), "__scene__main", "inner", snap)).toBe(false);
  });

  it("node 型：拖到自身 / 拖进自身后代 → 拒绝", () => {
    expect(canDropFor(editor, dragNode("btnB"), "btnB", "before", snap)).toBe(false);
    expect(canDropFor(editor, dragNode("root"), "btnD", "inner", snap)).toBe(false);
  });

  it("Q3：node 型跨场景拒绝；nodeData（面板新建）放行", () => {
    expect(canDropFor(editor, dragNode("btnB"), "btnC", "before", snap)).toBe(false);
    expect(canDropFor(editor, dragNode("btnB"), "root2", "inner", snap)).toBe(false);
    // nodeData 无源可失：跨场景目标允许（canNest YqPanel.defaultSlot × Button）
    expect(canDropFor(editor, dragData("Button"), "btnC", "before", snap)).toBe(true);
  });

  it("Q2：单节点槽已占用拒绝（nodeData），占用者自身原地放行（node）", () => {
    // 白名单：YqToolBar.defaultSlot 只认 YqFlexLine
    expect(canDropFor(editor, dragData("YqFlexLine"), "toolbar", "inner", snap)).toBe(false);
    expect(canDropFor(editor, dragData("YqFlexLine"), "toolbarEmpty", "inner", snap)).toBe(true);
    // 拖动者即占用者 → 原地松手语义放行
    expect(canDropFor(editor, dragNode("flexline1"), "toolbar", "inner", snap)).toBe(true);
  });

  it("Q1：间接容器格子内子节点禁用 before/after", () => {
    expect(canDropFor(editor, dragData("Button"), "btnA", "before", snap)).toBe(false);
    expect(canDropFor(editor, dragData("Button"), "btnA", "after", snap)).toBe(false);
    expect(canDropFor(editor, dragNode("btnA"), "btnA", "before", snap)).toBe(false);
  });

  it("before/after：场景根拒绝；普通兄弟通过（含 node 型）", () => {
    expect(canDropFor(editor, dragData("Button"), "root", "before", snap)).toBe(false);
    expect(canDropFor(editor, dragData("Button"), "btnB", "before", snap)).toBe(true);
    expect(canDropFor(editor, dragData("Button"), "btnB", "after", snap)).toBe(true);
    expect(canDropFor(editor, dragNode("btnB"), "btnD", "after", snap)).toBe(true);
  });

  it("inner：非容器叶子拒绝；空容器通过", () => {
    expect(canDropFor(editor, dragData("Button"), "btnB", "inner", snap)).toBe(false);
    expect(canDropFor(editor, dragData("Button"), "panelInner", "inner", snap)).toBe(true);
  });
});
