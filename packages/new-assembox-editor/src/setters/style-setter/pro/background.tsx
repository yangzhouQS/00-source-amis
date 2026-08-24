import type { PropType } from "vue";
import type { OnStyleChange } from "../utils";
/**
 * Background 面板 — backgroundColor / backgroundImage / backgroundSize / backgroundPosition / backgroundRepeat / opacity
 * 参考 lowcode pro/background
 */
import { computed, defineComponent, ref, watch } from "vue";
import { StyleRow } from "../components";
import { StyleColorInput } from "../components/color-input";

export const BackgroundPanel = defineComponent({
  name: "StyleBackgroundPanel",
  props: {
    styleData: { type: Object as PropType<Record<string, any>>, required: true },
    onStyleChange: { type: Function as PropType<OnStyleChange>, required: true },
  },
  setup(props) {
    const sd = computed(() => props.styleData);

    const bgType = ref<"color" | "image" | "">("");
    watch(
      () => sd.value.backgroundImage,
      (v) => {
        if (v) {
          bgType.value = "image";
        } else if (sd.value.backgroundColor) {
          bgType.value = "color";
        }
      },
      { immediate: true },
    );

    const emit = (styleKey: string, value: any) => {
      props.onStyleChange([{ styleKey, value: value ?? null }]);
    };

    const onBgImage = (url: string) => {
      emit("backgroundImage", url ? `url(${url})` : "");
    };

    const extractImgUrl = (val: string | undefined): string => {
      if (!val) {
        return "";
      }
      const m = val.match(/url\(([^)]+)\)/);
      return m ? m[1].replace(/['"]/g, "") : "";
    };

    const posHasValue = computed(() => !!sd.value.backgroundPosition);
    const sizePreset = computed(() => {
      const v = sd.value.backgroundSize;
      if (v === "contain" || v === "cover") {
        return v;
      }
      return "default";
    });

    return () => (
      <div class="style-panel">
        <StyleRow title="类型" hasValue={!!bgType.value}>
          <el-radio-group
            modelValue={bgType.value}
            onChange={(v: string) => {
              bgType.value = v as any;
            }}
          >
            <el-radio-button value="color" label="纯色" />
            <el-radio-button value="image" label="图片" />
          </el-radio-group>
        </StyleRow>

        {bgType.value === "color" && (
          <StyleRow title="背景色" hasValue={!!sd.value.backgroundColor}>
            <StyleColorInput modelValue={sd.value.backgroundColor ?? ""} on-change={(v: string) => emit("backgroundColor", v)} />
          </StyleRow>
        )}

        {bgType.value === "image" && (
          <>
            <StyleRow title="图片地址" hasValue={!!sd.value.backgroundImage}>
              <el-input
                modelValue={extractImgUrl(sd.value.backgroundImage)}
                placeholder="https://..."
                onUpdate:modelValue={onBgImage}
              />
            </StyleRow>
            <StyleRow title="填充方式" hasValue={!!sd.value.backgroundSize}>
              <el-select modelValue={sizePreset.value} style="width:100%" onChange={(v: string) => emit("backgroundSize", v === "default" ? "" : v)}>
                <el-option value="default" label="默认" />
                <el-option value="contain" label="contain（完整显示）" />
                <el-option value="cover" label="cover（铺满）" />
              </el-select>
            </StyleRow>
            <StyleRow title="重复" hasValue={!!sd.value.backgroundRepeat}>
              <el-select modelValue={sd.value.backgroundRepeat ?? ""} size="small" style="width:100%" onChange={(v: string) => emit("backgroundRepeat", v)}>
                <el-option value="" label="默认" />
                <el-option value="no-repeat" label="no-repeat" />
                <el-option value="repeat" label="repeat" />
                <el-option value="repeat-x" label="repeat-x" />
                <el-option value="repeat-y" label="repeat-y" />
              </el-select>
            </StyleRow>
            <StyleRow title="位置" hasValue={posHasValue.value}>
              <el-select modelValue={sd.value.backgroundPosition ?? ""} size="small" style="width:100%" onChange={(v: string) => emit("backgroundPosition", v)}>
                <el-option value="" label="默认" />
                <el-option value="left top" label="↖ left top" />
                <el-option value="center top" label="↑ center top" />
                <el-option value="right top" label="↗ right top" />
                <el-option value="left center" label="← left center" />
                <el-option value="center center" label="· center" />
                <el-option value="right center" label="→ right center" />
                <el-option value="left bottom" label="↙ left bottom" />
                <el-option value="center bottom" label="↓ center bottom" />
                <el-option value="right bottom" label="↘ right bottom" />
              </el-select>
            </StyleRow>
          </>
        )}

        <StyleRow title="透明度" hasValue={sd.value.opacity != null}>
          <div class="style-panel__slider">
            <el-slider
              modelValue={Math.round((Number.parseFloat(sd.value.opacity) || 0) * 100)}
              min={0}
              max={100}
              step={1}
              style="flex:1"
              onUpdate:modelValue={(v: number) => emit("opacity", v === 0 ? "0" : String(v / 100))}
            />
            <span class="style-panel__slider-value">
              {Math.round((Number.parseFloat(sd.value.opacity) || 0) * 100)}
              %
            </span>
          </div>
        </StyleRow>
      </div>
    );
  },
});
