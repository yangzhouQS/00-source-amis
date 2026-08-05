import type { Editor } from "../../core/editor";
import { Cellphone, Iphone, Monitor } from "@element-plus/icons-vue";
/**
 * 画布尺寸切换（设备预设）
 * 顶栏 Widget：默认/平板/手机 切换，驱动 iframe 宽度
 */
import { defineComponent, PropType } from "vue";
import { DEVICE_PRESETS } from "../../core/store";
import { useAssemNamespace } from "../../hooks/use-assem-namespace";
import "./simulator-size-style.less";

const ns = useAssemNamespace("simulator-size");

const ICON_MAP: Record<string, any> = {
  default: Monitor,
  tablet: Iphone,
  phone: Cellphone,
};

export const SimulatorSize = defineComponent({
  name: "SimulatorSize",
  props: {
    editor: { type: Object as PropType<Editor>, required: true },
  },
  setup(props) {
    return () => {
      const current = props.editor.store.state.device.key;
      return (
        <div class={ns.b()}>
          <el-radio-group
            modelValue={current}
            size="small"
            onUpdate:modelValue={(val: any) => {
              const preset = DEVICE_PRESETS.find(d => d.key === val);
              if (preset) {
                props.editor.store.setDevice(preset);
              }
            }}
          >
            {DEVICE_PRESETS.map((d) => {
              const Icon = ICON_MAP[d.key];
              return (
                <el-radio-button key={d.key} value={d.key}>
                  {Icon
                    ? (
                        <el-icon style={{ marginRight: "8px" }}>
                          <Icon />
                        </el-icon>
                      )
                    : null}
                  {d.label}
                </el-radio-button>
              );
            })}
          </el-radio-group>
        </div>
      );
    };
  },
});
