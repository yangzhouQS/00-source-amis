/**
 * 数据源文档归一化
 * - 旧格式兼容：拦截器/共享函数 isOn → enabled（只读兼容，写出一律 enabled）
 * - api.list 透传保留（不展示、不编辑、不删除）
 * - 补默认值：groupName / sort / 空 paramsConfig 骨架
 */
import type {
  DsDocument,
  DsParamsField,
  DsParamsTableModel,
  DsServiceItem,
  DsValueType,
} from "./types";

export const DEFAULT_GROUP_NAME = "默认分组";

/** 深拷贝（文档仅含可 JSON 化数据） */
export function cloneDoc<T>(doc: T): T {
  return JSON.parse(JSON.stringify(doc)) as T;
}

/** 归一化拦截器（isOn → enabled） */
function normalizeInterceptor(raw: any): { enabled: boolean; fn: string } | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const enabled = raw.enabled ?? raw.isOn ?? false;
  const fn = typeof raw.fn === "string" ? raw.fn : "";
  return { enabled: !!enabled, fn };
}

/** 归一化 paramsModel 表（对象表/数组表二态保持） */
function normalizeParamsTable(raw: any): DsParamsTableModel {
  if (Array.isArray(raw)) {
    return [];
  }
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const table: Record<string, DsParamsField> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (val && typeof val === "object") {
      table[key] = { ...(val as DsParamsField) };
    }
  }
  return table;
}

/** 归一化单个服务条目 */
function normalizeService(raw: any): DsServiceItem {
  const item: DsServiceItem = {
    url: typeof raw?.url === "string" ? raw.url : "",
    method: (raw?.method ?? "post") as DsServiceItem["method"],
    groupName: raw?.groupName ?? DEFAULT_GROUP_NAME,
    sort: typeof raw?.sort === "number" ? raw.sort : 1,
    description: raw?.description ?? "",
  };
  if (raw?.config && typeof raw.config === "object") {
    item.config = { ...raw.config };
  }
  if (raw?.isTopUp !== undefined) {
    item.isTopUp = !!raw.isTopUp;
  }
  const before = normalizeInterceptor(raw?.beforeReq);
  if (before) {
    item.beforeReq = before;
  }
  const after = normalizeInterceptor(raw?.afterReq);
  if (after) {
    item.afterReq = after;
  }
  if (raw?.paramsConfig && typeof raw.paramsConfig === "object") {
    const pc = raw.paramsConfig;
    const paramsModel: Record<string, DsParamsTableModel> = {};
    if (pc.paramsModel && typeof pc.paramsModel === "object") {
      for (const [table, def] of Object.entries(pc.paramsModel)) {
        paramsModel[table] = normalizeParamsTable(def);
      }
    }
    item.paramsConfig = {
      paramsType: pc.paramsType ?? "",
      dataModelType: pc.dataModelType ?? "single",
      dataModelName: pc.dataModelName ?? "",
      advancedFilterModelName: pc.advancedFilterModelName ?? "",
      paginationConfig: pc.paginationConfig ? { ...pc.paginationConfig } : undefined,
      paramsModel,
    };
  }
  return item;
}

/** 从 editor.dataSource（any）构建类型化文档 */
export function buildDoc(source: any): DsDocument {
  const src = source && typeof source === "object" ? source : {};
  const doc: DsDocument = {
    api: {
      config: src.api?.config && typeof src.api.config === "object"
        ? { ...src.api.config }
        : {},
      // 旧版接口登记表：透传保留（新配置恒为 null）
      list: src.api?.list && typeof src.api.list === "object" ? cloneDoc(src.api.list) : null,
    },
    requestConfig: {},
    dataModelConfig: {},
    sharedFns: {},
  };

  if (src.requestConfig && typeof src.requestConfig === "object") {
    for (const [id, raw] of Object.entries(src.requestConfig)) {
      doc.requestConfig[id] = normalizeService(raw);
    }
  }

  if (src.dataModelConfig && typeof src.dataModelConfig === "object") {
    for (const [name, raw] of Object.entries<any>(src.dataModelConfig)) {
      if (!raw || typeof raw !== "object") {
        continue;
      }
      const model: Record<string, any> = {};
      if (typeof raw.description === "string") {
        model.description = raw.description;
      }
      for (const [table, def] of Object.entries(raw)) {
        if (table === "description") {
          continue;
        }
        if (Array.isArray(def)) {
          model[table] = [];
        }
        else if (def && typeof def === "object") {
          model[table] = cloneDoc(def);
        }
      }
      doc.dataModelConfig[name] = model;
    }
  }

  if (src.sharedFns && typeof src.sharedFns === "object") {
    for (const [name, raw] of Object.entries<any>(src.sharedFns)) {
      if (!raw || typeof raw !== "object") {
        continue;
      }
      doc.sharedFns[name] = {
        enabled: !!(raw.enabled ?? raw.isOn ?? false),
        fn: typeof raw.fn === "string" ? raw.fn : "",
        description: raw.description ?? "",
      };
    }
  }

  return doc;
}

/** valueType 是否为基础标量（用于默认值输入组件分派） */
export function isScalarValueType(vt: DsValueType | undefined): boolean {
  return vt === "string" || vt === "number" || vt === "boolean";
}
