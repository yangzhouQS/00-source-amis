import type { ScenarioProfile } from '../../scenario/types';
import { PcSchemaOps } from './schema-ops';
import { PcRenderer } from './renderer';
import { PcComponentCatalog } from './component-catalog';
import { PcNestingRules } from './nesting-rules';
import { PcIframeRenderer } from '../../simulator/iframe/pc-iframe-renderer';

/**
 * PC 桌面端场景档案
 */
export const pcDesktopProfile: ScenarioProfile = {
  id: 'pc-desktop',
  name: 'PC 桌面端',

  schemaOps: new PcSchemaOps(),
  createRenderer: () => new PcRenderer(),
  createIframeRenderer: () => new PcIframeRenderer(),
  componentCatalog: new PcComponentCatalog(),
  nestingRules: new PcNestingRules(),
  emptySchema: () => new PcSchemaOps().emptySchema(),
};
