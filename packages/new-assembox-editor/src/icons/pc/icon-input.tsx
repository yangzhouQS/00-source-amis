import { defineComponent } from "vue";
import { SvgIcon } from "../svg-icon";

export const IconInput = defineComponent({
  name: "IconInput",
  setup() {
    return () => {
      return (
        <SvgIcon>
          <path
            d="M896 224H128c-35.2 0-64 28.8-64 64v448c0 35.2 28.8 64 64 64h768c35.2 0 64-28.8 64-64V288c0-35.2-28.8-64-64-64z m0 480c0 19.2-12.8 32-32 32H160c-19.2 0-32-12.8-32-32V320c0-19.2 12.8-32 32-32h704c19.2 0 32 12.8 32 32v384z"
            fill="#86909C"
            p-id="3019"
          >
          </path>
          <path
            d="M224 352c-19.2 0-32 12.8-32 32v256c0 16 12.8 32 32 32s32-12.8 32-32V384c0-16-12.8-32-32-32z"
            fill="#86909C"
            p-id="3020"
          >
          </path>
        </SvgIcon>
      );
    };
  },
});
