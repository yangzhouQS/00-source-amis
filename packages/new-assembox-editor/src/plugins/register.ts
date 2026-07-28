/**
 * 内置插件自注册
 * 导入此模块即注册所有内置插件到全局注册表
 */
import {registerPlugin} from '../core/plugin-manager';
import {builtinPlugins} from './builtin-plugins';

let registered = false;

/** 注册所有内置插件（幂等） */
export function registerBuiltinPlugins(): void {
  if (registered) return;
  registered = true;
  for (const plugin of builtinPlugins) {
    registerPlugin(plugin);
  }
}

/** 自动注册（导入即生效） */
registerBuiltinPlugins();
