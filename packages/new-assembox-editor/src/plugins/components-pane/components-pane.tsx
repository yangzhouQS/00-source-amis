/**
 * 组件库面板（拖拽源）
 * 从 ComponentRegistry 读取，按 group/category 分组
 * 支持拖入画布（DnD）与点击插入；BEM 类名（component-pane block）
 */
import {defineComponent, PropType} from 'vue';
import {ElCollapse, ElCollapseItem, ElEmpty, ElIcon} from 'element-plus';
import type {Editor} from '../../core/editor';
import type {ComponentMeta} from '../../schema/types';
import {useAssemNamespace} from '../../hooks/use-assem-namespace';
import './../pane.less';

const ns = useAssemNamespace('component-pane');

export const ComponentsPane = defineComponent({
  name: 'ComponentsPane',
  props: {
    editor: {type: Object as PropType<Editor>, required: true}
  },
  setup(props) {
    const onMouseDown = (e: MouseEvent, meta: ComponentMeta) => {
      props.editor.startComponentDrag(e, meta.type);
    };

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
          <div class={ns.b()}>
            <ElEmpty description="暂无组件，请注册组件" imageSize={60} />
          </div>
        );
      }
      const groupList = Array.from(groups.entries());
      return (
        <div class={ns.b()}>
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
    <div class={ns.e('category')} key={catName}>
      <div class={ns.e('category-title')}>{catName}</div>
      <div class={ns.e('category-grid')}>
        {items.map(meta => (
          <div
            key={meta.type}
            class={ns.e('item')}
            onMousedown={(e: MouseEvent) => onMouseDown(e, meta)}
            onClick={() => onClickInsert(meta)}
            title={meta.description || meta.name}
          >
            <ElIcon class={ns.e('icon')}>
              {meta.icon ? <meta.icon /> : <span>·</span>}
            </ElIcon>
            <span class={ns.e('name')}>{meta.name}</span>
          </div>
        ))}
      </div>
    </div>
  ));
}
