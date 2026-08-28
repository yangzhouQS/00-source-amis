import { defineComponent } from "vue";
import { SvgIcon } from "../svg-icon";

/** FilterSummary 筛选摘要：漏斗 + 三条结果横线 */
export const IconFilterSummary = defineComponent({
  name: "IconFilterSummary",
  setup() {
    return () => {
      return (
        <SvgIcon>
          <path
            d="M896 128H128c-19.2 0-38.4 12.8-44.8 32-6.4 19.2 0 41.6 12.8 54.4L384 505.6V864c0 12.8 6.4 25.6 19.2 32 6.4 3.2 12.8 6.4 19.2 6.4 6.4 0 12.8 0 19.2-3.2l192-96c12.8-6.4 22.4-22.4 22.4-35.2V505.6l288-291.2c12.8-12.8 19.2-35.2 12.8-54.4-6.4-19.2-25.6-32-44.8-32z m-320 662.4-128 64V544h128v246.4z m22.4-310.4H384L144 224h544L598.4 480z"
            fill="#86909C"
          >
          </path>
          <path d="M480 800h64v48h-64zM560 800h160v48H560z" fill="#165DFF"></path>
        </SvgIcon>
      );
    };
  },
});
