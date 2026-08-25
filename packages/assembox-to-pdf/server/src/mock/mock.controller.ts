import { Controller, Get } from '@nestjs/common';

/**
 * mock 业务 API（测试环境）：与 single-table-scene 的 columnConfigs 对齐。
 * 响应为后端统一信封 { code, status:'success', message, result }，
 * core-next executor 的 asEnvelope 会剥一层取 result（request/executor.ts:28-41）。
 */

const SUPPLIERS = [
  '无锡法斯特管业有限公司',
  '上海爱谁是谁影视文化工作室',
  '天津实业有限公司',
  '西安实业有限公司',
  '苏州工业园区精密制造有限公司',
  '杭州云栖数据科技有限公司',
];
const CONTRACTS = [
  { code: '测试-0001', name: '测试指挥部数据' },
  { code: '测试-00012', name: '36363636' },
  { code: '京东-0001', name: '京东部数据' },
  { code: '淘宝-00012', name: '淘宝数据测试合同' },
];
const ORGS = ['华东指挥部', '华南指挥部', '西南指挥部', '西北指挥部'];
const PAYMENT_TYPES = ['银行转账', '商业承兑', '电子汇票'];
const PAYMENT_NATURES = ['进度款', '结算款', '预付款', '质保金'];
const AUDITORS = ['张桂芳', '李明远', '王一舟', '赵清源'];
const REMARKS = [
  '按合同约定支付第三期进度款',
  '结算尾款，含变更签证部分',
  '年度框架协议第一批次',
  '质保期满支付',
  '',
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** 42 行 mock 数据（跨 A4 多页，可验证表头跨页重复与断页规则） */
function buildRows(): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < 42; i++) {
    const day = (i % 28) + 1;
    const month = (i % 12) + 1;
    const date = `2026-${pad(month)}-${pad(day)}`;
    const contract = CONTRACTS[i % CONTRACTS.length];
    rows.push({
      id: 10000 + i,
      orgId: 2001 + (i % 4),
      orgName: ORGS[i % ORGS.length],
      supplierId: 2116603680428500 + i,
      supplierName: SUPPLIERS[i % SUPPLIERS.length],
      paymentSum: Math.round((12345.67 + i * 913.25) * 100) / 100,
      paymentDate: date,
      paymentCode: `Sf-1987-${pad(month)}${pad(day)}-${pad(i + 1)}`,
      contractId: 1861113445945800 + (i % 4),
      contractCode: contract.code,
      colVarchar50No01: `${contract.code}-付款凭证.pdf`,
      paymentType: PAYMENT_TYPES[i % PAYMENT_TYPES.length],
      paymentNature: PAYMENT_NATURES[i % PAYMENT_NATURES.length],
      isAudit: i % 3 !== 0, // 1/3 未提交（Tag 列 danger 分支）
      auditor: AUDITORS[i % AUDITORS.length],
      creatorName: AUDITORS[(i + 1) % AUDITORS.length],
      createdAt: `${date} 09:${pad(i % 60)}:30`,
      remark: REMARKS[i % REMARKS.length],
    });
  }
  return rows;
}

const ROWS = buildRows();

@Controller('internal/mock')
export class MockController {
  /** 分页信封：toPaged 期望 { count, result }（use-remote-data.ts:80-86）。忽略分页参数返回全量 */
  @Get('payments')
  payments(): Record<string, unknown> {
    return envelope(ROWS);
  }

  /** 长表数据（200 行）：验证多页分页/表头跨页重复 */
  @Get('payments-large')
  paymentsLarge(): Record<string, unknown> {
    const large = Array.from({ length: 200 }, (_, i) => {
      const base = ROWS[i % ROWS.length];
      return { ...base, id: 10000 + i, paymentCode: `Sf-1987-L${String(i + 1).padStart(3, '0')}` };
    });
    return envelope(large);
  }
}

function envelope(rows: Record<string, unknown>[]): Record<string, unknown> {
  return {
    code: 200,
    status: 'success',
    message: 'ok',
    result: { count: rows.length, result: rows },
  };
}
