/**
 * 组件注册表
 * 借鉴 amis-core 的 registerRenderer：声明式注册 + override/weight + 异步加载
 * 取代旧版静态 assets import + window 全局自定义组件
 */
import type {
  ComponentMeta,
  PageNode,
  PageSchema,
  PropType
} from '../schema/types';
import {genNodeId} from '../schema/operations';

export class ComponentRegistry {
  /** type -> meta（最新生效） */
  private byType = new Map<string, ComponentMeta>();
  /** 全部注册历史（含被覆盖的，用于追溯） */
  private all = new Map<string, ComponentMeta>();

  /** 注册组件元信息 */
  register(meta: ComponentMeta): void {
    if (!meta.type) throw new Error('[ComponentRegistry] meta.type 必填');
    const existing = this.byType.get(meta.type);
    if (existing) {
      const existWeight = existing.weight ?? 0;
      const newWeight = meta.weight ?? 0;
      if (!meta.override && newWeight <= existWeight) {
        // 已存在且权重不更高，静默忽略（除非 override）
        return;
      }
    }
    this.byType.set(meta.type, meta);
    this.all.set(`${meta.type}#${Date.now()}`, meta);
  }

  /** 取消注册 */
  unregister(type: string): boolean {
    return this.byType.delete(type);
  }

  /** 按 type 获取 */
  get(type: string): ComponentMeta | undefined {
    return this.byType.get(type);
  }

  /** 是否已注册 */
  has(type: string): boolean {
    return this.byType.has(type);
  }

  /** schema → meta（兼容未来 test 函数） */
  resolve(node: PageNode): ComponentMeta | undefined {
    return this.byType.get(node.type);
  }

  /** 面板展示用（过滤 hidden/disabled） */
  listForPalette(): ComponentMeta[] {
    return Array.from(this.byType.values()).filter(
      m => !m.hidden && !m.disabled
    );
  }

  /** 全部 */
  allMetas(): ComponentMeta[] {
    return Array.from(this.byType.values());
  }

  /**
   * 根据 meta.scaffold 生成拖入节点（补 $$id）
   */
  createNode(
    type: string,
    snippetId?: string,
    overrides?: Partial<PageNode>
  ): PageNode | undefined {
    const meta = this.byType.get(type);
    if (!meta) return undefined;
    // 选 scaffold：指定 snippetId > 首个 snippet > scaffold
    let scaffold: Partial<PageNode> = meta.scaffold ?? {};
    if (meta.snippets?.length) {
      const snip = snippetId
        ? meta.snippets.find(s => (s.id ?? s.title) === snippetId)
        : meta.snippets[0];
      if (snip) scaffold = snip.schema;
    }
    const node: PageNode = {
      type,
      $$id: genNodeId(type),
      ...JSON.parse(JSON.stringify(scaffold)),
      ...overrides
    };
    node.type = type;
    node.$$id = overrides?.$$id ?? node.$$id;
    // 确保有 body 数组（容器）
    if (meta.isContainer && !node.body) {
      node.body = [];
    }
    // 应用属性默认值
    if (meta.props && meta.props.length) {
      node.props = {...node.props};
      for (const prop of meta.props) {
        if (
          prop.defaultValue !== undefined &&
          node.props[prop.name] === undefined
        ) {
          node.props[prop.name] = JSON.parse(JSON.stringify(prop.defaultValue));
        }
      }
    }
    return node;
  }

  /** 按 group/category 分组（组件面板用） */
  groupForPalette(): Map<string, Map<string, ComponentMeta[]>> {
    const groups = new Map<string, Map<string, ComponentMeta[]>>();
    for (const meta of this.listForPalette()) {
      const groupName = meta.group ?? '默认';
      const group = groups.get(groupName) ?? new Map();
      const categoryName = meta.category ?? '未分类';
      const category = group.get(categoryName) ?? [];
      category.push(meta);
      group.set(categoryName, category);
      groups.set(groupName, group);
    }
    return groups;
  }
}

/**
 * propType → setter 名推断
 * 借鉴 amis 的 propTypeToSetter
 */
export function inferSetterName(propType: PropType): string {
  if (typeof propType === 'string') {
    switch (propType) {
      case 'string':
        return 'StringSetter';
      case 'number':
        return 'NumberSetter';
      case 'boolean':
        return 'BoolSetter';
      case 'json':
        return 'JsonSetter';
      case 'color':
        return 'ColorSetter';
      case 'icon':
        return 'IconSetter';
      default:
        return 'StringSetter';
    }
  }
  switch (propType.type) {
    case 'oneOf':
      return 'SelectSetter';
    case 'shape':
      return 'ObjectSetter';
    case 'array':
    case 'arrayOf':
      return 'ArraySetter';
    default:
      return 'StringSetter';
  }
}

/** 装饰器：注册组件（便捷 API） */
export function EditorComponent(meta: ComponentMeta): ClassDecorator {
  // @ts-expect-error 装饰器签名兼容
  return function <T extends new (...args: any[]) => any>(target: T): T {
    const componentMeta: ComponentMeta = {
      ...meta,
      renderComponent: target as any
    };
    // 装饰器在模块加载时即注册到全局注册表
    // 通过延迟到 registry 可用时再注册
    pendingDecorators.push(componentMeta);
    return target;
  };
}

/** 待注册的装饰器组件（在 registry 创建后 flush） */
export const pendingDecorators: ComponentMeta[] = [];

/** 将待注册装饰器 flush 到 registry */
export function flushDecorators(registry: ComponentRegistry): void {
  while (pendingDecorators.length) {
    registry.register(pendingDecorators.shift()!);
  }
}
