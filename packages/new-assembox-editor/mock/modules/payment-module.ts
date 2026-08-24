/**
 * 业务 CRUD mock（对应 src/demo/single-table-scene.json 的 requestConfig）
 *
 * 端点：
 *   POST   /demo/payment-module/getMany           分页查询（关键词过滤）
 *   POST   /demo/payment-module/create-data       新增
 *   PUT    /demo/payment-module/update/:orgId/:id 更新
 *   DELETE /demo/payment-module/delete/:orgId/:id 删除
 *
 * 分页响应 result = { count, result: rows }（desktop-next toPaged 消费）。
 * 数据存内存（改 mock 重启 dev server 后还原，dev server 会随 mock 文件变更自动重启）。
 */
import type { MockModule } from "../types";

interface PaymentRow {
  id: number;
  orgId: number;
  orgName: string;
  supplierName: string;
  supplierId: number;
  contractName: string;
  contractId: number;
  contractCode: string;
  paymentDate: string;
  paymentCode: string;
  paymentType: string;
  paymentNature: string;
  paymentSum: number;
  remark: string;
  isAudit: boolean;
  auditor: string;
  auditDate: string;
}

let nextId = 13;

function seed(orgId: number, i: number): PaymentRow {
  const types = ["预付款", "进度款", "结算款", "尾款", "质保金"];
  return {
    id: i,
    orgId,
    orgName: "云阙科技",
    supplierName: `供应商${String(i).padStart(3, "0")}`,
    supplierId: 9000 + i,
    contractName: `年度采购合同-${i}`,
    contractId: 5000 + i,
    contractCode: `HT-2026-${String(i).padStart(4, "0")}`,
    paymentDate: `2026-0${(i % 8) + 1}-1${i % 9}`,
    paymentCode: `FK-2026-${String(i).padStart(4, "0")}`,
    paymentType: types[i % types.length],
    paymentNature: i % 2 === 0 ? "采购付款" : "服务付款",
    paymentSum: Math.round((i * 12345.67) % 100000) / 1,
    remark: i % 3 === 0 ? "加急" : "",
    isAudit: i % 2 === 1,
    auditor: i % 2 === 1 ? `审核员${i}` : "",
    auditDate: i % 2 === 1 ? `2026-0${(i % 8) + 1}-2${i % 9}` : "",
  };
}

/** 内存数据（模块级单例，dev server 生命周期内存活） */
const rows: PaymentRow[] = Array.from({ length: 12 }, (_, i) => seed(10001, i + 1));

/** 取分页参数：兼容 pageNum/pageSize 与 pageIndex/take 两种风格 */
function paginationOf(body: any): { pageNum: number; pageSize: number } {
  const b = body ?? {};
  const pageNum = Number(b.pageNum ?? b.pageIndex ?? b.current ?? 1) || 1;
  const pageSize = Number(b.pageSize ?? b.take ?? b.size ?? 20) || 20;
  return { pageNum, pageSize };
}

/** 取过滤参数：可能裸传或包在 filter/params 里 */
function filterOf(body: any): Record<string, string> {
  const b = body ?? {};
  const src = (b.filter ?? b.params ?? b) as Record<string, any>;
  return {
    paymentCode: String(src.paymentCode ?? ""),
    contractCode: String(src.contractCode ?? ""),
    supplierName: String(src.supplierName ?? ""),
  };
}

function pickIdFromBody(body: any): number | null {
  const n = Number(body?.id ?? body?.data?.id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export const paymentModule: MockModule = {
  routes: [
    {
      method: "POST",
      url: "/demo/payment-module/getMany",
      description: "分页查询付款单（支持 paymentCode/contractCode/supplierName 过滤）",
      delay: 300,
      handler: ({ body }) => {
        const { pageNum, pageSize } = paginationOf(body);
        const f = filterOf(body);
        const matched = rows.filter((r) => {
          if (f.paymentCode && !r.paymentCode.includes(f.paymentCode)) {
            return false;
          }
          if (f.contractCode && !r.contractCode.includes(f.contractCode)) {
            return false;
          }
          if (f.supplierName && !r.supplierName.includes(f.supplierName)) {
            return false;
          }
          return true;
        });
        const start = (pageNum - 1) * pageSize;
        return {
          count: matched.length,
          result: matched.slice(start, start + pageSize),
        };
      },
    },
    {
      method: "POST",
      url: "/demo/payment-module/create-data",
      description: "新增付款单",
      handler: ({ body }) => {
        const src = body?.data ?? body ?? {};
        const row: PaymentRow = {
          ...seed(Number(src.orgId) || 10001, nextId),
          ...src,
          id: nextId,
        };
        rows.unshift(row);
        nextId += 1;
        return { id: row.id };
      },
    },
    {
      method: "PUT",
      url: "/demo/payment-module/update/:orgId/:id",
      description: "更新付款单",
      handler: ({ params, body }) => {
        const id = Number(params.id) || pickIdFromBody(body) || -1;
        const idx = rows.findIndex(r => r.id === id);
        if (idx < 0) {
          return { __raw: true, status: 404, body: { code: 404, status: "error", message: `付款单 ${id} 不存在` } };
        }
        const src = body?.data ?? body ?? {};
        rows[idx] = { ...rows[idx], ...src, id, orgId: Number(params.orgId) || rows[idx].orgId };
        return true;
      },
    },
    {
      method: "DELETE",
      url: "/demo/payment-module/delete/:orgId/:id",
      description: "删除付款单",
      handler: ({ params, body }) => {
        const id = Number(params.id) || pickIdFromBody(body) || -1;
        const idx = rows.findIndex(r => r.id === id);
        if (idx < 0) {
          return { __raw: true, status: 404, body: { code: 404, status: "error", message: `付款单 ${id} 不存在` } };
        }
        rows.splice(idx, 1);
        return true;
      },
    },
  ],
};
