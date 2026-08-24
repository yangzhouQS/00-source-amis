import { defineComponent } from "vue";
import { SvgIcon } from "../svg-icon";

export const IconFlexLine = defineComponent({
  name: "IconFlexLine",
  setup() {
    return () => {
      return (
        <SvgIcon>
          <path
            d="M29.44 449.28h-25.6v-133.12H135.68v25.6H29.44zM29.44 559.78496h-25.6v133.12H135.68v-25.6H29.44zM993.28 449.28h25.6v-133.12h-131.84v25.6H993.28zM888.74496 665.39008v25.6h133.12v-131.84h-25.6v106.24zM84.48 396.8h394.24v213.33504h-394.24zM533.33504 396.8h407.89504v213.33504h-407.89504z"
            p-id="30772"
            fill="#86909C"
          >
          </path>
        </SvgIcon>
      );
    };
  },
});
