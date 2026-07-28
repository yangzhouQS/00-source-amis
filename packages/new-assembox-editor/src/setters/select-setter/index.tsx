/**
 * SelectSetter - 下拉选择
 * 支持 options（{label,value} / string）、分组、搜索、多选
 */
import {ElSelect, ElOption, ElOptionGroup} from 'element-plus';
import {defineSetter, normalizeOptions, renderPreview} from '../base';

export const SelectSetter = defineSetter<any>('SelectSetter', props => {
  if (props.isPreview) {
    const opt = normalizeOptions(props.options).find(
      o => o.value === props.value
    );
    return renderPreview(opt?.label ?? props.value);
  }
  const options = normalizeOptions(props.options);
  const mode = props.mode;

  const renderOption = (o: any) => (
    <ElOption
      key={String(o.value)}
      label={o.label}
      value={o.value}
      disabled={o.disabled}
    />
  );

  return (
    <ElSelect
      modelValue={props.value}
      disabled={props.disabled}
      multiple={mode === 'multiple' || mode === 'tags'}
      filterable={props.showSearch ?? false}
      clearable={props.hasClear ?? true}
      placeholder={props.placeholder || '请选择'}
      style="width:100%"
      onUpdate:modelValue={(v: any) => props.onChange(v)}
    >
      {options.map(o => {
        // 分组：children
        if (o.children && Array.isArray(o.children)) {
          return (
            <ElOptionGroup key={o.label} label={o.label}>
              {normalizeOptions(o.children).map(renderOption)}
            </ElOptionGroup>
          );
        }
        return renderOption(o);
      })}
    </ElSelect>
  );
});
