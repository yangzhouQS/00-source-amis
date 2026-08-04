/**
 * 内置插件集
 * 通过 PluginManager 激活，contributes.skeleton 贡献布局面板
 */
import type {EditorPluginObject} from '../core/plugin-types';
import {ComponentsPane} from './components-pane/components-pane';
import {SettingsPane} from './settings-pane/settings-pane';
import {OutlinePane} from './outline-pane/outline-pane';
import {SchemaPane} from './schema-pane/schema-pane';
import {HistoryPane} from './history-pane/history-pane';
import {EditorToolbar} from './editor-toolbar/editor-toolbar';
import {registerBuiltinSetters} from '../setters';
import {registerBuiltinActions} from '../actions/builtin-actions';
import {DesignerHost} from '../designer/designer-host';
import {SimulatorSize} from './simulator-size/simulator-size';
import {
  Box,
  Setting,
  Document as DocIcon,
  Tickets,
  Clock,
  Histogram
} from '@element-plus/icons-vue';

/**
 * Designer 插件：注册中央画布
 */
export const designerPlugin: EditorPluginObject = {
  id: 'builtin-designer',
  name: '画布',
  priority: 100,
  scene: ['global'],
  contributes: {
    skeleton: [
      {
        area: 'centerArea',
        type: 'Panel',
        name: 'DesignerPanel',
        content: DesignerHost,
        props: {}
      }
    ]
  }
};

/**
 * 组件库插件
 */
export const componentsPanePlugin: EditorPluginObject = {
  id: 'builtin-components-pane',
  name: '组件库',
  priority: 100,
  scene: ['global'],
  contributes: {
    skeleton: [
      {
        area: 'leftArea',
        type: 'PanelDock',
        name: 'componentsPaneDock',
        content: ComponentsPane,
        panelProps: {panelName: 'componentsPanePanel', area: 'leftFixedArea'},
        props: {
          title: '组件库',
          icon: Box,
          align: 'top',
          description: '组件库'
        },
        disabledPanelCache: true
      }
    ]
  }
};

/**
 * 设置面板插件
 */
export const settingsPanePlugin: EditorPluginObject = {
  id: 'builtin-settings-pane',
  name: '属性设置',
  priority: 100,
  scene: ['global'],
  contributes: {
    skeleton: [
      {
        area: 'rightArea',
        type: 'Panel',
        name: 'settingsPanel',
        content: SettingsPane,
        props: {}
      }
    ]
  }
};

/**
 * 大纲树插件
 */
export const outlinePanePlugin: EditorPluginObject = {
  id: 'builtin-outline-pane',
  name: '大纲树',
  priority: 100,
  scene: ['global'],
  contributes: {
    skeleton: [
      {
        area: 'leftArea',
        type: 'PanelDock',
        name: 'outlinePaneDock',
        content: OutlinePane,
        panelProps: {panelName: 'outlinePanePanel', area: 'leftFixedArea'},
        props: {
          title: '大纲',
          icon: Histogram,
          align: 'top',
          description: '大纲树'
        },
        disabledPanelCache: true
      }
    ]
  }
};

/**
 * 源码插件
 */
export const schemaPanePlugin: EditorPluginObject = {
  id: 'builtin-schema-pane',
  name: '源码',
  priority: 100,
  scene: ['global'],
  contributes: {
    skeleton: [
      {
        area: 'leftArea',
        type: 'PanelDock',
        name: 'schemaPaneDock',
        content: SchemaPane,
        panelProps: {panelName: 'schemaPanePanel', area: 'leftFixedArea'},
        props: {
          title: '源码',
          icon: DocIcon,
          align: 'top',
          description: 'Schema 源码'
        },
        disabledPanelCache: true
      }
    ]
  }
};

/**
 * 历史记录插件
 */
export const historyPanePlugin: EditorPluginObject = {
  id: 'builtin-history-pane',
  name: '历史记录',
  priority: 100,
  scene: ['global'],
  contributes: {
    skeleton: [
      {
        area: 'leftArea',
        type: 'PanelDock',
        name: 'historyPaneDock',
        content: HistoryPane,
        panelProps: {panelName: 'historyPanePanel', area: 'leftFixedArea'},
        props: {
          title: '历史',
          icon: Clock,
          align: 'bottom',
          description: '历史记录'
        },
        disabledPanelCache: true
      }
    ]
  }
};

/**
 * 核心 setter/action 注册插件
 * 在 init 阶段注册内置 setter 与动作
 */
export const coreRegistryPlugin: EditorPluginObject = {
  id: 'builtin-core-registry',
  name: '核心注册',
  priority: 200,
  scene: ['global'],
  setup(ctx) {
    registerBuiltinSetters(ctx.setterRegistry);
    registerBuiltinActions(ctx.actionRegistry);
  }
};

/**
 * 画布尺寸切换插件（顶栏 Widget）
 */
export const simulatorSizePlugin: EditorPluginObject = {
  id: 'builtin-simulator-size',
  name: '画布尺寸',
  scene: ['global'],
  contributes: {
    skeleton: [
      {
        area: 'topArea',
        type: 'Widget',
        name: 'simulatorSize',
        content: SimulatorSize,
        props: {}
      }
    ]
  }
};

/** 所有内置插件 */
/** 顶部工具栏插件（预览/撤销/节点操作） */
export const toolbarPlugin: EditorPluginObject = {
  id: 'builtin-toolbar',
  name: '工具栏',
  priority: 100,
  scene: ['global'],
  contributes: {
    skeleton: [
      {
        area: 'topArea',
        type: 'Widget',
        name: 'EditorToolbar',
        content: EditorToolbar
      }
    ]
  }
};

export const builtinPlugins: EditorPluginObject[] = [
  coreRegistryPlugin,
  toolbarPlugin,
  simulatorSizePlugin,
  designerPlugin,
  componentsPanePlugin,
  outlinePanePlugin,
  schemaPanePlugin,
  historyPanePlugin,
  settingsPanePlugin
];

/** 图标导出（外部用） */
export {Setting, Tickets};
