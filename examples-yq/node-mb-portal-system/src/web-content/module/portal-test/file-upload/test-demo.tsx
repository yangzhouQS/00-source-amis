import { defineComponent, onMounted, reactive } from "vue";

export const TestDemo = defineComponent({
  name: "TestDemo",
  props: {},
  setup(props) {
    const state = reactive({});

    const methods = {
      handleTest() {
        console.log("handleTest");
      },
    };

    onMounted(() => {

    });

    return () => {
      return (
        <div class="test-demo">
          component: TestDemo
          <el-button type="primary" onClick={methods.handleTest}>测试按钮</el-button>
        </div>
      );
    };
  },
});
