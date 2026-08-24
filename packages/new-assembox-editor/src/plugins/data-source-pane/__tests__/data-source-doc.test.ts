import { describe, expect, it } from "vitest";
import { buildDoc, cloneDoc } from "../doc/normalize";
import type { DsServiceItem } from "../doc/types";
import { DS_IDENTIFIER_RE, canCompileFn, hasBlockingIssues, validateService, validateSharedFn } from "../doc/validate";
import { filterByKeyword, transformGroups, uniqueCopyId } from "../shared/use-grouping";

/** 基线文档（对齐 single-table-scene.json 关键字段形态） */
function baseDoc() {
  return buildDoc({
    api: { config: { baseURL: "/api" }, list: { legacy: { url: "/old", method: "post" } } },
    requestConfig: {
      queryPayments: {
        url: "/demo/payment-module/getMany",
        method: "post",
        description: "查询客户列表",
        groupName: "默认分组",
        beforeReq: { isOn: true, fn: "async function beforeReq(requestConfig){ return requestConfig; }" },
        afterReq: { isOn: false, fn: "" },
        paramsConfig: {
          paramsType: "kvParams",
          dataModelType: "single",
          dataModelName: "filter",
          paramsModel: {
            singleTable: {
              paymentCode: { valueType: "string" },
              orgId: { valueType: "number", resolveType: "queryParams" },
            },
          },
        },
      },
      updatePayment: {
        url: "/demo/payment-module/update/:id",
        method: "post",
        paramsConfig: { paramsType: "formSaveParams", paramsModel: {} },
      },
    },
    dataModelConfig: {
      filter: { description: "查询过滤器", singleTable: { paymentCode: { valueType: "string", defaultValue: "" } } },
      rows: { description: "行数据", table: [] },
    },
    sharedFns: { searchTable: { isOn: true, fn: "function(ctx){}" } },
  });
}

describe("normalize：旧格式兼容与透传", () => {
  it("isOn → enabled（拦截器/共享函数）", () => {
    const doc = baseDoc();
    expect(doc.requestConfig.queryPayments!.beforeReq?.enabled).toBe(true);
    expect(doc.requestConfig.queryPayments!.afterReq?.enabled).toBe(false);
    expect(doc.sharedFns.searchTable!.enabled).toBe(true);
  });

  it("api.list 原样透传保留（不做编辑）", () => {
    const doc = baseDoc();
    expect(doc.api.list).toEqual({ legacy: { url: "/old", method: "post" } });
    expect(doc.api.config).toEqual({ baseURL: "/api" });
  });

  it("数组表保持空数组占位形态", () => {
    const doc = baseDoc();
    expect(doc.dataModelConfig.rows!.table).toEqual([]);
  });

  it("cloneDoc 深拷贝（改副本不影响原文档）", () => {
    const doc = baseDoc();
    const copy = cloneDoc(doc);
    copy.requestConfig.queryPayments!.url = "/changed";
    expect(doc.requestConfig.queryPayments!.url).toBe("/demo/payment-module/getMany");
  });
});

describe("validate：渲染契约规则", () => {
  it("编码唯一性/标识符校验", () => {
    const doc = baseDoc();
    const item = cloneDoc(doc.requestConfig.queryPayments!) as DsServiceItem;
    const issues = validateService("queryPayments", item, doc);
    expect(issues.some(i => i.level === "error" && i.message.includes("已存在"))).toBe(true);
    expect(DS_IDENTIFIER_RE.test("2bad")).toBe(false);
    expect(DS_IDENTIFIER_RE.test("good_Name1")).toBe(true);
  });

  it("R7：dataModelName 不存在 → warn", () => {
    const doc = baseDoc();
    const item = cloneDoc(doc.requestConfig.queryPayments!) as DsServiceItem;
    item.paramsConfig!.dataModelName = "notExist";
    const issues = validateService("q2", item, doc);
    expect(issues.some(i => i.level === "warn" && i.message.includes("notExist"))).toBe(true);
  });

  it("R1：url :id 占位缺 routeParams 字段 → warn", () => {
    const doc = baseDoc();
    const item = cloneDoc(doc.requestConfig.updatePayment!) as DsServiceItem;
    const issues = validateService("u2", item, doc);
    expect(issues.some(i => i.level === "warn" && i.message.includes(":id"))).toBe(true);
  });

  it("拦截器启用但为空 → error 阻断", () => {
    const doc = baseDoc();
    const item = cloneDoc(doc.requestConfig.queryPayments!) as DsServiceItem;
    item.beforeReq = { enabled: true, fn: "" };
    const issues = validateService("q3", item, doc);
    expect(hasBlockingIssues(issues)).toBe(true);
  });

  it("canCompileFn 识别语法错误", () => {
    expect(canCompileFn("function(){}")).toBe(true);
    expect(canCompileFn("function(){")).toBe(false);
    expect(canCompileFn("")).toBe(false);
  });

  it("共享函数启用但为空 → error", () => {
    const doc = baseDoc();
    const issues = validateSharedFn("fn1", { enabled: true, fn: "" }, doc);
    expect(hasBlockingIssues(issues)).toBe(true);
    const ok = validateSharedFn("fn1", { enabled: true, fn: "function(ctx){}" }, doc);
    expect(hasBlockingIssues(ok)).toBe(false);
  });
});

describe("use-grouping：分组/过滤/副本编码", () => {
  it("分组排序 + 置顶优先", () => {
    const items = [
      { id: "a", groupName: "B", sort: 2 },
      { id: "b", groupName: "A", sort: 1 },
      { id: "c", groupName: "B", sort: 1, isTopUp: true },
    ];
    const groups = transformGroups(items as any);
    expect(groups.map(g => g.title)).toEqual(["A", "B"]);
    expect(groups[1]!.children[0]!.id).toBe("c");
  });

  it("关键字过滤命中 id 与 description", () => {
    const items = [
      { id: "queryPayments", description: "查询" },
      { id: "deleteRow", description: "删除" },
    ];
    expect(filterByKeyword(items, "查询")).toHaveLength(1);
    expect(filterByKeyword(items, "")).toHaveLength(2);
  });

  it("副本编码去重递增", () => {
    expect(uniqueCopyId(new Set(["loadData"]), "loadData")).toBe("loadDataCopy");
    expect(uniqueCopyId(new Set(["loadData", "loadDataCopy"]), "loadData")).toBe("loadDataCopy2");
  });
});
