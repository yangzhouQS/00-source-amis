// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { SLOT_DOM_RULES, resolveSlotKeyFromDom } from "../scenarios/pc-desktop/slot-dom-rules";

/**
 * YqFlexLine 插槽几何解析准确性验证。
 *
 * DOM 结构对齐 element-plus-ui flex-line.vue 真实输出：
 *   .yq-flex-line（组件根，带 data-editor-id）
 *   ├── .yq-flex_line_left  > el-space > [按钮…defaultSlot 子项]
 *   └── .yq-flex_line_right > el-space > [按钮…rightSlot 子项]
 */
function buildFlexLineDom(): { root: HTMLElement; leftBtn: HTMLElement; rightInner: HTMLElement; gap: HTMLElement } {
  const root = document.createElement("div");
  root.className = "yq-flex-line";
  root.setAttribute("data-editor-id", "YqFlexLine::test-1");

  const left = document.createElement("div");
  left.className = "yq-flex_line_left";
  const leftSpace = document.createElement("div");
  const leftBtn = document.createElement("button");
  leftBtn.textContent = "左侧按钮";
  leftSpace.appendChild(leftBtn);
  left.appendChild(leftSpace);

  // 槽位区域之间的间隙元素（组件根直接子级，不属于任何区域）
  const gap = document.createElement("div");
  gap.className = "yq-flex-line-divider";

  const right = document.createElement("div");
  right.className = "yq-flex_line_right";
  const rightInner = document.createElement("div");
  right.appendChild(rightInner);

  root.append(left, gap, right);
  document.body.appendChild(root);
  return { root, leftBtn, rightInner, gap };
}

describe("resolveSlotKeyFromDom（YqFlexLine 左右槽识别）", () => {
  it("命中左区任意深度子元素 → defaultSlot", () => {
    const { root, leftBtn } = buildFlexLineDom();
    expect(resolveSlotKeyFromDom("YqFlexLine", root, leftBtn)).toBe("defaultSlot");
  });

  it("命中右区任意深度子元素 → rightSlot", () => {
    const { root, rightInner } = buildFlexLineDom();
    expect(resolveSlotKeyFromDom("YqFlexLine", root, rightInner)).toBe("rightSlot");
  });

  it("命中区域自身（elementFromPoint 落在区域容器上）→ 对应槽位", () => {
    const { root } = buildFlexLineDom();
    expect(resolveSlotKeyFromDom("YqFlexLine", root, root.querySelector(".yq-flex_line_left")!)).toBe("defaultSlot");
    expect(resolveSlotKeyFromDom("YqFlexLine", root, root.querySelector(".yq-flex_line_right")!)).toBe("rightSlot");
  });

  it("命中区域外（间隙/根自身，即左右区域都不 contained）→ null（传感器回退 defaultSlot）", () => {
    const { root, gap } = buildFlexLineDom();
    expect(resolveSlotKeyFromDom("YqFlexLine", root, gap)).toBeNull();
    expect(resolveSlotKeyFromDom("YqFlexLine", root, root)).toBeNull();
  });

  it("未登记规则的组件（单槽位）→ null（回退 defaultSlot 命中）", () => {
    const { root, leftBtn } = buildFlexLineDom();
    expect(resolveSlotKeyFromDom("YqBox", root, leftBtn)).toBeNull();
    expect(resolveSlotKeyFromDom(undefined, root, leftBtn)).toBeNull();
  });

  it("规则表登记完整性（左/右与 DIRECT_SLOTS 键一致）", () => {
    expect(SLOT_DOM_RULES.YqFlexLine?.map(r => r.slotKey)).toEqual(["defaultSlot", "rightSlot"]);
    expect(SLOT_DOM_RULES.YqPanel?.map(r => r.slotKey)).toEqual(["defaultSlot", "toolSlot"]);
    expect(SLOT_DOM_RULES.YqToolBar?.map(r => r.slotKey)).toEqual(["filterSlot", "toolSlot"]);
  });
});
