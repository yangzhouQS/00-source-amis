/**
 * StyleSetter 工具函数（参考 lowcode-engine-ext style-setter/utils）
 */

/** 驼峰 → 中划线（marginTop → margin-top） */
export function toLine(key: string): string {
  return key.replace(/([A-Z])/g, "-$1").toLowerCase();
}

/** 中划线 → 驼峰（margin-top → marginTop） */
export function toHump(name: string): string {
  return name.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase());
}

/** 去除数值单位（"12px" → 12，"auto" → null） */
export function removeUnit(value: string | undefined | null): number | null {
  if (value == null) {
    return null;
  }
  const n = Number.parseInt(String(value), 10);
  return Number.isNaN(n) ? null : n;
}

/** 添加单位（12 → "12px"） */
export function addUnit(value: number | string | null | undefined, unit: string): string | null {
  if (value == null || value === "") {
    return null;
  }
  return `${value}${unit}`;
}

/** 提取单位后缀（"12px" → "px"，"50%" → "%"） */
export function getUnit(value: string): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/^-?[0-9]\d*/g, "");
}

/** 判断是否为空值 */
export function isEmptyValue(value: unknown): boolean {
  return value == null;
}

/** 去除 px 单位统一值 */
export function unifyValue(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  if (/^-?\d+px$/.test(value)) {
    return value.replace("px", "");
  }
  return value;
}

/** 多值属性拆分取指定索引（"10px 20px" index=1 → "20"） */
export function parseValue(styleValue: string | undefined, valueIndex: number): string | null {
  if (!styleValue) {
    return null;
  }
  const arr = styleValue.split(" ");
  const v = arr[valueIndex];
  if (!v) {
    return null;
  }
  const unified = unifyValue(v);
  return unified === "auto" ? null : unified;
}

/** 是否 CSS 变量绑定 */
export function isCssVarBind(value: unknown): boolean {
  return typeof value === "string" && /var\(/.test(value);
}

/** style 对象 → CSS 文本（用于源码编辑） */
export function styleToCss(style: Record<string, any>): string {
  return Object.entries(style)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `  ${toLine(k)}: ${v};`)
    .join("\n");
}

/** CSS 文本 → style 对象 */
export function cssToStyle(css: string): Record<string, any> {
  const result: Record<string, any> = {};
  css.split(";").forEach((line) => {
    const colon = line.indexOf(":");
    if (colon < 0) {
      return;
    }
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim();
    if (key && val) {
      result[toHump(key)] = val;
    }
  });
  return result;
}

/** 类型定义 */
export interface StyleData {
  styleKey: string;
  value: string | number | boolean | null;
}

export type OnStyleChange = (changes: StyleData[]) => void;
