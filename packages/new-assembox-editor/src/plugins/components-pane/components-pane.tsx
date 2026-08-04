/**
 * 组件库面板（拖拽源）
 * 从场景 catalog（IComponentCatalog）读取，按 group/category 分组
 * 支持搜索过滤 + 拖入画布（DnD）与点击插入；BEM 类名（component-pane block）
 */
import {defineComponent, PropType, ref, computed} from 'vue';
import {
  ElCollapse,
  ElCollapseItem,
  ElEmpty,
  ElIcon,
  ElInput,
  ElScrollbar
} from 'element-plus';
import type {Editor} from '../../core/editor';
import type {ComponentCatalogItem} from '../../scenario/types';
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

    const onMouseDown = (e: MouseEvent, item: ComponentCatalogItem) => {
      props.editor.startComponentDrag(e, item.renderType);
    };

    const onClickInsert = (item: ComponentCatalogItem) => {
      const parentId = props.editor.rootNodeId;
      if (!parentId) return;
      const node = props.editor.schemaOps.createNode(
        item.renderType,
        item.name,
        props.editor.schemaOps.cloneSchema(item.scaffold)
      );
      props.editor.insert(parentId, 'defaultSlot', node);
    };

    /** 按 group/category 分组（结构：group → category → items） */
    const grouped = computed(() => {
      const groups = props.editor.catalog.getGroups();
      const components = props.editor.catalog.getComponents();
      const map = new Map<string, Map<string, ComponentCatalogItem[]>>();
      for (const g of groups) {
        map.set(g.title, new Map());
      }
      for (const c of components) {
        const g = groups.find(x => x.name === c.group);
        const gTitle = g?.title ?? c.group ?? '其他';
        if (!map.has(gTitle)) map.set(gTitle, new Map());
        const cats = map.get(gTitle)!;
        const cTitle = c.category ?? '其他';
        if (!cats.has(cTitle)) cats.set(cTitle, []);
        cats.get(cTitle)!.push(c);
      }
      return map;
    });

    /** 按关键字过滤分组（匹配 name/renderType） */
    const filteredGroups = computed(() => {
      const groups = grouped.value;
      const kw = keyword.value.trim().toLowerCase();
      if (!kw) return groups;
      const result = new Map<string, Map<string, ComponentCatalogItem[]>>();
      for (const [groupName, categories] of groups) {
        const newCats = new Map<string, ComponentCatalogItem[]>();
        for (const [catName, items] of categories) {
          const matched = items.filter(
            m =>
              (m.name ?? '').toLowerCase().includes(kw) ||
              m.renderType.toLowerCase().includes(kw)
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
          <div class={ns.e('search')}>
            <ElInput
              modelValue={keyword.value}
              onUpdate:modelValue={(v: string) => (keyword.value = v)}
              placeholder="搜索组件"
              clearable
              size="small"
              prefix-icon="Search"
            />
          </div>
          <ElScrollbar class={ns.e('scroll')}>
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
          </ElScrollbar>
        </div>
      );
    };
  }
});

function renderCategories(
  categories: Map<string, ComponentCatalogItem[]>,
  onMouseDown: (e: MouseEvent, m: ComponentCatalogItem) => void,
  onClickInsert: (m: ComponentCatalogItem) => void
) {
  return Array.from(categories.entries()).map(([catName, items]) => (
    <div class={ns.e('category')} key={catName}>
      <div class={ns.e('category-title')}>{catName}</div>
      <div class={ns.e('category-grid')}>
        {items.map(item => (
          <div
            key={item.renderType}
            class={ns.e('item')}
            onMousedown={(e: MouseEvent) => onMouseDown(e, item)}
            onClick={() => onClickInsert(item)}
            title={item.name}
          >
            <ElIcon class={ns.e('icon')}>
              <span>·</span>
            </ElIcon>
            <span class={ns.e('name')}>{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  ));
}
