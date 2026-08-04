/**
 * Demo 入口（PC 桌面场景）
 * 注册场景 → 创建编辑器实例 → 挂载 Workbench
 */
import {createApp} from 'vue';
import ElementPlus, {ElMessage} from 'element-plus';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import 'element-plus/dist/index.css';
import {createEditor, Workbench} from '../index';
import {registerScenario} from '../scenario';
import {pcDesktopProfile} from '../scenarios/pc-desktop';
// 默认测试 schema（供应商单表场景，取 uiSkeleton 作为编辑器 schema）
import schemaJson from './single-table-scene.json';

// Monaco 本地加载（避免 CDN 依赖，代理环境 CDN 不可达）
import {loader} from '@guolao/vue-monaco-editor';
import * as monaco from 'monaco-editor';
// @ts-ignore vite ?worker import（运行时由 vite 处理，类型声明 vue-tsc 不识别）
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';
// @ts-ignore vite ?worker import
import JsonWorker from 'monaco-editor/language/json/json.worker.js?worker';

(self as any).MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === 'json') return new JsonWorker();
    return new EditorWorker();
  }
};
loader.config({monaco} as any);

// 暴露 ElMessage 给动作系统（toast 动作用）
(window as any).ElMessage = ElMessage;

async function main() {
  // 1. 注册并激活 PC 桌面场景
  registerScenario(pcDesktopProfile);

  // 2. 创建编辑器实例（场景驱动，渲染器由 DesignerHost 挂载）
  const editor = createEditor({
    platform: 'desktop',
    scenario: 'pc-desktop',
    canvasMode: 'iframe',
    schema: (schemaJson as any).uiSkeleton
  });

  // 暴露 editor 便于调试
  (window as any).editor = editor;

  // 3. 启动编辑器（激活插件）
  await editor.start();

  // 4. 注册键盘快捷键
  const {useEditorShortcuts} = await import('../hooks/use-editor-shortcuts');
  useEditorShortcuts(editor);

  // 5. 挂载 Workbench
  const app = createApp({
    render: () => (
      <Workbench
        skeleton={editor.skeleton}
        store={editor.store}
        editor={editor}
      />
    )
  });

  // 注册 Element Plus 图标
  for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    if (['Box', 'box'].includes(key)){
      continue;
    }
    app.component(key, component as any);
  }
  app.use(ElementPlus);
  console.log(window);
  app.use(ElementPlusUi);
  app.use(ElementPro);
  app.use(TablePro);
  app.mount('#app');
}

main().catch(err => {
  console.error('编辑器启动失败:', err);
});
