import type { ComponentCatalogItem, IComponentCatalog } from "../../scenario/types";
import { PC_CATEGORIES, PC_GROUPS } from "./component-metadata";
import { PC_COMPONENTS_PANEL } from "./component-metadata-config";

/**
 * PC 场景组件目录
 */
export class PcComponentCatalog implements IComponentCatalog {
  getComponents(): ComponentCatalogItem[] {
    return PC_COMPONENTS_PANEL;
  }

  getGroups(): { name: string; title: string }[] {
    return PC_GROUPS;
  }

  getCategories(groupName: string): { name: string; title: string }[] {
    const groupComponents = PC_COMPONENTS_PANEL.filter(c => c.group === groupName);
    const usedCategories = new Set(groupComponents.map(c => c.category));
    return PC_CATEGORIES.filter(cat => usedCategories.has(cat.name));
  }
}
