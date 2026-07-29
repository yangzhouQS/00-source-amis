# Logger 集中日志管理

> 文件：`src/core/logger.ts`
> 参考：lowcode-engine [zen-logger](https://web.npm.alibaba-inc.com/package/zen-logger) 设计

---

## 一、设计目标

| 目标 | 说明 |
|---|---|
| **按业务名隔离** | 每个模块创建独立 logger（如 `dragon`、`event-bus`），日志带 bizName 前缀，一眼可辨来源 |
| **按级别过滤** | 5 级（debug < log < info < warn < error），生产默认 `warn`，只输出 warn + error |
| **URL 动态调级** | 浏览器地址栏追加 `?__logConf__=` 即可实时调整，无需改代码/重启 |
| **彩色控制台输出** | 级别有颜色（warn 橙、error 红），bizName 绿色前缀 |
| **缓存复用** | 同 bizName 的 `getLogger()` 返回同一实例，避免重复创建 |
| **零依赖** | 纯 TS，不引入外部 npm 包 |

---

## 二、API

### 2.1 getLogger（推荐入口）

```typescript
import { getLogger } from '@cs/new-assembox-editor';
// 或内部模块
import { getLogger } from './logger';

const logger = getLogger('dragon');
```

**签名**：
```typescript
function getLogger(bizName: string, level?: LogLevel): Logger
```

- `bizName`：业务名（模块标识，如 `'dragon'`、`'canvas-sensor'`、`'plugin-manager'`）
- `level`：初始级别（可选，默认 `warn`）
- 返回：`Logger` 实例（同 bizName 复用缓存）

### 2.2 Logger 方法

| 方法 | 说明 | 控制台 |
|---|---|---|
| `logger.debug(...args)` | 调试信息（最详细） | `console.debug` 灰色 |
| `logger.log(...args)` | 普通日志 | `console.log` 默认色 |
| `logger.info(...args)` | 重要信息 | `console.info` 蓝色 |
| `logger.warn(...args)` | 警告 | `console.warn` 橙色 |
| `logger.error(...args)` | 错误 | `console.error` 红色 |
| `logger.setLevel(level)` | 动态修改级别 | — |

### 2.3 全局函数

| 函数 | 说明 |
|---|---|
| `setGlobalLevel('debug')` | 批量设置所有已创建 logger 的级别 |
| `new Logger({ bizName, level })` | 直接构造（不推荐，除非需要多个同 bizName 的不同级别实例） |

---

## 三、日志级别

从低到高，低级别的输出包含高级别：

```
debug(0) < log(1) < info(2) < warn(3) < error(4)
```

| 当前级别 | 输出哪些 |
|---|---|
| `debug` | debug, log, info, warn, error（全部） |
| `log` | log, info, warn, error |
| `info` | info, warn, error |
| `warn`（默认） | warn, error |
| `error` | 仅 error |

---

## 四、URL 动态调级

无需改代码，直接在浏览器地址栏追加 `__logConf__` query 参数：

### 4.1 全局调级

```
http://localhost:5174/?__logConf__=debug
```
所有模块输出 debug 及以上。

```
http://localhost:5174/?__logConf__=warn
```
所有模块只输出 warn 和 error（等同默认）。

### 4.2 按业务名过滤

```
http://localhost:5174/?__logConf__=debug|dragon
```
只开启 bizName 精确匹配 `dragon` 的 debug 及以上。

```
http://localhost:5174/?__logConf__=warn|simulator
```
只开启 bizName 包含 `simulator` 的 warn 及以上（模糊匹配 `includes`）。

```
http://localhost:5174/?__logConf__=debug|*
```
所有模块 debug 及以上（等同不带 bizName）。

### 4.3 语法总结

```
__logConf__=<level>[|<bizMatch>]
```

| 参数 | 说明 | 示例 |
|---|---|---|
| `level` | 日志级别 | `debug` / `log` / `info` / `warn` / `error` |
| `bizMatch`（可选） | 业务名匹配（精确或 `includes`） | `dragon` / `simulator` / `*` |

---

## 五、控制台输出示例

```
[INFO] editor  编辑器已就绪 {version: "0.1.0"}
[WARN] dragon  拖拽感应区未命中 {globalX: 100, globalY: 200}
[ERROR] iframe-bridge  渲染器连接超时
[DEBUG] canvas-sensor  computeIndicator {containerId: "root", width: 1200}
```

颜色效果：
- `[INFO]` 蓝色加粗
- `[WARN]` 橙色加粗
- `[ERROR]` 红色加粗
- `[DEBUG]` 灰色加粗
- bizName（如 `dragon`）绿色加粗

---

## 六、已接入模块

| 模块 | bizName | 文件 |
|---|---|---|
| 编辑器核心 | `editor` | `src/core/editor.ts` |
| 事件总线 | `event-bus` | `src/core/event-bus.ts` |
| 插件管理器 | `plugin-manager` | `src/core/plugin-manager.ts` |
| 拖拽引擎 | `dragon` | `src/designer/drag/dragon.ts` |
| iframe 渲染器 | `simulator-renderer` | `src/simulator/iframe/simulator-renderer.ts` |
| iframe 通信桥 | `iframe-bridge` | `src/simulator/iframe/iframe-bridge.ts` |

---

## 七、使用指南

### 7.1 在新模块中接入

```typescript
import { getLogger } from '@/core/logger';

const logger = getLogger('my-module');

export function doSomething() {
  logger.debug('开始执行', { args: [...] });
  try {
    // ... 业务逻辑
    logger.info('执行成功');
  } catch (err) {
    logger.error('执行失败', err);
  }
}
```

### 7.2 在插件中使用

```typescript
import { getLogger } from '@cs/new-assembox-editor';

class MyPlugin {
  readonly id = 'my-plugin';
  private logger = getLogger('my-plugin');

  init(ctx) {
    this.logger.info('插件初始化');
    ctx.bus.on('after-insert', e => {
      this.logger.debug('节点插入', e.context.nodeId);
    });
  }
}
```

### 7.3 替换原有 console.log

```typescript
// ❌ 旧：无法控制级别，无法过滤
console.log('拖拽开始', dragObject);
console.error('渲染失败', error);

// ✅ 新：可控级别，按模块过滤
logger.debug('拖拽开始', dragObject);
logger.error('渲染失败', error);
```

### 7.4 生产环境

默认级别 `warn`，生产环境只输出 warn + error，debug/log/info 被静默。
不会产生控制台噪声，不影响性能。

### 7.5 开发调试

开发时在 URL 追加参数即可全开：

```
http://localhost:5174/?__logConf__=debug
```

或只看特定模块：

```
http://localhost:5174/?__logConf__=debug|dragon
```

---

## 八、与旧版（console.log）的对比

| 维度 | 旧版 `console.log` | 新版 Logger |
|---|---|---|
| 级别控制 | ❌ 无 | ✅ 5 级，可按模块独立设置 |
| 动态调级 | ❌ 需改代码 | ✅ URL query 实时切换 |
| 模块标识 | ❌ 无前缀，难以定位来源 | ✅ bizName 前缀（彩色） |
| 生产静默 | ❌ 全部输出 | ✅ 默认 warn，自动静默 debug/log/info |
| 输出格式 | ❌ 纯文本 | ✅ 彩色 `[LEVEL] bizName` 前缀 |
| 缓存复用 | — | ✅ 同 bizName 复用实例 |
| 外部依赖 | 无 | 无（纯 TS） |
