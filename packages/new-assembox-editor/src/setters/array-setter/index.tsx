import type { PropConfig } from "../../schema/types";

import { Delete, Plus, Rank, ArrowRight } from "@element-plus/icons-vue";
import { ElMessageBox } from "element-plus";
/**
 * ArraySetter - array editor (add/remove/sort items, itemSetter for children)
 */
import { defineComponent, h, ref } from "vue";
import { useAssemNamespace } from "../../hooks/use-assem-namespace";
import { useSetterCtx } from "../base";
import "./array-setter-style.less";

const ns = useAssemNamespace("array-setter");

interface ListItemConfig {
  setter?: string;
  config?: { items: PropConfig[] };
  initialValue?: any;
  props?: Record<string, any>;
}

export const ArraySetter = defineComponent({
  name: "ArraySetter",
  props: {
    value: { type: Array, default: () => [] },
    onChange: { type: Function, required: true },
    itemSetter: { type: [String, Object] as any, default: "StringSetter" },
    itemConfig: {
      type: Object as () => { items: PropConfig[] },
      default: undefined,
    },
    initialValue: { type: null as any, default: "" },
    itemMaxLength: { type: Number, default: undefined },
    disabled: { type: Boolean, default: false },
    mode: { type: String, default: "list" },
    /** 增删/排序后按新 index 重生成每项的键（产出前应用，数据源头保持一致）。
     *  典型：格子 tag（item-N 是 UI 库 slot 命名键，错位=内容错挂）。
     *  仅声明时生效，默认不动原项引用。元数据 setterProps 可直接传函数（TS 模块）。 */
    rekey: { type: Function as unknown as () => ((item: any, index: number) => any), default: undefined },
    /** 数组长度变化时回写的兄弟字段名（如 YqFlexBox 的 itemNum——渲染层按
     *  itemNum 循环读 itemConfig，长度不同步即崩）。仅顶层 props 声明用法
     *  生效（嵌套于 ObjectSetter 时无兄弟字段概念，静默忽略）。 */
    syncLengthField: { type: String, default: undefined },
    /** 所属字段名（settings-pane renderField 透传；syncLengthField 回写定位用） */
    fieldName: { type: String, default: "" },
    /** 子项折叠（窄面板空间优化，借鉴旧版 el-collapse 交互）：true 时子项默认收起，
     *  行头（拖拽柄 + 标题 + 删除）常驻，点击标题切换展开编辑区。默认 false 全展开。 */
    collapsible: { type: Boolean, default: false },
    /** 折叠行标题（collapsible 时用）：(item, index) => string。
     *  典型：格子取 tag（item-N）。默认 `#${index + 1}`。 */
    itemTitle: { type: Function as unknown as () => ((item: any, index: number) => string), default: undefined },
    /** 删除确认文案（声明即开启二次确认——删数组项可能连带子树数据，对齐旧版
     *  popconfirm；文案提示可撤销）。仅一项时无确认必要由 itemMinLength 兜底。 */
    confirmRemove: { type: String, default: undefined },
    /** 最少保留项数（低于该数隐藏删除按钮；如格子至少 1 格，对齐旧版 itemNum>1 才可删） */
    itemMinLength: { type: Number, default: undefined },
  },
  setup(props) {
    const ctx = useSetterCtx();
    const draggingIndex = ref<number | null>(null);
    /** 展开的子项 index 集（collapsible 模式；新增项自动展开便于立即编辑） */
    const expanded = ref<Set<number>>(new Set([0]));

    const getInitial = () => {
      if (props.initialValue !== undefined && props.initialValue !== "") {
        return JSON.parse(JSON.stringify(props.initialValue));
      }
      const itemSetter = props.itemSetter as ListItemConfig;
      if (itemSetter?.initialValue !== undefined) {
        return JSON.parse(JSON.stringify(itemSetter.initialValue));
      }
      return "";
    };

    const resolveItemSetter = () => {
      const itemSetter = props.itemSetter;
      let setterName
        = typeof itemSetter === "string" ? itemSetter : "StringSetter";
      let setterProps: Record<string, any> = {};
      const itemConfig: { items: PropConfig[] } | undefined = props.itemConfig;
      if (typeof itemSetter === "object" && itemSetter) {
        setterName = (itemSetter as ListItemConfig).setter ?? "StringSetter";
        setterProps = (itemSetter as ListItemConfig).props ?? {};
        const cfg = (itemSetter as ListItemConfig).config ?? itemConfig;
        if (setterName === "ObjectSetter" && cfg) {
          setterProps.config = cfg;
        }
      } else if (setterName === "ObjectSetter" && itemConfig) {
        setterProps.config = itemConfig;
      }
      const comp = ctx?.setterRegistry.get(setterName);
      return { comp, setterName, setterProps };
    };

    /** 统一产出通道：应用 rekey + 兄弟字段回写（syncLengthField） */
    const emit = (next: any[]) => {
      const rekeyFn = props.rekey as ((item: any, index: number) => any) | undefined;
      const list = rekeyFn ? next.map((item, index) => rekeyFn(item, index)) : next;
      if (props.syncLengthField && props.fieldName && ctx?.editor && ctx.nodeId) {
        // 顶层用法：onChange 走 updateProps 合并通道，一次写回数组 + 长度字段
        ctx.editor.updateProps(ctx.nodeId, {
          [props.fieldName]: list,
          [props.syncLengthField]: list.length,
        });
        return;
      }
      props.onChange(list);
    };

    const removeItem = (index: number) => {
      if (props.confirmRemove) {
        // 二次确认（删数组项可能连带子树；编辑器有 undo，文案兜底提示）
        ElMessageBox.confirm(props.confirmRemove, "删除确认", {
          type: "warning",
          confirmButtonText: "删除",
          cancelButtonText: "取消",
        })
          .then(() => doRemove(index))
          .catch(() => {/* 取消：无操作 */});
        return;
      }
      doRemove(index);
    };
    const doRemove = (index: number) => {
      const next = [...(props.value ?? [])];
      next.splice(index, 1);
      emit(next);
    };
    const updateItem = (index: number, v: any) => {
      const next = [...(props.value ?? [])];
      next[index] = v;
      emit(next);
    };
    const onDragStart = (index: number) => {
      draggingIndex.value = index;
    };

    const titleOf = (item: any, index: number): string => {
      const fn = props.itemTitle as ((i: any, idx: number) => string) | undefined;
      return fn ? fn(item, index) : `#${index + 1}`;
    };
    const toggleItem = (index: number) => {
      const next = new Set(expanded.value);
      next.has(index) ? next.delete(index) : next.add(index);
      expanded.value = next;
    };
    const addItem = () => {
      const next = [...(props.value ?? []), getInitial()];
      // 新增项自动展开（立即编辑）
      expanded.value = new Set([...expanded.value, next.length - 1]);
      emit(next);
    };
    const onDrop = (index: number) => {
      if (draggingIndex.value === null || draggingIndex.value === index) {
        return;
      }
      const next = [...(props.value ?? [])];
      const [moved] = next.splice(draggingIndex.value, 1);
      next.splice(index, 0, moved);
      draggingIndex.value = null;
      emit(next);
    };

    return () => {
      const list = Array.isArray(props.value) ? props.value : [];
      const { comp: ItemComp, setterName, setterProps } = resolveItemSetter();
      const reachedMax
        = props.itemMaxLength !== undefined && list.length >= props.itemMaxLength;
      /** 低于最少保留数时隐藏删除（如格子至少 1 格） */
      const canRemove
        = props.itemMinLength === undefined || list.length > props.itemMinLength;

      return (
        <div class={ns.b()}>
          {list.length
            ? (
                <div class={ns.e("list")}>
                  {list.map((item: any, index: number) => {
                    const open = !props.collapsible || expanded.value.has(index);
                    const body = ItemComp
                      ? (
                          h(ItemComp, {
                            value: item,
                            disabled: props.disabled,
                            onChange: (v: any) => updateItem(index, v),
                            ...setterProps,
                          })
                        )
                      : (
                          <span class="lc-assem-setter-missing">
                            no setter:
                            {" "}
                            {setterName}
                          </span>
                        );

                    if (props.collapsible) {
                      /* 折叠模式：行头（拖拽柄 + 标题切换 + 删除）常驻，body 展开时下挂 */
                      return (
                        <div
                          key={index}
                          class={[ns.e("item"), ns.m("collapsible"), { [ns.m("collapsed")]: !open }]}
                          draggable={!props.disabled && !open}
                          onDragstart={() => onDragStart(index)}
                          onDragover={(e: DragEvent) => e.preventDefault()}
                          onDrop={() => onDrop(index)}
                        >
                          <div class={ns.e("item-header")}>
                            <span class={ns.e("item-handle")}>
                              <Rank />
                            </span>
                            <div class={ns.e("item-toggle")} onClick={() => toggleItem(index)}>
                              <el-icon class={[ns.e("item-caret"), { [ns.m("open")]: open }]}>
                                <ArrowRight />
                              </el-icon>
                              <span class={ns.e("item-title")}>{titleOf(item, index)}</span>
                            </div>
                            <div class={ns.e("item-actions")}>
                              {canRemove && (
                                <el-button link type="danger" title="删除" disabled={props.disabled} onClick={() => removeItem(index)}
                                >
                                  <Delete />
                                </el-button>
                              )}
                            </div>
                          </div>
                          {open && <div class={ns.e("item-body")}>{body}</div>}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={index}
                        class={ns.e("item")}
                        draggable={!props.disabled}
                        onDragstart={() => onDragStart(index)}
                        onDragover={(e: DragEvent) => e.preventDefault()}
                        onDrop={() => onDrop(index)}
                      >
                        <div class={ns.e("item-handle")}>
                          <Rank />
                        </div>
                        <div class={ns.e("item-body")}>
                          {body}
                        </div>
                        <div class={ns.e("item-actions")}>
                          {canRemove && (
                            <el-button link type="danger" title="删除" disabled={props.disabled} onClick={() => removeItem(index)}
                            >
                              <Delete />
                            </el-button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            : (
                <el-empty
                  description="No items, click below to add"
                  imageSize={40}
                />
              )}
          {!reachedMax && !props.disabled && (
            <el-button
              class={ns.e("add")}
              type="primary"
              link
              onClick={addItem}
            >
              <Plus />
              {" "}
              Add item
            </el-button>
          )}
        </div>
      );
    };
  },
});
