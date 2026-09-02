/**
 * 内置插件集
 * 通过 PluginManager 激活，contributes.skeleton 贡献布局面板
 */
import type { EditorPluginObject } from "../core/plugin-types";
import {
  Clock,
  Coin,
  Document as DocIcon,
  Grid,
  Histogram,
  Setting,
  Tickets,
} from "@element-plus/icons-vue";
import { registerBuiltinActions } from "../actions/builtin-actions";
import { DesignerHost } from "../designer/designer-host";
import { registerBuiltinSetters } from "../setters";
import { ComponentsPane } from "./components-pane/components-pane";
import { dataSourcePanePlugin } from "./data-source-pane";
import { DocLibraryLink } from "./doc-library/doc-library-link";
import { EditorToolbar } from "./editor-toolbar/editor-toolbar";
import { HistoryPane } from "./history-pane/history-pane";
import { OutlinePane } from "./outline-pane";
import { SceneSwitcher } from "./scene-switcher/scene-switcher";
import { SchemaPane } from "./schema-pane/schema-pane";
import { SettingsPane } from "./settings-pane/settings-pane";
import { SimulatorSize } from "./simulator-size/simulator-size";

/**
 * Designer 插件：注册中央画布
 */
export const designerPlugin: EditorPluginObject = {
  id: "builtin-designer",
  name: "画布",
  priority: 100,
  scene: ["global"],
  contributes: {
    skeleton: [
      {
        area: "centerArea",
        type: "Panel",
        name: "DesignerPanel",
        content: DesignerHost,
        props: {},
      },
    ],
  },
};

/**
 * 组件库插件
 */
export const componentsPanePlugin: EditorPluginObject = {
  id: "builtin-components-pane",
  name: "组件库",
  priority: 100,
  scene: ["global"],
  contributes: {
    skeleton: [
      {
        area: "leftArea",
        type: "PanelDock",
        name: "componentsPaneDock",
        content: ComponentsPane,
        panelProps: { panelName: "componentsPanePanel", area: "leftFixedArea" },
        props: {
          title: "组件库",
          icon: Grid,
          align: "top",
          description: "组件库",
        },
        disabledPanelCache: true,
      },
    ],
  },
};

/**
 * 设置面板插件
 */
export const settingsPanePlugin: EditorPluginObject = {
  id: "builtin-settings-pane",
  name: "属性设置",
  priority: 100,
  scene: ["global"],
  contributes: {
    skeleton: [
      {
        area: "rightArea",
        type: "Panel",
        name: "settingsPanel",
        content: SettingsPane,
        props: {},
      },
    ],
  },
};

/**
 * 大纲树插件
 * - 左侧 dock 常规入口（master）
 * - 右侧 backup 面板：拖拽期间若两侧大纲树均不可见，临时切换显示
 *   （对齐 lc-engine OutlinePlugin 的 switchPanes 状态机，详见
 *    new-docs/outline-drag-unification-design.md §12 决策记录）
 */
export const outlinePanePlugin: EditorPluginObject = {
  id: "builtin-outline-pane",
  name: "大纲树",
  priority: 100,
  scene: ["global"],
  contributes: {
    skeleton: [
      {
        area: "leftArea",
        type: "PanelDock",
        name: "outlinePaneDock",
        content: OutlinePane,
        panelProps: { panelName: "outlinePanePanel", area: "leftFixedArea" },
        props: {
          title: "大纲",
          icon: Histogram,
          align: "top",
          description: "大纲树",
        },
        disabledPanelCache: true,
      },
      {
        area: "rightArea",
        type: "Panel",
        name: "outlinePaneBackupPanel",
        content: OutlinePane,
        panelProps: { initInactive: true, hideTitleBar: true },
        props: { title: "大纲", index: 1 },
      },
    ],
  },
  setup(ctx) {
    const skeleton = ctx.skeleton;
    const backup = () => skeleton.getPanel("outlinePaneBackupPanel");
    const settings = () => skeleton.getPanel("settingsPanel");
    /** 左侧大纲（master）当前是否可见：fixed/float 两区任一激活即算 */
    const masterVisible = () => skeleton.getPanel("outlinePanePanel")?.active === true;
    /** 拖拽前 backup 是否已激活（拖拽起于 backup 内树时的还原依据） */
    let backupWasActive = false;

    /** 拖拽开始：两侧树都不可见 → 切换右侧属性面板为大纲树 */
    const onDragstart = () => {
      const b = backup();
      if (!b) {
        return;
      }
      backupWasActive = b.active;
      if (!masterVisible() && !b.active) {
        b.setActive(true);
        settings()?.setActive(false);
      }
    };
    /** 拖拽结束：仅还原本次切换（拖前已激活的场景不动） */
    const onDragend = () => {
      const b = backup();
      if (!b) {
        return;
      }
      if (!backupWasActive && b.active) {
        b.setActive(false);
        settings()?.setActive(true);
      }
    };
    const off = ctx.editor.dragon.on({ onDragstart, onDragend });
    return () => off();
  },
};

/**
 * 源码插件
 */
export const schemaPanePlugin: EditorPluginObject = {
  id: "builtin-schema-pane",
  name: "源码",
  priority: 100,
  scene: ["global"],
  contributes: {
    skeleton: [
      {
        area: "leftArea",
        type: "PanelDock",
        name: "schemaPaneDock",
        content: SchemaPane,
        panelProps: { panelName: "schemaPanePanel", area: "leftFixedArea" },
        props: {
          title: "源码",
          icon: DocIcon,
          align: "top",
          description: "Schema 源码",
        },
        disabledPanelCache: true,
      },
    ],
  },
};

/**
 * 历史记录插件
 */
export const historyPanePlugin: EditorPluginObject = {
  id: "builtin-history-pane",
  name: "历史记录",
  priority: 100,
  scene: ["global"],
  contributes: {
    skeleton: [
      {
        area: "leftArea",
        type: "PanelDock",
        name: "historyPaneDock",
        content: HistoryPane,
        panelProps: { panelName: "historyPanePanel", area: "leftFixedArea" },
        props: {
          title: "历史",
          icon: Clock,
          align: "bottom",
          description: "历史记录",
        },
        disabledPanelCache: true,
      },
    ],
  },
};

/**
 * 文档库链接插件（左侧底部图标，点击跳转外部组件文档）
 */
export const docLibraryPlugin: EditorPluginObject = {
  id: "builtin-doc-library",
  name: "文档库",
  priority: 100,
  scene: ["global"],
  contributes: {
    skeleton: [
      {
        area: "leftArea",
        type: "Widget",
        name: "docLibraryLink",
        content: DocLibraryLink,
        props: {
          align: "bottom",
          description: "组件文档库",
        },
        contentProps: {
          url: "https://test.yearrow.com/yunque-element/component-library/02-layout-guide/04-panel.html",
        },
      },
    ],
  },
};

/**
 * 核心 setter/action 注册插件
 * 在 init 阶段注册内置 setter 与动作
 */
export const coreRegistryPlugin: EditorPluginObject = {
  id: "builtin-core-registry",
  name: "核心注册",
  priority: 200,
  scene: ["global"],
  setup(ctx) {
    registerBuiltinSetters(ctx.setterRegistry);
    registerBuiltinActions(ctx.actionRegistry);
  },
};

/**
 * 画布尺寸切换插件（顶栏 Widget）
 */
export const simulatorSizePlugin: EditorPluginObject = {
  id: "builtin-simulator-size",
  name: "画布尺寸",
  scene: ["global"],
  contributes: {
    skeleton: [
      {
        area: "topArea",
        type: "Widget",
        name: "simulatorSize",
        content: SimulatorSize,
        props: {},
      },
    ],
  },
};

/**
 * 场景切换插件（顶栏 Widget，多路由页面切换）
 */
export const sceneSwitcherPlugin: EditorPluginObject = {
  id: "builtin-scene-switcher",
  name: "场景切换",
  scene: ["global"],
  contributes: {
    skeleton: [
      {
        area: "topArea",
        type: "Widget",
        name: "sceneSwitcher",
        content: SceneSwitcher,
        props: {},
      },
    ],
  },
};

/** 所有内置插件 */
/** 顶部工具栏插件（预览/撤销/节点操作） */
export const toolbarPlugin: EditorPluginObject = {
  id: "builtin-toolbar",
  name: "工具栏",
  priority: 100,
  scene: ["global"],
  contributes: {
    skeleton: [
      {
        area: "topArea",
        type: "Widget",
        name: "EditorToolbar",
        content: EditorToolbar,
      },
    ],
  },
};

export const builtinPlugins: EditorPluginObject[] = [
  coreRegistryPlugin,
  toolbarPlugin,
  simulatorSizePlugin,
  sceneSwitcherPlugin,
  designerPlugin,
  componentsPanePlugin,
  dataSourcePanePlugin,
  outlinePanePlugin,
  schemaPanePlugin,
  historyPanePlugin,
  docLibraryPlugin,
  settingsPanePlugin,
];

/** 图标导出（外部用） */
export { Setting, Tickets };
