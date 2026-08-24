import { defineComponent } from "vue";
import { SvgIcon } from "../svg-icon";

export const IconListElement = defineComponent({
  name: "IconListElement",
  setup() {
    return () => {
      return (
        <SvgIcon>
          <path
            d="M64 160h896v64H64v-64zM64 800h896v64H64v-64zM64 416a32 32 0 0 1 32-32h192a32 32 0 0 1 32 32v192a32 32 0 0 1-32 32h-192a32 32 0 0 1-32-32v-192zM128 576h128V448H128v128zM416 384a32 32 0 0 0-32 32v192a32 32 0 0 0 32 32h192a32 32 0 0 0 32-32v-192a32 32 0 0 0-32-32h-192zM448 448h128v128H448V448zM704 416a32 32 0 0 1 32-32h192a32 32 0 0 1 32 32v192a32 32 0 0 1-32 32h-192a32 32 0 0 1-32-32v-192zM768 576h128V448h-128v128z"
            fill="#86909C"
            p-id="13039"
          >
          </path>
        </SvgIcon>
      );
    };
  },
});
