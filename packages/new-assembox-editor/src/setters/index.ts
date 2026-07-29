/**
 * Setter 统一出口 + 内置注册
 * 每个 setter 独立目录，此处聚合导出并提供注册函数
 */
import type {SetterRegistry} from '../registry/setter-registry';

// 基础类型
export {StringSetter} from './string-setter';
export {TextareaSetter} from './textarea-setter';
export {NumberSetter} from './number-setter';
export {BoolSetter} from './bool-setter';
export {SelectSetter} from './select-setter';
export {RadioGroupSetter} from './radio-group-setter';
export {ColorSetter} from './color-setter';
export {JsonSetter} from './json-setter';

// 图标
export {IconSetter} from './icon-setter';

// 复合类型
export {ObjectSetter} from './object-setter';
export {ArraySetter} from './array-setter';
export {ArrayOfMultiSetter} from './array-of-multi-setter';
export {MixedSetter} from './mixed-setter';

// 高级/业务
export {FunctionSetter} from './function-setter';
export {JSFunctionSetter} from './js-function-setter';
export type {JSFunctionValue} from './js-function-setter';
export {RequestFnSetter} from './request-fn-setter';
export {StyleSetter} from './style-setter';
export {ModelNameSetter} from './model-name-setter';
export {ClassNameSetter} from './classname-setter';
export {VariableSetter} from './variable-setter';
export {ExpressionSetter} from './expression-setter';
export {LabelSetter} from './label-setter';
export {DocSetter} from './doc-setter';
export {CustomSetter} from './custom-setter';

// 契约与工具
export type {SetterProps, SetterContext} from './types';
export {
  SETTER_CONTEXT_KEY,
  useSetterCtx,
  defineSetter,
  normalizeOptions
} from './base';
export {resolveSetter, isFieldHidden} from './resolve';

import {StringSetter} from './string-setter';
import {TextareaSetter} from './textarea-setter';
import {NumberSetter} from './number-setter';
import {BoolSetter} from './bool-setter';
import {SelectSetter} from './select-setter';
import {RadioGroupSetter} from './radio-group-setter';
import {ColorSetter} from './color-setter';
import {JsonSetter} from './json-setter';
import {IconSetter} from './icon-setter';
import {ObjectSetter} from './object-setter';
import {ArraySetter} from './array-setter';
import {ArrayOfMultiSetter} from './array-of-multi-setter';
import {MixedSetter} from './mixed-setter';
import {FunctionSetter} from './function-setter';
import {JSFunctionSetter} from './js-function-setter';
import {RequestFnSetter} from './request-fn-setter';
import {StyleSetter} from './style-setter';
import {ModelNameSetter} from './model-name-setter';
import {ClassNameSetter} from './classname-setter';
import {VariableSetter} from './variable-setter';
import {ExpressionSetter} from './expression-setter';
import {LabelSetter} from './label-setter';
import {DocSetter} from './doc-setter';
import {CustomSetter} from './custom-setter';

/** 内置 setter 注册表（name -> component） */
export const builtinSetterMap = {
  StringSetter,
  TextareaSetter,
  NumberSetter,
  BoolSetter,
  SelectSetter,
  RadioGroupSetter,
  ColorSetter,
  JsonSetter,
  IconSetter,
  ObjectSetter,
  ArraySetter,
  ArrayOfMultiSetter,
  MixedSetter,
  FunctionSetter,
  JSFunctionSetter,
  RequestFnSetter,
  StyleSetter,
  ModelNameSetter,
  ClassNameSetter,
  VariableSetter,
  ExpressionSetter,
  LabelSetter,
  DocSetter,
  CustomSetter
} as const;

/** 注册所有内置 setter 到 SetterRegistry */
export function registerBuiltinSetters(registry: SetterRegistry): void {
  for (const [name, component] of Object.entries(builtinSetterMap)) {
    registry.register(name, component as any);
  }
}
