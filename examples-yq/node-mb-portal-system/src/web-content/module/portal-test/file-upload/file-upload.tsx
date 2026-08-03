import type { FileSimpleUploadModelValue } from "@cs/vue3-biz-components-library";
import { ElMessage } from "element-plus";
import { defineComponent, getCurrentInstance, onMounted, reactive, ref } from "vue";
import {
  YqFilePreviewBox,
} from "../../../../../../../packages/vue3-biz-components-library/src/components/file-preview";
import { usePortalContext } from "../../../utils/use-portal-context";
import { CardPreview } from "./card-preview";

export const FileUpload = defineComponent({
  name: "FileUpload",
  props: {},
  setup(props) {
    const { getPortalStore, getHttp } = usePortalContext();
    const instance = getCurrentInstance()!;
    const filePreview = instance.appContext.config.globalProperties.$yqFilePreview;
    const flowTaskPreview = instance.appContext.config.globalProperties.$yqFlowTaskPreview;
    const filePreviewMap = new Map<string, string>();

    const flowConfig = reactive({
      orgId: "4645991825031168",
      instanceId: "12736534355642368",
      tenantId: "10000",
    });

    const state = reactive({
      fileInfo: null,
      fileInfo2: { fileName: "", fileUrl: "" },
      // fileInfo3: { fileName: "", fileUrl: "10000/common/biz-test/手写签字和处理意见.png" },
      fileInfo3: { fileName: "", fileUrl: "10000/common/mquantity/Snipaste_2026-07-09_15-55-18.png" },
      fileInfo44: [{ fileName: "", fileUrl: "10000/common/mquantity/Snipaste_2026-07-09_15-55-18.png" }] as any[],
      fileInfo4: [],
      fileInfo5: [], // 文件表格
      fileInfo6: [
        {
          fileName: "Snipaste_2026-07-09_15-55-18.png",
          fileUrl: "10000/common/biz-test/Snipaste_2026-07-09_15-55-18.png",
          fileSize: 44821,
          fileType: "png",
          status: "success",
          progress: 100,
          _uid: 1,
          createdAt: "2026-07-09 18:42:56",
        },
        {
          fileName: "Snipaste_2026-07-09_13-42-49.png",
          fileUrl: "10000/common/biz-test/Snipaste_2026-07-09_13-42-49.png",
          fileSize: 334841,
          fileType: "png",
          status: "success",
          progress: 100,
          _uid: 2,
          createdAt: "2026-07-09 18:42:56",
        },
        {
          fileName: "微信截图_20260709134225.png",
          fileUrl: "10000/common/biz-test/微信截图_20260709134225.png",
          fileSize: 166739,
          fileType: "png",
          status: "success",
          progress: 100,
          _uid: 3,
          createdAt: "2026-07-09 18:42:56",
        },
      ],
      fileInfo7: [],
      count: 0,
    });

    const resultSimple = ref<FileSimpleUploadModelValue>({
      fileName: "",
      fileUrl: "",
      fileSize: 0,
      fileType: "",
    });

    // 文件预览列表
    const fileList = [
      {
        fileUrl: "10000/common/mquantity/微信截图_20260709134225 (7).png",
      },
      {
        fileUrl: "10000/common/biz-test/看板后台测试报告v1.0.docx",
      },
      {
        fileUrl: "10000/common/biz-test/a9982f7441bd4e07a3b1a26af43457d9 - 副本 - 副本.jpg",
      },
      {
        fileUrl: "10000/common/biz-test/采购材料清单模板-2.xlsx",
      },
      {
        fileUrl: "10000/common/biz-test/2025年1—12月西安市主要经济指标.pdf",
      },
      {
        fileName: "Snipaste_2026-07-09_15-55-18.png",
        fileUrl: "10000/common/biz-test/Snipaste_2026-07-09_15-55-18.png",
        fileSize: 44821,
        fileType: "png",
        status: "success",
        progress: 100,
        _uid: 1,
        createdAt: "2026-07-10 09:10:52",
      },
      {
        fileName: "Snipaste_2026-07-09_13-42-49.png",
        fileUrl: "10000/common/biz-test/Snipaste_2026-07-09_13-42-49.png",
        fileSize: 334841,
        fileType: "png",
        status: "success",
        progress: 100,
        _uid: 2,
        createdAt: "2026-07-10 09:10:54",
      },
      {
        fileName: "微信截图_20260709134225.png",
        fileUrl: "10000/common/biz-test/微信截图_20260709134225.png",
        fileSize: 166739,
        fileType: "png",
        status: "success",
        progress: 100,
        _uid: 3,
        createdAt: "2026-07-10 09:10:52",
      },
      {
        fileName: "从结对编程到 AI 掌舵：SOLO 开发范式转变的思考.pdf",
        fileUrl: "10000/common/mquantity/从结对编程到 AI 掌舵：SOLO 开发范式转变的思考.pdf",
      },
      {
        fileName: "TRAE 的 Agent 是如何写项目的？.pdf",
        fileUrl: "10000/common/mquantity/TRAE 的 Agent 是如何写项目的？.pdf",
      },
    ];

    const methods = {
      handleSignatureBoardTest: () => {
        console.log("handleSignatureBoardTest");
        const yqSignatureBoard = instance.appContext.config.globalProperties.$yqSignatureBoard;
        yqSignatureBoard({
          title: "请签字啦！",
          onConfirm: () => {
            console.log("onConfirm");
          },
        });
      },
      taskPreview: () => {
        flowTaskPreview({
          taskProps: flowConfig,
        });
      },
      increment: () => {
        state.count++;
      },
      handleTest: () => {
        console.log(window);
      },
      init: async () => {
        // 企业检索
        /* const searchResult = await $http.post(
          "/mb-sharedata/enterprise-inquiries/search",
          {
            search: "阿里巴巴",
            pageSize: 20,
            pageIndex: 1,
          },
        );
        console.log(searchResult.data); // 企业数组 */

        // 企业详情
        /* const detailsResult = await $http.post(
          "/mb-sharedata/enterprise-inquiries/get-details",
          {
            keyword: "阿里巴巴（中国）网络技术有限公司",
          },
        );
        console.log(detailsResult.data); // 企业详情对象 */

        // 钢筋识别
        /* const res = await $http.post("/mb-sharedata/rebar-recognition/recognize", {
          discrenType: "steel_bar",
          pictureUrl: "https://cdn.yearrow.com/test/rebar/2222.png",
        });
        console.log(res); */

        // 车牌识别
        /* const res2 = await $http.post("/mb-sharedata/plate-recognition/recognize", {
          url: "https://cdn.yearrow.com/test/rebar/car-img-01.jpg",
          multiDetect: false,
        });
        console.log(res2);
        */
      },
      uploadTableData5: () => {
        if (state.fileInfo5.length === 0) {
          ElMessage.warning("请先上传文件");
          return false;
        }
        const params = {
          list: state.fileInfo5.map((item) => {
            const store = getPortalStore();
            Object.assign(item, {
              orgId: store.$context.orgId,
              orderId: store.$context.orgId,
              moduleCode: "biz-test",
            });
            return item;
          }),
        };
        getHttp().post("/mb-sharedata/attachment/bulk-create", params).then((res) => {
          ElMessage.success("上传成功");
          state.fileInfo7 = res.result;
        }).catch((e) => {
          ElMessage.error(e.message);
        });
      },
      filePreview: () => {
        filePreview({
          fileList,
        });
      },
      switchChangeTest: () => {
        if (state.fileInfo44[0]?._filePreviewUrl) {
          filePreviewMap.set(state.fileInfo44[0].fileUrl, state.fileInfo44[0]._filePreviewUrl);
        }
        if (Date.now() % 2 === 0) {
          const fileUrl = "10000/common/mquantity/Snipaste_2026-07-09_15-55-18.png";
          const previewUrl = filePreviewMap.get(fileUrl);
          state.fileInfo44 = [{ fileName: "", fileUrl, _filePreviewUrl: previewUrl }];
        } else {
          const fileUrl = "10000/common/biz-test/Snipaste_2026-07-09_15-55-18.png";
          const previewUrl = filePreviewMap.get(fileUrl);
          state.fileInfo44 = [{ fileUrl, fileName: "", _filePreviewUrl: previewUrl }];
        }
        console.log(state.fileInfo44);
      },
    };

    onMounted(() => {
      methods.init();
    });

    return () => {
      return (
        <yq-box paddingSize="large">
          <el-button
            type="primary"
            onClick={methods.handleTest}
          >
            测试
          </el-button>
          <div style="display: flex; align-items: center; width: 400px">
            <el-input v-model={flowConfig.instanceId} placeholder="instanceId"></el-input>
            <el-input v-model={flowConfig.orgId} placeholder="orgId"></el-input>
            <el-button
              type="primary"
              onClick={methods.taskPreview}
            >
              流程日志预览
            </el-button>
          </div>
          <div class="file-upload">
            <el-form
              ref="form"
              label-width="80px"
            >

              <el-divider>6、PC端签字组件 yq-signature-board </el-divider>
              <el-row>
                <el-col span={6}>
                  <yq-signature-board />
                </el-col>
                <el-col span={6}>
                  <el-button
                    type="primary"
                    onClick={methods.handleSignatureBoardTest}
                  >
                    函数式签字组件弹窗
                  </el-button>
                </el-col>
              </el-row>

              <el-divider>1、文件预览组件 yq-file-preview</el-divider>
              <el-row>
                <el-col span={24}>
                  <el-button
                    type="primary"
                    plain={true}
                    onClick={() => {
                      methods.filePreview();
                    }}
                  >
                    文件预览测试
                  </el-button>
                  <yq-file-preview>

                  </yq-file-preview>
                </el-col>
                <el-col>
                  <div style={{ width: "600px", height: "300px" }}>
                    <YqFilePreviewBox fileList={fileList} />
                  </div>
                </el-col>
              </el-row>

              <el-divider>2、简易文件上传 yq-file-simple-upload</el-divider>
              <el-row>
                <el-col span={6}>
                  <el-form-item label="1.简易文件上传">
                    <YqFileSimpleUpload
                      v-model={resultSimple.value}
                    >
                      { {
                        default: () => <div>文件上传组件</div>,
                        description: () => {
                          return <span>上传说明：格式支持[png/jpeg/jpg]、大小要求: 5M</span>;
                        },
                      } }
                    </YqFileSimpleUpload>
                  </el-form-item>
                </el-col>

                <el-col span={6}>
                  <el-form-item label="预览">
                    <YqFileSimpleUpload v-model={state.fileInfo3}>
                    </YqFileSimpleUpload>
                  </el-form-item>
                </el-col>
                <el-col span={6}>
                  <el-form-item label="简易文件上传结果">
                    { JSON.stringify(resultSimple.value, null, 2) }
                  </el-form-item>
                </el-col>
                <el-col span={6}>
                  <el-form-item label="大文件上传">
                    <YqFileSimpleUpload
                      v-model={state.fileInfo2}
                      max-size={100 * 1024 * 1024}
                    >
                    </YqFileSimpleUpload>
                  </el-form-item>
                </el-col>
                <el-col span={6}>
                  <el-form-item label="数据回显">
                    <YqFileSimpleUpload
                      key={state.count}
                      data-key={state.count}
                      v-model={state.fileInfo3}
                    >
                    </YqFileSimpleUpload>
                  </el-form-item>
                  <el-button
                    type="primary"
                    onClick={methods.increment}
                  >
                    刷新
                    {state.count}
                  </el-button>
                </el-col>
              </el-row>

              <el-divider>3、图片卡片式上传 yq-file-image-card-upload </el-divider>
              <el-row>
                <el-col span={24}>
                  <el-form-item label="2.多图上传">
                    <YqFileImageCardUpload
                      v-model={state.fileInfo4}
                    >
                    </YqFileImageCardUpload>
                  </el-form-item>
                </el-col>
                <el-col span={24}>
                  <el-form-item label="2.多图上传-回显">
                    <el-button
                      type="primary"
                      onClick={methods.switchChangeTest}
                    >
                      切换原数据
                    </el-button>
                    <YqFileImageCardUpload
                      v-model={state.fileInfo44}
                    >
                    </YqFileImageCardUpload>
                    { JSON.stringify(state.fileInfo44, null, 2) }
                  </el-form-item>
                </el-col>
                <el-col span={24}>
                  <el-form-item label="多图上传">
                    { JSON.stringify(state.fileInfo4, null, 2) }
                  </el-form-item>
                </el-col>
              </el-row>

              <el-divider>4、表格式多文件上传 yq-file-table-upload</el-divider>
              <el-row style={{ height: "1800px" }}>
                <el-col span={24}>
                  <yq-file-table-upload
                    v-model={state.fileInfo5}
                    accept="image/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,.mp4,.avi,.mov,.txt,.log,.js"
                    max-size={200 * 1024 * 1024}
                  >
                  </yq-file-table-upload>
                </el-col>
                <div style={{ height: "100px", width: "100%" }} />
                <el-button type="primary" onClick={methods.uploadTableData5}>上传保存</el-button>
                <el-col span={24}>
                  <h2>fileInfo5</h2>
                  { JSON.stringify(state.fileInfo5, null, 2) }
                </el-col>

                <el-col span={24}>
                  <h2>文件编辑状态操作</h2>
                  <YqFileTableUpload
                    v-model={state.fileInfo7}
                  >
                  </YqFileTableUpload>
                </el-col>

                <el-col span={24}>
                  <h1>fileInfo7</h1>
                  { JSON.stringify(state.fileInfo7, null, 2) }
                </el-col>
              </el-row>

              <el-divider>5、图片预览组件 yq-image-card-preview </el-divider>
              <el-row style={{ height: "800px" }}>
                <el-col span={24}>
                  <CardPreview />
                </el-col>
              </el-row>

            </el-form>
          </div>
        </yq-box>
      );
    };
  },
});
