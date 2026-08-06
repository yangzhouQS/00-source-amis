import type { ISchemaOps } from "../scenario/types";
/**
 * 响应式 Store（基于 Vue reactive）
 * v2: 去除 amis 依赖，schema 类型为 any，操作委托给 schemaOps
 */
import { reactive, shallowRef, triggerRef } from "vue";

const HISTORY_LIMIT = 50;

/** 从 schema（uiSkeleton）推断初始场景名（取第一个 key） */
function inferInitialScene(schema: any): string {
  const keys = schema && typeof schema === "object" ? Object.keys(schema) : [];
  return keys[0] ?? "";
}

export interface HistoryEntry {
  schema: any;
  label: string;
  timestamp: number;
}

export interface DevicePreset {
  key: string;
  label: string;
  width: number | null;
}

export const DEVICE_PRESETS: DevicePreset[] = [
  { key: "default", label: "默认", width: null },
  { key: "tablet", label: "平板", width: 768 },
  { key: "phone", label: "手机", width: 375 },
];

export interface EditorState {
  schema: any;
  selectedIds: string[];
  activeId: string | null;
  hoverId: string | null;
  platform: "desktop" | "mobile";
  device: DevicePreset;
  ready: boolean;
  rightPanelVisible: boolean;
  designMode: "design" | "preview";
  /** 当前激活场景名（uiSkeleton 的顶层 key） */
  activeScene: string;
}

export class EditorStore {
  readonly state: EditorState;
  private schemaOps: ISchemaOps;

  private past: HistoryEntry[] = [];
  private future: HistoryEntry[] = [];
  private suspendHistory = false;
  readonly schemaRef = shallowRef<any>(null);

  constructor(initial: any, schemaOps: ISchemaOps) {
    this.schemaOps = schemaOps;
    const schema = initial ? schemaOps.cloneSchema(initial) : schemaOps.emptySchema();
    this.schemaRef.value = schema;
    this.state = reactive<EditorState>({
      schema,
      selectedIds: [],
      activeId: null,
      hoverId: null,
      platform: "desktop",
      device: DEVICE_PRESETS[0],
      ready: false,
      rightPanelVisible: true,
      designMode: "design",
      activeScene: inferInitialScene(schema),
    });
  }

  get schema(): any {
    return this.state.schema;
  }

  /** 更新 schemaOps 引用（场景切换时） */
  setSchemaOps(ops: ISchemaOps): void {
    this.schemaOps = ops;
  }

  setDevice(device: DevicePreset): void {
    this.state.device = device;
  }

  loadSchema(schema: any): void {
    const cloned = this.schemaOps.cloneSchema(schema);
    this.past = [];
    this.future = [];
    this.state.schema = cloned;
    this.schemaRef.value = cloned;
    this.state.activeId = null;
    this.state.selectedIds = [];
    // 若当前场景在新 schema 中不存在，回退到第一个场景
    if (!cloned || typeof cloned !== "object" || !(this.state.activeScene in cloned)) {
      this.state.activeScene = inferInitialScene(cloned);
    }
  }

  /** 切换激活场景（清空选区，不产生历史记录） */
  setActiveScene(name: string): void {
    this.state.activeScene = name;
    this.state.activeId = null;
    this.state.selectedIds = [];
  }

  /** 清空历史记录（场景增删后调用，从头累积） */
  clearHistory(): void {
    this.past = [];
    this.future = [];
  }

  commit(label: string, mutator: (schema: any) => void): any {
    if (!this.suspendHistory) {
      // pushHistory 克隆当前 schema 存为历史快照（变更前）
      this.pushHistory(label);
    }
    // 直接原地修改 reactive schema（省一次 cloneSchema）
    mutator(this.state.schema);
    // 强制触发 schemaRef 响应式更新（原地修改后引用未变，shallowRef 不自动通知）
    triggerRef(this.schemaRef);
    return this.state.schema;
  }

  batch(label: string, mutator: (schema: any) => void): void {
    this.suspendHistory = true;
    try {
      this.commit(label, mutator);
    } finally {
      this.suspendHistory = false;
      this.pushHistory(label);
    }
  }

  private pushHistory(label: string): void {
    this.past.push({ schema: this.schemaOps.cloneSchema(this.state.schema), label, timestamp: Date.now() });
    if (this.past.length > HISTORY_LIMIT) {
      this.past.shift();
    }
    this.future = [];
  }

  undo(): boolean {
    const entry = this.past.pop();
    if (!entry) {
      return false;
    }
    this.future.push({ schema: this.schemaOps.cloneSchema(this.state.schema), label: "redo", timestamp: Date.now() });
    this.state.schema = entry.schema;
    this.schemaRef.value = entry.schema;
    return true;
  }

  redo(): boolean {
    const entry = this.future.pop();
    if (!entry) {
      return false;
    }
    this.past.push({ schema: this.schemaOps.cloneSchema(this.state.schema), label: "undo", timestamp: Date.now() });
    this.state.schema = entry.schema;
    this.schemaRef.value = entry.schema;
    return true;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  get history(): readonly HistoryEntry[] {
    return this.past;
  }

  // ── 选区 ──

  select(id: string | null): void {
    this.state.activeId = id;
    this.state.selectedIds = id ? [id] : [];
  }

  toggleSelect(id: string): void {
    const idx = this.state.selectedIds.indexOf(id);
    if (idx >= 0) {
      this.state.selectedIds.splice(idx, 1);
      this.state.activeId = this.state.selectedIds[0] ?? null;
    } else {
      this.state.selectedIds.push(id);
      this.state.activeId = id;
    }
  }

  clearSelection(): void {
    this.state.activeId = null;
    this.state.selectedIds = [];
  }

  setHover(id: string | null): void {
    this.state.hoverId = id;
  }

  isSelected(id: string): boolean {
    return this.state.selectedIds.includes(id);
  }

  get activeNode(): any | undefined {
    return this.state.activeId ? this.schemaOps.getNodeById(this.state.schema, this.state.activeId) : undefined;
  }

  // ── 面板/模式 ──

  /** 右侧面板配置（插件 buildPanels 生成） */
  panels: any[] = [];

  setPanels(panels: any[]): void {
    this.panels = panels;
  }

  setReady(ready: boolean): void {
    this.state.ready = ready;
  }

  toggleRightPanel(visible?: boolean): void {
    this.state.rightPanelVisible = visible ?? !this.state.rightPanelVisible;
  }

  toggleDesignMode(): void {
    this.state.designMode = this.state.designMode === "design" ? "preview" : "design";
    if (this.state.designMode === "preview") {
      this.clearSelection();
    }
  }
}

export interface OutlineNode {
  id: string;
  label: string;
  type: string;
  children: OutlineNode[];
}

/** 用 schemaOps.walk 构建大纲树（格式无关） */
export function buildOutlineFromSchemaOps(schema: any, ops: ISchemaOps): OutlineNode[] {
  const roots: OutlineNode[] = [];
  const nodeMap = new Map<string, OutlineNode>();
  const childMap = new Map<string | null, OutlineNode[]>();

  ops.walk(schema, (node, parent) => {
    const id = ops.getNodeId(node);
    const outlineNode: OutlineNode = {
      id,
      label: ops.getNodeLabel(node),
      type: node?.__nodeOptions?.renderType ?? node?.type ?? "unknown",
      children: [],
    };
    nodeMap.set(id, outlineNode);
    const pid = parent ? ops.getNodeId(parent) : null;
    if (!childMap.has(pid)) {
      childMap.set(pid, []);
    }
    childMap.get(pid)!.push(outlineNode);
  });

  // 构建树
  for (const [pid, children] of childMap) {
    if (pid === null) {
      roots.push(...children);
    } else {
      const parent = nodeMap.get(pid);
      if (parent) {
        parent.children.push(...children);
      }
    }
  }

  return roots;
}

/** 用 schemaOps.walk 构建大纲树，按场景分组（多路由页面） */
export function buildOutlineGroupedByScene(
  schema: any,
  ops: ISchemaOps,
): OutlineNode[] {
  const sceneKeys = schema && typeof schema === "object" ? Object.keys(schema) : [];
  return sceneKeys.map((sceneName) => {
    const sceneData = schema[sceneName];
    const children = buildOutlineFromSchemaOps({ [sceneName]: sceneData } as any, ops);
    return {
      id: `__scene__${sceneName}`,
      label: sceneName,
      type: "scene",
      children,
    } as OutlineNode;
  });
}
