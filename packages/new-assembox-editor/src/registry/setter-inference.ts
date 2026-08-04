/**
 * propType → setter 名推断
 * 借鉴 amis 的 propTypeToSetter（与组件注册表解耦）
 */
import type {PropType} from '../schema/types';

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
