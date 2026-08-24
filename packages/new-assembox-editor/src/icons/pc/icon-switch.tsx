import { defineComponent } from "vue";
import { SvgIcon } from "../svg-icon";

export const IconSwitch = defineComponent({
  name: "IconSwitch",
  setup() {
    return () => {
      return (
        <SvgIcon>
          <path
            d="M751.36 768H272.64a271.36 271.36 0 0 1 0-542.72h478.72a271.36 271.36 0 0 1 0 542.72zM272.64 287.36a207.36 207.36 0 0 0 0 414.72h478.72a207.36 207.36 0 0 0 0-414.72z"
            fill="#86909C"
            p-id="2866"
          >
          </path>
          <path d="M577.28 494.72a158.08 158.08 0 1 0 316.16 0 158.08 158.08 0 1 0-316.16 0z" fill="#86909C" p-id="2867"></path>
        </SvgIcon>
      );
    };
  },
});
