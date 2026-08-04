import type { ISchemaOps } from '../../scenario/types';
import { createPcEmptySchema } from './empty-schema';
import { lookupSlotGate, type SlotField, type SlotHost } from '@cs/assembox-desktop-next';

let counter = 0;
function shortId(): string {
  counter += 1;
  return `${Date.now().toString(36)}${counter.toString(36)}`;
}

const SLOT_FIELDS: string[] = [
  'defaultSlot', 'toolSlot', 'filterSlot', 'headerSlot',
  'bottomSlot', 'labelSlot', 'rightSlot', 'columRender', 'buttonOption'
];

const SLOT_LABELS: Record<string, string> = {
  defaultSlot: '内容区',
  toolSlot: '工具栏',
  filterSlot: '筛选项',
  headerSlot: '头部',
  bottomSlot: '底部',
  labelSlot: '标签',
  rightSlot: '右侧',
  columRender: '单元格',
  buttonOption: '按钮项'
};

export class PcSchemaOps implements ISchemaOps {
  getNodeId(node: any): string {
    return node?.__nodeId ?? '';
  }

  setNodeId(node: any, id: string): void {
    if (node) node.__nodeId = id;
  }

  genNodeId(type: string): string {
    return `${type}::${shortId()}`;
  }

  getNodeLabel(node: any): string {
    return node?.__nodeName || node?.__nodeOptions?.renderType || '未命名';
  }

  getNodeById(schema: any, id: string): any | undefined {
    let found: any | undefined;
    this.walk(schema, (node) => {
      if (this.getNodeId(node) === id) found = node;
    });
    return found;
  }

  getParentById(schema: any, id: string): any | undefined {
    let parent: any | undefined;
    this.walk(schema, (node, p) => {
      if (this.getNodeId(node) === id) parent = p;
    });
    return parent;
  }

  walk(schema: any, visitor: (node: any, parent: any | null, slotKey: string) => void): void {
    const walkNode = (node: any, parent: any | null, slotKey: string): void => {
      if (!node || typeof node !== 'object') return;
      visitor(node, parent, slotKey);

      const opts = node.__nodeOptions;
      if (!opts) return;

      for (const field of SLOT_FIELDS) {
        const val = opts[field];
        if (Array.isArray(val)) {
          val.forEach((child: any) => walkNode(child, node, field));
        } else if (val && typeof val === 'object' && val.__nodeType) {
          walkNode(val, node, field);
        }
      }

      if (Array.isArray(opts.itemConfig)) {
        opts.itemConfig.forEach((item: any) => {
          if (item?.defaultSlot) {
            walkNode(item.defaultSlot, node, 'defaultSlot');
          }
        });
      }
    };

    const scenes = Object.values(schema || {});
    for (const scene of scenes) {
      const root = (scene as any)?.viewsProps?.planeOptions;
      if (root) walkNode(root, null, 'defaultSlot');
    }
  }

  getSlots(node: any): { key: string; label: string }[] {
    const renderType = node?.__nodeOptions?.renderType;
    if (!renderType) return [];
    return SLOT_FIELDS
      .filter(field => {
        const val = node?.__nodeOptions?.[field];
        return val !== undefined && val !== null;
      })
      .map(key => ({ key, label: SLOT_LABELS[key] ?? key }));
  }

  getSlotChildren(parentNode: any, slotKey: string): any[] {
    const opts = parentNode?.__nodeOptions;
    if (!opts) return [];

    if (slotKey === 'defaultSlot' && Array.isArray(opts.itemConfig)) {
      const children: any[] = [];
      opts.itemConfig.forEach((item: any) => {
        if (item?.defaultSlot) {
          if (Array.isArray(item.defaultSlot)) children.push(...item.defaultSlot);
          else children.push(item.defaultSlot);
        }
      });
      return children;
    }

    const val = opts[slotKey];
    if (!val) return [];
    return Array.isArray(val) ? val : [val];
  }

  insertNode(schema: any, parentId: string, slotKey: string, node: any, index?: number): any | undefined {
    const parent = this.getNodeById(schema, parentId);
    if (!parent) return undefined;
    const opts = parent.__nodeOptions;
    if (!opts) return undefined;

    if (slotKey === 'defaultSlot' && Array.isArray(opts.itemConfig)) {
      const item = opts.itemConfig.find((it: any) => it?.defaultSlot === null || it?.defaultSlot === undefined);
      if (item) {
        item.defaultSlot = node;
        return node;
      }
      opts.itemConfig.push({ isFixed: false, paddingSize: 'base', clearPadding: [], isHidden: false, contentType: 'container', defaultSlot: node });
      return node;
    }

    if (!opts[slotKey]) opts[slotKey] = [];
    if (!Array.isArray(opts[slotKey])) opts[slotKey] = [opts[slotKey]];
    const arr = opts[slotKey];
    const at = index === undefined ? arr.length : Math.max(0, Math.min(index, arr.length));
    arr.splice(at, 0, node);
    return node;
  }

  removeNode(schema: any, nodeId: string): any | undefined {
    const parent = this.getParentById(schema, nodeId);
    if (!parent) return undefined;
    const opts = parent.__nodeOptions;
    if (!opts) return undefined;

    for (const field of SLOT_FIELDS) {
      const val = opts[field];
      if (Array.isArray(val)) {
        const idx = val.findIndex((c: any) => this.getNodeId(c) === nodeId);
        if (idx >= 0) return val.splice(idx, 1)[0];
      } else if (val && this.getNodeId(val) === nodeId) {
        opts[field] = null;
        return val;
      }
    }

    if (Array.isArray(opts.itemConfig)) {
      for (const item of opts.itemConfig) {
        if (item?.defaultSlot) {
          if (Array.isArray(item.defaultSlot)) {
            const idx = item.defaultSlot.findIndex((c: any) => this.getNodeId(c) === nodeId);
            if (idx >= 0) return item.defaultSlot.splice(idx, 1)[0];
          } else if (this.getNodeId(item.defaultSlot) === nodeId) {
            const removed = item.defaultSlot;
            item.defaultSlot = null;
            return removed;
          }
        }
      }
    }
    return undefined;
  }

  moveNode(schema: any, nodeId: string, toParentId: string, slotKey: string, index?: number): boolean {
    const removed = this.removeNode(schema, nodeId);
    if (!removed) return false;
    this.insertNode(schema, toParentId, slotKey, removed, index);
    return true;
  }

  updateNode(schema: any, nodeId: string, patch: any): any | undefined {
    const node = this.getNodeById(schema, nodeId);
    if (!node) return undefined;
    if (patch.__nodeOptions) Object.assign(node.__nodeOptions, patch.__nodeOptions);
    if (patch.__nodeEvent) Object.assign(node.__nodeEvent, patch.__nodeEvent);
    if (patch.__nodeStyle) node.__nodeStyle = { ...(node.__nodeStyle || {}), ...patch.__nodeStyle };
    if (patch.__nodeName !== undefined) node.__nodeName = patch.__nodeName;
    return node;
  }

  cloneNode(node: any): any {
    return this.cloneSchema(node);
  }

  cloneSchema(schema: any): any {
    return JSON.parse(JSON.stringify(schema));
  }

  createNode(renderType: string, nodeName: string, overrides?: any): any {
    return {
      __nodeName: nodeName,
      __nodeId: this.genNodeId(renderType),
      __nodeType: 'renderNode',
      __nodeEvent: {},
      __nodeOptions: { renderType, ...overrides },
      __nodeStyle: {},
      __nodeProps: null
    };
  }

  emptySchema(): any {
    return createPcEmptySchema();
  }

  /** 判断节点是否为容器（有槽位可投放子节点） */
  isContainer(node: any): boolean {
    const renderType = node?.__nodeOptions?.renderType;
    if (!renderType) return false;
    const gate = lookupSlotGate(renderType as SlotHost, 'defaultSlot' as SlotField);
    return gate !== undefined;
  }

  /** 找到 nodeId 所在的父节点 + 槽位键 + 索引（供 paste/duplicate/moveUp/moveDown） */
  findSlotOf(schema: any, nodeId: string): { parentId: string; slotKey: string; index: number } | undefined {
    let result: { parentId: string; slotKey: string; index: number } | undefined;
    this.walk(schema, (node) => {
      if (result) return;
      const opts = node?.__nodeOptions;
      if (!opts) return;
      for (const field of SLOT_FIELDS) {
        const val = opts[field];
        if (Array.isArray(val)) {
          const idx = val.findIndex((c: any) => this.getNodeId(c) === nodeId);
          if (idx >= 0) { result = { parentId: this.getNodeId(node), slotKey: field, index: idx }; return; }
        } else if (val && this.getNodeId(val) === nodeId) {
          result = { parentId: this.getNodeId(node), slotKey: field, index: 0 }; return;
        }
      }
      if (Array.isArray(opts.itemConfig)) {
        for (let i = 0; i < opts.itemConfig.length; i++) {
          const item = opts.itemConfig[i];
          if (item?.defaultSlot) {
            if (Array.isArray(item.defaultSlot)) {
              const idx = item.defaultSlot.findIndex((c: any) => this.getNodeId(c) === nodeId);
              if (idx >= 0) { result = { parentId: this.getNodeId(node), slotKey: 'defaultSlot', index: idx }; return; }
            } else if (this.getNodeId(item.defaultSlot) === nodeId) {
              result = { parentId: this.getNodeId(node), slotKey: 'defaultSlot', index: i }; return;
            }
          }
        }
      }
    });
    return result;
  }

  /** 上移节点（在所在槽位中前移一位） */
  moveNodeUp(schema: any, nodeId: string): boolean {
    const loc = this.findSlotOf(schema, nodeId);
    if (!loc || loc.index <= 0) return false;
    const parent = this.getNodeById(schema, loc.parentId);
    if (!parent) return false;
    const opts = parent.__nodeOptions;
    if (!opts) return false;
    const arr = opts[loc.slotKey];
    if (Array.isArray(arr) && loc.index > 0) {
      [arr[loc.index - 1], arr[loc.index]] = [arr[loc.index], arr[loc.index - 1]];
      return true;
    }
    return false;
  }

  /** 下移节点（在所在槽位中后移一位） */
  moveNodeDown(schema: any, nodeId: string): boolean {
    const loc = this.findSlotOf(schema, nodeId);
    if (!loc) return false;
    const parent = this.getNodeById(schema, loc.parentId);
    if (!parent) return false;
    const opts = parent.__nodeOptions;
    if (!opts) return false;
    const arr = opts[loc.slotKey];
    if (Array.isArray(arr) && loc.index < arr.length - 1) {
      [arr[loc.index + 1], arr[loc.index]] = [arr[loc.index], arr[loc.index + 1]];
      return true;
    }
    return false;
  }
}
