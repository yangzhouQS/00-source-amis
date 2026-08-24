import { defineComponent } from "vue";
import { SvgIcon } from "../svg-icon";

export const IconTimePicker = defineComponent({
  name: "IconTimePicker",
  setup() {
    return () => {
      return (
        <SvgIcon>
          <path
            d="M512 896a384 384 0 1 0 0-768 384 384 0 0 0 0 768z m0 85.333C252.8 981.333 42.667 771.2 42.667 512S252.8 42.667 512 42.667 981.333 252.8 981.333 512 771.2 981.333 512 981.333z"
            fill="#86909C"
            p-id="3019"
          >
          </path>
          <path
            d="M554.667 483.67L711.168 562.9a40.363 40.363 0 0 1 16.768 56.192c-11.947 20.736-38.059 28.502-59.435 17.707l-163.37-82.688A42.667 42.667 0 0 1 469.333 512V298.667a42.667 42.667 0 1 1 85.334 0v185.002z"
            fill="#86909C"
            p-id="3020"
          >
          </path>
        </SvgIcon>
      );
    };
  },
});
