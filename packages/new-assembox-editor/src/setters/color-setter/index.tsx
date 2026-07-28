/**
 * ColorSetter - 颜色选择
 */
import {ElColorPicker} from 'element-plus';
import {defineSetter, renderPreview} from '../base';

export const ColorSetter = defineSetter<string>('ColorSetter', props => {
  if (props.isPreview) return renderPreview(props.value);
  return (
    <div style="display:flex;align-items:center;gap:8px">
      <ElColorPicker
        modelValue={props.value ?? ''}
        disabled={props.disabled}
        showAlpha={props.showAlpha ?? true}
        colorFormat={props.colorFormat ?? 'hex'}
        predefine={props.predefine}
        onUpdate:modelValue={(v: string | null) => props.onChange(v ?? '')}
      />
      <span class="assem-color-text" style="font-size:12px;color:#606266">
        {props.value || '无'}
      </span>
    </div>
  );
});
