import { defineComponent } from "vue";
import { SvgIcon } from "../svg-icon";

export const IconOrgPanel = defineComponent({
  name: "IconOrgPanel",
  setup() {
    return () => {
      return (
        <SvgIcon>
          <path
            d="M801.382 607.027L689.766 413.901V61.44H334.234V413.9L222.618 607.028H61.44V962.56h355.533V714.957h190.054V962.56H962.56V607.027H801.382zM399.77 126.976h224.665v224.46H400.18v-224.46z m-48.333 770.048H126.976v-224.46h224.46v224.46z m65.536-247.603v-42.599h-118.58l109.773-190.054h207.872l109.773 190.054H607.232v42.599h-190.26z m480.051 247.603h-224.46V672.358h224.46v224.666z"
            fill="#86909C"
            p-id="2866"
          >
          </path>
        </SvgIcon>
      );
    };
  },
});
