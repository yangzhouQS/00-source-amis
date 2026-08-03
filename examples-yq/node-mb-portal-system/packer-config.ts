import process from "node:process";
// import { RsdoctorRspackPlugin } from '@rsdoctor/rspack-plugin';

// 开发环境需要copy文件配置
const devCopyConfig: Record<string, string> = {};
const development = process.env.NODE_ENV === "development";
if (development) {
  devCopyConfig["./config.yaml"] = "dist/config.yaml";
}

export default {
  global: {
    clear: ["dist"],
    copy: {
      "src/web-content/assets": "dist/lib/assets",
      ...devCopyConfig,
    },
    node: {
      rootOutPath: "dist/",
      packerConfig: {
        plugins: [
          /* new RsdoctorRspackPlugin({
         // 插件选项
        }), */
        ],
      },
    },
    browserVue3: {
      rootOutPath: "dist/",
      packerConfig: {
        resolve: {
          // 优先使用 module 字段（ESM 构建），避免 browser/main 字段解析到 IIFE 构建导致命名导入失效
          mainFields: ["module", "browser", "main"],
          extensions: [".js", ".ts", ".json", ".tsx", ".vue"],
        },
        externals: {
          "vue": "Vue",
          "axios": "axios",
          "vue-router": "VueRouter",
          "element-plus": "ElementPlus",
          "@cs/element-plus-ui": "ElementPlusUi",
          "@cs/js-kanban-framework": "JsKanbanFramework",
          "@cs/js-web-framework": "JsKanbanFramework ",
          "@cs/table-pro": "TablePro",
          "@element-plus/icons-vue": "ElementPlusIconsVue",
        },
      },
    },
  },
  entries: {
    server: {
      type: "node",
      name: "server",
      output: {
        fileName: "main.js",
        filePath: "dist/controllers",
      },
      input: "src/controllers/main.ts",
    },
    portalTest: {
      type: "browserVue3",
      title: "测试",
      input: "src/web-content/module/portal-test/index.ts",
    },
  },
};
