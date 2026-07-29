/**
 * 画布尺寸切换（设备预设）
 * 顶栏 Widget：默认/平板/手机 切换，驱动 iframe 宽度
 */
import {defineComponent, PropType} from 'vue';
import type {Editor} from '../../core/editor';
import {DEVICE_PRESETS} from '../../core/store';

export const SimulatorSize = defineComponent({
  name: 'SimulatorSize',
  props: {
    editor: {type: Object as PropType<Editor>, required: true}
  },
  setup(props) {
    return () => {
      const current = props.editor.store.state.device.key;
      return (
        <div
          style={{
            display: 'flex',
            gap: '4px',
            alignItems: 'center',
            padding: '0 8px'
          }}
        >
          {DEVICE_PRESETS.map(d => {
            const active = current === d.key;
            return (
              <button
                key={d.key}
                title={d.label}
                onClick={() => props.editor.store.setDevice(d)}
                style={{
                  padding: '2px 8px',
                  cursor: 'pointer',
                  border: active ? '1px solid #409eff' : '1px solid #dcdfe6',
                  background: active ? '#ecf5ff' : '#fff',
                  color: active ? '#409eff' : '#606266',
                  borderRadius: '3px',
                  fontSize: '12px'
                }}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      );
    };
  }
});
