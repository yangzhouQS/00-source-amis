import { defineComponent } from "vue";
import { SvgIcon } from "../svg-icon";

/** GridItem 网格项：单个栅格卡片（圆角矩形 + 左侧色条） */
export const IconGridItem = defineComponent({
  name: "IconGridItem",
  setup() {
    return () => {
      return (
        <SvgIcon>
          <path
            d="M832 256H192c-35.2 0-64 28.8-64 64v448c0 35.2 28.8 64 64 64h640c35.2 0 64-28.8 64-64V320c0-35.2-28.8-64-64-64z m0 512H192V320h640v448z"
            fill="#86909C"
          >
          </path>
          <path d="M256 448h128v224H256z" fill="#165DFF" opacity="0.7"></path>
          <path d="M448 448h320v32H448zM448 544h192v32H448zM448 640h256v32H448z" fill="#86909C"></path>
        </SvgIcon>
      );
    };
  },
});
