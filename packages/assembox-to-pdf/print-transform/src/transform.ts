/**
 * 场景打印变换（方案 A §6，详细设计见 packages/assembox-to-pdf/docs/02-*.md）
 *
 * 契约：
 * - 纯函数：不修改输入，返回全新对象（与 core-next adaptNodeTree 同一不可变约定）
 * - 幂等：对已变换场景重复执行无副作用（剔除类规则天然幂等，改写类规则写固定值）
 * - 未知 renderType 透传 + 统计上报（PRINT_TRANSFORM_UNKNOWN_TYPE），前向兼容
 *
 * 遍历策略：通用深走查 —— 任何带 __nodeOptions.renderType 的对象视为渲染节点，
 * 其槽位（defaultSlot/toolSlot/filterSlot/itemConfig[].defaultSlot/columnSlots[].columRender
 * /bottomSlot 等）均为节点属性，无需按组件逐一定义访问路径。
 */
import type { PrintTransformOptions, TransformResult, TransformStats } from './options';
import { KNOWN_RENDER_TYPES, REMOVE_RENDER_TYPES } from './known-types';

type Node_ = Record<string, any>;

const DELETE_KEY: unique symbol = Symbol('print-transform:delete');

function isPlainObject(v: unknown): v is Node_ {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isRenderNode(v: unknown): v is Node_ {
  return isPlainObject(v) && typeof v.__nodeOptions?.renderType === 'string';
}

function emptyStats(): TransformStats {
  return { removed: {}, tableRewrites: 0, chartRewrites: 0, unknownRenderTypes: [] };
}

function noteRemoved(stats: TransformStats, renderType: string): void {
  stats.removed[renderType] = (stats.removed[renderType] ?? 0) + 1;
}

/** 节点级规则：返回 null 表示整树剔除；否则原位改写后继续走查其槽位属性 */
function transformNode(node: Node_, stats: TransformStats, options: Required<PrintTransformOptions>): Node_ | null {
  const renderType: string = node.__nodeOptions.renderType;

  if (REMOVE_RENDER_TYPES.has(renderType)) {
    noteRemoved(stats, renderType);
    return null;
  }
  if (renderType === 'YqNavigationBar' && !options.keepNav) {
    noteRemoved(stats, renderType);
    return null;
  }
  if (renderType === 'YqTableAsync') {
    // D1 数据策略：分页改「全量单页」（currentSize = rowLimit），分页 UI 收敛为仅总数
    node.__nodeOptions.pagination = {
      currentSize: options.rowLimit,
      pageSizes: [options.rowLimit],
      layout: 'total',
    };
    node.__nodeOptions.autoLoad = true;
    stats.tableRewrites++;
  }
  if (renderType === 'Chart') {
    // 消除 G2Plot 动画期截取风险：animation 是 G2Plot 配置项，须并入 options
    // （assem-chart.vue 只透传 options/data/g2PlotName 等，节点级属性不进图表配置）
    node.__nodeOptions.options = { ...(node.__nodeOptions.options ?? {}), animation: false };
    node.__nodeOptions.width = '100%';
    stats.chartRewrites++;
  }
  if (renderType === 'YqBox' || renderType === 'YqPanel') {
    // 容器高度约束解除（表格容器链上的 height:100% 会与打印分页冲突）
    if (node.__nodeOptions.height === '100%') {
      node.__nodeOptions.height = 'auto';
    }
    if (isPlainObject(node.__nodeStyle)) {
      delete node.__nodeStyle.height;
    }
  }
  if (renderType === 'YqNavigationBar' && options.keepNav) {
    // 保留时降级为纯标题条：去掉路由跳转语义
    if (Array.isArray(node.__nodeOptions.routers)) {
      node.__nodeOptions.routers = node.__nodeOptions.routers.map((r: Node_) => ({ ...r, to: '' }));
    }
  }
  if (!KNOWN_RENDER_TYPES.has(renderType) && !stats.unknownRenderTypes.includes(renderType)) {
    stats.unknownRenderTypes.push(renderType);
  }

  // 继续走查节点自身属性（槽位/数组里嵌套的子节点）
  for (const key of Object.keys(node)) {
    const result = processValue(node[key], stats, options);
    if (result === DELETE_KEY || result === null) {
      delete node[key];
    } else {
      node[key] = result;
    }
  }
  return node;
}

function processValue(
  value: unknown,
  stats: TransformStats,
  options: Required<PrintTransformOptions>,
): unknown {
  if (Array.isArray(value)) {
    const mapped = value
      .map((item) => processValue(item, stats, options))
      .filter((item) => item !== null && item !== DELETE_KEY);
    return mapped;
  }
  if (isRenderNode(value)) {
    const transformed = transformNode(value, stats, options);
    return transformed; // null → 由调用方删除/过滤
  }
  if (isPlainObject(value)) {
    for (const key of Object.keys(value)) {
      const result = processValue(value[key], stats, options);
      if (result === DELETE_KEY || result === null) {
        delete value[key];
      } else {
        value[key] = result;
      }
    }
    return value;
  }
  return value;
}

/** 收集场景内出现的全部 renderType（测试辅助） */
export function collectRenderTypes(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((v) => collectRenderTypes(v, into));
    return into;
  }
  if (isPlainObject(value)) {
    if (isRenderNode(value)) into.add(value.__nodeOptions.renderType);
    Object.values(value).forEach((v) => collectRenderTypes(v, into));
  }
  return into;
}

/**
 * 深克隆（函数安全）：
 * 反序列化后的场景里 __nodeEvent.handler 是函数（adaptNodeTree 产物），structuredClone
 * 会抛错；函数与其它非普通对象按引用共享 —— 本变换从不改动它们，共享是安全的。
 */
function deepClone<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => deepClone(item)) as unknown as T;
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) out[key] = deepClone(value[key]);
    return out as T;
  }
  return value;
}

/**
 * 场景打印变换主入口。
 *
 * @param scene 反序列化后的 uiSkeleton（Record<sceneName, SceneConfig>）
 * @param options 打印选项子集
 */
export function transformForPrint<T extends Record<string, any>>(
  scene: T,
  options: PrintTransformOptions = {},
): TransformResult<T> {
  const resolved: Required<PrintTransformOptions> = {
    rowLimit: options.rowLimit ?? 1000,
    keepNav: options.keepNav ?? false,
  };
  const stats = emptyStats();
  const out: Record<string, any> = deepClone(scene);

  for (const sceneName of Object.keys(out)) {
    const sceneConfig = out[sceneName];
    const viewsProps = sceneConfig?.viewsProps;
    if (!isPlainObject(viewsProps)) continue;

    // 弹层不属于打印内容：Dialog/Drawer 由 AssemViews 直渲（docs/architecture/05 §5.3）
    if (Array.isArray(viewsProps.dialogOptions)) {
      viewsProps.dialogOptions.forEach(() => noteRemoved(stats, 'Dialog'));
      viewsProps.dialogOptions = [];
    }
    if (Array.isArray(viewsProps.drawerOptions)) {
      viewsProps.drawerOptions.forEach(() => noteRemoved(stats, 'Drawer'));
      viewsProps.drawerOptions = [];
    }

    if (viewsProps.planeOptions != null) {
      const plane = processValue(viewsProps.planeOptions, stats, resolved);
      viewsProps.planeOptions = plane ?? undefined;
      // 根布局解除视口约束：height:100% → auto（屏幕视口布局 vs 纸张流式布局）
      if (isRenderNode(viewsProps.planeOptions)) {
        if (viewsProps.planeOptions.__nodeOptions.height != null) {
          viewsProps.planeOptions.__nodeOptions.height = 'auto';
        }
        if (isPlainObject(viewsProps.planeOptions.__nodeStyle)) {
          delete viewsProps.planeOptions.__nodeStyle.height;
        }
      }
    }
  }
  return { scene: out as T, stats };
}
