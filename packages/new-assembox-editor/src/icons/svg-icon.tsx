import { defineComponent } from "vue";

const SizePresets: any = {
  xsmall: 8,
  small: 12,
  medium: 16,
  large: 20,
  xlarge: 30,
};

interface SvgProps {
  size: string;
  viewBox?: string;
  style?: object;
}

/**
 * SVG渲染组件
 */
export const SvgIcon = defineComponent({
  name: "LeftArea",
  props: {
    size: {
      type: [String, Number],
      default: "large",
    },
    viewBox: {
      type: String,
      default: "0 0 1024 1024",
    },
  },
  setup(props: SvgProps, { slots }) {
    let size = 12;
    if (SizePresets[props.size]) {
      size = SizePresets[props.size];
    } else if (props.size) {
      size = Number.parseInt(props.size);
    }
    return () => {
      // aria-hidden="true"
      return (
        <svg fill="currentColor" width={size} height={size} xmlns="http://www.w3.org/2000/svg" viewBox={props.viewBox}>
          {slots?.default && slots?.default()}
        </svg>
      );
    };
  },
});
