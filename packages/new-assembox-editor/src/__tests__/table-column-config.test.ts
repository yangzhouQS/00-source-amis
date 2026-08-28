// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { PC_COMPONENTS_ALL } from "../scenarios/pc-desktop/component-metadata-config";

/**
 * 表格列配置可视化（V1，Q1~Q5 决策落地）守护测试。
 *
 * 决策（grilling Round 1）：V1 平铺列 + {attr} 嵌套经两层 ObjectSetter 编辑；
 * columnSlots 留 json（columRender 子树 V2）；五变体共享基础列编辑；
 * 新增列 prop 唯一键自增（col-N，ArraySetter initialValue 函数形式）。
 */
describe("YqTableAsync 列配置可视化元数据", () => {
  const table = PC_COMPONENTS_ALL.find(c => c.renderType === "YqTableAsync")!;
  const colProp = table.props!.find(p => p.name === "columnConfigs")!;
  const sp = colProp.setterProps as any;

  it("顶层声明：labelVisible=false + ArraySetter + 折叠 + 删除确认", () => {
    expect(colProp.labelVisible).toBe(false);
    expect(colProp.setter).toBe("ArraySetter");
    expect(sp.collapsible).toBe(true);
    expect(typeof sp.confirmRemove).toBe("string");
  });

  it("attr 嵌套：两层 ObjectSetter，内层 10 字段齐备（Q2）", () => {
    expect(sp.itemSetter.setter).toBe("ObjectSetter");
    const attrField = sp.itemConfig.items[0];
    expect(attrField.name).toBe("attr");
    expect(attrField.setter).toBe("ObjectSetter");
    expect(attrField.setterProps.config.items.map((i: any) => i.name)).toEqual([
      "prop", "label", "width", "align", "headerAlign", "sortable",
      "cannotHide", "type", "scopedSlot", "decimalCode",
    ]);
  });

  it("新增列初值为函数（Q5）：prop 唯一键自增 col-N + label 带序号", () => {
    expect(typeof sp.initialValue).toBe("function");
    const item = sp.initialValue(3); // 第 4 列（index 3）
    expect(item.attr.prop).toBe("col-4");
    expect(item.attr.label).toBe("列标题4");
    expect(item.attr.align).toBe("left");
  });

  it("columnSlots/columnHeaderSlots 保持 json（V1 不动，columRender 子树 V2）", () => {
    const slots = table.props!.find(p => p.name === "columnSlots")!;
    const headerSlots = table.props!.find(p => p.name === "columnHeaderSlots")!;
    expect(slots.setter).toBeUndefined();
    expect(headerSlots.setter).toBeUndefined();
  });

  it("分页配置可视化：ObjectSetter + currentSize/pageSizes/layout 三字段", () => {
    const pg = table.props!.find(p => p.name === "pagination")!;
    expect(pg.setter).toBe("ObjectSetter");
    const items = (pg.setterProps as any).config.items.map((i: any) => i.name);
    expect(items).toEqual(["currentSize", "pageSizes", "layout"]);
    const pageSizes = (pg.setterProps as any).config.items[1];
    expect(pageSizes.setter).toBe("ArraySetter");
  });

  it("五变体共享基础列编辑（tableCommonProps 复用）", () => {
    for (const rt of ["YqTableOnly", "YqTableReport", "YqTableTree", "YqTableEdit"]) {
      const t = PC_COMPONENTS_ALL.find(c => c.renderType === rt)!;
      const col = t.props!.find(p => p.name === "columnConfigs")!;
      expect(col.setter, `${rt} 未共享列配置可视化`).toBe("ArraySetter");
    }
  });
});
