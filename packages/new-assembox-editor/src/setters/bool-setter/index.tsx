/**
 * BoolSetter - 布尔开关
 */
import {defineSetter, renderPreview} from '../base';

export const BoolSetter = defineSetter<boolean>('BoolSetter', props => {
  if (props.isPreview) return renderPreview(props.value ? '是' : '否');
  return (
    <el-switch
      modelValue={!!props.value}
      disabled={props.disabled}
      activeText={props.activeText}
      inactiveText={props.inactiveText}
      activeValue={props.activeValue ?? true}
      inactiveValue={props.inactiveValue ?? false}
      onUpdate:modelValue={(v: any) => props.onChange(!!v)}
    />
  );
});
