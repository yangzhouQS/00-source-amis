import { defineComponent } from "vue";
import { SvgIcon } from "../svg-icon";

/** YqImageCardPreview 图片卡片预览：双卡片叠放 + 放大镜角标 */
export const IconImageCardPreview = defineComponent({
  name: "IconImageCardPreview",
  setup() {
    return () => {
      return (
        <SvgIcon>
          <path
            d="M704 128H192c-35.2 0-64 28.8-64 64v416c0 35.2 28.8 64 64 64h64v-64h-64V192h512v96h64v-96c0-35.2-28.8-64-64-64z"
            fill="#86909C"
          >
          </path>
          <path
            d="M832 320H320c-35.2 0-64 28.8-64 64v448c0 35.2 28.8 64 64 64h512c35.2 0 64-28.8 64-64V384c0-35.2-28.8-64-64-64z m0 512H320V384h512v448z"
            fill="#86909C"
          >
          </path>
          <path d="M384 448h96v160h-96zM502.4 448h147.2l-64 160H438.4z" fill="#165DFF" opacity="0.4"></path>
          <path d="M384 672h384v32H384zM384 736h256v32H384z" fill="#86909C" opacity="0.5"></path>
          <path
            d="M780.8 540.8c-38.4-38.4-102.4-38.4-140.8 0-38.4 38.4-38.4 102.4 0 140.8 32 32 80 36.8 118.4 16l57.6 57.6 22.4-22.4-57.6-57.6c20.8-38.4 16-86.4-16-118.4z m-19.2 121.6c-28.8 28.8-73.6 28.8-102.4 0-28.8-28.8-28.8-73.6 0-102.4 28.8-28.8 73.6-28.8 102.4 0 28.8 28.8 28.8 73.6 0 102.4z"
            fill="#165DFF"
          >
          </path>
        </SvgIcon>
      );
    };
  },
});
