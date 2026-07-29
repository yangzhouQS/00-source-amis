/**
 * 响应式 Store（基于 Vue reactive）
 * 借鉴 amis-editor-core 的 MST MainStore 设计：schema + selection + history + panels 统一
 * 单一变更入口 commit()，自动记录历史
 */
import {reactive, computed, shallowRef} from 'vue';
import type {
  PageSchema,
  PageNode,
  NodeId,
  PanelItem,
  ToolbarItem
} from '../schema/types';
import * as ops from '../schema/operations';

const HISTORY_LIMIT = 50;

export interface HistoryEntry {
  schema: PageSchema;
  /** 触发来源描述 */
  label: string;
  timestamp: number;
}

/** 画布设备预设（尺寸预览） */
export interface DevicePreset {
  key: string;
  label: string;
  /** 画布宽度（px），null = 100% 自适应 */
  width: number | null;
}

/** 内置设备预设 */
export const DEVICE_PRESETS: DevicePreset[] = [
  {key: 'default', label: '默认', width: null},
  {key: 'tablet', label: '平板', width: 768},
  {key: 'phone', label: '手机', width: 375}
];

export interface EditorState {
  schema: PageSchema;
  selectedIds: NodeId[];
  activeId: NodeId | null;
  hoverId: NodeId | null;
  panels: PanelItem[];
  toolbars: ToolbarItem[];
  platform: 'desktop' | 'mobile';
  /** 画布设备预设（尺寸预览） */
  device: DevicePreset;
  ready: boolean;
  /** 右侧面板可见性 */
  rightPanelVisible: boolean;
  /** 设计/预览模式 */
  designMode: 'design' | 'preview';
}

export class EditorStore {
  readonly state: EditorState;

  private past: HistoryEntry[] = [];
  private future: HistoryEntry[] = [];
  /** 暂停历史记录（批量操作时） */
  private suspendHistory = false;
  /** schema 引用（shallowRef，避免深度响应式开销，通过 commit 触发更新） */
  readonly schemaRef = shallowRef<PageSchema>(createEmptySchema());

  constructor(initial?: PageSchema) {
    const schema = initial ? ops.cloneSchema(initial) : createEmptySchema();
    ops.ensureIds(schema);
    this.schemaRef.value = schema;
    this.state = reactive<EditorState>({
      schema,
      selectedIds: [],
      activeId: null,
      hoverId: null,
      panels: [],
      toolbars: [],
      platform: 'desktop',
      device: DEVICE_PRESETS[0],
      ready: false,
      rightPanelVisible: true,
      designMode: 'design'
    });
  }

  /** 当前 schema（响应式） */
  get schema(): PageSchema {
    return this.state.schema;
  }

  /** 设置画布设备预设（尺寸预览） */
  setDevice(device: DevicePreset): void {
    this.state.device = device;
  }

  /** 加载 schema（重置历史） */
  loadSchema(schema: PageSchema): void {
    const cloned = ops.cloneSchema(schema);
    ops.ensureIds(cloned);
    this.past = [];
    this.future = [];
    this.state.schema = cloned;
    this.schemaRef.value = cloned;
    this.state.activeId = null;
    this.state.selectedIds = [];
  }

  /**
   * 单一变更入口
   * @param label 变更描述（历史记录用）
   * @param mutator 变更函数（操作 schema 副本）
   * @returns 变更后的 schema
   */
  commit(label: string, mutator: (schema: PageSchema) => void): PageSchema {
    // 记录变更前快照
    if (!this.suspendHistory) {
      this.pushHistory(label);
    }
    const next = ops.cloneSchema(this.state.schema);
    mutator(next);
    ops.ensureIds(next);
    this.state.schema = next;
    this.schemaRef.value = next;
    return next;
  }

  /** 批量变更（合并为一条历史） */
  batch(label: string, mutator: (schema: PageSchema) => void): void {
    this.suspendHistory = true;
    try {
      this.commit(label, mutator);
    } finally {
      this.suspendHistory = false;
      // 批量结束后真正入栈一条
      this.pushHistory(label);
    }
  }

  private pushHistory(label: string): void {
    this.past.push({
      schema: ops.cloneSchema(this.state.schema),
      label,
      timestamp: Date.now()
    });
    if (this.past.length > HISTORY_LIMIT) this.past.shift();
    this.future = [];
  }

  /** 撤销 */
  undo(): boolean {
    const entry = this.past.pop();
    if (!entry) return false;
    this.future.push({
      schema: ops.cloneSchema(this.state.schema),
      label: 'redo',
      timestamp: Date.now()
    });
    this.state.schema = entry.schema;
    this.schemaRef.value = entry.schema;
    return true;
  }

  /** 重做 */
  redo(): boolean {
    const entry = this.future.pop();
    if (!entry) return false;
    this.past.push({
      schema: ops.cloneSchema(this.state.schema),
      label: 'undo',
      timestamp: Date.now()
    });
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

  // --------------------- 选区 ---------------------

  select(id: NodeId | null): void {
    this.state.activeId = id;
    this.state.selectedIds = id ? [id] : [];
  }

  toggleSelect(id: NodeId): void {
    const set = new Set(this.state.selectedIds);
    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
    }
    this.state.selectedIds = Array.from(set);
    this.state.activeId =
      this.state.selectedIds[this.state.selectedIds.length - 1] ?? null;
  }

  clearSelection(): void {
    this.state.activeId = null;
    this.state.selectedIds = [];
  }

  setHover(id: NodeId | null): void {
    this.state.hoverId = id;
  }

  /** 获取活动节点 */
  get activeNode(): PageNode | undefined {
    return this.state.activeId
      ? ops.getNodeById(this.state.schema, this.state.activeId)
      : undefined;
  }

  /** 是否选中 */
  isSelected(id: NodeId): boolean {
    return this.state.selectedIds.includes(id);
  }

  // --------------------- 面板/工具栏 ---------------------

  setPanels(panels: PanelItem[]): void {
    this.state.panels = panels;
  }

  setToolbars(toolbars: ToolbarItem[]): void {
    this.state.toolbars = toolbars;
  }

  setReady(ready: boolean): void {
    this.state.ready = ready;
  }

  toggleRightPanel(visible?: boolean): void {
    this.state.rightPanelVisible = visible ?? !this.state.rightPanelVisible;
  }

  /** 切换设计/预览模式 */
  toggleDesignMode(): void {
    this.state.designMode =
      this.state.designMode === 'design' ? 'preview' : 'design';
    if (this.state.designMode === 'preview') {
      this.clearSelection();
    }
  }

  /** schema 节点总数（大纲等用） */
  get nodeCount(): number {
    let count = 0;
    const walk = (node: PageNode) => {
      count++;
      ops.getChildren(node).forEach(walk);
    };
    walk(this.state.schema);
    return count;
  }

  /** 大纲树（computed） */
  readonly outline = computed(() => buildOutline(this.state.schema));
}

/** 创建空 schema */
export function createEmptySchema(): PageSchema {
  return {
    type: 'page',
    $$id: 'root',
    body: []
  };
}

/** 大纲节点 */
export interface OutlineNode {
  id: NodeId;
  label: string;
  type: string;
  children: OutlineNode[];
}

function buildOutline(node: PageNode): OutlineNode {
  return {
    id: node.$$id,
    label: ops.getNodeLabel(node),
    type: node.type,
    children: ops.getChildren(node).map(buildOutline)
  };
}
