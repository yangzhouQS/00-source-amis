/**
 * RadioGroupSetter - 单选按钮组
 */
import {defineSetter, normalizeOptions, renderPreview} from '../base';

export const RadioGroupSetter = defineSetter<any>('RadioGroupSetter', props => {
  if (props.isPreview) {
    const opt = normalizeOptions(props.options).find(
      o => o.value === props.value
    );
    return renderPreview(opt?.label ?? props.value);
  }
  const options = normalizeOptions(props.options);
  const button = props.button ?? true;
  return (
    <el-radio-group
      modelValue={props.value}
      disabled={props.disabled}
      size={props.size ?? 'small'}
      onUpdate:modelValue={(v: any) => props.onChange(v)}
    >
      {options.map(o =>
        button ? (
          <el-radio-button
            key={String(o.value)}
            value={o.value}
            disabled={o.disabled}
          >
            {o.label}
          </el-radio-button>
        ) : (
          <el-radio key={String(o.value)} value={o.value} disabled={o.disabled}>
            {o.label}
          </el-radio>
        )
      )}
    </el-radio-group>
  );
});
