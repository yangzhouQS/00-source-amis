import type { ImageItem } from "@cs/vue3-biz-components-library";
import { $http } from "@cs/js-kanban-framework";
import { ElMessage } from "element-plus";
import { defineComponent, onMounted, reactive } from "vue";

/**
 * 图片卡片预览组件 demo 数据
 *
 * fileUrl 为 OSS ossKey，由组件内部通过 useFileClient 解析为真实访问 URL；
 * fileType 为带点号写法（.png），由组件自动规范化。
 */
const imageList: ImageItem[] = [
  {
    fileName: "Snipaste_2026-07-09_15-55-18.png",
    fileUrl: "10000/common/mquantity/Snipaste_2026-07-09_15-55-18.png",
    fileSize: 44821,
    fileType: ".png",
  },
  {
    fileName: "Snipaste_2026-07-09_13-42-49.png",
    fileUrl: "10000/common/mquantity/Snipaste_2026-07-09_13-42-49.png",
    fileSize: 334841,
    fileType: ".png",
  },
  {
    fileName: "微信截图_20260709134225.png",
    fileUrl: "10000/common/mquantity/微信截图_20260709134225.png",
    fileSize: 166739,
    fileType: ".png",
  },
  {
    fileName: "cb6a04e0c76f42828ab173cf0555a6a4 - 副本.jpg",
    fileUrl: "10000/common/mquantity/cb6a04e0c76f42828ab173cf0555a6a4 - 副本.jpg",
    fileSize: 2907764,
    fileType: ".jpg",
  },
  {
    fileName: "2ed7cfb8882411ebb6edd017c2d2eca2 - 副本 - 副本.png",
    fileUrl: "10000/common/mquantity/2ed7cfb8882411ebb6edd017c2d2eca2 - 副本 - 副本.png",
    fileSize: 10231177,
    fileType: ".png",
  },
  {
    fileName: "cb6a04e0c76f42828ab173cf0555a6a4 - 副本.jpg",
    fileUrl: "10000/common/mquantity/cb6a04e0c76f42828ab173cf0555a6a4 - 副本.jpg",
    fileSize: 2907764,
    fileType: ".jpg",
  },
];

export const CardPreview = defineComponent({
  name: "CardPreview",
  setup() {
    const state = reactive({
      previewDisabled: false,
      downloadDisabled: false,
      borderRadius: 4,
    });

    const handlers = {
      handlePreview(item: ImageItem, index: number): void {
        console.log("[CardPreview] preview", item, index);
      },
      handleDownload(item: ImageItem, index: number): void {
        console.log("[CardPreview] download", item, index);
      },
      handleError(item: ImageItem, index: number, err: Error): void {
        console.error("[CardPreview] error", item, index, err);
        ElMessage.error(`图片加载失败：${item.fileName}`);
      },
      handleTestPreview: async () => {
        const res = {
          "10000/common/mquantity/Snipaste_2026-07-09_15-55-18.png": "https://dev-oss.yearrow.com:9000/yunque-dev/10000/common/mquantity/Snipaste_2026-07-09_15-55-18.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=kIE5EybIZYwJ3xTHynf6%2F20260717%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260717T150257Z&X-Amz-Expires=1800&X-Amz-SignedHeaders=host&X-Amz-Signature=927512f2b9a51abe8e38f456280b394bf2bb2769f94c5f3e92cff04e70feb8da",
          "10000/common/mquantity/Snipaste_2026-07-09_13-42-49.png": "https://dev-oss.yearrow.com:9000/yunque-dev/10000/common/mquantity/Snipaste_2026-07-09_13-42-49.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=kIE5EybIZYwJ3xTHynf6%2F20260717%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260717T150257Z&X-Amz-Expires=1800&X-Amz-SignedHeaders=host&X-Amz-Signature=403510a481d54962cf0e603be617458449bf8a24be3c11d911a57bfd3280f5c5",
          "10000/common/mquantity/微信截图_20260709134225.png": "https://dev-oss.yearrow.com:9000/yunque-dev/10000/common/mquantity/%E5%BE%AE%E4%BF%A1%E6%88%AA%E5%9B%BE_20260709134225.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=kIE5EybIZYwJ3xTHynf6%2F20260717%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260717T150257Z&X-Amz-Expires=1800&X-Amz-SignedHeaders=host&X-Amz-Signature=a6033ed45afb39f0eb43ce30bbbc6a39e554955766255bdaae1fb43ad452dca1",
          "10000/common/mquantity/cb6a04e0c76f42828ab173cf0555a6a4 - 副本.jpg": "https://dev-oss.yearrow.com:9000/yunque-dev/10000/common/mquantity/cb6a04e0c76f42828ab173cf0555a6a4%20-%20%E5%89%AF%E6%9C%AC.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=kIE5EybIZYwJ3xTHynf6%2F20260717%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260717T150257Z&X-Amz-Expires=1800&X-Amz-SignedHeaders=host&X-Amz-Signature=65b85be834966218c32bc2ef26af950487707d1468e3ac2d63a7edac35ce3fef",
          "10000/common/mquantity/2ed7cfb8882411ebb6edd017c2d2eca2 - 副本 - 副本.png": "https://dev-oss.yearrow.com:9000/yunque-dev/10000/common/mquantity/2ed7cfb8882411ebb6edd017c2d2eca2%20-%20%E5%89%AF%E6%9C%AC%20-%20%E5%89%AF%E6%9C%AC.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=kIE5EybIZYwJ3xTHynf6%2F20260717%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260717T150257Z&X-Amz-Expires=1800&X-Amz-SignedHeaders=host&X-Amz-Signature=b48e1fb5fab9a34c91344d2f48c11632de432610af2ca8fec6450b5698a42eb8",
        };
        const fileKeys = Object.keys(res);
        $http.post("/pmShare/file/filePreviews", fileKeys);
      },
    };

    onMounted(() => {
      console.log("[CardPreview] mounted");
    });
    return () => {
      return (
        <div class="card-preview-demo">
          <el-divider>图片卡片预览 image-card-preview</el-divider>
          <el-button type="primary" onClick={handlers.handleTestPreview}>
            测试预览
          </el-button>

          <div style={{ marginBottom: "16px", display: "flex", gap: "24px" }}>
            <el-switch
              v-model={state.previewDisabled}
              active-text="禁用预览"
            />
            <el-switch
              v-model={state.downloadDisabled}
              active-text="禁用下载"
            />
            <el-input-number v-model={state.borderRadius} />
          </div>

          <YqImageCardPreview
            imageList={imageList}
            borderRadius={`${state.borderRadius}px`}
            previewDisabled={state.previewDisabled}
            downloadDisabled={state.downloadDisabled}
            onPreview={handlers.handlePreview}
            onDownload={handlers.handleDownload}
            onError={handlers.handleError}
          />
        </div>
      );
    };
  },
});
