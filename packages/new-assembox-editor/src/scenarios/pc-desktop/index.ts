import type { ScenarioProfile } from "../../scenario/types";
import { DEFAULT_PC_ASSETS, PcIframeRenderer } from "../../simulator/iframe/pc-iframe-renderer";
import { PcComponentCatalog } from "./component-catalog";
import { PcNestingRules } from "./nesting-rules";
import { PcRenderer } from "./renderer";
import { PcSchemaOps } from "./schema-ops";

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
  componentCatalog: new PcComponentCatalog(),
  nestingRules: new PcNestingRules(),
  emptySchema: () => new PcSchemaOps().emptySchema(),
};
