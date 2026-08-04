import type { IComponentCatalog, ComponentCatalogItem } from '../../scenario/types';
import { PC_COMPONENTS, PC_GROUPS, PC_CATEGORIES } from './component-metadata';

/**
 * PC 场景组件目录
 */
export class PcComponentCatalog implements IComponentCatalog {
  getComponents(): ComponentCatalogItem[] {
    return PC_COMPONENTS;
  }

  getGroups(): { name: string; title: string }[] {
    return PC_GROUPS;
  }

  getCategories(groupName: string): { name: string; title: string }[] {
    const groupComponents = PC_COMPONENTS.filter((c) => c.group === groupName);
    const usedCategories = new Set(groupComponents.map((c) => c.category));
    return PC_CATEGORIES.filter((cat) => usedCategories.has(cat.name));
  }
}
