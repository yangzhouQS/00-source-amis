// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { PC_COMPONENTS_ALL } from "../scenarios/pc-desktop/component-metadata-config";

/**
 * YqFlexBox 格子配置（ArraySetter 声明式组合）守护测试。
 *
 * 决策背景（docs/adr/0001）：旧版 413 行硬编码 FlexBoxItemConfig 收敛为
 * 元数据声明——ArraySetter(ObjectSetter) 组合 + 两个通用可选能力：
 * rekey（tag 重排，UI 库 slot 命名键）+ syncLengthField（itemNum 长度回写）。
 */
describe("YqFlexBox 元数据（ArraySetter 声明式格子配置）", () => {
  const flexBox = PC_COMPONENTS_ALL.find(c => c.renderType === "YqFlexBox")!;

  it("容器级：width/height 默认值对齐渲染层 100%（显式快照原则）", () => {
    const width = flexBox.props!.find(p => p.name === "width")!;
    const height = flexBox.props!.find(p => p.name === "height")!;
    expect(width.defaultValue).toBe("100%");
    expect(height.defaultValue).toBe("100%");
    expect(flexBox.scaffold.width).toBe("100%");
    expect(flexBox.scaffold.height).toBe("100%");
  });

  it("itemNum 不提供编辑（长度由 itemConfig 增删驱动 + syncLengthField 回写）", () => {
    expect(flexBox.props!.find(p => p.name === "itemNum")).toBeUndefined();
    expect(flexBox.scaffold.itemNum).toBe(flexBox.scaffold.itemConfig.length);
  });

  it("itemConfig 走 ArraySetter + ObjectSetter 组合，rekey/syncLengthField/initialValue 齐备", () => {
    const itemConfig = flexBox.props!.find(p => p.name === "itemConfig")!;
    expect(itemConfig.setter).toBe("ArraySetter");
    const sp = itemConfig.setterProps as any;
    expect(sp.itemSetter.setter).toBe("ObjectSetter");
    expect(typeof sp.rekey).toBe("function");
    expect(sp.syncLengthField).toBe("itemNum");
    // 新格子默认值：单项对象（ArraySetter initialValue 语义，非数组）；
    // defaultSlot null（空槽占位引导拖入），无 contentType（遗留废弃）
    const init = sp.initialValue;
    expect(Array.isArray(init)).toBe(false);
    expect(init.defaultSlot).toBeNull();
    expect("contentType" in init).toBe(false);
    expect("contentType" in flexBox.scaffold.itemConfig[0]).toBe(false);
  });

  it("rekey 按 index 重排 tag（item-N 是 UI 库 slot 命名键）", () => {
    const rekey = (flexBox.props!.find(p => p.name === "itemConfig")!.setterProps as any)
      .rekey as (item: any, index: number) => any;
    const a = { tag: "item-2", isFixed: false };
    const b = { tag: "item-1", isFixed: true };
    // 排序后 [a, b] → tag 按新位置重排；非 tag 字段保留
    const [ra, rb] = [a, b].map((x, i) => rekey(x, i));
    expect(ra.tag).toBe("item-1");
    expect(rb.tag).toBe("item-2");
    expect(ra.isFixed).toBe(false);
    expect(rb.isFixed).toBe(true);
  });

  it("格子字段覆盖旧版全部可配置项（10 字段）", () => {
    const items = ((flexBox.props!.find(p => p.name === "itemConfig")!.setterProps as any)
      .itemConfig.items as Array<{ name: string }>).map(i => i.name);
    for (const field of [
      "tag", "isFixed", "size", "paddingSize", "clearPadding",
      "showDragButton", "dragButtonPosition", "isFold", "expandSize", "isHidden",
    ]) {
      expect(items, `格子字段缺 ${field}`).toContain(field);
    }
  });

  it("slots 声明补齐（间接容器 itemConfig[].defaultSlot）", () => {
    expect(flexBox.slots).toEqual([{ name: "defaultSlot", slotType: "array", description: "格子内容" }]);
  });
});
