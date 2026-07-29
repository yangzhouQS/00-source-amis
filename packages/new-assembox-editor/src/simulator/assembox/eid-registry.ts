/**
 * $$eid 注册表：加载期给每个节点分配唯一编辑态 id；
 * 挂载期把 assembox-desktop 上报的实例按「父链 + __nodeName + 顺序」匹配到 $$eid。
 * 不动 __nodeId / $exposeds（生产兼容）。
 */

export interface EidNodeInfo {
  $$eid: string;
  __nodeId?: string;
  __nodeName?: string;
  __nodeType?: string;
  nodeRef: any;
  parentEid: string | null;
  el: HTMLElement | null;
  instance: any;
}

let counter = 0;
function genEid(): string {
  counter += 1;
  return (
    'e_' + counter.toString(36) + '_' + Math.random().toString(36).slice(2, 6)
  );
}

/**
 * 健壮地取组件根元素：
 * 优先 proxy.$el；为空/注释/fragment 时回退到 vnode.el / subTree.el，
 * 并在 subTree 为 fragment 时向下找第一个真实元素。
 */
function resolveEl(instance: any): HTMLElement | null {
  const candidates: any[] = [
    instance?.proxy?.$el,
    instance?.$el,
    instance?.vnode?.el,
    instance?.subTree?.el,
    instance?.proxy?.vnode?.el
  ];
  for (const c of candidates) {
    if (c && c.nodeType === 1) return c as HTMLElement;
  }
  // subTree 为 fragment（多根/注释）时，向下找首个真实元素
  const sub = instance?.subTree ?? instance?.proxy?.subTree;
  const found = findFirstElement(sub);
  return found;
}

function findFirstElement(vnode: any): HTMLElement | null {
  if (!vnode) return null;
  if (vnode.nodeType === 1) return vnode;
  const el: any = vnode.el;
  if (el && el.nodeType === 1) return el;
  if (Array.isArray(vnode.children)) {
    for (const c of vnode.children) {
      const f = findFirstElement(c);
      if (f) return f;
    }
  }
  if (vnode.component) {
    const f = findFirstElement(vnode.component.subTree);
    if (f) return f;
  }
  return null;
}

export class EidRegistry {
  private map = new Map<string, EidNodeInfo>();
  private byEl = new Map<HTMLElement, string>();

  /** 加载期：递归遍历 JSON clone，给每个带 __nodeType 的节点分配 $$eid */
  assignEids(root: any): void {
    const visited = new WeakSet();
    const walk = (node: any, parentEid: string | null) => {
      if (!node || typeof node !== 'object' || visited.has(node)) return;
      visited.add(node);
      let effectiveParent = parentEid;
      // 仅给「实际组件节点」(baseNode 等) 分配 $$eid；跳过 renderNode/columnNode 派发包装
      // （派发包装不会被标记，若作为父节点会破坏子节点的父链匹配）
      const isWrapper =
        node.__nodeType &&
        ['renderNode', 'columnNode'].includes(node.__nodeType);
      if (node.__nodeType && !isWrapper) {
        const eid = genEid();
        node.$$eid = eid;
        this.map.set(eid, {
          $$eid: eid,
          __nodeId: node.__nodeId,
          __nodeName: node.__nodeName,
          __nodeType: node.__nodeType,
          nodeRef: node,
          parentEid,
          el: null,
          instance: null
        });
        effectiveParent = eid;
      }
      // 通用深递归：遍历所有对象/数组值（兼容 __nodeOptions/defaultSlot/planeOptions 等任意嵌套）
      for (const k of Object.keys(node)) {
        if (k === '$$eid') continue;
        const v = node[k];
        if (Array.isArray(v)) {
          v.forEach(c => walk(c, effectiveParent));
        } else if (v && typeof v === 'object') {
          walk(v, effectiveParent);
        }
      }
    };
    walk(root, null);
  }

  /** 挂载期：按父链 + __nodeName 匹配 $$eid 并回填 el/instance */
  matchAndRegister(instance: any): EidNodeInfo | null {
    const el = resolveEl(instance);
    if (!el) return null;
    const __nodeName = instance?.props?.__nodeName;
    const __nodeType = instance?.props?.__nodeType;
    // 跳过派发包装节点
    if (__nodeType && ['renderNode', 'columnNode'].includes(__nodeType))
      return null;

    const parentEl = (el.parentElement as HTMLElement | null)?.closest(
      '[data-editor-id]'
    ) as HTMLElement | null;
    const parentEid = parentEl?.getAttribute('data-editor-id') ?? null;

    // 主匹配：parentEid + __nodeName
    let target: EidNodeInfo | null = null;
    for (const info of this.map.values()) {
      if (info.el) continue;
      if (info.parentEid !== parentEid) continue;
      if (__nodeName && info.__nodeName && info.__nodeName !== __nodeName)
        continue;
      target = info;
      break;
    }
    // 兜底1：同 parentEid 任意未匹配
    if (!target) {
      for (const info of this.map.values()) {
        if (!info.el && info.parentEid === parentEid) {
          target = info;
          break;
        }
      }
    }
    // 兜底2：全局任意未匹配（按登记顺序）
    if (!target) {
      for (const info of this.map.values()) {
        if (!info.el) {
          target = info;
          break;
        }
      }
    }
    if (!target) return null;

    target.el = el;
    target.instance = instance;
    el.setAttribute('data-editor-id', target.$$eid);
    this.byEl.set(el, target.$$eid);
    return target;
  }

  unregisterByInstance(instance: any): void {
    const el = resolveEl(instance);
    if (!el) return;
    const eid = this.byEl.get(el);
    if (!eid) return;
    const info = this.map.get(eid);
    if (info) {
      info.el = null;
      info.instance = null;
    }
    this.byEl.delete(el);
  }

  get(eid: string): EidNodeInfo | undefined {
    return this.map.get(eid);
  }
  all(): EidNodeInfo[] {
    return Array.from(this.map.values());
  }
  count(): number {
    return this.map.size;
  }
  mountedCount(): number {
    return Array.from(this.map.values()).filter(i => i.el).length;
  }

  static stripEids(node: any): void {
    if (!node || typeof node !== 'object') return;
    delete node.$$eid;
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (Array.isArray(v)) v.forEach(EidRegistry.stripEids);
      else if (v && typeof v === 'object') EidRegistry.stripEids(v);
    }
  }
}
