// @vitest-environment jsdom
import { getComponentMap, lookupMeta, registerDefaults } from "@cs/assembox-desktop-next";
import { beforeAll, describe, expect, it } from "vitest";
import { PC_COMPONENTS_ALL } from "../scenarios/pc-desktop/component-metadata-config";
import { RENDER_TYPE_CATEGORIES } from "../scenarios/pc-desktop/nesting-categories";
import { PcNestingRules } from "../scenarios/pc-desktop/nesting-rules";
import { buildSlotSemantics, setSlotSemantics } from "../scenarios/pc-desktop/slot-semantics";

/**
 * 编辑器静态 category 表 与 渲染库运行时注册表 的对齐守护测试。
 *
 * RENDER_TYPE_CATEGORIES（nesting-categories.ts）是从渲染库 manifest.ts 的
 * COMPONENTS 表手工抄写的镜像 —— 编辑器侧嵌套校验依赖它（host 侧库副本未注册时
 * lookupMeta 恒 undefined）。渲染库新增组件 / 调整 category 而未同步编辑器表时，
 * 本测试立即失败，提示补同步。
 */
describe("rENDER_TYPE_CATEGORIES 与渲染库对齐", () => {
  // registerDefaults 会 registerManifest（component-catalog 运行时表填充数据）
  registerDefaults();

  it("本地表每条：渲染库 lookupMeta 存在且 category 一致", () => {
    const mismatches: string[] = [];
    const missing: string[] = [];
    for (const [renderType, category] of Object.entries(RENDER_TYPE_CATEGORIES)) {
      const meta = lookupMeta(renderType);
      if (!meta) {
        missing.push(renderType);
      } else if (meta.category !== category) {
        mismatches.push(`${renderType}: 本地=${category} 库=${meta.category}`);
      }
    }
    expect(missing, `本地表存在但渲染库未注册: ${missing.join(", ")}`).toEqual([]);
    expect(mismatches, `category 漂移: ${mismatches.join("; ")}`).toEqual([]);
  });

  it("渲染库注册表每条：本地表必须覆盖（防渲染库新增组件漏登记）", () => {
    const registered = Array.from(getComponentMap().keys()) as string[];
    const notInLocal = registered.filter(rt => !(rt in RENDER_TYPE_CATEGORIES));
    expect(
      notInLocal,
      `渲染库新增组件未同步到 nesting-categories.ts: ${notInLocal.join(", ")}`,
    ).toEqual([]);
  });

  it("数量一致", () => {
    expect(Object.keys(RENDER_TYPE_CATEGORIES).length).toBe(getComponentMap().size);
  });

  it("典型断言（语义抽样，失败时先看上面两条对齐报错）", () => {
    expect(RENDER_TYPE_CATEGORIES.Button).toBe("lineElement");
    expect(RENDER_TYPE_CATEGORIES.YqFlexLine).toBe("layout");
    expect(RENDER_TYPE_CATEGORIES.YqTableAsync).toBe("element");
    expect(RENDER_TYPE_CATEGORIES.ListElement).toBe("columnElement");
    expect(RENDER_TYPE_CATEGORIES.UiSkeletonBlockSlot).toBe("placeholder");
  });
});

describe("编辑器侧槽位门禁（nesting-rules PcNestingRules，slots 声明驱动）", () => {
  // 白名单查询依赖注入的 slots 声明（docs/19：单测显式注入，不依赖时序）
  beforeAll(() => {
    setSlotSemantics(buildSlotSemantics(PC_COMPONENTS_ALL));
  });

  it("YqToolBar.defaultSlot 组件级白名单：仅 YqFlexLine（GridBox/FlexBox 亦拒，修复 category 粒度缺口）", () => {
    const rules = new PcNestingRules();
    expect(rules.canNest("YqToolBar", "defaultSlot", "YqFlexLine")).toBe(true);
    expect(rules.canNest("YqToolBar", "defaultSlot", "GridBox")).toBe(false);
    expect(rules.canNest("YqToolBar", "defaultSlot", "YqFlexBox")).toBe(false);
    expect(rules.canNest("YqToolBar", "defaultSlot", "Button")).toBe(false);
    expect(rules.canNest("YqToolBar", "defaultSlot", "YqTableAsync")).toBe(false);
  });

  it("toolSlot/filterSlot 未声明白名单，走渲染库 category 表", () => {
    const rules = new PcNestingRules();
    expect(rules.canNest("YqToolBar", "toolSlot", "Button")).toBe(true);
    expect(rules.canNest("YqToolBar", "toolSlot", "YqFlexLine")).toBe(false);
    expect(rules.canNest("YqToolBar", "filterSlot", "YqFilterItem")).toBe(true);
  });

  it("未声明宿主走渲染库 SLOTS 表（Panel.defaultSlot 不受限收口不变）", () => {
    const rules = new PcNestingRules();
    expect(rules.canNest("YqPanel", "defaultSlot", "Button")).toBe(true);
    expect(rules.canNest("YqPanel", "defaultSlot", "YqTableAsync")).toBe(true);
  });
});
