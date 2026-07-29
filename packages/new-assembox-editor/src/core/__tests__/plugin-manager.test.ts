import {describe, it, expect, vi} from 'vitest';
import {definePlugin} from '../plugin-types';
import {PluginManager} from '../plugin-manager';
import type {EventBus} from '../event-bus';
import type {PluginContext} from '../plugin-types';

// EventBus 极简 stub
const fakeBus = {
  on: vi.fn(() => () => {}),
  trigger: vi.fn(() => ({prevented: false, stopped: false}))
} as unknown as EventBus;

const fakeCtx = {} as PluginContext;

describe('PluginManager 实例级注册', () => {
  it('register 后 getPlugin 返回插件与 options', () => {
    const pm = new PluginManager(fakeBus);
    const p = definePlugin({id: 'a'});
    pm.register(p, {x: 1});
    expect(pm.getPlugin('a')?.plugin).toBe(p);
    expect(pm.getPlugin('a')?.options).toEqual({x: 1});
  });

  it('unregister 后 getPlugin 返回 undefined', () => {
    const pm = new PluginManager(fakeBus);
    pm.register(definePlugin({id: 'a'}));
    pm.unregister('a');
    expect(pm.getPlugin('a')).toBeUndefined();
  });
});

describe('PluginManager dep 拓扑排序', () => {
  it('被依赖插件先 activate', async () => {
    const order: string[] = [];
    const a = definePlugin({
      id: 'a',
      dep: ['b'],
      setup: () => {
        order.push('a');
      }
    });
    const b = definePlugin({
      id: 'b',
      setup: () => {
        order.push('b');
      }
    });
    const pm = new PluginManager(fakeBus);
    pm.register(a);
    pm.register(b);
    await pm.activate(fakeCtx, 'desktop');
    expect(order).toEqual(['b', 'a']);
  });

  it('循环依赖降级 priority 不卡死', async () => {
    const a = definePlugin({id: 'a', dep: ['c'], priority: 1});
    const c = definePlugin({id: 'c', dep: ['a'], priority: 0});
    const pm = new PluginManager(fakeBus);
    pm.register(a);
    pm.register(c);
    await expect(pm.activate(fakeCtx, 'desktop')).resolves.toBeUndefined();
    const ids = pm.getPlugins().map(p => p.id);
    expect(ids).toContain('a');
    expect(ids).toContain('c');
  });
});

describe('PluginManager setup dispose 回收', () => {
  it('setup 返回的 dispose 在 destroy 时逆序调用', async () => {
    const calls: string[] = [];
    const a = definePlugin({
      id: 'a',
      setup: () => () => {
        calls.push('dispose-a');
      }
    });
    const b = definePlugin({
      id: 'b',
      setup: () => () => {
        calls.push('dispose-b');
      }
    });
    const pm = new PluginManager(fakeBus);
    pm.register(a);
    pm.register(b);
    await pm.activate(fakeCtx, 'desktop');
    pm.destroy();
    expect(calls).toEqual(['dispose-b', 'dispose-a']);
  });

  it('单个 setup 抛错不阻断其它插件', async () => {
    const ok = vi.fn();
    const bad = definePlugin({
      id: 'bad',
      setup: () => {
        throw new Error('boom');
      }
    });
    const good = definePlugin({id: 'good', setup: ok});
    const pm = new PluginManager(fakeBus);
    pm.register(bad);
    pm.register(good);
    await pm.activate(fakeCtx, 'desktop');
    expect(ok).toHaveBeenCalled();
  });
});

describe('PluginManager contributes 自动应用', () => {
  it('contributes.components 注册到 componentRegistry', async () => {
    const register = vi.fn();
    const ctx = {
      componentRegistry: {register},
      setterRegistry: {register: vi.fn()},
      actionRegistry: {register: vi.fn()},
      assetRegistry: {register: vi.fn()},
      skeleton: {add: vi.fn()}
    } as unknown as PluginContext;
    const meta = {type: 'Button'} as any;
    const p = definePlugin({id: 'p', contributes: {components: [meta]}});
    const pm = new PluginManager(fakeBus);
    pm.register(p);
    await pm.activate(ctx, 'desktop');
    expect(register).toHaveBeenCalledWith(meta);
  });

  it('contributes.skeleton 注入 editor 后 skeleton.add', async () => {
    const add = vi.fn();
    const editor = {id: 'editor-x'} as any;
    const ctx = {
      componentRegistry: {register: vi.fn()},
      setterRegistry: {register: vi.fn()},
      actionRegistry: {register: vi.fn()},
      assetRegistry: {register: vi.fn()},
      skeleton: {add},
      editor
    } as unknown as PluginContext;
    const p = definePlugin({
      id: 'p',
      contributes: {
        skeleton: [
          {area: 'leftArea', type: 'PanelDock', name: 'd', contentProps: {k: 1}}
        ]
      }
    });
    const pm = new PluginManager(fakeBus);
    pm.register(p);
    await pm.activate(ctx, 'desktop');
    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'd',
        contentProps: expect.objectContaining({k: 1, editor})
      })
    );
  });
});
