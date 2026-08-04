import {useAssemNamespace} from '../../hooks/use-assem-namespace';
const ns = useAssemNamespace('style-setter');

/**
 * StyleSetter - CSS style editor (grouped panels)
 */
import {defineComponent, computed} from 'vue';
import {useSetterCtx} from '../base';
import './style-setter.less';

const PRESET_COLORS = [
  '#0079f2',
  '#00c587',
  '#f0b40e',
  '#f04631',
  '#909399',
  '#303133',
  '#ffffff',
  '#000000'
];

export const StyleSetter = defineComponent({
  name: 'StyleSetter',
  props: {
    value: {type: Object, default: () => ({})},
    onChange: {type: Function, required: true},
    disabled: {type: Boolean, default: false}
  },
  setup(props) {
    const ctx = useSetterCtx();
    const style = computed(() =>
      props.value && typeof props.value === 'object' ? props.value : {}
    );

    const set = (key: string, v: any) => {
      const next = {...style.value};
      if (v === '' || v === null || v === undefined) {
        delete next[key];
      } else {
        next[key] = v;
      }
      props.onChange(next);
    };

    const ColorSetter = ctx?.setterRegistry.get('ColorSetter');
    const NumberSetter = ctx?.setterRegistry.get('NumberSetter');
    const SelectSetter = ctx?.setterRegistry.get('SelectSetter');

    const renderColorField = (key: string, label: string) =>
      ColorSetter ? (
        <el-form-item label={label}>
          <ColorSetter
            value={style.value[key]}
            predefine={PRESET_COLORS}
            onUpdate:modelValue={(v: string) => set(key, v)}
          />
        </el-form-item>
      ) : null;

    const renderNumberField = (key: string, label: string) =>
      NumberSetter ? (
        <el-form-item label={label}>
          <NumberSetter
            value={
              typeof style.value[key] === 'number' ||
              /^\d+$/.test(String(style.value[key] ?? ''))
                ? parseInt(String(style.value[key]))
                : undefined
            }
            onUpdate:modelValue={(v: number) => set(key, v ? `${v}px` : '')}
          />
        </el-form-item>
      ) : null;

    const renderSelectField = (key: string, label: string, options: any[]) =>
      SelectSetter ? (
        <el-form-item label={label}>
          <SelectSetter
            value={style.value[key] ?? ''}
            options={options}
            onUpdate:modelValue={(v: any) => set(key, v)}
          />
        </el-form-item>
      ) : null;

    return () => (
      <div class={ns.b()}>
        <el-collapse modelValue={['layout', 'font', 'border', 'position']}>
          <el-collapse-item title="Layout" name="layout">
            <el-form labelWidth="80px" size="small" disabled={props.disabled}>
              {renderSelectField('display', 'display', [
                {label: 'default', value: ''},
                {label: 'block', value: 'block'},
                {label: 'inline', value: 'inline'},
                {label: 'inline-block', value: 'inline-block'},
                {label: 'flex', value: 'flex'},
                {label: 'grid', value: 'grid'},
                {label: 'none', value: 'none'}
              ])}
              {renderSelectField('flexDirection', 'flex-direction', [
                {label: 'default', value: ''},
                {label: 'row', value: 'row'},
                {label: 'column', value: 'column'},
                {label: 'row-reverse', value: 'row-reverse'},
                {label: 'column-reverse', value: 'column-reverse'}
              ])}
              {renderSelectField('justifyContent', 'justify', [
                {label: 'default', value: ''},
                {label: 'flex-start', value: 'flex-start'},
                {label: 'center', value: 'center'},
                {label: 'flex-end', value: 'flex-end'},
                {label: 'space-between', value: 'space-between'},
                {label: 'space-around', value: 'space-around'}
              ])}
              {renderNumberField('width', 'width')}
              {renderNumberField('height', 'height')}
              {renderNumberField('padding', 'padding')}
              {renderNumberField('margin', 'margin')}
            </el-form>
          </el-collapse-item>
          <el-collapse-item title="Font" name="font">
            <el-form labelWidth="80px" size="small" disabled={props.disabled}>
              {renderColorField('color', 'color')}
              {renderNumberField('fontSize', 'font-size')}
              {renderNumberField('lineHeight', 'line-height')}
              {renderNumberField('fontWeight', 'font-weight')}
              {renderSelectField('textAlign', 'text-align', [
                {label: 'default', value: ''},
                {label: 'left', value: 'left'},
                {label: 'center', value: 'center'},
                {label: 'right', value: 'right'}
              ])}
            </el-form>
          </el-collapse-item>
          <el-collapse-item title="Border & Background" name="border">
            <el-form labelWidth="80px" size="small" disabled={props.disabled}>
              {renderColorField('backgroundColor', 'background')}
              {renderColorField('borderColor', 'border-color')}
              {renderNumberField('borderWidth', 'border-width')}
              {renderNumberField('borderRadius', 'border-radius')}
            </el-form>
          </el-collapse-item>
          <el-collapse-item title="Position" name="position">
            <el-form labelWidth="80px" size="small" disabled={props.disabled}>
              {renderSelectField('position', 'position', [
                {label: 'default', value: ''},
                {label: 'static', value: 'static'},
                {label: 'relative', value: 'relative'},
                {label: 'absolute', value: 'absolute'},
                {label: 'fixed', value: 'fixed'},
                {label: 'sticky', value: 'sticky'}
              ])}
              {renderNumberField('top', 'top')}
              {renderNumberField('right', 'right')}
              {renderNumberField('bottom', 'bottom')}
              {renderNumberField('left', 'left')}
              {renderNumberField('zIndex', 'z-index')}
            </el-form>
          </el-collapse-item>
        </el-collapse>
      </div>
    );
  }
});
