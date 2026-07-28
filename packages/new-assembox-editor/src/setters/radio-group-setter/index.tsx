/**
 * RadioGroupSetter - 单选按钮组
 */
import {ElRadioGroup, ElRadioButton, ElRadio} from 'element-plus';
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
    <ElRadioGroup
      modelValue={props.value}
      disabled={props.disabled}
      size={props.size ?? 'small'}
      onUpdate:modelValue={(v: any) => props.onChange(v)}
    >
      {options.map(o =>
        button ? (
          <ElRadioButton
            key={String(o.value)}
            value={o.value}
            disabled={o.disabled}
          >
            {o.label}
          </ElRadioButton>
        ) : (
          <ElRadio key={String(o.value)} value={o.value} disabled={o.disabled}>
            {o.label}
          </ElRadio>
        )
      )}
    </ElRadioGroup>
  );
});
