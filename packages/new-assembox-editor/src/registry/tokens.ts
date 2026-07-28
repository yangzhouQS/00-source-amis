/**
 * DI Tokens 定义（类型安全的注入键）
 * 所有可注入的服务都通过 token 注册与获取
 */
import type {InjectionToken} from '../core/di-container';
import {token} from '../core/di-container';
import type {Editor} from '../core/editor';
import type {EditorStore} from '../core/store';
import type {EventBus} from '../core/event-bus';
import type {PluginManager} from '../core/plugin-manager';
import type {ComponentRegistry} from '../registry/component-registry';
import type {SetterRegistry} from '../registry/setter-registry';
import type {AssetRegistry} from '../registry/asset-registry';
import type {ActionRegistry} from '../registry/action-registry';
import type {Skeleton} from '../skeleton/skeleton';
import type {Selection} from '../core/selection';

export const EDITOR = token<Editor>('editor');
export const STORE = token<EditorStore>('store');
export const BUS = token<EventBus>('bus');
export const DI = token('di-container');
export const PLUGIN_MANAGER = token<PluginManager>('plugin-manager');
export const COMPONENT_REGISTRY =
  token<ComponentRegistry>('component-registry');
export const SETTER_REGISTRY = token<SetterRegistry>('setter-registry');
export const ASSET_REGISTRY = token<AssetRegistry>('asset-registry');
export const ACTION_REGISTRY = token<ActionRegistry>('action-registry');
export const SKELETON = token<Skeleton>('skeleton');
export const SELECTION = token<Selection>('selection');

export type AnyToken = InjectionToken<any>;
