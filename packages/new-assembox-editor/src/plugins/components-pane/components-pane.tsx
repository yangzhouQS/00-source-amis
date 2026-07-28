/**
 * 组件库面板（拖拽源）
 * 从 ComponentRegistry 读取，按 group/category 分组
 * 支持拖入画布（DnD）与点击插入
 */
import {defineComponent, PropType} from 'vue';
import {ElCollapse, ElCollapseItem, ElEmpty, ElIcon} from 'element-plus';
import type {Editor} from '../../core/editor';
import type {ComponentMeta} from '../../schema/types';
import './../pane.less';

export const ComponentsPane = defineComponent({
  name: 'ComponentsPane',
  props: {
    editor: {type: Object as PropType<Editor>, required: true}
  },
  setup(props) {
    /** 拖拽开始（自模拟引擎，mousedown 触发） */
    const onMouseDown = (e: MouseEvent, meta: ComponentMeta) => {
      props.editor.startComponentDrag(e, meta.type);
    };

    /** 点击插入到根 */
    const onClickInsert = (meta: ComponentMeta) => {
      const node = props.editor.componentRegistry.createNode(meta.type);
      if (node) {
        props.editor.insert(props.editor.store.schema.$$id, 'body', node);
      }
    };

    return () => {
      const groups = props.editor.componentRegistry.groupForPalette();
      if (groups.size === 0) {
        return (
          <div class="assem-components-pane">
            <ElEmpty description="暂无组件，请注册组件" imageSize={60} />
          </div>
        );
      }
      const groupList = Array.from(groups.entries());
      return (
        <div class="assem-components-pane">
          {groupList.length > 1 ? (
            <ElCollapse modelValue={groupList.map(g => g[0])}>
              {groupList.map(([groupName, categories]) => (
                <ElCollapseItem
                  key={groupName}
                  title={groupName}
                  name={groupName}
                >
                  {renderCategories(categories, onMouseDown, onClickInsert)}
                </ElCollapseItem>
              ))}
            </ElCollapse>
          ) : (
            renderCategories(
              groups.values().next().value ?? new Map(),
              onMouseDown,
              onClickInsert
            )
          )}
        </div>
      );
    };
  }
});

function renderCategories(
  categories: Map<string, ComponentMeta[]>,
  onMouseDown: (e: MouseEvent, m: ComponentMeta) => void,
  onClickInsert: (m: ComponentMeta) => void
) {
  return Array.from(categories.entries()).map(([catName, items]) => (
    <div class="assem-category" key={catName}>
      <div class="assem-category-title">{catName}</div>
      <div class="assem-category-grid">
        {items.map(meta => (
          <div
            key={meta.type}
            class="assem-component-item"
            onMousedown={(e: MouseEvent) => onMouseDown(e, meta)}
            onClick={() => onClickInsert(meta)}
            title={meta.description || meta.name}
          >
            <ElIcon class="assem-component-icon">
              {meta.icon ? <meta.icon /> : <span>·</span>}
            </ElIcon>
            <span class="assem-component-name">{meta.name}</span>
          </div>
        ))}
      </div>
    </div>
  ));
}
