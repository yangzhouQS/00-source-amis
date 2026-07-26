import { h } from 'vue';
import { ElInput, ElFormItem } from 'element-plus';
import type { EditorPlugin } from '@/types/plugin';

/** 内置示例插件：图表组件 + 自定义属性编辑器 + 工具栏按钮 */
const chartsPlugin: EditorPlugin = {
  id: 'builtin-charts',
  name: '图表组件',
  description: '提供 amis chart 图表组件、属性编辑与工具栏入口（内置示例插件）',
  version: '1.0.0',
  author: 'amis-editor-vue',
  components: [
    {
      type: 'chart',
      name: '图表',
      group: '展示',
      schema: () => ({
        type: 'chart',
        config: {
          title: { text: '示例图表' },
          xAxis: { type: 'category', data: ['A', 'B', 'C'] },
          yAxis: { type: 'value' },
          series: [{ type: 'bar', data: [10, 20, 30] }]
        }
      })
    }
  ],
  renderers: [{ type: 'chart', name: '图表', group: '展示' }],
  propertyEditors: [
    {
      matchType: 'chart',
      tab: 'property',
      order: 1,
      render: (node, ctx) =>
        h(
          ElFormItem,
          { label: '图表标题' },
          {
            default: () =>
              h(ElInput, {
                modelValue: (node as any).config?.title?.text ?? '',
                placeholder: '图表标题',
                'onUpdate:modelValue': (v: string) => {
                  const config = {
                    ...((node as any).config || {}),
                    title: { text: v }
                  };
                  ctx.updateNode(ctx.getSelectedPath() ?? '', { config });
                }
              })
          }
        )
    }
  ],
  toolbarButtons: [{ id: 'builtin-charts-btn', label: '图表插件已启用', order: 100 }]
};

/** 所有内置插件 */
export const BUILTIN_PLUGINS: EditorPlugin[] = [chartsPlugin];
