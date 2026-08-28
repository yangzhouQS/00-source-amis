import { defineComponent } from "vue";
import { SvgIcon } from "../svg-icon";

/** YqFlexBox 弹性布局：左大右小双栏 + 中缝拖拽线 */
export const IconFlexBox = defineComponent({
  name: "IconFlexBox",
  setup() {
    return () => {
      return (
        <SvgIcon>
          <path
            d="M896 192H128c-35.2 0-64 28.8-64 64v512c0 35.2 28.8 64 64 64h768c35.2 0 64-28.8 64-64V256c0-35.2-28.8-64-64-64z m0 576H128V256h768v512z"
            fill="#86909C"
          >
          </path>
          <path d="M160 320h320v384H160z" fill="#165DFF" opacity="0.25"></path>
          <path d="M160 320h320v48H160zM160 320h48v384h-48z" fill="#165DFF" opacity="0.5"></path>
          <path d="M544 320h320v384H544z" fill="#86909C" opacity="0.2"></path>
          <path d="M544 320h320v48H544zM816 320h48v384h-48z" fill="#86909C" opacity="0.5"></path>
          <path d="M500 320h24v384h-24z" fill="#165DFF"></path>
        </SvgIcon>
      );
    };
  },
});
