/**
 * 组件库面板（拖拽源）
 * 从 ComponentRegistry 读取，按 group/category 分组
 * 支持搜索过滤 + 拖入画布（DnD）与点击插入；BEM 类名（component-pane block）
 */
import {defineComponent, PropType, ref, computed} from 'vue';
import {
  ElCollapse,
  ElCollapseItem,
  ElEmpty,
  ElIcon,
  ElInput
} from 'element-plus';
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
    const keyword = ref('');

    const onMouseDown = (e: MouseEvent, meta: ComponentMeta) => {
      props.editor.startComponentDrag(e, meta.type);
    };

    const onClickInsert = (meta: ComponentMeta) => {
      const node = props.editor.componentRegistry.createNode(meta.type);
      if (node) {
        props.editor.insert(props.editor.store.schema.$$id, 'body', node);
      }
    };

    /** 按关键字过滤分组（匹配 name/type/description/tags） */
    const filteredGroups = computed(() => {
      const groups = props.editor.componentRegistry.groupForPalette();
      const kw = keyword.value.trim().toLowerCase();
      if (!kw) return groups;
      const result = new Map<string, Map<string, ComponentMeta[]>>();
      for (const [groupName, categories] of groups) {
        const newCats = new Map<string, ComponentMeta[]>();
        for (const [catName, items] of categories) {
          const matched = items.filter(
            m =>
              (m.name ?? '').toLowerCase().includes(kw) ||
              m.type.toLowerCase().includes(kw) ||
              (m.description ?? '').toLowerCase().includes(kw) ||
              (m.tags ?? []).some(t => t.toLowerCase().includes(kw))
          );
          if (matched.length) newCats.set(catName, matched);
        }
        if (newCats.size) result.set(groupName, newCats);
      }
      return result;
    });

    return () => {
      const groups = filteredGroups.value;
      const groupList = Array.from(groups.entries());
      return (
        <div class={ns.b()}>
          <div class={ns.e('search')} style={{padding: '8px'}}>
            <ElInput
              modelValue={keyword.value}
              onUpdate:modelValue={(v: string) => (keyword.value = v)}
              placeholder="搜索组件"
              clearable
              size="small"
            />
          </div>
          {groups.size === 0 ? (
            <ElEmpty
              description={
                keyword.value ? '未找到匹配组件' : '暂无组件，请注册组件'
              }
              imageSize={60}
            />
          ) : groupList.length > 1 ? (
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
            {meta.snippets && meta.snippets.length > 1 ? (
              <span
                class={ns.e('snippet-count')}
                style={{fontSize: '10px', color: '#909399', marginLeft: '4px'}}
              >
                {meta.snippets.length}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  ));
}
