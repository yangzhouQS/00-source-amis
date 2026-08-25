// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { resolveFlexLineSlot } from "../scenarios/pc-desktop/slot-dom/flex-line";
import { resolveSlotKeyFromDom } from "../scenarios/pc-desktop/slot-dom/index";
import { resolvePanelSlot } from "../scenarios/pc-desktop/slot-dom/panel";
import { resolveToolBarSlot } from "../scenarios/pc-desktop/slot-dom/tool-bar";

/**
 * 多槽位组件悬停识别准确性验证。
 *
 * DOM 结构对齐 element-plus-ui 各组件真实输出（类名逐一对齐源码）。
 * 每个组件 resolver 独立测（slot-dom/ 按组件拆分），分发入口再测注册表。
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

describe("yqFlexLine resolver（左右槽识别）", () => {
  it("左区任意深度子元素 → defaultSlot；右区 → rightSlot", () => {
    const { root, leftBtn, rightInner } = buildFlexLineDom();
    expect(resolveFlexLineSlot(root, leftBtn)).toBe("defaultSlot");
    expect(resolveFlexLineSlot(root, rightInner)).toBe("rightSlot");
  });

  it("命中区域自身 → 对应槽位；区域外（间隙/根）→ null", () => {
    const { root, gap } = buildFlexLineDom();
    expect(resolveFlexLineSlot(root, root.querySelector(".yq-flex_line_left")!)).toBe("defaultSlot");
    expect(resolveFlexLineSlot(root, root.querySelector(".yq-flex_line_right")!)).toBe("rightSlot");
    expect(resolveFlexLineSlot(root, gap)).toBeNull();
    expect(resolveFlexLineSlot(root, root)).toBeNull();
  });
});

describe("yqPanel resolver（内容/工具槽识别）", () => {
  it(".panel-content → defaultSlot；.header-tool .tool-content → toolSlot", () => {
    const root = document.createElement("div");
    root.className = "yq-panel";
    const header = document.createElement("div");
    header.className = "panel-header";
    const tool = document.createElement("div");
    tool.className = "header-tool";
    const toolContent = document.createElement("div");
    toolContent.className = "tool-content";
    tool.appendChild(toolContent);
    header.appendChild(tool);
    const content = document.createElement("div");
    content.className = "panel-content";
    const contentChild = document.createElement("span");
    content.appendChild(contentChild);
    root.append(header, content);

    expect(resolvePanelSlot(root, contentChild)).toBe("defaultSlot");
    expect(resolvePanelSlot(root, toolContent)).toBe("toolSlot");
    expect(resolvePanelSlot(root, header)).toBeNull(); // 头部其他区域不误判
  });
});

describe("yqToolBar resolver（筛选/工具槽识别）", () => {
  it(".yq-filter-content → filterSlot；.yq-tool-slot → toolSlot", () => {
    const root = document.createElement("div");
    root.className = "yq-tool-bar";
    const area = document.createElement("div");
    area.className = "yq-filter-area";
    const filterContent = document.createElement("div");
    filterContent.className = "yq-filter-content";
    const filterItem = document.createElement("div");
    filterContent.appendChild(filterItem);
    const func = document.createElement("div");
    func.className = "yq-tool-func";
    const toolSlot = document.createElement("div");
    toolSlot.className = "yq-tool-slot";
    func.appendChild(toolSlot);
    area.append(filterContent, func);
    root.appendChild(area);

    expect(resolveToolBarSlot(root, filterItem)).toBe("filterSlot");
    expect(resolveToolBarSlot(root, toolSlot)).toBe("toolSlot");
    expect(resolveToolBarSlot(root, area)).toBeNull(); // 区域间隙不误判
  });
});

describe("resolveSlotKeyFromDom 分发入口", () => {
  it("按 renderType 分派到对应 resolver", () => {
    const { root, rightInner } = buildFlexLineDom();
    expect(resolveSlotKeyFromDom("YqFlexLine", root, rightInner)).toBe("rightSlot");
  });

  it("未登记组件（单槽位）/ 未传 renderType / null 命中 → null（传感器回退 defaultSlot）", () => {
    const { root, leftBtn } = buildFlexLineDom();
    expect(resolveSlotKeyFromDom("YqBox", root, leftBtn)).toBeNull();
    expect(resolveSlotKeyFromDom(undefined, root, leftBtn)).toBeNull();
    expect(resolveSlotKeyFromDom("YqFlexLine", root, null)).toBeNull();
  });
});
