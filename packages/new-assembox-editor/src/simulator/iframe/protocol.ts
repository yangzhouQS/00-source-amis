/**
 * iframe 画布通信协议
 *
 * 同源直引模型（dev/prod 同源，无需 postMessage）：
 *  Host 创建 iframe → iframe 加载 canvas.html → entry 暴露 win.__ASSEM_RENDERER__
 *  Host 通过 win.__ASSEM_RENDERER__.xxx() 调用渲染器
 *  Host 注入 win.__ASSEM_HOST__ = callbacks，渲染器通过它回报事件
 *  DOM 查询：Host 直接用 iframe.contentDocument（同步）
 */

/** Host 注入到 iframe window 的全局键 */
export const HOST_GLOBAL_KEY = "__ASSEM_HOST__";
/** iframe entry 暴露渲染器的全局键 */
export const RENDERER_GLOBAL_KEY = "__ASSEM_RENDERER__";

/** Host → Renderer 命令（Host 调用，Renderer 实现） */
export interface IframeRendererApi {
  readonly ready: boolean;
  /** 初始化：注入 schema 并首次挂载 */
  init: (schema: any, designMode: "design" | "preview") => void;
  /** 全量同步 schema（结构变更后） */
  setSchema: (schema: any) => void;
  /** 切换当前渲染的场景（场景名 = uiSkeleton 的顶层 key） */
  setScene?: (sceneName: string) => void;
  /** host 下发运行时配置（routerConfig/dataSource/globalVars），mount 前调用 */
  setRuntime?: (payload: { routerConfig?: any; dataSource?: any; globalVars?: Record<string, any> }) => void;
  /** 定向更新节点属性（增量，可选实现） */
  updateNode?: (nodeId: string, patch: any) => void;
  /** 设计/预览模式切换 */
  setDesignMode: (mode: "design" | "preview") => void;
  /** 拖拽态（禁用画布交互光标） */
  setDraggingState: (active: boolean) => void;
  /** 强制重渲染 */
  rerender: () => void;
  /** 销毁 */
  dispose: () => void;
}

/** Renderer → Host 回调（Host 注入，Renderer 调用） */
export interface IframeHostCallbacks {
  /** iframe 渲染器就绪 */
  onReady: () => void;
  /** 画布内点击节点 */
  onClick: (nodeId: string | null, originalEvent: MouseEvent) => void;
  /** 画布内悬浮节点 */
  onHover: (nodeId: string | null) => void;
  /** 渲染器错误 */
  onError: (message: string, detail?: any) => void;
}

// ═══════════════════════════════════════════════
// 动态依赖清单（assets）—— Host 下发，iframe 按清单加载/注册
// ═══════════════════════════════════════════════

/** 一条 JS 依赖（CDN IIFE / UMD，加载后挂全局变量） */
export interface JsAsset {
  /** 脚本地址 */
  src: string;
  /** 加载后挂载的全局变量名（如 'ElementPro'）。命名后可被 asPlugin/asIcons/components/bootstrap 引用 */
  global?: string;
  /** 作为 Vue 插件 app.use(window[global], pluginOptions) */
  asPlugin?: boolean;
  /** app.use 的选项（如 ElementPlus 的 { locale }） */
  pluginOptions?: any;
  /** 该全局是图标库：遍历其所有属性注册为全局组件 app.component(key, val)（对应旧版 ElementPlusIconsVue 注册） */
  asIcons?: boolean;
  /** 从该全局取组件注册为全局组件（别名），path 缺省取 global 自身（对应旧版 box/Box 别名） */
  components?: Array<{ name: string; path?: string }>;
  /** 加载后执行构造初始化 new window[global][ctorPath](args)（对应旧版 new Vue3WebFramework.WebFramework()） */
  bootstrap?: { ctorPath?: string; args?: any[] };
}

/**
 * 外部组件定义（registerExternal）。
 * 把一个已加载的全局 Vue 组件按 renderType 注册进 assembox 渲染清单。
 */
export interface ExternalComponentDef {
  /** schema 里的 renderType，如 'ToggleChip' */
  renderType: string;
  /** 全局取值路径，如 'ElementPlusUi.ToggleChip'（从 window 起算的点分路径） */
  globalPath: string;
  /** 归类（决定能放进哪些容器槽位），如 'lineElement' / 'element' / 'container' */
  category: string;
}

/**
 * iframe 动态依赖清单。
 * Host 通过 __ASSEM_HOST__.assets 下发；iframe entry 读取后按序加载 JS/CSS，
 * 再由渲染器在 app.mount 前注册插件与外部组件。
 */
export interface IframeAssetsManifest {
  /** JS 依赖，按数组顺序加载（保证依赖顺序，如 element-pro 依赖 element-plus） */
  js?: JsAsset[];
  /** CSS 依赖（link rel=stylesheet） */
  css?: string[];
  /** 额外的 Vue 插件全局变量名（这些全局已由 js 加载，这里只登记 app.use） */
  plugins?: string[];
  /** 外部组件注册（registerExternal），补全内置 manifest 未含的组件 */
  externals?: ExternalComponentDef[];
}

// ═══════════════════════════════════════════════
// 宿主外置依赖下发（对齐旧版 ASSEM_RENDER_DEPENDENCIES_KEY 契约）
// ═══════════════════════════════════════════════

/**
 * 旧版依赖描述格式（宿主从服务端解析后下发，如 node-mp-assem-editor-website 的
 * parserDependenciesVersion → setDesktopRenderDependencies 链路）。
 * fileType=script 的项加载后仅挂全局，style 加载 css；global/注册标记由
 * HOST_SCRIPT_ASSET_MAP 按 packageName/url 自动补全（服务端数据不含这些字段）。
 */
export interface RenderDependencyItem {
  fileType: "script" | "style";
  /** 包名（服务端原始值，如 'element-plus-js'、'js-web-frameworky'——存在拼写容错） */
  packageName: string;
  /** 脚本/样式地址 */
  fileUrl: string;
  /** scope 标记（public/private 均直接按 fileUrl 加载，仅影响旧版合并逻辑，此处保留兼容） */
  scope?: "public" | "private";
  /** script 加载后挂载的全局变量名（可选，缺省按映射表推断） */
  global?: string;
  [key: string]: any;
}

/**
 * 宿主脚本 packageName → iframe 资产注册配置映射。
 * 渲染器注册循环依赖 global/asPlugin/asIcons 标记执行 app.use / 图标注册，
 * 服务端依赖数据只有 packageName + fileUrl，据此补全。
 * url 匹配作为兜底（容忍 packageName 拼写差异，如 'js-web-frameworky'）。
 */
const HOST_SCRIPT_ASSET_MAP: Array<{
  packageNames: string[];
  urlIncludes?: string[];
  asset: Omit<JsAsset, "src">;
}> = [
  {
    packageNames: ["vue-router"],
    asset: { global: "VueRouter" },
  },
  {
    packageNames: ["axios"],
    asset: { global: "axios" },
  },
  {
    packageNames: ["element-plus-js", "element-plus"],
    urlIncludes: ["element-plus/"],
    asset: { global: "ElementPlus", asPlugin: true },
  },
  {
    packageNames: ["@element-plus/icons-vue"],
    urlIncludes: ["icons-vue"],
    asset: { global: "ElementPlusIconsVue", asIcons: true },
  },
  {
    packageNames: ["@cs/element-pro-js", "element-pro-js"],
    urlIncludes: ["element-pro"],
    asset: { global: "ElementPro", asPlugin: true },
  },
  {
    packageNames: ["@cs/element-plus-ui-js", "element-plus-ui-js"],
    urlIncludes: ["element-plus-ui"],
    asset: { global: "ElementPlusUi", asPlugin: true },
  },
  {
    packageNames: ["@cs/table-pro-js", "table-pro-js"],
    urlIncludes: ["table-pro"],
    asset: { global: "TablePro", asPlugin: true },
  },
  {
    packageNames: ["js-web-framework", "js-web-frameworky", "vue3-web-framework-library"],
    urlIncludes: ["js-web-framework", "vue3-web-framework"],
    asset: { global: "JsWebFramework" },
  },
  {
    packageNames: ["vue3-biz-components-library", "vue3-com-components-library"],
    urlIncludes: ["vue3-biz-components", "vue3-com-components"],
    // UMD 导出 install（批量注册 yq-table-setting / yq-advanced-filter 等全局组件）
    asset: { global: "Vue3BizComponentsLibrary", asPlugin: true },
  },
];

/** iframe 内禁止加载的宿主脚本（按 packageName/url 匹配）：
 *  vue.global 会覆盖 entry 预置的 win.Vue（ESM 单实例），导致渲染器与 CDN 包分裂为两个 Vue 实例 */
function isBlockedHostScript(item: RenderDependencyItem): boolean {
  const name = (item.packageName ?? "").toLowerCase();
  const url = item.fileUrl ?? "";
  return name === "vue3" || name === "vue"
    || /\/vue\/[\d.]+\/vue\.global/.test(url);
}

/** 按 packageName 精确 + url 子串兜底，推断宿主脚本的资产注册配置 */
function matchHostScriptAsset(item: RenderDependencyItem): Partial<JsAsset> {
  const name = (item.packageName ?? "").toLowerCase();
  for (const entry of HOST_SCRIPT_ASSET_MAP) {
    if (entry.packageNames.some(n => n.toLowerCase() === name)) {
      return entry.asset;
    }
  }
  for (const entry of HOST_SCRIPT_ASSET_MAP) {
    if (entry.urlIncludes?.some(u => item.fileUrl.includes(u))) {
      return entry.asset;
    }
  }
  return {};
}

/** css 按「库家族」提取去重键（element-pro/element-plus-ui/table-pro/material-cloud/cs-common） */
function cssFamilyKey(href: string): string {
  const m = href.match(/(element-pro|element-plus-ui|table-pro|material-cloud|cs-common)/);
  return m ? m[1] : href;
}

/**
 * 合并宿主下发依赖与场景内置默认清单（对齐旧版 thirdPartyDeps 合并语义）。
 * - 宿主项在前（先加载，可覆盖内置版本）、内置默认在后兜底
 * - js 按 src 去重 + 按 global 去重（宿主换版本如 table-pro 3.0.3 后，内置 1.0.13 不再加载）
 * - css 按 url 去重 + 按库家族去重（避免双版本主题互相覆盖）
 * - plugins/externals 取并集（宿主优先）
 */
export function mergeAssets(
  host?: IframeAssetsManifest,
  builtin?: IframeAssetsManifest,
): IframeAssetsManifest | undefined {
  if (!host) {
    return builtin;
  }
  if (!builtin) {
    return host;
  }
  const hostJs = host.js ?? [];
  const hostCss = host.css ?? [];
  const srcSet = new Set(hostJs.map(a => a.src));
  const globalSet = new Set(hostJs.map(a => a.global).filter(Boolean));
  const cssFamilies = new Set(hostCss.map(cssFamilyKey));

  const js = [
    ...hostJs,
    ...(builtin.js ?? []).filter(a => !srcSet.has(a.src) && !(a.global && globalSet.has(a.global))),
  ];
  const css = [
    ...hostCss,
    ...(builtin.css ?? []).filter(href => cssFamilyKey(href) === href || !cssFamilies.has(cssFamilyKey(href))),
  ];

  return {
    ...builtin,
    ...host,
    js,
    css,
    plugins: [...new Set([...(host.plugins ?? []), ...(builtin.plugins ?? [])])],
    externals: [...(host.externals ?? []), ...(builtin.externals ?? [])],
  };
}

/**
 * 旧版扁平依赖列表归一化为 iframe 资产清单。
 * - 过滤 vue/vue.global（iframe 持有 ESM Vue 单实例，禁止覆盖）
 * - 按 HOST_SCRIPT_ASSET_MAP 补全 global/asPlugin/asIcons（packageName 精确 + url 兜底）
 * - 保持宿主下发顺序（加载顺序敏感：element-plus 先于 element-pro，framework 先于 biz-lib）
 * - fileUrl 精确去重（同名包不同 URL 的 private 渲染器 UMD 共存）
 */
export function normalizeRenderDependencies(
  deps?: IframeAssetsManifest | RenderDependencyItem[],
): IframeAssetsManifest | undefined {
  if (!deps) {
    return undefined;
  }
  if (!Array.isArray(deps)) {
    return deps as IframeAssetsManifest;
  }
  const manifest: IframeAssetsManifest = { js: [], css: [] };
  const seenUrl = new Set<string>();
  for (const item of deps) {
    if (!item?.fileUrl || seenUrl.has(item.fileUrl)) {
      continue;
    }
    seenUrl.add(item.fileUrl);
    if (item.fileType === "style") {
      manifest.css!.push(item.fileUrl);
      continue;
    }
    if (isBlockedHostScript(item)) {
      continue;
    }
    // 显式 global 优先（如本地 UMD 包 @cs/assembox-desktop-next），缺省按映射表推断
    manifest.js!.push({
      src: item.fileUrl,
      ...matchHostScriptAsset(item),
      ...(item.global ? { global: item.global } : {}),
    });
  }
  return manifest;
}

/**
 * Host 注入到 iframe window 的载荷：回调 + 依赖清单。
 * win.__ASSEM_HOST__ 的类型。
 */
export interface IframeHostPayload extends IframeHostCallbacks {
  /** 动态依赖清单（可选；缺省时 iframe 仅加载内置默认） */
  assets?: IframeAssetsManifest;
}
