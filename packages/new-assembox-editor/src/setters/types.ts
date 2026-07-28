/**
 * Setter 统一契约
 * 兼容新项目设计：所有 setter 通过 props 接收 value/onChange
 * 兼容旧版 lowcode-engine / assembox 的 setter 概念（移植为 Vue3 + Element Plus）
 */
import type {Editor} from '../core/editor';
import type {SetterRegistry} from '../registry/setter-registry';
import type {NodeId, PropConfig} from '../schema/types';

/** 所有 setter 的通用 props */
export interface SetterProps<T = any> {
  /** 当前值 */
  value: T;
  /** 默认值 */
  defaultValue?: T;
  /** 值变更回调（统一出口） */
  onChange: (value: T) => void;
  /** 占位文本 */
  placeholder?: string;
  /** 是否只读预览 */
  isPreview?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 所属字段名（调试/label 显示用） */
  fieldName?: string;
  /** setter 附加配置（来自 PropConfig.setterProps） */
  [key: string]: any;
}

/** 复合 setter（Object/Array/Mixed）所需的上下文 */
export interface SetterContext {
  /** 编辑器实例 */
  editor: Editor;
  /** setter 注册表（解析子 setter） */
  setterRegistry: SetterRegistry;
  /** 当前节点 id */
  nodeId?: NodeId;
  /** 当前字段配置 */
  fieldConfig?: PropConfig;
}

/** provide/inject key */
export const SETTER_CONTEXT_KEY = Symbol('assem-setter-context');

/** 列表项配置（ArraySetter 的子项配置） */
export interface ListItemConfig {
  /** 子项 setter 名 */
  setter?: string;
  /** 子项 setter 附加 props */
  props?: Record<string, any>;
  /** 子项默认值 */
  initialValue?: any;
}

/** 对象子字段配置（ObjectSetter 用，复用 PropConfig） */
export type ObjectItemConfig = PropConfig;
