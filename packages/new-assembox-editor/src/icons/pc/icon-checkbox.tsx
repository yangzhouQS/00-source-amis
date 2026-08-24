import { defineComponent } from "vue";
import { SvgIcon } from "../svg-icon";

export const IconCheckbox = defineComponent({
  name: "IconCheckbox",
  setup() {
    return () => {
      return (
        <SvgIcon>
          <path
            d="M170.667 128h682.666A42.667 42.667 0 0 1 896 170.667v682.666A42.667 42.667 0 0 1 853.333 896H170.667A42.667 42.667 0 0 1 128 853.333V170.667A42.667 42.667 0 0 1 170.667 128z m42.666 85.333v597.334h597.334V213.333H213.333z m256.128 469.334L288.427 501.632l60.33-60.33 120.704 120.703L710.784 320.64l60.373 60.33-301.696 301.697z"
            fill="#86909C"
            p-id="3327"
          >
          </path>
        </SvgIcon>
      );
    };
  },
});
