import type { EditorPluginObject } from "../../core/plugin-types";
import { Coin } from "@element-plus/icons-vue";
/**
 * 数据源配置插件（服务/模型/方法 三 Tab）
 * - 独立快照历史（30 步，与 schema 撤销栈隔离）
 * - 防抖 flush：editor.dataSource 引用替换 + 画布热更新（可选通道）+ ds:changed 事件
 * - 接口与服务合一（v1.1）：url/method 内联于服务配置，api.list 仅兼容透传
 */
import { token } from "../../core/di-container";
import type { DsDocHandle } from "./doc/use-data-source-doc";
import { evictDataSourceDoc, useDataSourceDoc } from "./doc/use-data-source-doc";
import type { DsHostOptions } from "./doc/types";
import { DataSourcePane } from "./data-source-pane";

/** DI token：数据源文档实例（供 setter 联动/其他插件消费） */
export const DATA_SOURCE_DOC = token<DsDocHandle>("data-source-doc");

export interface DataSourcePluginOptions extends DsHostOptions {}

export const dataSourcePanePlugin: EditorPluginObject<DataSourcePluginOptions> = {
  id: "builtin-data-source-pane",
  name: "数据源",
  priority: 100,
  scene: ["global"],
  contributes: {
    skeleton: [
      {
        area: "leftArea",
        type: "PanelDock",
        name: "dataSourcePaneDock",
        content: DataSourcePane,
        panelProps: { panelName: "dataSourcePanePanel", area: "leftFixedArea" },
        props: { title: "数据源", icon: Coin, align: "top", description: "服务/模型/方法" },
        disabledPanelCache: true,
      },
    ],
  },
  setup(ctx, options) {
    const doc = useDataSourceDoc(ctx.editor);
    ctx.di.register(DATA_SOURCE_DOC, doc);
    doc.setHostOptions(options ?? {});
    return () => {
      doc.dispose();
      evictDataSourceDoc(ctx.editor);
    };
  },
};
