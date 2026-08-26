/**
 * 打印宿主页入口（方案 A §4.2）
 *
 * 流程：claim（票据换任务）→ vendor 资产装载 → 场景打印变换 → 创建 app
 * → AssemPlugin → registerDefaults → wrapFns（mount 前包装请求函数）→ mount
 * → idleCheck 兜底。
 *
 * bootstrap 配方对齐 new-assembox-editor 的 iframe canvas（同源验证过的装配方式），
 * 区别仅在于：不设 window.assemBoxIsEdit / assemBoxDesignMode（打印是运行态）。
 */
import * as Vue from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import 'element-plus/dist/index.css';
import '@cs/assembox-desktop-next/dist/index.css';
import { AssemPlugin, AssemViews, registerDefaults, deserializeScene } from '@cs/assembox-desktop-next';
import { transformForPrint } from '@cs/print-transform';
import { claimTask, getTicketFromUrl } from './claim';
import { installReadiness, failFast } from './readiness';
import { installVendorPlugins, loadVendorAssets } from './assets';
import './print.css';

async function bootstrap(): Promise<void> {
  const win = window as any;

  // ① 单 Vue 实例：ESM Vue 先挂全局，后续 UMD/IIFE 包（element-plus 等）读取 window.Vue
  win.Vue = Vue;

  const ticket = getTicketFromUrl();
  if (!ticket) {
    failFast('NO_TICKET', 'URL 缺少 ticket 参数');
    return;
  }

  let task;
  try {
    // ② 本地 vendor 资产（不依赖外部 CDN），claim 失败尽早置错误信号
    await loadVendorAssets();
    task = await claimTask(ticket);
  } catch (e) {
    failFast('BOOTSTRAP_FAILED', (e as Error).message);
    return;
  }

  const printOptions = task.printOptions ?? {};

  // ③ 反序列化（事件字符串 → 函数）+ 打印变换（剔除交互件/表格全量/解除视口约束）
  // deserializeScene 接收单个 SceneConfig（{ viewsProps }），不是整个 uiSkeleton Record
  const sceneConfig = deserializeScene((task.uiSkeleton as any)[task.sceneName]);
  const { scene: printScene, stats } = transformForPrint({ [task.sceneName]: sceneConfig } as any, {
    rowLimit: printOptions.rowLimit,
    keepNav: printOptions.keepNav,
  });
  console.log('[print-host] transform stats', JSON.stringify(stats));

  // ④ 就绪协议：先安装，mount 前 wrapFns 包住 $requestFns（计数从首请求起准确）
  const readiness = installReadiness({ tolerant: printOptions.tolerant });

  const viewsProps = (printScene as any)[task.sceneName]?.viewsProps ?? null;

  const app = Vue.createApp({
    setup: () => () =>
      Vue.h('div', { 'data-print-root': true }, [
        viewsProps ? Vue.h(AssemViews, { viewsProps }) : Vue.h('div', '空场景'),
      ]),
  });

  // ⑤ 插件装配顺序对齐编辑器 canvas：portalPinia → UMD 插件/图标 → router → AssemPlugin
  installVendorPlugins(app);

  const routes = Object.keys(task.routerConfig ?? {}).map((name) => {
    const cfg = (task.routerConfig as any)[name];
    return { path: cfg?.path ?? `/${name}`, name, component: { render: () => Vue.h('div') }, meta: cfg?.meta ?? {} };
  });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: routes.length ? routes : [{ path: '/', name: 'print', component: { render: () => Vue.h('div') } }],
  });
  app.use(router);

  app.use(AssemPlugin, {
    uiSkeleton: printScene,
    dataSource: task.dataSource as any,
    routerConfig: task.routerConfig as any,
    security: {},
  });
  registerDefaults();

  // ⑥ wrapFns 必须在 mount 前：表格 onMounted 即触发 requestFn（assem-yq-table-async.vue:201-205）
  const core = app.config.globalProperties.$assemCore as any;
  readiness.wrapFns(core);

  document.body.dataset.printHost = '';
  document.body.dataset.orientation = printOptions.orientation ?? 'portrait';
  app.mount('#app');

  // ⑦ 无请求场景兜底（有请求时由计数归零触发 settle）
  Vue.nextTick(() => readiness.idleCheck());
}

bootstrap().catch((e) => {
  failFast('BOOTSTRAP_FAILED', (e as Error)?.message ?? String(e));
});
