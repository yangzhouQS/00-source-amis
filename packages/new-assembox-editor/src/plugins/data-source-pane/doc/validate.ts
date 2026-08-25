/**
 * 数据源语义校验器
 * 规则对齐渲染层消费链路（docs-lib/05 设计文档 R1-R8），产出结构化问题而非弹消息。
 * error 阻断保存；warn 提示但不阻断。
 */
import type { DsDocument, DsIssue, DsServiceItem } from "./types";

/** 标识符（服务编码/模型名/表名/字段名/函数名） */
export const DS_IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** url 路由占位（:param）提取 */
function extractRouteParams(url: string): string[] {
  const out: string[] = [];
  const re = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(url))) {
    out.push(m[1]!);
  }
  return out;
}

/** fn 字符串可编译性检查（safeEvalFn 同源语义：表达式求值） */
export function canCompileFn(fn: string): boolean {
  if (!fn.trim()) {
    return false;
  }
  try {
    // eslint-disable-next-line no-new-func
    new Function(`return (${fn});`);
    return true;
  }
  catch {
    return false;
  }
}

function issue(level: DsIssue["level"], path: string, message: string): DsIssue {
  return { level, path, message };
}

/** 服务配置校验（编辑保存前调用；excludeId 用于重命名场景排除自身） */
export function validateService(
  id: string,
  item: DsServiceItem,
  doc: DsDocument,
  opts: { excludeId?: string } = {},
): DsIssue[] {
  const issues: DsIssue[] = [];
  const base = `服务[${id || "新服务"}]`;

  if (!id) {
    issues.push(issue("error", `${base}.请求编码`, "请求编码必填"));
  }
  else if (!DS_IDENTIFIER_RE.test(id)) {
    issues.push(issue("error", `${base}.请求编码`, "编码须为合法标识符（字母开头，仅含字母/数字/下划线）"));
  }
  else if (id in doc.requestConfig && id !== opts.excludeId) {
    issues.push(issue("error", `${base}.请求编码`, `编码 "${id}" 已存在`));
  }

  if (!item.url?.trim()) {
    issues.push(issue("error", `${base}.url`, "接口地址必填"));
  }
  if (!item.method) {
    issues.push(issue("error", `${base}.method`, "请求方法必选"));
  }

  // 拦截器：启用但无函数体 / 无法编译
  for (const key of ["beforeReq", "afterReq"] as const) {
    const itc = item[key];
    if (itc?.enabled) {
      if (!itc.fn.trim()) {
        issues.push(issue("error", `${base}.${key}`, "拦截器已启用但函数体为空"));
      }
      else if (!canCompileFn(itc.fn)) {
        issues.push(issue("error", `${base}.${key}`, "拦截器函数存在语法错误"));
      }
    }
  }

  const pc = item.paramsConfig;
  if (!pc) {
    return issues;
  }

  // R7：参数取值模型存在性
  if (pc.dataModelName && !(pc.dataModelName in doc.dataModelConfig)) {
    issues.push(issue("warn", `${base}.数据模型`, `模型 "${pc.dataModelName}" 不存在，参数将只取默认值/外部参数`));
  }
  if (pc.advancedFilterModelName && !(pc.advancedFilterModelName in doc.dataModelConfig)) {
    issues.push(issue("warn", `${base}.高级筛选模型`, `模型 "${pc.advancedFilterModelName}" 不存在`));
  }

  // paramsModel 字段级校验
  for (const [tableName, table] of Object.entries(pc.paramsModel)) {
    if (Array.isArray(table)) {
      continue; // 数组表占位无字段
    }
    if (Object.keys(table).length === 0) {
      issues.push(issue("warn", `${base}.${tableName}`, "表字段为空，如不需要请移除该 key"));
      continue;
    }
    const seen = new Set<string>();
    for (const [fieldName, field] of Object.entries(table)) {
      const at = `${base}.${tableName}.${fieldName}`;
      if (!fieldName) {
        issues.push(issue("error", `${base}.${tableName}`, "存在字段编码为空的行"));
        continue;
      }
      if (seen.has(fieldName)) {
        issues.push(issue("error", at, `字段编码 "${fieldName}" 重复`));
      }
      seen.add(fieldName);
      if (!field.valueType) {
        issues.push(issue("error", at, "字段类型未选择"));
      }
      // R5：isCache 回写目标表存在性（仅当绑定模型存在时校验）
      if (field.isCache && pc.dataModelName) {
        const model = doc.dataModelConfig[pc.dataModelName];
        const hasTable = model ? tableName in model : false;
        if (!hasTable) {
          issues.push(issue("warn", at, `isCache 回写目标模型 "${pc.dataModelName}.${tableName}" 不存在`));
        }
      }
    }
  }

  // R1：url 路由占位与 routeParams 字段对齐
  if (item.url) {
    const placeholders = extractRouteParams(item.url);
    const routeFields = new Set<string>();
    for (const table of Object.values(pc.paramsModel)) {
      if (Array.isArray(table)) {
        continue;
      }
      for (const [fieldName, field] of Object.entries(table)) {
        if ((field.resolveType ?? "").includes("routeParams")) {
          routeFields.add(fieldName);
        }
      }
    }
    for (const p of placeholders) {
      if (!routeFields.has(p)) {
        issues.push(issue("warn", `${base}.url`, `路由占位 ":${p}" 无对应 routeParams 字段，运行期将不被替换`));
      }
    }
  }

  return issues;
}

/** 模型配置校验（excludeName 用于重命名场景） */
export function validateModel(
  name: string,
  model: Record<string, any>,
  doc: DsDocument,
  opts: { excludeName?: string } = {},
): DsIssue[] {
  const issues: DsIssue[] = [];
  const base = `模型[${name || "新模型"}]`;

  if (!name) {
    issues.push(issue("error", `${base}.模型名`, "模型名必填"));
  }
  else if (!DS_IDENTIFIER_RE.test(name)) {
    issues.push(issue("error", `${base}.模型名`, "模型名须为合法标识符（字母开头，仅含字母/数字/下划线）"));
  }
  else if (name in doc.dataModelConfig && name !== opts.excludeName) {
    issues.push(issue("error", `${base}.模型名`, `模型 "${name}" 已存在`));
  }

  for (const [tableName, table] of Object.entries(model)) {
    if (tableName === "description" || Array.isArray(table)) {
      continue;
    }
    if (!DS_IDENTIFIER_RE.test(tableName)) {
      issues.push(issue("error", `${base}.${tableName}`, "表名须为合法标识符"));
      continue;
    }
    const seen = new Set<string>();
    for (const [fieldName, field] of Object.entries(table as Record<string, any>)) {
      const at = `${base}.${tableName}.${fieldName}`;
      if (!fieldName || !DS_IDENTIFIER_RE.test(fieldName)) {
        issues.push(issue("error", at, "字段名须为合法标识符"));
        continue;
      }
      if (seen.has(fieldName)) {
        issues.push(issue("error", at, `字段名 "${fieldName}" 重复`));
      }
      seen.add(fieldName);
      if (!field?.valueType) {
        issues.push(issue("error", at, "字段类型未选择"));
      }
    }
  }
  return issues;
}

/** 共享方法校验 */
export function validateSharedFn(
  name: string,
  fn: { enabled: boolean; fn: string },
  doc: DsDocument,
  opts: { excludeName?: string } = {},
): DsIssue[] {
  const issues: DsIssue[] = [];
  const base = `方法[${name || "新方法"}]`;

  if (!name) {
    issues.push(issue("error", `${base}.函数名`, "函数名必填"));
  }
  else if (!DS_IDENTIFIER_RE.test(name)) {
    issues.push(issue("error", `${base}.函数名`, "函数名须为合法标识符"));
  }
  else if (name in doc.sharedFns && name !== opts.excludeName) {
    issues.push(issue("error", `${base}.函数名`, `函数名 "${name}" 已存在`));
  }

  if (fn.enabled) {
    if (!fn.fn.trim()) {
      issues.push(issue("error", `${base}.fn`, "函数已启用但函数体为空"));
    }
    else if (!canCompileFn(fn.fn)) {
      issues.push(issue("error", `${base}.fn`, "函数存在语法错误"));
    }
  }
  else if (!fn.fn.trim()) {
    issues.push(issue("error", `${base}.fn`, "函数体不能为空"));
  }
  return issues;
}

/** 是否存在阻断保存的 error */
export function hasBlockingIssues(issues: DsIssue[]): boolean {
  return issues.some(i => i.level === "error");
}
