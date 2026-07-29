/**
 * Demo 入口
 * 创建编辑器实例 → 注册 demo 组件 → 挂载 Workbench
 */
import {createApp} from 'vue';
import ElementPlus, {ElMessage} from 'element-plus';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import 'element-plus/dist/index.css';
import {createEditor, Workbench} from '../index';
import {registerDemoComponents} from './components';

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
  // 1. 创建编辑器实例（默认注入内置插件：组件库/设置/画布/大纲/源码/历史，iframe 隔离渲染画布）
  const editor = createEditor({
    platform: 'desktop',
    canvasMode: 'iframe',
    schema: {
      type: 'page',
      $$id: 'root',
      body: [
        {
          type: 'card',
          $$id: 'demo-card',
          props: {header: '欢迎使用新版 assembox 编辑器'},
          body: [
            {
              type: 'button',
              $$id: 'demo-btn',
              props: {type: 'primary', content: '点击我'},
              onEvent: {click: {actions: []}}
            }
          ]
        }
      ]
    }
  });

  // 暴露 editor 便于调试
  (window as any).editor = editor;

  // 3. 注册 demo 组件
  registerDemoComponents(editor.componentRegistry);

  // 4. 启动编辑器（激活插件）
  await editor.start();

  // 4.5 注册键盘快捷键
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
    app.component(key, component as any);
  }
  app.use(ElementPlus);
  app.mount('#app');
}

main().catch(err => {
  console.error('编辑器启动失败:', err);
});
