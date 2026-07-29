/**
 * Setter 注册表
 * - 动态注册 setter 组件
 * - propType → setter 名推断（委托 component-registry 的 inferSetterName）
 */
import type {VueComponent, SetterMeta} from '../schema/types';
import {inferSetterName} from './component-registry';
import type {PropType} from '../schema/types';

export class SetterRegistry {
  private map = new Map<string, VueComponent>();

  /** 注册 setter */
  register(name: string, component: VueComponent): void {
    this.map.set(name, component);
  }

  /** 取消注册 */
  unregister(name: string): boolean {
    return this.map.delete(name);
  }

  /** 批量注册 */
  registerAll(setters: SetterMeta[]): void {
    setters.forEach(s => this.register(s.name, s.component));
  }

  /** 获取 setter */
  get(name: string): VueComponent | undefined {
    return this.map.get(name);
  }

  /** 是否存在 */
  has(name: string): boolean {
    return this.map.has(name);
  }

  /** 按 propType 推断并获取 setter 组件 */
  resolve(
    propType: PropType,
    explicitSetter?: string
  ): VueComponent | undefined {
    const name = explicitSetter ?? inferSetterName(propType);
    return this.get(name);
  }

  /** 全部 setter 名 */
  names(): string[] {
    return Array.from(this.map.keys());
  }
}
