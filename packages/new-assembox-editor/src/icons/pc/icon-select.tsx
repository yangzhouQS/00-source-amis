import { defineComponent } from "vue";
import { SvgIcon } from "../svg-icon";

export const IconSelect = defineComponent({
  name: "IconSelect",
  setup() {
    return () => {
      return (
        <SvgIcon>
          <path d="M839.68 445.44H614.4l112.64 122.88z" fill="#86909C" p-id="2866"></path>
          <path
            d="M957.44 194.56H81.92c-10.24 0-20.48 10.24-20.48 25.6V742.4c0 10.24 10.24 20.48 25.6 20.48h875.52c10.24 0 25.6-10.24 25.6-20.48V220.16c-5.12-15.36-15.36-25.6-30.72-25.6z m-51.2 471.04c0 10.24-10.24 15.36-20.48 15.36H158.72c-10.24 0-20.48-5.12-20.48-15.36V291.84c0-10.24 10.24-15.36 20.48-15.36h727.04c10.24 0 20.48 5.12 20.48 15.36V665.6z"
            fill="#86909C"
            p-id="2867"
          >
          </path>
        </SvgIcon>
      );
    };
  },
});
