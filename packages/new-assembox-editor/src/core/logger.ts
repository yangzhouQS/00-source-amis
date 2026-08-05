/**
 * 集中式日志管理
 * 参考 lowcode-engine zen-logger 设计：
 * - 按业务名（bizName）隔离，不同模块各自 logger
 * - 按级别（level）过滤：debug < log < info < warn < error
 * - URL query `__logConf__` 动态调整级别
 * - 控制台输出带 bizName 前缀 + 级别颜色
 */

export type LogLevel = "debug" | "log" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  log: 1,
  info: 2,
  warn: 3,
  error: 4,
};

/** 各级别样式（用 CSS light-dark() 自动适配深/浅色主题） */
const LEVEL_STYLES: Record<LogLevel, string> = {
  debug: "font-weight:bold;color:light-dark(#909399,#888f98)",
  log: "color:light-dark(#303133,#d4d4d4)",
  info: "font-weight:bold;color:light-dark(#409eff,#5aa9ff)",
  warn: "font-weight:bold;color:light-dark(#e6a23c,#f0a93e)",
  error: "font-weight:bold;color:light-dark(#f56c6c,#f87171)",
};

const BIZ_STYLE = "font-weight:bold;color:light-dark(#67c23a,#5bb86a)";
const LOC_STYLE = "color:light-dark(#909399,#6b7280);font-size:11px";

/**
 * 从调用栈提取真实调用方的 文件:行号。
 *
 * 栈帧顺序：Error → getCallerLocation → output → debug/log/... → 真实调用方
 * 跳过 logger.ts 自身的帧，取第一个外部帧。
 */
function getCallerLocation(): string {
  const stack = new Error("trace").stack ?? "";
  const lines = stack.split("\n");
  for (const line of lines) {
    if (!line.includes(".ts") && !line.includes(".tsx")) {
      continue;
    }
    // 跳过 logger.ts 自身
    if (line.includes("logger.ts")) {
      continue;
    }
    // 提取 最后一段 path:line:col（兼容 Chrome/Edge/Firefox 格式）
    // Chrome:  "    at foo (http://host/src/xxx.ts:42:9)"
    // Firefox: "foo@http://host/src/xxx.ts:42:9"
    const match = line.match(/([\w.-]+\.(?:ts|tsx)):(\d+)/);
    if (match) {
      return `${match[1]}:${match[2]}`;
    }
  }
  return "";
}

/** 默认级别（生产） */
const DEFAULT_LEVEL: LogLevel = "log";

/** 从 URL query 解析日志配置 */
function parseLogConfig(): { level: LogLevel; bizMatch: string | null } {
  try {
    const params = new URLSearchParams(window.location.search);
    const conf = params.get("__logConf__");
    if (!conf) {
      return { level: DEFAULT_LEVEL, bizMatch: null };
    }
    const parts = conf.split("|");
    const level
      = (parts[0] as LogLevel) in LEVEL_ORDER
        ? (parts[0] as LogLevel)
        : DEFAULT_LEVEL;
    const bizMatch = parts[1] ?? null;
    return { level, bizMatch };
  } catch {
    return { level: DEFAULT_LEVEL, bizMatch: null };
  }
}

const GLOBAL_CONFIG = parseLogConfig();

export interface LoggerOptions {
  /** 业务名（模块标识，如 'dragon'、'canvas-sensor'） */
  bizName: string;
  /** 初始级别（默认 warn） */
  level?: LogLevel;
}

export class Logger {
  readonly bizName: string;
  private level: LogLevel;

  constructor(opts: LoggerOptions | string) {
    this.bizName = typeof opts === "string" ? opts : opts.bizName;
    this.level
      = typeof opts === "string" ? DEFAULT_LEVEL : opts.level ?? DEFAULT_LEVEL;
  }

  /** 判断该 logger 是否应输出（URL __logConf__ 覆盖 + bizName 匹配） */
  private shouldLog(target: LogLevel): boolean {
    // URL 配置覆盖
    if (GLOBAL_CONFIG.bizMatch) {
      const matches
        = GLOBAL_CONFIG.bizMatch === "*"
          || this.bizName.includes(GLOBAL_CONFIG.bizMatch);
      if (matches) {
        return LEVEL_ORDER[target] >= LEVEL_ORDER[GLOBAL_CONFIG.level];
      }
    }
    return LEVEL_ORDER[target] >= LEVEL_ORDER[this.level];
  }

  /**
   * 格式化并输出日志。
   *
   * 输出格式：[LEVEL] bizName (file.ts:42)  message...
   * 前缀含三级样式：级别色 → bizName 色 → 位置灰色。
   *
   * 注意：DevTools 源码定位仍指向 logger.ts（浏览器限制），
   * 但日志文本中的 (file.ts:42) 提供了真实调用方位置，
   * 且 DevTools Call Stack 面板可直接跳到调用方。
   */
  private output(level: LogLevel, args: any[]): void {
    if (!this.shouldLog(level)) {
      return;
    }
    const loc = getCallerLocation();
    const locPart = loc ? `%c(${loc}) ` : "";
    const locStyle = loc ? LOC_STYLE : "";
    const prefix = `%c[${level.toUpperCase()}]%c ${this.bizName} ${locPart}`;
    const fn = (console as any)[level] ?? console.log;
    // 直接调用 console[level]（非 output 间接），缩短调用栈
    fn(prefix, LEVEL_STYLES[level], BIZ_STYLE, locStyle, ...args);
  }

  debug(...args: any[]): void {
    this.output("debug", args);
  }

  log(...args: any[]): void {
    this.output("log", args);
  }

  info(...args: any[]): void {
    this.output("info", args);
  }

  warn(...args: any[]): void {
    this.output("warn", args);
  }

  error(...args: any[]): void {
    this.output("error", args);
  }

  /** 动态设置级别 */
  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

/** logger 缓存（同 bizName 复用） */
const cache = new Map<string, Logger>();

/**
 * 创建/获取 logger
 * @param bizName 业务名
 * @param level 初始级别
 */
export function getLogger(bizName: string, level?: LogLevel): Logger {
  let logger = cache.get(bizName);
  if (!logger) {
    logger = new Logger({ bizName, level });
    cache.set(bizName, logger);
  }
  return logger;
}

/**
 * 全局设置所有 logger 的级别
 */
export function setGlobalLevel(level: LogLevel): void {
  cache.forEach(l => l.setLevel(level));
}
