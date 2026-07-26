import { defineStore } from 'pinia';
import {
  assignByPath,
  assignIds,
  getByPath,
  insertChild,
  removeByPath,
  cloneSchema,
  generateEid,
  getParent
} from '@/core/schema-utils';
import type { AmisSchema } from '@/types/schema';

const HISTORY_LIMIT = 50;

function createDefaultSchema(): AmisSchema {
  return assignIds({
    type: 'page',
    title: '新页面',
    body: [
      {
        type: 'tpl',
        tpl: '欢迎使用 amis 可视化编辑器（Vue 版）',
        wrapperComponent: 'h2'
      },
      {
        type: 'form',
        title: '示例表单',
        body: [
          { type: 'input-text', name: 'username', label: '用户名' },
          { type: 'input-email', name: 'email', label: '邮箱' }
        ]
      }
    ]
  });
}

interface HistoryState {
  past: string[];
  future: string[];
}

export const useEditorStore = defineStore('editor', {
  state: () => ({
    schema: createDefaultSchema() as AmisSchema,
    selectedPath: '' as string | null,
    activeLeftTab: 'components' as 'components' | 'outline',
    activeRightTab: 'property' as 'property' | 'events',
    sourceVisible: true,
    amisVersion: '6.13.0',
    history: { past: [], future: [] } as HistoryState
  }),

  getters: {
    selectedNode(state): AmisSchema | undefined {
      return getByPath(state.schema, state.selectedPath);
    },
    canUndo(state): boolean {
      return state.history.past.length > 0;
    },
    canRedo(state): boolean {
      return state.history.future.length > 0;
    }
  },

  actions: {
    /** 提交一次变更到历史栈（在变更前调用） */
    commit() {
      this.history.past.push(JSON.stringify(this.schema));
      if (this.history.past.length > HISTORY_LIMIT) {
        this.history.past.shift();
      }
      this.history.future = [];
    },

    /** 整体替换 schema（用于源码面板回写） */
    setSchema(schema: AmisSchema, record = true) {
      if (record) this.commit();
      this.schema = assignIds(cloneSchema(schema));
    },

    select(path: string | null) {
      this.selectedPath = path;
    },

    updateNode(path: string, patch: Record<string, any>) {
      this.commit();
      assignByPath(this.schema, path, patch);
    },

    /**
     * 在父节点 region 区域插入节点，并自动选中新增节点。
     * @param parentPath '' 表示根节点的直接区域
     * @returns 新增节点的路径
     */
    insertNode(
      parentPath: string,
      region: string,
      node: AmisSchema,
      index?: number
    ): string | undefined {
      const parent = getByPath(this.schema, parentPath);
      if (!parent) return;
      const withId = assignIds(cloneSchema(node));
      const arr = (parent as any)[region];
      const at = typeof index === 'number' ? index : Array.isArray(arr) ? arr.length : 0;
      this.commit();
      insertChild(parent, region, withId, at);
      const newPath = `${parentPath ? parentPath + '.' : ''}${region}.${at}`;
      this.selectedPath = newPath;
      return newPath;
    },

    removeNode(path: string) {
      this.commit();
      const ok = removeByPath(this.schema, path);
      if (ok && this.selectedPath === path) {
        this.selectedPath = '';
      }
    },

    /** 复制指定路径节点到其同级末尾 */
    duplicateNode(path: string) {
      const info = getParent(this.schema, path);
      const node = getByPath(this.schema, path);
      if (!info || !node) return;
      this.commit();
      const copy = assignIds(cloneSchema(node));
      if (Array.isArray(info.parent)) {
        const idx = Number(info.key);
        info.parent.splice(idx + 1, 0, copy);
      }
    },

    /** 上移/下移节点（同级数组内） */
    moveNode(path: string, direction: -1 | 1) {
      const info = getParent(this.schema, path);
      if (!info || !Array.isArray(info.parent)) return;
      const idx = Number(info.key);
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= info.parent.length) return;
      this.commit();
      const [moved] = (info.parent as unknown as AmisSchema[]).splice(idx, 1);
      (info.parent as unknown as AmisSchema[]).splice(newIdx, 0, moved);
      const segs = path.split('.');
      segs.pop();
      this.selectedPath = `${segs.join('.')}.${newIdx}`;
    },

    undo() {
      if (!this.history.past.length) return;
      this.history.future.unshift(JSON.stringify(this.schema));
      const prev = this.history.past.pop()!;
      this.schema = JSON.parse(prev);
    },

    redo() {
      if (!this.history.future.length) return;
      this.history.past.push(JSON.stringify(this.schema));
      const next = this.history.future.shift()!;
      this.schema = JSON.parse(next);
    },

    /** 导出干净的 amis 源码（剥离编辑器字段） */
    exportSchema(): AmisSchema {
      const clone = cloneSchema(this.schema);
      const strip = (node: any) => {
        if (node && typeof node === 'object') {
          delete node.$$eid;
          for (const k of Object.keys(node)) {
            if (Array.isArray(node[k])) node[k].forEach(strip);
            else if (node[k] && typeof node[k] === 'object') strip(node[k]);
          }
        }
      };
      strip(clone);
      return clone;
    }
  }
});

export { generateEid };
