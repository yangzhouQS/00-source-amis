import type { INestingRules } from '../../scenario/types';
import {
  lookupSlotGate,
  isCategoryAllowed,
  lookupMeta,
  type SlotField,
  type SlotHost,
} from '@cs/assembox-desktop-next';

/**
 * PC 场景嵌套校验
 * 直接包装 assembox-desktop-next 的 nesting.ts + component-catalog.ts
 */
export class PcNestingRules implements INestingRules {
  canNest(parentRenderType: string, slotKey: string, childRenderType: string): boolean {
    const gate = lookupSlotGate(parentRenderType as SlotHost, slotKey as SlotField);
    if (!gate) return true;
    if (gate === 'any') return true;
    const childMeta = lookupMeta(childRenderType);
    if (!childMeta) return false;
    return isCategoryAllowed(childMeta.category, gate);
  }

  getAllowedCategories(parentRenderType: string, slotKey: string): string[] | undefined {
    const gate = lookupSlotGate(parentRenderType as SlotHost, slotKey as SlotField);
    if (!gate || gate === 'any') return undefined;
    return gate;
  }

  getCategory(renderType: string): string | undefined {
    return lookupMeta(renderType)?.category;
  }
}
