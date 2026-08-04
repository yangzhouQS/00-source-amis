/**
 * iframe 画布通信协议
 *
 * 同源直引模型（dev/prod 同源，无需 postMessage）：
 *  Host 创建 iframe → iframe 加载 canvas.html → entry 暴露 win.__ASSEM_RENDERER__
 *  Host 通过 win.__ASSEM_RENDERER__.xxx() 调用渲染器
 *  Host 注入 win.__ASSEM_HOST__ = callbacks，渲染器通过它回报事件
 *  DOM 查询：Host 直接用 iframe.contentDocument（同步）
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Host 注入到 iframe window 的全局键 */
export const HOST_GLOBAL_KEY = '__ASSEM_HOST__';
/** iframe entry 暴露渲染器的全局键 */
export const RENDERER_GLOBAL_KEY = '__ASSEM_RENDERER__';

/** Host → Renderer 命令（Host 调用，Renderer 实现） */
export interface IframeRendererApi {
  readonly ready: boolean;
  /** 初始化：注入 schema 并首次挂载 */
  init(schema: any, designMode: 'design' | 'preview'): void;
  /** 全量同步 schema（结构变更后） */
  setSchema(schema: any): void;
  /** 定向更新节点属性（增量，可选实现） */
  updateNode?(nodeId: string, patch: any): void;
  /** 设计/预览模式切换 */
  setDesignMode(mode: 'design' | 'preview'): void;
  /** 拖拽态（禁用画布交互光标） */
  setDraggingState(active: boolean): void;
  /** 强制重渲染 */
  rerender(): void;
  /** 销毁 */
  dispose(): void;
}

/** Renderer → Host 回调（Host 注入，Renderer 调用） */
export interface IframeHostCallbacks {
  /** iframe 渲染器就绪 */
  onReady(): void;
  /** 画布内点击节点 */
  onClick(nodeId: string | null, originalEvent: MouseEvent): void;
  /** 画布内悬浮节点 */
  onHover(nodeId: string | null): void;
  /** 渲染器错误 */
  onError(message: string, detail?: any): void;
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

/**
 * Host 注入到 iframe window 的载荷：回调 + 依赖清单。
 * win.__ASSEM_HOST__ 的类型。
 */
export interface IframeHostPayload extends IframeHostCallbacks {
  /** 动态依赖清单（可选；缺省时 iframe 仅加载内置默认） */
  assets?: IframeAssetsManifest;
}
