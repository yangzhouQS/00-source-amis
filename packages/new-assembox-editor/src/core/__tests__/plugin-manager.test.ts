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

/** 构造含 register/unregister 的 registry mock ctx */
function mockCtx() {
  return {
    componentRegistry: {register: vi.fn(), unregister: vi.fn()},
    setterRegistry: {register: vi.fn(), unregister: vi.fn()},
    actionRegistry: {register: vi.fn(), unregister: vi.fn()},
    assetRegistry: {register: vi.fn(), unregister: vi.fn()},
    skeleton: {add: vi.fn(), remove: vi.fn()}
  } as unknown as PluginContext;
}

describe('PluginManager 实例级注册', () => {
  it('activate 后 getPlugin 返回已激活插件与 options', async () => {
    const pm = new PluginManager(fakeBus);
    const p = definePlugin({id: 'a'});
    pm.register(p, {x: 1});
    await pm.activate(fakeCtx, 'desktop');
    expect(pm.getPlugin('a')?.plugin).toBe(p);
    expect(pm.getPlugin('a')?.options).toEqual({x: 1});
  });

  it('unregister 后 activate 不包含该插件', async () => {
    const pm = new PluginManager(fakeBus);
    pm.register(definePlugin({id: 'a'}));
    pm.unregister('a');
    await pm.activate(fakeCtx, 'desktop');
    expect(pm.getPlugin('a')).toBeUndefined();
  });

  it('getPlugin 不返回未激活（scene 过滤掉）的插件', async () => {
    const pm = new PluginManager(fakeBus);
    pm.register(definePlugin({id: 'a', scene: 'mobile'}));
    await pm.activate(fakeCtx, 'desktop');
    expect(pm.getPlugin('a')).toBeUndefined();
  });
});

describe('PluginManager priority 覆盖', () => {
  it('同 id 低 priority 不覆盖高 priority', async () => {
    const pm = new PluginManager(fakeBus);
    const high = definePlugin({id: 'a', priority: 10, setup: vi.fn()});
    const low = definePlugin({id: 'a', priority: 1, setup: vi.fn()});
    pm.register(high);
    pm.register(low);
    await pm.activate(fakeCtx, 'desktop');
    expect(pm.getPlugin('a')?.plugin).toBe(high);
    expect(low.setup).not.toHaveBeenCalled();
  });

  it('同 id 高 priority 覆盖低 priority', async () => {
    const pm = new PluginManager(fakeBus);
    const high = definePlugin({id: 'a', priority: 10, setup: vi.fn()});
    const low = definePlugin({id: 'a', priority: 1, setup: vi.fn()});
    pm.register(low);
    pm.register(high);
    await pm.activate(fakeCtx, 'desktop');
    expect(pm.getPlugin('a')?.plugin).toBe(high);
    expect(high.setup).toHaveBeenCalled();
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

describe('PluginManager setup 失败隔离', () => {
  it('setup 失败插件的 buildPanels 不被调用', async () => {
    const buildPanels = vi.fn();
    const bad = definePlugin({
      id: 'bad',
      setup: () => {
        throw new Error('boom');
      },
      buildPanels
    });
    const pm = new PluginManager(fakeBus);
    pm.register(bad);
    await pm.activate(fakeCtx, 'desktop');
    pm.buildPanels(null, []);
    expect(buildPanels).not.toHaveBeenCalled();
  });
});

describe('PluginManager contributes 自动应用与反注册', () => {
  it('contributes.components 注册到 componentRegistry', async () => {
    const ctx = mockCtx();
    const meta = {type: 'Button'} as any;
    const p = definePlugin({id: 'p', contributes: {components: [meta]}});
    const pm = new PluginManager(fakeBus);
    pm.register(p);
    await pm.activate(ctx, 'desktop');
    expect((ctx.componentRegistry as any).register).toHaveBeenCalledWith(meta);
  });

  it('contributes.skeleton 注入 editor 后 skeleton.add', async () => {
    const ctx = mockCtx();
    const editor = {id: 'editor-x'} as any;
    (ctx as any).editor = editor;
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
    expect((ctx.skeleton as any).add).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'd',
        contentProps: expect.objectContaining({k: 1, editor})
      })
    );
  });

  it('destroy 后 contributes 反注册（componentRegistry.unregister + skeleton.remove）', async () => {
    const ctx = mockCtx();
    const p = definePlugin({
      id: 'p',
      contributes: {
        components: [{type: 'Button'} as any],
        skeleton: [{area: 'leftArea', type: 'Panel', name: 'panel-x'}]
      }
    });
    const pm = new PluginManager(fakeBus);
    pm.register(p);
    await pm.activate(ctx, 'desktop');
    pm.destroy();
    expect((ctx.componentRegistry as any).unregister).toHaveBeenCalledWith(
      'Button'
    );
    expect((ctx.skeleton as any).remove).toHaveBeenCalledWith('panel-x');
  });
});
