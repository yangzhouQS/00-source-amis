import { defineComponent } from "vue";

export const IconToolbar = defineComponent({
  name: "IconToolbar",
  setup() {
    return () => {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56">
          <g transform="translate(3 12)" fill="none" fill-rule="evenodd">
            <path
              d="M3 0h44a3 3 0 0 1 3 3v26a3 3 0 0 1-3 3H3a3 3 0 0 1-3-3V3a3 3 0 0 1 3-3zm0 1a2 2 0 0 0-2 2v26a2 2 0 0 0 2 2h44a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2H3z"
              fill="#CCC"
              fill-rule="nonzero"
            />
            <rect fill="#86909C" x="4" y="5" width="11" height="3" rx="1" />
            <rect fill="#CDCDCD" x="36" y="5" width="11" height="3" rx="1" />
            <rect fill="#CDCDCD" x="4" y="12" width="11" height="3" rx="1" />
            <rect fill="#CDCDCD" x="36" y="12" width="11" height="3" rx="1" />
            <rect fill="#CDCDCD" x="20" y="5" width="11" height="3" rx="1" />
            <rect fill="#CDCDCD" x="20" y="12" width="11" height="3" rx="1" />
            <path
              d="m45.906 27.439-2.238-2.242c.223-.276.398-.583.525-.921a3.14 3.14 0 0 0 .187-1.09c-.022-.897-.333-1.647-.932-2.25-.601-.604-1.353-.916-2.255-.936-.904.02-1.655.332-2.254.935-.602.604-.915 1.354-.939 2.252.024.902.337 1.653.939 2.254.599.6 1.35.912 2.254.939a3.26 3.26 0 0 0 1.08-.19c.34-.123.648-.297.924-.522l2.238 2.238a.344.344 0 0 0 .238.094.322.322 0 0 0 .23-.097.332.332 0 0 0 .003-.464zm-7.241-4.252c.015-.715.261-1.31.738-1.784.479-.477 1.075-.725 1.79-.745.715.02 1.31.268 1.784.745.477.474.725 1.069.745 1.784-.02.719-.268 1.317-.745 1.793-.474.475-1.069.722-1.784.742-.715-.02-1.311-.267-1.79-.742-.477-.476-.723-1.074-.738-1.793z"
              fill="#000"
              fill-rule="nonzero"
            />
          </g>
        </svg>
      );
    };
  },
});
