import { defineComponent } from "vue";
import { SvgIcon } from "../svg-icon";

export const IconTableAsync = defineComponent({
  name: "IconTableAsync",
  setup() {
    return () => {
      return (
        <SvgIcon>
          <path
            d="M588 864a16 16 0 0 1 16 16v32a16 16 0 0 1-16 16H436a16 16 0 0 1-16-16v-32a16 16 0 0 1 16-16h152z m-324 0a16 16 0 0 1 16 16v32a16 16 0 0 1-16 16H112a16 16 0 0 1-16-16v-32a16 16 0 0 1 16-16h152z m648 0a16 16 0 0 1 16 16v32a16 16 0 0 1-16 16H760a16 16 0 0 1-16-16v-32a16 16 0 0 1 16-16h152z m0-768a16 16 0 0 1 15.98 15.2l0.02 0.8v672a16 16 0 0 1-15.2 15.98l-0.8 0.02H112a16 16 0 0 1-15.98-15.2L96 784V112a16 16 0 0 1 15.2-15.98l0.8-0.02h800zM360 376H160v360h200V376z m252 0H424v360h188V376z m252 0H676v360h188V376z m0-216H160v152h704V160z"
            fill="#86909C"
            p-id="3016"
          >
          </path>
        </SvgIcon>
      );
    };
  },
});
