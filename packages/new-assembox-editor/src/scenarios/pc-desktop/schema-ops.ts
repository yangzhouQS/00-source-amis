import type { SlotField, SlotHost } from "@cs/assembox-desktop-next";
import type { ISchemaOps } from "../../scenario/types";
import { lookupSlotGate } from "@cs/assembox-desktop-next";
import { createPcEmptySchema } from "./empty-schema";
import {
  DOCUMENT_ARRAYS,
  forEachChild,
  getNodeSlots,
  getSlotChildrenList,
  insertChildIntoOpts,
  isNode,
  locateChild,
  removeChildFromOpts,
} from "./slot-accessors";

let counter = 0;
function shortId(): string {
  counter += 1;
  return `${Date.now().toString(36)}${counter.toString(36)}`;
}

export class PcSchemaOps implements ISchemaOps {
  getNodeId(node: any): string {
    return node?.__nodeId ?? "";
  }

  setNodeId(node: any, id: string): void {
    if (node) {
      node.__nodeId = id;
    }
  }

  genNodeId(type: string): string {
    return `${type}::${shortId()}`;
  }

  getNodeLabel(node: any): string {
    return node?.__nodeName || node?.__nodeOptions?.renderType || "未命名";
  }

  getNodeById(schema: any, id: string): any | undefined {
    let found: any | undefined;
    this.walk(schema, (node) => {
      if (this.getNodeId(node) === id) {
        found = node;
      }
    });
    return found;
  }

  getParentById(schema: any, id: string): any | undefined {
    let parent: any | undefined;
    this.walk(schema, (node, p) => {
      if (this.getNodeId(node) === id) {
        parent = p;
      }
    });
    return parent;
  }

  walk(schema: any, visitor: (node: any, parent: any | null, slotKey: string) => void): void {
    const walkNode = (node: any, parent: any | null, slotKey: string): void => {
      if (!isNode(node)) {
        return;
      }
      visitor(node, parent, slotKey);
      forEachChild(node, (child, key) => walkNode(child, node, key));
    };

    const scenes = Object.values(schema || {});
    for (const scene of scenes) {
      const vp = (scene as any)?.viewsProps;
      if (!vp) {
        continue;
      }
      if (vp.planeOptions) {
        walkNode(vp.planeOptions, null, "defaultSlot");
      }
      for (const docArr of DOCUMENT_ARRAYS) {
        if (Array.isArray(vp[docArr])) {
          for (const doc of vp[docArr]) {
            walkNode(doc, null, "defaultSlot");
          }
        }
      }
    }
  }

  getSlots(node: any): { key: string; label: string }[] {
    return getNodeSlots(node);
  }

  getSlotChildren(parentNode: any, slotKey: string): any[] {
    const opts = parentNode?.__nodeOptions;
    if (!opts) {
      return [];
    }
    return getSlotChildrenList(opts, slotKey);
  }

  insertNode(schema: any, parentId: string, slotKey: string, node: any, index?: number): any | undefined {
    const parent = this.getNodeById(schema, parentId);
    if (!parent?.__nodeOptions) {
      return undefined;
    }
    return insertChildIntoOpts(parent.__nodeOptions, slotKey, node, index, shortId);
  }

  removeNode(schema: any, nodeId: string): any | undefined {
    const parent = this.getParentById(schema, nodeId);
    if (!parent?.__nodeOptions) {
      return undefined;
    }
    return removeChildFromOpts(parent.__nodeOptions, nodeId, n => this.getNodeId(n));
  }

  moveNode(schema: any, nodeId: string, toParentId: string, slotKey: string, index?: number): boolean {
    const removed = this.removeNode(schema, nodeId);
    if (!removed) {
      return false;
    }
    this.insertNode(schema, toParentId, slotKey, removed, index);
    return true;
  }

  updateNode(schema: any, nodeId: string, patch: any): any | undefined {
    const node = this.getNodeById(schema, nodeId);
    if (!node) {
      return undefined;
    }
    if (patch.__nodeOptions) {
      Object.assign(node.__nodeOptions, patch.__nodeOptions);
    }
    if (patch.__nodeEvent) {
      Object.assign(node.__nodeEvent, patch.__nodeEvent);
    }
    if (patch.__nodeStyle) {
      node.__nodeStyle = { ...(node.__nodeStyle || {}), ...patch.__nodeStyle };
    }
    if (patch.__nodeName !== undefined) {
      node.__nodeName = patch.__nodeName;
    }
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
      __nodeType: "renderNode",
      __nodeEvent: {},
      __nodeOptions: { renderType, ...overrides },
      __nodeStyle: {},
      __nodeProps: null,
    };
  }

  emptySchema(): any {
    return createPcEmptySchema();
  }

  /** 判断节点是否为容器（有槽位可投放子节点） */
  isContainer(node: any): boolean {
    const renderType = node?.__nodeOptions?.renderType;
    if (!renderType) {
      return false;
    }
    const gate = lookupSlotGate(renderType as SlotHost, "defaultSlot" as SlotField);
    return gate !== undefined;
  }

  /** 找到 nodeId 所在的父节点 + 槽位键 + 索引（供 paste/duplicate/moveUp/moveDown） */
  findSlotOf(schema: any, nodeId: string): { parentId: string; slotKey: string; index: number } | undefined {
    let result: { parentId: string; slotKey: string; index: number } | undefined;
    this.walk(schema, (node) => {
      if (result) {
        return;
      }
      const opts = node?.__nodeOptions;
      if (!opts) {
        return;
      }
      const loc = locateChild(opts, nodeId, n => this.getNodeId(n));
      if (loc) {
        result = { parentId: this.getNodeId(node), slotKey: loc.slotKey, index: loc.index };
      }
    });
    return result;
  }

  /** 上移节点（在所在槽位中前移一位） */
  moveNodeUp(schema: any, nodeId: string): boolean {
    const parent = this.getParentById(schema, nodeId);
    if (!parent?.__nodeOptions) {
      return false;
    }
    const loc = locateChild(parent.__nodeOptions, nodeId, n => this.getNodeId(n));
    if (!loc?.swapArr || loc.index <= 0) {
      return false;
    }
    const arr = loc.swapArr;
    [arr[loc.index - 1], arr[loc.index]] = [arr[loc.index], arr[loc.index - 1]];
    return true;
  }

  /** 下移节点（在所在槽位中后移一位） */
  moveNodeDown(schema: any, nodeId: string): boolean {
    const parent = this.getParentById(schema, nodeId);
    if (!parent?.__nodeOptions) {
      return false;
    }
    const loc = locateChild(parent.__nodeOptions, nodeId, n => this.getNodeId(n));
    if (!loc?.swapArr || loc.index >= loc.swapArr.length - 1) {
      return false;
    }
    const arr = loc.swapArr;
    [arr[loc.index + 1], arr[loc.index]] = [arr[loc.index], arr[loc.index + 1]];
    return true;
  }

  // ── 场景级操作（多路由页面增删）──

  /** 列出所有场景名（schema 顶层 key） */
  listScenes(schema: any): string[] {
    return schema && typeof schema === "object" ? Object.keys(schema) : [];
  }

  /** 新增场景（往 schema 顶层加 key，已存在则拒绝） */
  addScene(schema: any, sceneName: string, sceneData: any): boolean {
    if (!schema || typeof schema !== "object" || schema[sceneName]) {
      return false;
    }
    schema[sceneName] = sceneData;
    return true;
  }

  /** 删除场景（从 schema 顶层移除 key，至少保留一个） */
  removeScene(schema: any, sceneName: string): boolean {
    if (!schema || typeof schema !== "object" || Object.keys(schema).length <= 1) {
      return false;
    }
    if (!schema[sceneName]) {
      return false;
    }
    delete schema[sceneName];
    return true;
  }
}
