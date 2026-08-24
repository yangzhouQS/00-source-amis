import { defineComponent } from "vue";
import { SvgIcon } from "../svg-icon";

export const IconBox = defineComponent({
  name: "IconBox",
  setup() {
    return () => {
      return (
        <SvgIcon>
          <path
            d="M184 112c-39.764 0-72 32.236-72 72v656c0 39.764 32.236 72 72 72h656c39.764 0 72-32.236 72-72V184c0-39.764-32.236-72-72-72H184z m0-48h656c66.274 0 120 53.726 120 120v656c0 66.274-53.726 120-120 120H184c-66.274 0-120-53.726-120-120V184c0-66.274 53.726-120 120-120z"
            p-id="5914"
            fill="#cdcdcd"
          >
          </path>
        </SvgIcon>
      );
    };
  },
});
