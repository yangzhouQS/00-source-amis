/**
 * DataSourceDocument 状态管理（插件核心 composable）
 * - reactive 文档镜像 + 独立快照历史（上限 30，与 schema 撤销栈隔离）
 * - commit → 防抖 300ms flush：editor.dataSource 引用替换 + 画布热更新（可选通道）+ ds:changed 事件
 * - 实例按 Editor 缓存（WeakMap），面板组件经 useDataSourceDoc(editor) 取同一实例
 */
import type { Editor } from "../../../core/editor";
import { reactive, ref, type Ref } from "vue";
import type { DsDocument, DsHostOptions } from "./types";
import { buildDoc, cloneDoc } from "./normalize";

const HISTORY_LIMIT = 30;
const FLUSH_DEBOUNCE = 300;

/** 数据源变更事件名（插件命名空间规范：ds:*） */
export const DS_CHANGED_EVENT = "ds:changed";

export interface DsDocHandle {
  /** reactive 文档（组件直接响应式读取） */
  readonly state: DsDocument;
  readonly canUndo: Ref<boolean>;
  readonly canRedo: Ref<boolean>;
  /** 宿主选项（fetchModels 等，setup 时注入） */
  readonly hostOptions: Ref<DsHostOptions>;
  setHostOptions(options: DsHostOptions): void;
  /** 提交一次编辑（先压历史快照，再执行变更，再调度 flush） */
  commit(label: string, mutator: (doc: DsDocument) => void): void;
  undo(): void;
  redo(): void;
  /** 立即落地（保存前可调用） */
  flush(): void;
  dispose(): void;
}

interface Snapshot {
  label: string;
  doc: DsDocument;
}

function createDocHandle(editor: Editor): DsDocHandle {
  const state = reactive<DsDocument>(buildDoc(editor.dataSource));
  const canUndo = ref(false);
  const canRedo = ref(false);
  const hostOptions = ref<DsHostOptions>({});

  let past: Snapshot[] = [];
  let future: Snapshot[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const updateFlags = () => {
    canUndo.value = past.length > 0;
    canRedo.value = future.length > 0;
  };

  /** 快照就地应用（保持 state 引用稳定，reactive 深转换） */
  const applyDoc = (snap: DsDocument): void => {
    for (const key of Object.keys(state)) {
      delete (state as any)[key];
    }
    Object.assign(state, cloneDoc(snap));
  };

  const pushHistory = (label: string) => {
    past.push({ label, doc: cloneDoc(state) });
    if (past.length > HISTORY_LIMIT) {
      past.shift();
    }
    future = [];
  };

  const flushNow = () => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    const snapshot = cloneDoc(state);
    editor.dataSource = snapshot;
    // 画布热更新通道（内核 P0 前置改造提供；未实现时静默降级）
    (editor.renderer as any)?.setRuntimeConfig?.({ dataSource: cloneDoc(state) });
    editor.bus.trigger(DS_CHANGED_EVENT, { dataSource: snapshot });
  };

  const scheduleFlush = () => {
    if (flushTimer) {
      clearTimeout(flushTimer);
    }
    flushTimer = setTimeout(flushNow, FLUSH_DEBOUNCE);
  };

  const handle: DsDocHandle = {
    state,
    canUndo,
    canRedo,
    hostOptions,
    setHostOptions(options) {
      hostOptions.value = options;
    },
    commit(label, mutator) {
      pushHistory(label);
      mutator(state);
      updateFlags();
      scheduleFlush();
    },
    undo() {
      const entry = past.pop();
      if (!entry) {
        return;
      }
      future.push({ label: entry.label, doc: cloneDoc(state) });
      applyDoc(entry.doc);
      updateFlags();
      scheduleFlush();
    },
    redo() {
      const entry = future.pop();
      if (!entry) {
        return;
      }
      past.push({ label: entry.label, doc: cloneDoc(state) });
      applyDoc(entry.doc);
      updateFlags();
      scheduleFlush();
    },
    flush: flushNow,
    dispose() {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
        try {
          flushNow();
        }
        catch {
          /* 销毁期 flush 失败忽略 */
        }
      }
      past = [];
      future = [];
      updateFlags();
    },
  };

  return handle;
}

/** 按 Editor 缓存文档实例（多面板/多组件共享同一状态） */
const docCache = new WeakMap<Editor, DsDocHandle>();

export function useDataSourceDoc(editor: Editor): DsDocHandle {
  let handle = docCache.get(editor);
  if (!handle) {
    handle = createDocHandle(editor);
    docCache.set(editor, handle);
  }
  return handle;
}

/** 主动注销（插件 dispose 时调用，下次访问将重建） */
export function evictDataSourceDoc(editor: Editor): void {
  docCache.delete(editor);
}
