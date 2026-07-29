/**
 * 集中式日志管理
 * 参考 lowcode-engine zen-logger 设计：
 * - 按业务名（bizName）隔离，不同模块各自 logger
 * - 按级别（level）过滤：debug < log < info < warn < error
 * - URL query `__logConf__` 动态调整级别
 * - 控制台输出带 bizName 前缀 + 级别颜色
 */

export type LogLevel = 'debug' | 'log' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  log: 1,
  info: 2,
  warn: 3,
  error: 4
};

const LEVEL_STYLES: Record<LogLevel, string> = {
  debug: 'color:#909399;font-weight:bold',
  log: 'color:#303133',
  info: 'color:#409eff;font-weight:bold',
  warn: 'color:#e6a23c;font-weight:bold',
  error: 'color:#f56c6c;font-weight:bold'
};

const BIZ_STYLE = 'color:#67c23a;font-weight:bold';

/** 默认级别（生产） */
const DEFAULT_LEVEL: LogLevel = 'warn';

/** 从 URL query 解析日志配置 */
function parseLogConfig(): {level: LogLevel; bizMatch: string | null} {
  try {
    const params = new URLSearchParams(window.location.search);
    const conf = params.get('__logConf__');
    if (!conf) return {level: DEFAULT_LEVEL, bizMatch: null};
    const parts = conf.split('|');
    const level =
      (parts[0] as LogLevel) in LEVEL_ORDER
        ? (parts[0] as LogLevel)
        : DEFAULT_LEVEL;
    const bizMatch = parts[1] ?? null;
    return {level, bizMatch};
  } catch {
    return {level: DEFAULT_LEVEL, bizMatch: null};
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
    this.bizName = typeof opts === 'string' ? opts : opts.bizName;
    this.level =
      typeof opts === 'string' ? DEFAULT_LEVEL : opts.level ?? DEFAULT_LEVEL;
  }

  /** 判断该 logger 是否应输出（URL __logConf__ 覆盖 + bizName 匹配） */
  private shouldLog(target: LogLevel): boolean {
    // URL 配置覆盖
    if (GLOBAL_CONFIG.bizMatch) {
      const matches =
        GLOBAL_CONFIG.bizMatch === '*' ||
        this.bizName.includes(GLOBAL_CONFIG.bizMatch);
      if (matches)
        return LEVEL_ORDER[target] >= LEVEL_ORDER[GLOBAL_CONFIG.level];
    }
    return LEVEL_ORDER[target] >= LEVEL_ORDER[this.level];
  }

  /** 格式化输出 */
  private output(level: LogLevel, args: any[]): void {
    if (!this.shouldLog(level)) return;
    const prefix = `%c[${level.toUpperCase()}]%c ${this.bizName}`;
    const fn = console[level] ?? console.log;
    fn.call(console, prefix, LEVEL_STYLES[level], BIZ_STYLE, ...args);
  }

  debug(...args: any[]): void {
    this.output('debug', args);
  }
  log(...args: any[]): void {
    this.output('log', args);
  }
  info(...args: any[]): void {
    this.output('info', args);
  }
  warn(...args: any[]): void {
    this.output('warn', args);
  }
  error(...args: any[]): void {
    this.output('error', args);
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
    logger = new Logger({bizName, level});
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
