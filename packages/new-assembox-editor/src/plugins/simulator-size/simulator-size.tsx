/**
 * 画布尺寸切换（设备预设）
 * 顶栏 Widget：默认/平板/手机 切换，驱动 iframe 宽度
 */
import {defineComponent, PropType} from 'vue';
import {ElRadioButton, ElRadioGroup} from 'element-plus';
import {Monitor, Cellphone, Iphone} from '@element-plus/icons-vue';
import type {Editor} from '../../core/editor';
import {DEVICE_PRESETS} from '../../core/store';

const ICON_MAP: Record<string, any> = {
  default: Monitor,
  tablet: Iphone,
  phone: Cellphone
};

export const SimulatorSize = defineComponent({
  name: 'SimulatorSize',
  props: {
    editor: {type: Object as PropType<Editor>, required: true}
  },
  setup(props) {
    return () => {
      const current = props.editor.store.state.device.key;
      return (
        <ElRadioGroup
          modelValue={current}
          size="small"
          onUpdate:modelValue={(val: string) => {
            const preset = DEVICE_PRESETS.find(d => d.key === val);
            if (preset) props.editor.store.setDevice(preset);
          }}
        >
          {DEVICE_PRESETS.map(d => {
            const Icon = ICON_MAP[d.key];
            return (
              <ElRadioButton key={d.key} value={d.key}>
                {Icon ? (
                  <el-icon style="margin-right:2px">
                    <Icon />
                  </el-icon>
                ) : null}
                {d.label}
              </ElRadioButton>
            );
          })}
        </ElRadioGroup>
      );
    };
  }
});
