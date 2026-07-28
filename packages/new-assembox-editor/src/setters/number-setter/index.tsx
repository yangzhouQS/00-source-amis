/**
 * NumberSetter - 数字输入
 */
import {ElInputNumber} from 'element-plus';
import {defineSetter, renderPreview} from '../base';

export const NumberSetter = defineSetter<number>('NumberSetter', props => {
  if (props.isPreview) return renderPreview(props.value);
  return (
    <ElInputNumber
      modelValue={
        typeof props.value === 'number' ? props.value : props.defaultValue ?? 0
      }
      min={props.min}
      max={props.max}
      step={props.step ?? 1}
      precision={props.precision}
      disabled={props.disabled}
      controlsPosition={props.controlsPosition ?? 'right'}
      style="width:100%"
      onUpdate:modelValue={(v: number | undefined) => props.onChange(v ?? 0)}
    />
  );
});
