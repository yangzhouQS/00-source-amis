import type { ScenarioProfile } from "../../scenario/types";
import { DEFAULT_PC_ASSETS, PcIframeRenderer } from "../../simulator/iframe/pc-iframe-renderer";
import { PcComponentCatalog } from "./component-catalog";
import { PC_COMPONENTS_ALL } from "./component-metadata-config";
import { PcNestingRules } from "./nesting-rules";
import { PcRenderer } from "./renderer";
import { PcSchemaOps } from "./schema-ops";
import { resolveSlotKeyFromDom } from "./slot-dom";
import { buildSlotSemantics, setSlotSemantics } from "./slot-semantics";
// 设计态空槽位占位提示（inline 模式画布在主文档；lib 构建时随包输出 CSS）
import "./slot-placeholder-style.less";

// 槽位语义注入（docs/19 设计方案）：component-metadata-config 的 slots 声明编译后
// 注入模块级注册点，早于任何 schemaOps/nestingRules 调用（模块加载即完成）
setSlotSemantics(buildSlotSemantics(PC_COMPONENTS_ALL));

/**
 * PC 桌面端场景档案
 */
export const pcDesktopProfile: ScenarioProfile = {
  id: "pc-desktop",
  name: "PC 桌面端",

  schemaOps: new PcSchemaOps(),
  createRenderer: () => new PcRenderer(),
  createIframeRenderer: assets => new PcIframeRenderer(assets),
  // 内置默认依赖（与宿主 renderDependencies 合并：宿主项优先，内置兜底）
  defaultRenderAssets: DEFAULT_PC_ASSETS,
  // 多槽位组件悬停识别（YqFlexLine 左右槽 / YqPanel 内容与工具槽 / YqToolBar 筛选与工具槽）
  resolveSlotKeyFromDom,
  componentCatalog: new PcComponentCatalog(),
  nestingRules: new PcNestingRules(),
  emptySchema: () => new PcSchemaOps().emptySchema(),
};
