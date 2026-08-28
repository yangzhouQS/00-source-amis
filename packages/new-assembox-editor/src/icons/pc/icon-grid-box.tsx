import { defineComponent } from "vue";
import { SvgIcon } from "../svg-icon";

/** GridBox 网格布局：三列栅格底座 + 顶部标题条 */
export const IconGridBox = defineComponent({
  name: "IconGridBox",
  setup() {
    return () => {
      return (
        <SvgIcon>
          <path
            d="M896 64H128C64 64 64 118.4 64 160v704c0 41.6 0 96 64 96h768c64 0 64-54.4 64-96V160c0-41.6 0-96-64-96z m0 96v128H128V160h768zM384 416h192v448H384V416z m-64 448H128V416h192v448z m448 0H576V416h192v448z"
            fill="#86909C"
          >
          </path>
        </SvgIcon>
      );
    };
  },
});
