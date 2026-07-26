import { defineComponent, computed } from 'vue';
import { ElCollapse, ElCollapseItem, ElIcon } from 'element-plus';
import { Rank } from '@element-plus/icons-vue';
import { groupComponents } from '@/builtin-components';
import { getAvailableComponents } from '@/core/component-registry';
import { addComponent } from '@/core/editor-actions';
import type { ComponentLibItem } from '@/types/schema';

export default defineComponent({
  name: 'ComponentLibrary',
  setup() {
    const groups = computed(() => groupComponents(getAvailableComponents()));

    const handleDragStart = (e: DragEvent, item: ComponentLibItem) => {
      if (!e.dataTransfer) return;
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('application/x-amis-component', item.type);
      e.dataTransfer.setData('text/plain', item.type);
    };

    const handleClick = (item: ComponentLibItem) => {
      addComponent(item.type);
    };

    return () => (
      <div class="amis-comp-lib">
        <ElCollapse modelValue={groups.value.map(g => g.group)}>
          {groups.value.map(group => (
            <ElCollapseItem title={group.group} name={group.group}>
              <div class="amis-comp-lib__grid">
                {group.items.map(item => (
                  <div
                    class="amis-comp-lib__item"
                    draggable
                    title={`点击添加 ${item.name}（或拖到画布）`}
                    onDragstart={(e: DragEvent) => handleDragStart(e, item)}
                    onClick={() => handleClick(item)}
                  >
                    <ElIcon class="amis-comp-lib__drag">
                      <Rank />
                    </ElIcon>
                    <span>{item.name}</span>
                  </div>
                ))}
              </div>
            </ElCollapseItem>
          ))}
        </ElCollapse>
      </div>
    );
  }
});
