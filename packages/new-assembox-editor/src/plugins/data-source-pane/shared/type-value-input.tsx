import type { DsValueType } from "../doc/types";
/**
 * 类型感知默认值输入
 * string → 文本框；number → 数字框；boolean → 开关；list/object → JSON 多行文本
 * 编辑态与存储态同型（真布尔/真数字），消灭旧版字符串化往返
 */
import { ElMessage } from "element-plus";
import { defineComponent, PropType } from "vue";
import { useAssemNamespace } from "../../../hooks/use-assem-namespace";

const ns = useAssemNamespace("ds-value-input");

export const DsValueInput = defineComponent({
  name: "DsValueInput",
  props: {
    modelValue: { type: null as any, default: undefined },
    valueType: { type: String as PropType<DsValueType | undefined>, default: undefined },
    onChange: { type: Function as PropType<(v: any) => void>, required: true },
    size: { type: String as PropType<"small" | "default">, default: "small" },
    placeholder: { type: String, default: "" },
  },
  setup(props) {
    const parseJsonLike = (text: string): boolean => {
      if (!text.trim()) {
        props.onChange(undefined);
        return true;
      }
      try {
        props.onChange(JSON.parse(text));
        return true;
      }
      catch {
        ElMessage.warning("JSON 格式错误，请检查默认值");
        return false;
      }
    };

    return () => {
      switch (props.valueType) {
        case "number":
          return (
            <el-input-number
              modelValue={typeof props.modelValue === "number" ? props.modelValue : undefined}
              onUpdate:modelValue={(v: number | undefined) => props.onChange(v)}
              size={props.size}
              controlsPosition="right"
              style="width:100%"
              placeholder={props.placeholder}
            />
          );
        case "boolean":
          return (
            <el-switch
              modelValue={props.modelValue === true}
              onUpdate:modelValue={(v: boolean) => props.onChange(v)}
              size={props.size}
            />
          );
        case "list":
        case "object": {
          const text = props.modelValue === undefined || props.modelValue === null
            ? ""
            : JSON.stringify(props.modelValue, null, 2);
          return (
            <el-input
              class={ns.b()}
              modelValue={text}
              onChange={(v: string) => parseJsonLike(v)}
              type="textarea"
              autosize={{ minRows: 1, maxRows: 4 }}
              size={props.size}
              placeholder="JSON 数组/对象"
            />
          );
        }
        case "string":
        default:
          return (
            <el-input
              modelValue={typeof props.modelValue === "string" ? props.modelValue : props.modelValue === undefined || props.modelValue === null ? "" : String(props.modelValue)}
              onUpdate:modelValue={(v: string) => props.onChange(v)}
              size={props.size}
              clearable
              placeholder={props.placeholder}
            />
          );
      }
    };
  },
});
