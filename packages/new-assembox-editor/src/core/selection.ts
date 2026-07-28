/**
 * 选区管理
 */
import type {NodeId} from '../schema/types';
import type {EditorStore} from './store';

export class Selection {
  constructor(private readonly store: EditorStore) {}

  select(id: NodeId | null): void {
    this.store.select(id);
  }

  toggleSelect(id: NodeId): void {
    this.store.toggleSelect(id);
  }

  clear(): void {
    this.store.clearSelection();
  }

  get selectedIds(): NodeId[] {
    return this.store.state.selectedIds;
  }

  get activeId(): NodeId | null {
    return this.store.state.activeId;
  }

  isSelected(id: NodeId): boolean {
    return this.store.isSelected(id);
  }
}
