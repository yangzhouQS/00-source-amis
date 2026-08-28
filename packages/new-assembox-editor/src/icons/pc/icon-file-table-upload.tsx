import { defineComponent } from "vue";
import { SvgIcon } from "../svg-icon";

/**
 * YqFileTableUpload 表格式多文件上传（对齐真实组件视觉：el-table 文件列表 + 上传按钮）
 * 结构：表头行（文件名/大小/操作）+ 两条文件行 + 右下上传按钮
 */
export const IconFileTableUpload = defineComponent({
  name: "IconFileTableUpload",
  setup() {
    return () => {
      return (
        <SvgIcon>
          {/* 表格容器 */}
          <path
            d="M896 128H128c-35.2 0-64 28.8-64 64v640c0 35.2 28.8 64 64 64h768c35.2 0 64-28.8 64-64V192c0-35.2-28.8-64-64-64z m0 704H128V192h768v640z"
            fill="#86909C"
          >
          </path>
          {/* 表头底色条 */}
          <path d="M128 192h768v64H128z" fill="#86909C" opacity="0.35"></path>
          {/* 表头列分隔 */}
          <path d="M544 192v64h-64v-64h64z m320 0v64h-64v-64h64z" fill="#86909C" opacity="0.6"></path>
          {/* 文件行 1：文件图标 + 名称线 + 删除点 */}
          <path d="M160 320h96v32h-96zM160 512h96v32h-96z" fill="#165DFF" opacity="0.8"></path>
          <path d="M288 328h288v16H288zM288 360h192v16H288zM288 520h288v16H288zM288 552h192v16H288z" fill="#86909C" opacity="0.55"></path>
          {/* 行分隔线 */}
          <path d="M128 448h768v8H128zM128 640h768v8H128z" fill="#86909C" opacity="0.25"></path>
          {/* 行尾操作点（预览/下载/删除三小点） */}
          <path d="M784 336h24v24h-24zM720 336h24v24h-24zM848 336h24v24h-24zM784 528h24v24h-24zM720 528h24v24h-24zM848 528h24v24h-24z" fill="#165DFF" opacity="0.55"></path>
          {/* 右下上传按钮（圆 + 向上箭头） */}
          <path
            d="M784 704h-64v96h-32v-96h-64l80-80 80 80z m-80 128a16 16 0 1 1 0-32 16 16 0 0 1 0 32 m96 0a16 16 0 1 1 0-32 16 16 0 0 1 0 32"
            fill="#165DFF"
            opacity="0.9"
          ></path>
        </SvgIcon>
      );
    };
  },
});
