import type { PropType } from "vue";
/**
 * Row — 通用属性行容器（标签 + 内容）
 * 参考 lowcode Row：标签有值时高亮，支持 slot 内容或 radio-group
 */
import { defineComponent } from "vue";
import { useAssemNamespace } from "../../hooks/use-assem-namespace";

const ns = useAssemNamespace("style-row");

export const StyleRow = defineComponent({
  name: "StyleRow",
  props: {
    title: { type: String, default: "" },
    hasValue: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    return () => (
      <div class={[ns.b(), props.hasValue ? ns.is("active") : ""]}>
        {props.title && <div class={ns.e("title")}>{props.title}</div>}
        <div class={ns.e("content")}>{slots.default?.()}</div>
      </div>
    );
  },
});

/** Radio 项定义 */
export interface RadioItem {
  value: string;
  icon?: string;
  title?: string;
  tips?: string;
}

/**
 * RadioGroup — 图标按钮组（选中切换）
 * 参考 lowcode RadioGroup：点击相同值取消（toggle off）
 */
export const StyleRadioGroup = defineComponent({
  name: "StyleRadioGroup",
  props: {
    modelValue: { type: String, default: "" },
    dataList: { type: Array as PropType<RadioItem[]>, default: () => [] },
  },
  emits: ["update:modelValue", "change"],
  setup(props, { emit }) {
    const handleClick = (item: RadioItem) => {
      if (props.modelValue === item.value) {
        emit("update:modelValue", "");
        emit("change", "");
      } else {
        emit("update:modelValue", item.value);
        emit("change", item.value);
      }
    };
    return () => (
      <el-radio-group
        modelValue={props.modelValue}
        onUpdate:modelValue={(v: string) => emit("update:modelValue", v)}
      >
        {props.dataList.map(item => (
          <el-tooltip
            key={item.value}
            content={item.tips ?? item.title ?? item.value}
            placement="top"
            showAfter={400}
          >
            <el-radio-button
              value={item.value}
              label={item.value}
              onClick={() => handleClick(item)}
            >
              {item.icon ? <i class={item.icon} /> : item.title ?? item.value}
            </el-radio-button>
          </el-tooltip>
        ))}
      </el-radio-group>
    );
  },
});
