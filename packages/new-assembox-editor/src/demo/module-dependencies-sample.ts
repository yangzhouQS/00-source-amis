import type { RenderDependencyItem } from "../simulator/iframe/protocol";

/**
 * 本地打包产物（public/@cs 拷贝自 assembox-packages-project 构建输出）。
 * 注意加载顺序约束：desktop-next UMD 工厂参数读取 global.Vue / axios / ElementPlus /
 * Vue3BizComponentsLibrary / ElementPlusIconsVue，必须排在这些库之后 —— 已置于
 * 依赖序允许的最前位置（vue3-biz 之后、better-print 之前）。
 * core-next UMD 额外读取 global._ / CryptoJS / dayjs（宿主如需其导出函数请自行补齐）。
 * desktop-next 内部已打包 core-next，画布渲染链不依赖 core-next 全局。
 */
export const localUmdDependencies: RenderDependencyItem[] = [
  {
    fileType: "script",
    packageName: "@cs/assembox-core-next",
    fileUrl: "/@cs/assembox-core-next/dist/index.umd.cjs",
    global: "AssemboxPackage",
  },
  {
    fileType: "script",
    packageName: "@cs/assembox-desktop-next",
    fileUrl: "/@cs/assembox-desktop-next/dist/index.umd.cjs",
    global: "AssemBoxDesktopNext",
  },
  {
    fileType: "style",
    packageName: "@cs/assembox-desktop-next-css",
    fileUrl: "/@cs/assembox-desktop-next/dist/index.css",
  },
];

/**
 * 服务端「模块依赖版本解析」返回样例（对齐 test/parser-module-dependencies-version.ts）。
 * 宿主实际使用时由接口（如 parserDependenciesVersion）获取后传入
 * createEditor({ renderDependencies }) 或 editor.setRenderDependencies()。
 *
 * 归一化处理见 simulator/iframe/protocol.ts normalizeRenderDependencies：
 * - vue3 过滤（iframe 持有 ESM Vue 单实例，vue.global 会覆盖 win.Vue 造成双实例）
 * - packageName → global/asPlugin/asIcons 自动补全（如 element-plus-js → ElementPlus 插件注册）
 * - fileUrl 去重、顺序保持（element-plus 先于组件库、framework 先于 biz-lib）
 */
export const moduleDependenciesSample: RenderDependencyItem[] = [
  { fileType: "script", scope: "public", packageName: "vue3", fileUrl: "https://cdn.yearrow.com/files/vue/3.4.34/vue.global.prod.js" },
  { fileType: "script", scope: "public", packageName: "vue-router", fileUrl: "https://cdn.yearrow.com/files/vue-router/4.2.5/vue-router.global.prod.js" },
  { fileType: "script", scope: "public", packageName: "axios", fileUrl: "https://cdn.yearrow.com/files/axios/1.7.0/axios.min.js" },
  { fileType: "script", scope: "public", packageName: "decimal", fileUrl: "https://cdn.yearrow.com/files/decimal.js/10.4.3/decimal.js" },
  { fileType: "script", scope: "public", packageName: "@antv/g2plot", fileUrl: "https://cdn.yearrow.com/files/@antv/g2plot/2.4.32/g2plot.min.js" },
  // { fileType: "style", scope: "public", packageName: "fonts/cs-common", fileUrl: "https://cdn.yearrow.com/fonts/cs-common/1.0.0/iconfont.css" },
  { fileType: "script", scope: "public", packageName: "element-plus-js", fileUrl: "https://cdn.yearrow.com/files/element-plus/2.13.7/index.full.min.js" },
  { fileType: "script", scope: "public", packageName: "@element-plus/icons-vue", fileUrl: "https://cdn.yearrow.com/files/@element-plus/icons-vue/2.3.1/global.iife.min.js" },
  { fileType: "script", scope: "public", packageName: "@cs/element-plus-ui-js", fileUrl: "https://cdn.yearrow.com/files/@cs/element-plus-ui/1.1.0/element-plus-ui.iife.js" },
  { fileType: "style", scope: "public", packageName: "@cs/element-plus-ui-css", fileUrl: "https://cdn.yearrow.com/files/@cs/element-plus-ui/1.1.0/theme/yun-que.css" },
  { fileType: "style", scope: "public", packageName: "@cs/table-pro-css", fileUrl: "https://cdn.yearrow.com/files/@cs/table-pro/3.0.3/theme/yun-que.css" },
  { fileType: "script", scope: "public", packageName: "@cs/table-pro-js", fileUrl: "https://cdn.yearrow.com/files/@cs/table-pro/3.0.3/table-pro.iife.js" },
  { fileType: "script", scope: "public", packageName: "js-web-framework", fileUrl: "https://cdn.yearrow.com/files/@cs/js-web-framework/1.2.0/js-web-framework.umd.js" },
  { fileType: "script", scope: "public", packageName: "vue3-biz-components-library", fileUrl: "https://cdn.yearrow.com/files/@cs/vue3-biz-components-library/test-2026-8-18/vue3-biz-components-library.umd.js" },
  // 本地 UMD 包在此插入（依赖序最前可行位：element 家族 + framework + biz-lib 已就绪）
  ...localUmdDependencies,
  { fileType: "script", scope: "public", packageName: "@cs/better-print", fileUrl: "https://cdn.yearrow.com/files/@cs/better-print/1.2.16/better-print.iife.js" },
  { fileType: "script", scope: "public", packageName: "@cs/excel-conduct-library", fileUrl: "https://cdn.yearrow.com/files/@cs/excel-conduct-library/2.1.19/excel-conduct-library.iife.js" },
];
