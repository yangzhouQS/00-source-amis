import { defineComponent } from "vue";

/**
 * YqToolBar 工作栏：付款单号查询输入 + 查询/过滤/重置（蓝）+ 添加/编辑/删除/导出按钮
 * 设计稿 152×104，通过 viewBox 等比缩放适配面板（物料面板 18px、大纲树 14px 等方形容器）
 */
export const IconToolbar = defineComponent({
  name: "IconToolbar",
  setup() {
    return () => {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 152 104"
          width="152"
          height="104"
        >
          {/* 整体白色背景 */}
          <rect x="0" y="0" width="152" height="104" fill="#fff" />
          {/* 双层外框 */}
          <rect
            x="1"
            y="1"
            width="150"
            height="102"
            rx="12"
            fill="none"
            stroke="#333"
            stroke-width="1"
          />
          <rect
            x="5"
            y="5"
            width="142"
            height="94"
            rx="10"
            fill="none"
            stroke="#333"
            stroke-width="1"
          />
          {/* 付款单号输入框 */}
          <rect
            x="12"
            y="12"
            width="80"
            height="20"
            rx="5"
            fill="#fff"
            stroke="#333"
            stroke-width="1"
          />
          <circle
            cx="24"
            cy="22"
            r="2"
            fill="none"
            stroke="#333"
            stroke-width="1"
            stroke-linecap="round"
          />
          <line
            x1="26"
            y1="24"
            x2="27"
            y2="25"
            stroke="#333"
            stroke-width="1"
            stroke-linecap="round"
          />
          <text x="32" y="25" font-family="Arial, sans-serif" font-size="9" fill="#aaa">
            付款单号
          </text>
          {/* 第一排蓝色按钮：查询/过滤/重置 */}
          <rect x="102" y="12" width="18" height="16" rx="5" fill="#165DFF" />
          <text x="106" y="23" font-family="Arial, sans-serif" font-size="9" fill="#fff">
            查询
          </text>
          <rect x="102" y="34" width="18" height="16" rx="5" fill="#165DFF" />
          <text x="106" y="45" font-family="Arial, sans-serif" font-size="9" fill="#fff">
            过滤
          </text>
          <rect x="102" y="56" width="18" height="16" rx="5" fill="#165DFF" />
          <text x="106" y="67" font-family="Arial, sans-serif" font-size="9" fill="#fff">
            重置
          </text>
          {/* 第二排操作按钮：添加/编辑/删除/导出 */}
          <rect
            x="12"
            y="38"
            width="20"
            height="16"
            rx="5"
            fill="#fff"
            stroke="#333"
            stroke-width="1"
          />
          <text x="18" y="49" font-family="Arial, sans-serif" font-size="9" fill="#333">
            添加
          </text>
          <rect
            x="38"
            y="38"
            width="20"
            height="16"
            rx="5"
            fill="#fff"
            stroke="#333"
            stroke-width="1"
          />
          <text x="44" y="49" font-family="Arial, sans-serif" font-size="9" fill="#333">
            编辑
          </text>
          <rect
            x="64"
            y="38"
            width="20"
            height="16"
            rx="5"
            fill="#fff"
            stroke="#333"
            stroke-width="1"
          />
          <text x="70" y="49" font-family="Arial, sans-serif" font-size="9" fill="#333">
            删除
          </text>
          <rect x="12" y="60" width="16" height="16" rx="5" fill="#165DFF" />
          <text x="16" y="71" font-family="Arial, sans-serif" font-size="9" fill="#fff">
            导出
          </text>
        </svg>
      );
    };
  },
});
