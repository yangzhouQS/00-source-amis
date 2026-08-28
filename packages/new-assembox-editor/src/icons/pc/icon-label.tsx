import { defineComponent } from "vue";
import { SvgIcon } from "../svg-icon";

/** YqLabel 标签文本：大写 T 字排版 + 底部短横（文字排版语义） */
export const IconLabel = defineComponent({
  name: "IconLabel",
  setup() {
    return () => {
      return (
        <SvgIcon>
          <path
            d="M192 192h224v64h-80v448h80v64H192v-64h80V256h-80z"
            fill="#86909C"
          >
          </path>
          <path d="M480 480h352v64H480z" fill="#165DFF"></path>
          <path d="M480 640h224v48H480z" fill="#86909C" opacity="0.5"></path>
        </SvgIcon>
      );
    };
  },
});
