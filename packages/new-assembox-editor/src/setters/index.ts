/**
 * Setter 统一出口 + 内置注册
 * 每个 setter 独立目录，此处聚合导出并提供注册函数
 */
import type { SetterRegistry } from "../registry/setter-registry";

import { ArrayOfMultiSetter } from "./array-of-multi-setter";
import { ArraySetter } from "./array-setter";
import { BoolSetter } from "./bool-setter";
import { ClassNameSetter } from "./classname-setter";
import { ColorSetter } from "./color-setter";
import { CustomSetter } from "./custom-setter";
import { DocSetter } from "./doc-setter";
import { ExpressionSetter } from "./expression-setter";
import { FunctionSetter } from "./function-setter";
import { IconSetter } from "./icon-setter";
import { JSFunctionSetter } from "./js-function-setter";
import { JsonSetter } from "./json-setter";
import { LabelSetter } from "./label-setter";
import { MixedSetter } from "./mixed-setter";
import { ModelNameSetter } from "./model-name-setter";
import { NumberSetter } from "./number-setter";
import { ObjectSetter } from "./object-setter";
import { RadioGroupSetter } from "./radio-group-setter";
import { RequestFnSetter } from "./request-fn-setter";
import { SelectSetter } from "./select-setter";
import { StringSetter } from "./string-setter";
import { StyleSetter } from "./style-setter";
import { TextareaSetter } from "./textarea-setter";
import { VariableSetter } from "./variable-setter";

export { ArrayOfMultiSetter } from "./array-of-multi-setter";
export { ArraySetter } from "./array-setter";
export {
  defineSetter,
  normalizeOptions,
  SETTER_CONTEXT_KEY,
  useSetterCtx,
} from "./base";
export { BoolSetter } from "./bool-setter";
export { ClassNameSetter } from "./classname-setter";
export { ColorSetter } from "./color-setter";
export { CustomSetter } from "./custom-setter";
export { DocSetter } from "./doc-setter";

export { ExpressionSetter } from "./expression-setter";

// 高级/业务
export { FunctionSetter } from "./function-setter";
// 图标
export { IconSetter } from "./icon-setter";
export { JSFunctionSetter } from "./js-function-setter";
export type { JSFunctionValue } from "./js-function-setter";

export { JsonSetter } from "./json-setter";
export { LabelSetter } from "./label-setter";
export { MixedSetter } from "./mixed-setter";
export { ModelNameSetter } from "./model-name-setter";
export { NumberSetter } from "./number-setter";
// 复合类型
export { ObjectSetter } from "./object-setter";
export { RadioGroupSetter } from "./radio-group-setter";
export { RequestFnSetter } from "./request-fn-setter";
export { isFieldHidden, resolveSetter } from "./resolve";
export { SelectSetter } from "./select-setter";
// 基础类型
export { StringSetter } from "./string-setter";
export { StyleSetter } from "./style-setter";

export { TextareaSetter } from "./textarea-setter";
// 契约与工具
export type { SetterContext, SetterProps } from "./types";
export { VariableSetter } from "./variable-setter";

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
  CustomSetter,
} as const;

/** 注册所有内置 setter 到 SetterRegistry */
export function registerBuiltinSetters(registry: SetterRegistry): void {
  for (const [name, component] of Object.entries(builtinSetterMap)) {
    registry.register(name, component as any);
  }
}
