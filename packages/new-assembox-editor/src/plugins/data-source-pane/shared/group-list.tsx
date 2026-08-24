import type { DsGroup } from "./use-grouping";
/**
 * 通用分组折叠列表（服务/方法列表共用）
 * renderItem 由调用方注入，渲染单条卡片
 */
import { defineComponent, PropType } from "vue";
import { useAssemNamespace } from "../../../hooks/use-assem-namespace";

const ns = useAssemNamespace("ds-group-list");

export const DsGroupList = defineComponent({
  name: "DsGroupList",
  props: {
    groups: { type: Array as PropType<DsGroup<any>[]>, default: () => [] },
    /** 渲染单条卡片（item） */
    renderItem: { type: Function as PropType<(item: any) => any>, required: true },
    emptyText: { type: String, default: "暂无配置" },
  },
  setup(props) {
    return () => {
      if (!props.groups.length) {
        return <el-empty description={props.emptyText} imageSize={50} />;
      }
      return (
        <div class={ns.b()}>
          {props.groups.map(group => (
            <div class={ns.e("group")} key={group.title || "默认"}>
              <div class={ns.e("group-title")}>
                <span>{group.title || "默认分组"}</span>
                <span class={ns.e("group-count")}>{group.children.length}</span>
              </div>
              <div class={ns.e("group-body")}>
                {group.children.map(item => props.renderItem(item))}
              </div>
            </div>
          ))}
        </div>
      );
    };
  },
});
