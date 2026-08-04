/**
 * StringSetter - 字符串输入
 */
import { defineSetter, renderPreview } from "../base";

export const StringSetter = defineSetter<string>("StringSetter", (props) => {
  if (props.isPreview) {
    return renderPreview(props.value);
  }
  return (
    <el-input
      modelValue={props.value ?? ""}
      placeholder={props.placeholder || "请输入"}
      disabled={props.disabled}
      clearable={props.clearable ?? true}
      onUpdate:modelValue={(v: string) => props.onChange(v ?? "")}
    />
  );
});
