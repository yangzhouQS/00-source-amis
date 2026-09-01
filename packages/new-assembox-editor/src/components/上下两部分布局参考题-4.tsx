import { defineComponent, reactive, ref } from "vue";

export const GenerateSignLinkDialog = defineComponent({
  name: "GenerateSignLinkDialog",
  props: {
  },
  emits: [],
  setup(props, { emit, expose }) {
    const dialogVisible = ref(false)


    // flex-box 布局：上方表单弹性撑满，下方操作区固定（flex-line 右侧插槽放按钮）
    const flexConfig = [
      {
        tag: "item-1",
        isFixed: false,
        size: "",
        paddingSize: "large",
        clearPadding: [],
      },
      {
        tag: "item-2",
        isFixed: true,
        size: "",
        paddingSize: "large",
        clearPadding: ['top'],
      },
    ];

    return () => {
      return (
        <el-dialog
          v-model={dialogVisible.value}
        >
          {{
            default: () => (
              <yq-flex-box
                isRow={false}
                itemNum={flexConfig.length}
                itemConfig={flexConfig}
              >
                {{
                  "item-1": () => (
                    <div></div>
                  ),
                  "item-2": () => (
                    <yq-flex-line>
                      {{
                        right: () => (
                          <>
                           <el-button onClick={() => {
                              dialogVisible.value = false;
                            }}
                            >
                              取消
                            </el-button>
                            <el-button
                              type="primary"
                            >
                              确定
                            </el-button>
                          </>
                        ),
                      }}
                    </yq-flex-line>
                  ),
                }}
              </yq-flex-box>
            ),
          }}
        </el-dialog>
      );
    };
  },
});
