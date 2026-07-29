/**
 * assembox-desktop iframe 入口（运行于 public/assembox-canvas.html）
 * 用 window 全局（Vue/AssemboxDesktop），不 import vue（避免与 vue.global 重复加载）
 * P0：挂载 assembox-desktop 渲染测试 JSON + 接入 AssemboxBridge 契约 + 盖标记 + 选中
 */
import {AssemboxBridge} from './assembox-bridge';

const win = window as any;

// 1) 编辑环境标记（触发 assembox-desktop 的 isEditorEnv 分支 → editorHook 上报）
win.assemBoxIsEdit = true;

// 2) AssemboxBridge 实现 AssemVueRenderer 契约
const bridge = new AssemboxBridge({
  onNodeMounted: (eid, el) => console.log('[mount]', eid, el.tagName),
  onNodeUnmounted: eid => console.log('[unmount]', eid)
});
win.AssemVueRenderer = bridge;

// 3) 测试 schema：button 嵌在 box 容器内（仅需 Vue + ElementPlus 全局）
const testSchema = {
  __nodeId: 'root',
  __nodeName: 'views',
  __nodeType: 'baseNode',
  __nodeOptions: {
    planeOptions: {
      __nodeId: 'p1',
      __nodeName: 'plane',
      __nodeType: 'baseNode',
      __nodeOptions: {
        flexBoxOptions: {
          __nodeId: 'f1',
          __nodeName: 'flexBox',
          __nodeType: 'baseNode',
          __nodeOptions: {
            isRow: false,
            itemNum: 1,
            itemConfig: [
              {
                tag: 'item-1',
                isFixed: false,
                paddingSize: 'base',
                contentType: 'container',
                defaultSlot: {
                  __nodeId: 'c1',
                  __nodeName: 'containerRender',
                  __nodeType: 'renderNode',
                  __nodeOptions: {
                    renderType: 'box',
                    containerOptions: {
                      __nodeId: 'b1',
                      __nodeName: 'box',
                      __nodeType: 'baseNode',
                      __nodeOptions: {
                        border: true,
                        background: true,
                        boxType: 'element',
                        paddingSize: 'small',
                        defaultSlot: {
                          __nodeId: 'e1',
                          __nodeName: 'elementRender',
                          __nodeType: 'renderNode',
                          __nodeOptions: {
                            renderType: 'button',
                            elementOptions: {
                              __nodeId: 'btn1',
                              __nodeName: 'button',
                              __nodeType: 'baseNode',
                              __nodeOptions: {
                                type: 'primary',
                                content: 'P0测试按钮'
                              },
                              __nodeEvent: {}
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            ]
          }
        }
      }
    }
  }
};

// 4) 等 assembox-desktop iife 就绪后挂载（assignEids 只执行一次，避免重试累积）
bridge.registry.assignEids(testSchema);

function mount(): void {
  const lib = win.AssemboxDesktop;
  if (!lib) {
    setTimeout(mount, 30);
    return;
  }
  const Vue = win.Vue;
  const {createApp, h} = Vue;
  const app = createApp({
    render: () =>
      h(lib.views, {
        __nodeOptions: testSchema.__nodeOptions,
        __nodeId: testSchema.__nodeId,
        __nodeName: testSchema.__nodeName,
        __nodeType: testSchema.__nodeType
      })
  });
  // 注入 $assemCore（views/compsInit/eventArgs 依赖）
  if (lib.AssemPlugin && lib.AssemPlugin.install) {
    lib.AssemPlugin.install(app, {uiSkeleton: {master: testSchema}});
  }
  app.mount('#app');
  win.__assemApp = app;

  // 捕获阶段拦截：点击/悬浮经 data-editor-id 定位 $$eid（设计态选中）
  document.addEventListener(
    'click',
    (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('[data-editor-id]');
      const eid = target?.getAttribute('data-editor-id') ?? null;
      win.__assemSelectedEid = eid;
      console.log('[select]', eid);
      e.stopPropagation();
    },
    true
  );
  document.addEventListener(
    'mouseover',
    (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('[data-editor-id]');
      win.__assemHoverEid = target?.getAttribute('data-editor-id') ?? null;
    },
    true
  );

  console.log(
    '[assembox-canvas] mounted, app=',
    !!app,
    'lib=',
    !!lib,
    'totalEid=',
    bridge.registry.count()
  );
}

mount();
