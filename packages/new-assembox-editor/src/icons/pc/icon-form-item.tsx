import { defineComponent } from "vue";
import { SvgIcon } from "../svg-icon";

export const IconFormItem = defineComponent({
  name: "IconFormItem",
  setup() {
    return () => {
      return (
        <SvgIcon>
          <path
            d="M896 64a64 64 0 0 1 64 64v768a64 64 0 0 1-64 64H128a64 64 0 0 1-64-64V128a64 64 0 0 1 64-64h768z m0 320H128v512h768V384zM224 704a32 32 0 1 1 0 64 32 32 0 0 1 0-64z m576 0a32 32 0 0 1 0 64H352a32 32 0 0 1 0-64h448zM224 512a32 32 0 1 1 0 64 32 32 0 0 1 0-64z m576 0a32 32 0 0 1 0 64H352a32 32 0 0 1 0-64h448z m96-384H128v192h768V128z"
            fill="#86909C"
            p-id="2866"
          >
          </path>
        </SvgIcon>
      );
    };
  },
});
