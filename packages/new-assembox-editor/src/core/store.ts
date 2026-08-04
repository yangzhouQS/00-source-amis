/**
 * 响应式 Store（基于 Vue reactive）
 * v2: 去除 amis 依赖，schema 类型为 any，操作委托给 schemaOps
 */
import {reactive, computed, shallowRef} from 'vue';
import type {ISchemaOps} from '../scenario/types';

const HISTORY_LIMIT = 50;

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
  {key: 'default', label: '默认', width: null},
  {key: 'tablet', label: '平板', width: 768},
  {key: 'phone', label: '手机', width: 375}
];

export interface EditorState {
  schema: any;
  selectedIds: string[];
  activeId: string | null;
  hoverId: string | null;
  platform: 'desktop' | 'mobile';
  device: DevicePreset;
  ready: boolean;
  rightPanelVisible: boolean;
  designMode: 'design' | 'preview';
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
      platform: 'desktop',
      device: DEVICE_PRESETS[0],
      ready: false,
      rightPanelVisible: true,
      designMode: 'design'
    });
  }

  get schema(): any { return this.state.schema; }

  /** 更新 schemaOps 引用（场景切换时） */
  setSchemaOps(ops: ISchemaOps): void { this.schemaOps = ops; }

  setDevice(device: DevicePreset): void { this.state.device = device; }

  loadSchema(schema: any): void {
    const cloned = this.schemaOps.cloneSchema(schema);
    this.past = [];
    this.future = [];
    this.state.schema = cloned;
    this.schemaRef.value = cloned;
    this.state.activeId = null;
    this.state.selectedIds = [];
  }

  commit(label: string, mutator: (schema: any) => void): any {
    if (!this.suspendHistory) this.pushHistory(label);
    const next = this.schemaOps.cloneSchema(this.state.schema);
    mutator(next);
    this.state.schema = next;
    this.schemaRef.value = next;
    return next;
  }

  batch(label: string, mutator: (schema: any) => void): void {
    this.suspendHistory = true;
    try { this.commit(label, mutator); } finally {
      this.suspendHistory = false;
      this.pushHistory(label);
    }
  }

  private pushHistory(label: string): void {
    this.past.push({ schema: this.schemaOps.cloneSchema(this.state.schema), label, timestamp: Date.now() });
    if (this.past.length > HISTORY_LIMIT) this.past.shift();
    this.future = [];
  }

  undo(): boolean {
    const entry = this.past.pop();
    if (!entry) return false;
    this.future.push({ schema: this.schemaOps.cloneSchema(this.state.schema), label: 'redo', timestamp: Date.now() });
    this.state.schema = entry.schema;
    this.schemaRef.value = entry.schema;
    return true;
  }

  redo(): boolean {
    const entry = this.future.pop();
    if (!entry) return false;
    this.past.push({ schema: this.schemaOps.cloneSchema(this.state.schema), label: 'undo', timestamp: Date.now() });
    this.state.schema = entry.schema;
    this.schemaRef.value = entry.schema;
    return true;
  }

  get canUndo(): boolean { return this.past.length > 0; }
  get canRedo(): boolean { return this.future.length > 0; }
  get history(): readonly HistoryEntry[] { return this.past; }

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

  clearSelection(): void { this.state.activeId = null; this.state.selectedIds = []; }
  setHover(id: string | null): void { this.state.hoverId = id; }
  isSelected(id: string): boolean { return this.state.selectedIds.includes(id); }

  get activeNode(): any | undefined {
    return this.state.activeId ? this.schemaOps.getNodeById(this.state.schema, this.state.activeId) : undefined;
  }

  // ── 面板/模式 ──

  /** 右侧面板配置（插件 buildPanels 生成） */
  panels: any[] = [];

  setPanels(panels: any[]): void { this.panels = panels; }

  setReady(ready: boolean): void { this.state.ready = ready; }
  toggleRightPanel(visible?: boolean): void { this.state.rightPanelVisible = visible ?? !this.state.rightPanelVisible; }

  toggleDesignMode(): void {
    this.state.designMode = this.state.designMode === 'design' ? 'preview' : 'design';
    if (this.state.designMode === 'preview') this.clearSelection();
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
      type: node?.__nodeOptions?.renderType ?? node?.type ?? 'unknown',
      children: []
    };
    nodeMap.set(id, outlineNode);
    const pid = parent ? ops.getNodeId(parent) : null;
    if (!childMap.has(pid)) childMap.set(pid, []);
    childMap.get(pid)!.push(outlineNode);
  });

  // 构建树
  for (const [pid, children] of childMap) {
    if (pid === null) {
      roots.push(...children);
    } else {
      const parent = nodeMap.get(pid);
      if (parent) parent.children.push(...children);
    }
  }

  return roots;
}
