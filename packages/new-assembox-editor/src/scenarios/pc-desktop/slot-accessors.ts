/**
 * 槽位访问规则表（schema-ops 与 renderer 共享的单一真相源）
 *
 * 子节点存储有两种模式：
 * - 直接槽位：__nodeOptions[field] = node | node[]
 * - 间接容器：__nodeOptions[arrayField][i][childProp] = node
 *
 * 历史问题：旧 SLOT_FIELDS 扁平列表无法表达间接路径，
 * 导致 tabPane / buttonGroupOptions / columnSlots / dialogOptions 子节点遍历缺失。
 *
 * 单节点槽语义（slotType: "object"）权威来源为 component-metadata-config 的
 * slots 声明，经 slot-semantics 注入（docs/19 设计方案）。
 */
import { findSingleNodeSlot } from "./slot-semantics";

/** 判断值是否为节点对象（含 __nodeType） */
export function isNode(val: any): boolean {
  return val != null && typeof val === "object" && typeof val.__nodeType === "string";
}

// ═══════════════════════════════════════════════════════
// 规则定义
// ═══════════════════════════════════════════════════════

/** 直接槽位：__nodeOptions[field] = node | node[] */
export interface DirectSlot {
  field: string;
  slotKey: string;
  label: string;
}

export const DIRECT_SLOTS: DirectSlot[] = [
  { field: "defaultSlot", slotKey: "defaultSlot", label: "内容区" },
  { field: "toolSlot", slotKey: "toolSlot", label: "工具栏" },
  { field: "filterSlot", slotKey: "filterSlot", label: "筛选项" },
  { field: "headerSlot", slotKey: "headerSlot", label: "头部" },
  { field: "bottomSlot", slotKey: "bottomSlot", label: "底部" },
  { field: "labelSlot", slotKey: "labelSlot", label: "标签" },
  { field: "rightSlot", slotKey: "rightSlot", label: "右侧" },
];

/** 间接容器：子节点嵌套在中间数组项的某属性中 */
export interface IndirectContainer {
  arrayField: string;
  childProp: string;
  slotKey: string;
  label: string;
  /** 删除子节点时的策略：set-null = 仅清空 childProp（保留壳）；splice-entry = 删除整个数组项 */
  removeMode: "set-null" | "splice-entry";
  /** 创建新数组项（插入时用）；不提供则该容器不支持通过 insertNode 新增 */
  createEntry?: (node: any, genTempId: () => string) => any;
}

export const INDIRECT_CONTAINERS: IndirectContainer[] = [
  {
    arrayField: "itemConfig",
    childProp: "defaultSlot",
    slotKey: "defaultSlot",
    label: "内容区",
    removeMode: "set-null",
    createEntry: node => ({
      isFixed: false,
      paddingSize: "base",
      clearPadding: [],
      isHidden: false,
      contentType: "container",
      defaultSlot: node,
    }),
  },
  {
    arrayField: "tabPane",
    childProp: "defaultSlot",
    slotKey: "defaultSlot",
    label: "标签页",
    removeMode: "set-null",
    createEntry: (node, genTempId) => ({
      renderType: "TabPanelItem",
      label: "新标签",
      name: genTempId(),
      paddingSize: "base",
      defaultSlot: node,
    }),
  },
  {
    arrayField: "buttonGroupOptions",
    childProp: "buttonOption",
    slotKey: "buttonOption",
    label: "按钮项",
    removeMode: "splice-entry",
    createEntry: node => ({
      tooltipOption: {},
      buttonOption: node,
    }),
  },
  {
    arrayField: "columnSlots",
    childProp: "columRender",
    slotKey: "columRender",
    label: "单元格",
    removeMode: "set-null",
    createEntry: (node, genTempId) => ({
      code: genTempId(),
      propName: "新列",
      columRender: node,
    }),
  },
];

/** 独立文档数组（viewsProps 下与 planeOptions 平行的文档树） */
export const DOCUMENT_ARRAYS = ["dialogOptions", "drawerOptions", "tabOptions"];

// ═══════════════════════════════════════════════
// 单节点槽（宿主维度）
// ═══════════════════════════════════════════════

/**
 * 单节点槽语义：宿主以 `:node="options.xxxSlot"` 直渲单个节点（无 v-for）。
 *
 * 权威来源：component-metadata-config 的 slots 声明（slotType: "object"），
 * 经 slot-semantics 注入（docs/19 设计方案）。历史硬编码表已删除（P3 完成）。
 *
 * 语义风险：若按通用数组槽归一（insertChildIntoOpts 会把值数组化），
 * wrapper 把数组交给 NodeRenderer → 子组件 useNodeOptions 解构
 * `props.__nodeOptions.renderType` 崩溃（"Cannot destructure property"）。
 * 新增单节点宿主 = 元数据声明 slotType: "object"（声明前逐条对照 wrapper
 * 源码确认消费方式，历史核对清单见 git 历史本注释）。
 */
/** 指定宿主的槽位是否为单节点语义（仅声明驱动；未声明视为数组槽） */
export function isSingleNodeSlot(renderType: string | undefined, slotKey: string): boolean {
  return findSingleNodeSlot(renderType, slotKey) === true;
}

/**
 * 该槽位当前是否可插入节点。
 * 单节点槽已占用 → false（防数组化崩溃）；数组槽 / 间接容器恒 true。
 */
export function canInsertIntoSlot(opts: any, slotKey: string): boolean {
  const direct = DIRECT_SLOTS.find(s => s.slotKey === slotKey);
  if (!direct) {
    return true;
  }
  if (!isSingleNodeSlot(opts?.renderType, slotKey)) {
    return true;
  }
  return opts[direct.field] == null;
}

/** 所有已知 slotKey 集合（直接 + 间接） */
export const ALL_SLOT_KEYS: string[] = [
  ...DIRECT_SLOTS.map(s => s.slotKey),
  ...INDIRECT_CONTAINERS.map(c => c.slotKey),
];

/** slotKey → label 查找 */
export function slotLabel(slotKey: string): string {
  const direct = DIRECT_SLOTS.find(s => s.slotKey === slotKey);
  if (direct) {
    return direct.label;
  }
  const indirect = INDIRECT_CONTAINERS.find(c => c.slotKey === slotKey);
  return indirect?.label ?? slotKey;
}

// ═══════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════

/** 遍历节点的所有子节点（直接槽位 + 间接容器），统一替换原 SLOT_FIELDS 循环 + itemConfig 特殊分支 */
export function forEachChild(node: any, visitor: (child: any, slotKey: string) => void): void {
  const opts = node?.__nodeOptions;
  if (!opts) {
    return;
  }

  for (const { field, slotKey } of DIRECT_SLOTS) {
    const val = opts[field];
    if (Array.isArray(val)) {
      for (const child of val) {
        if (isNode(child)) {
          visitor(child, slotKey);
        }
      }
    } else if (isNode(val)) {
      visitor(val, slotKey);
    }
  }

  for (const c of INDIRECT_CONTAINERS) {
    const arr = opts[c.arrayField];
    if (!Array.isArray(arr)) {
      continue;
    }
    for (const item of arr) {
      const child = item?.[c.childProp];
      if (Array.isArray(child)) {
        for (const n of child) {
          if (isNode(n)) {
            visitor(n, c.slotKey);
          }
        }
      } else if (isNode(child)) {
        visitor(child, c.slotKey);
      }
    }
  }
}

/** 子节点定位结果（findSlotOf / removeNode / moveUp / moveDown 共用） */
export interface ChildLocation {
  slotKey: string;
  /** 在 swapArr 中的索引（moveUp/Down 用） */
  index: number;
  /** 可用于交换/删除的数组引用 */
  swapArr: any[] | null;
  /** 所属间接容器（直接槽位时为 undefined） */
  container?: IndirectContainer;
}

/** 在父节点的 __nodeOptions 中定位指定 nodeId 的子节点 */
export function locateChild(
  opts: any,
  nodeId: string,
  getNodeId: (n: any) => string,
): ChildLocation | undefined {
  for (const { field, slotKey } of DIRECT_SLOTS) {
    const val = opts[field];
    if (Array.isArray(val)) {
      const idx = val.findIndex((c: any) => getNodeId(c) === nodeId);
      if (idx >= 0) {
        return { slotKey, index: idx, swapArr: val };
      }
    } else if (val && getNodeId(val) === nodeId) {
      return { slotKey, index: 0, swapArr: null };
    }
  }

  for (const c of INDIRECT_CONTAINERS) {
    const arr = opts[c.arrayField];
    if (!Array.isArray(arr)) {
      continue;
    }
    for (let i = 0; i < arr.length; i++) {
      const child = arr[i]?.[c.childProp];
      if (Array.isArray(child)) {
        const idx = child.findIndex((n: any) => getNodeId(n) === nodeId);
        if (idx >= 0) {
          return { slotKey: c.slotKey, index: idx, swapArr: child, container: c };
        }
      } else if (child && getNodeId(child) === nodeId) {
        return { slotKey: c.slotKey, index: i, swapArr: arr, container: c };
      }
    }
  }
  return undefined;
}

/** 从父节点的 __nodeOptions 中移除指定 nodeId 的子节点，返回被移除的节点 */
export function removeChildFromOpts(
  opts: any,
  nodeId: string,
  getNodeId: (n: any) => string,
): any | undefined {
  for (const { field } of DIRECT_SLOTS) {
    const val = opts[field];
    if (Array.isArray(val)) {
      const idx = val.findIndex((c: any) => getNodeId(c) === nodeId);
      if (idx >= 0) {
        return val.splice(idx, 1)[0];
      }
    } else if (val && getNodeId(val) === nodeId) {
      opts[field] = null;
      return val;
    }
  }

  for (const c of INDIRECT_CONTAINERS) {
    const arr = opts[c.arrayField];
    if (!Array.isArray(arr)) {
      continue;
    }
    for (let i = 0; i < arr.length; i++) {
      const child = arr[i]?.[c.childProp];
      if (Array.isArray(child)) {
        const idx = child.findIndex((n: any) => getNodeId(n) === nodeId);
        if (idx >= 0) {
          return child.splice(idx, 1)[0];
        }
      } else if (child && getNodeId(child) === nodeId) {
        const removed = child;
        if (c.removeMode === "splice-entry") {
          arr.splice(i, 1);
        } else {
          arr[i][c.childProp] = null;
        }
        return removed;
      }
    }
  }
  return undefined;
}

/** 向父节点 __nodeOptions 的指定槽位插入子节点 */
export function insertChildIntoOpts(
  opts: any,
  slotKey: string,
  node: any,
  index: number | undefined,
  genTempId: () => string,
): any | undefined {
  const direct = DIRECT_SLOTS.find(s => s.slotKey === slotKey);
  if (direct) {
    // 单节点槽（宿主 wrapper 期望单节点）：空 → 直接赋值；已占用 → 拒绝
    // （数组化会让 wrapper 取 .__nodeOptions 得 undefined 而崩溃）
    if (isSingleNodeSlot(opts.renderType, direct.slotKey)) {
      if (opts[direct.field] != null) {
        return undefined;
      }
      opts[direct.field] = node;
      return node;
    }
    if (!opts[direct.field]) {
      opts[direct.field] = [];
    }
    if (!Array.isArray(opts[direct.field])) {
      opts[direct.field] = [opts[direct.field]];
    }
    const arr = opts[direct.field];
    const at = index === undefined ? arr.length : Math.max(0, Math.min(index, arr.length));
    arr.splice(at, 0, node);
    return node;
  }

  const container = INDIRECT_CONTAINERS.find(c => c.slotKey === slotKey && c.createEntry);
  if (!container || !container.createEntry) {
    return undefined;
  }
  if (!Array.isArray(opts[container.arrayField])) {
    opts[container.arrayField] = [];
  }

  if (container.arrayField === "itemConfig") {
    const empty = opts[container.arrayField].find(
      (it: any) => it?.[container.childProp] === null || it?.[container.childProp] === undefined,
    );
    if (empty) {
      empty[container.childProp] = node;
      return node;
    }
  }

  const entry = container.createEntry(node, genTempId);
  const arr = opts[container.arrayField];
  const at = index === undefined ? arr.length : Math.max(0, Math.min(index, arr.length));
  arr.splice(at, 0, entry);
  return node;
}

/** 提取节点指定槽位的所有子节点 */
export function getSlotChildrenList(opts: any, slotKey: string): any[] {
  const direct = DIRECT_SLOTS.find(s => s.slotKey === slotKey);
  if (direct) {
    const val = opts[direct.field];
    if (!val) {
      return [];
    }
    return Array.isArray(val) ? val : [val];
  }

  const containers = INDIRECT_CONTAINERS.filter(c => c.slotKey === slotKey);
  const out: any[] = [];
  for (const c of containers) {
    const arr = opts[c.arrayField];
    if (!Array.isArray(arr)) {
      continue;
    }
    for (const item of arr) {
      const child = item?.[c.childProp];
      if (Array.isArray(child)) {
        out.push(...child.filter(isNode));
      } else if (isNode(child)) {
        out.push(child);
      }
    }
  }
  return out;
}

/** 返回节点拥有的所有槽位（用于大纲树/属性面板展示） */
export function getNodeSlots(node: any): { key: string; label: string }[] {
  const opts = node?.__nodeOptions;
  if (!opts) {
    return [];
  }
  const result: { key: string; label: string }[] = [];

  for (const { field, slotKey, label } of DIRECT_SLOTS) {
    if (opts[field] !== undefined && opts[field] !== null) {
      result.push({ key: slotKey, label });
    }
  }

  const seenContainers = new Set<string>();
  for (const { arrayField, slotKey, label } of INDIRECT_CONTAINERS) {
    if (seenContainers.has(slotKey)) {
      continue;
    }
    if (Array.isArray(opts[arrayField]) && opts[arrayField].length > 0) {
      result.push({ key: slotKey, label });
      seenContainers.add(slotKey);
    }
  }
  return result;
}
