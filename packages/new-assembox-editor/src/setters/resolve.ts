/**
 * 复合 setter 通用辅助：根据 PropConfig 解析 setter 组件与 props
 */
import type {Component} from 'vue';
import type {SetterRegistry} from '../registry/setter-registry';
import {inferSetterName} from '../registry/setter-inference';
import type {PropConfig} from '../schema/types';

export interface ResolvedSetter {
  component: Component | undefined;
  setterName: string;
  setterProps: Record<string, any>;
}

/** 根据 PropConfig 解析 setter（显式 setter 优先，否则按 propType 推断） */
export function resolveSetter(
  registry: SetterRegistry,
  propConfig: PropConfig
): ResolvedSetter {
  const setterName = propConfig.setter ?? inferSetterName(propConfig.propType);
  const setterProps: Record<string, any> = {...(propConfig.setterProps ?? {})};
  // oneOf → 自动注入 options
  if (
    propConfig.propType &&
    typeof propConfig.propType === 'object' &&
    propConfig.propType.type === 'oneOf'
  ) {
    setterProps.options = propConfig.propType.value.map(
      (v: any, i: number) => ({
        label:
          propConfig.propType &&
          typeof propConfig.propType === 'object' &&
          propConfig.propType.type === 'oneOf'
            ? propConfig.propType.labels?.[i] ?? String(v)
            : String(v),
        value: v
      })
    );
  }
  return {
    component: registry.get(setterName),
    setterName,
    setterProps
  };
}

/** 计算字段是否隐藏 */
export function isFieldHidden(propConfig: PropConfig, value: any): boolean {
  if (propConfig.hidden === undefined) return false;
  if (typeof propConfig.hidden === 'function')
    return !!propConfig.hidden(value);
  return !!propConfig.hidden;
}
