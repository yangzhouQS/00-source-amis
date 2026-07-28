/**
 * TextareaSetter - 多行文本
 */
import {ElInput} from 'element-plus';
import {defineSetter, renderPreview} from '../base';

export const TextareaSetter = defineSetter<string>('TextareaSetter', props => {
  if (props.isPreview) return renderPreview(props.value);
  return (
    <ElInput
      type="textarea"
      rows={props.rows ?? 3}
      modelValue={props.value ?? ''}
      placeholder={props.placeholder || '请输入'}
      disabled={props.disabled}
      showWordLimit={props.showWordLimit ?? false}
      maxlength={props.maxlength}
      onUpdate:modelValue={(v: string) => props.onChange(v ?? '')}
    />
  );
});
