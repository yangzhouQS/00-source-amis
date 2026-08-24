import { defineComponent } from "vue";
import { SvgIcon } from "../svg-icon";

export const IconTableOnly = defineComponent({
  name: "IconTableOnly",
  setup() {
    return () => {
      return (
        <SvgIcon>
          <path
            d="M960 672H64a32 32 0 0 1-32-32V384a32 32 0 0 1 32-32h896a32 32 0 0 1 32 32v256a32 32 0 0 1-32 32zM96 608h832V416H96z"
            fill="#86909C"
            p-id="2866"
          >
          </path>
          <path
            d="M896 928H128a32 32 0 0 1-32-32V640a32 32 0 0 1 64 0v224h704V640a32 32 0 0 1 64 0v256a32 32 0 0 1-32 32z m0-512a32 32 0 0 1-32-32V160H160v224a32 32 0 0 1-64 0V128a32 32 0 0 1 32-32h768a32 32 0 0 1 32 32v256a32 32 0 0 1-32 32z"
            fill="#86909C"
            p-id="2867"
          >
          </path>
          <path
            d="M448 288H256a32 32 0 0 1 0-64h192a32 32 0 0 1 0 64z m320 0H576a32 32 0 0 1 0-64h192a32 32 0 0 1 0 64zM448 800H256a32 32 0 0 1 0-64h192a32 32 0 0 1 0 64z m320 0H576a32 32 0 0 1 0-64h192a32 32 0 0 1 0 64zM448 544H192a32 32 0 0 1 0-64h256a32 32 0 0 1 0 64z m384 0H576a32 32 0 0 1 0-64h256a32 32 0 0 1 0 64z"
            fill="#86909C"
            p-id="2868"
          >
          </path>
        </SvgIcon>
      );
    };
  },
});
