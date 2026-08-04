# iframe 画布动态依赖注入配置参考

> 适用：`packages/new-assembox-editor` 的 iframe 画布渲染器（`canvasMode: 'iframe'`）。
> 本文说明如何通过 **assets 清单** 让 iframe 按需动态加载 JS/CSS、注册 Vue 插件、图标、全局组件别名、外部组件、框架引导。

---

## 一、为什么需要动态依赖清单

iframe 画布运行在独立的 `canvas.html` 文档内，与编辑器主窗口（host）资源/样式隔离。画布要渲染的组件库（element-pro、table-pro 等）只有 CDN IIFE 包，它们在加载时会读取 `window.Vue`。

**关键约束**：iframe 内必须保持**单一 Vue 实例**——`assembox-desktop-next`（ESM Vue）与 CDN 全局包（element-pro 等）必须共用同一个 Vue，否则会出现双实例崩溃（`Cannot read properties of null (reading 'isCE')`）。

assets 协议解决两件事：
1. **加载顺序**：先把 ESM Vue 挂到 `window.Vue`，再按依赖顺序加载 CDN JS（element-pro 依赖 element-plus）。
2. **注册齐全**：覆盖旧版 `registerPlugin(app)` 的全部注册能力（插件/locale/图标/别名/引导/外部组件）。

---

## 二、核心类型（`src/simulator/iframe/protocol.ts`）

```ts
/** 一条 JS 依赖（CDN IIFE / UMD，加载后挂全局变量） */
export interface JsAsset {
  src: string;                         // 脚本地址
  global?: string;                     // 加载后挂载的全局变量名，如 'ElementPro'
  asPlugin?: boolean;                  // 作为 Vue 插件 app.use(window[global], pluginOptions)
  pluginOptions?: any;                 // app.use 的选项，如 ElementPlus 的 { locale }
  asIcons?: boolean;                   // 该全局是图标库：遍历其属性注册为全局组件
  components?: Array<{ name: string; path?: string }>;  // 取组件注册为全局组件（别名）
  bootstrap?: { ctorPath?: string; args?: any[] };       // 构造引导 new window[global][ctorPath](args)
}

/** 外部组件定义（registerExternal） */
export interface ExternalComponentDef {
  renderType: string;                  // schema 里的 renderType，如 'ToggleChip'
  globalPath: string;                  // 全局取值路径，如 'ElementPlusUi.ToggleChip'
  category: string;                    // 归类，如 'lineElement' / 'element' / 'container'
}

/** iframe 动态依赖清单（Host 下发） */
export interface IframeAssetsManifest {
  js?: JsAsset[];                      // 按数组顺序加载
  css?: string[];                      // link rel=stylesheet
  plugins?: string[];                  // 额外的 Vue 插件全局名（仅 app.use）
  externals?: ExternalComponentDef[];  // 外部组件注册（补全内置 manifest）
}
```

---

## 三、字段详解

### JsAsset 标记（一条 JS 依赖可叠加多个标记）

| 标记 | 渲染器处理 | 对应旧版 registerPlugin |
|---|---|---|
| `global` | 加载后赋值 `window[global]`，供后续标记引用 | `window.ElementPro` 等 |
| `asPlugin: true` | `app.use(window[global], pluginOptions)` | `app.use(window.ElementPro)` |
| `pluginOptions` | 传给 `app.use` 的第二参数 | `{ locale: zhCn }` |
| `asIcons: true` | 遍历 `window[global]` 全部属性，`app.component(key, val)` | 遍历 `ElementPlusIconsVue` 注册图标 |
| `components: [{name, path}]` | `app.component(name, resolvePath(window[global], path))` | `app.component('box', ElementPro.Box)` |
| `bootstrap: {ctorPath, args}` | `new window[global][ctorPath](...args)` | `new Vue3WebFramework.WebFramework({})` |

**特殊处理**：当 `global === 'ElementPlus'` 且 `pluginOptions.locale` 未指定时，渲染器自动注入 `element-plus/es/locale/lang/zh-cn`（中文），无需手动配置。

### externals（外部组件注册）

`registerExternal` 会把一个**普通 Vue 组件**包成认识 `__nodeOptions/__nodeEvent/__nodeId` 协议的适配组件，注册进 assembox 渲染清单（`lookupMeta` 可查到）。

适用：内置 `registerDefaults()` 未含的组件（如 ToggleChip、业务自定义组件）。

> 注意：仅 `app.component(name, comp)` 注册的组件 **不会** 进入 assembox manifest，`NodeRenderer` 解析不到——必须走 `externals`（底层 `registerExternal`）。

---

## 四、配置示例

### 示例 1：PC 默认清单（`DEFAULT_PC_ASSETS`）

```ts
const CDN = 'https://cdn.yearrow.com/files';

export const DEFAULT_PC_ASSETS: IframeAssetsManifest = {
  js: [
    { src: `${CDN}/element-plus/2.13.7/index.full.min.js`, global: 'ElementPlus', asPlugin: true },
    { src: `${CDN}/@element-plus/icons-vue/2.3.1/global.iife.min.js`, global: 'ElementPlusIconsVue', asIcons: true },
    { src: `${CDN}/vue-router/4.2.5/vue-router.global.prod.js`, global: 'VueRouter' },
    { src: `${CDN}/axios/1.7.0/axios.min.js`, global: 'axios' },
    {
      src: `${CDN}/@cs/element-pro/1.7.6/element-pro.iife.js`,
      global: 'ElementPro', asPlugin: true,
      components: [{ name: 'box', path: 'Box' }, { name: 'Box', path: 'Box' }],
    },
    { src: `${CDN}/@cs/element-plus-ui/1.0.1/element-plus-ui.iife.js`, global: 'ElementPlusUi', asPlugin: true },
    { src: `${CDN}/@cs/table-pro/1.0.13/table-pro.iife.js`, global: 'TablePro', asPlugin: true },
  ],
  css: [
    `${CDN}/@cs/element-pro/1.7.6/theme/index.css`,
    `${CDN}/@cs/element-plus-ui/1.0.1/theme/yun-que.css`,
    `${CDN}/fonts/material-cloud/1.0.0/iconfont.css`,
    `${CDN}/@cs/table-pro/1.0.13/theme/index.css`,
  ],
};
```

### 示例 2：自定义场景（换库/移动端）

```ts
const mobileAssets: IframeAssetsManifest = {
  js: [
    { src: 'https://cdn.example.com/vue/3.4.34/vue.global.prod.js' }, // 不挂 global（仅执行）
    { src: 'https://cdn.example.com/vant/4/index.js', global: 'Vant', asPlugin: true },
  ],
  css: ['https://cdn.example.com/vant/4/index.css'],
};
const renderer = new PcIframeRenderer(mobileAssets);
```

### 示例 3：补注册外部组件（如 ToggleChip）

```ts
const assets: IframeAssetsManifest = {
  ...DEFAULT_PC_ASSETS,
  externals: [
    {
      renderType: 'ToggleChip',
      globalPath: 'ElementPlusUi.ToggleChip', // 从 window 起算的点分路径
      category: 'lineElement',                // 决定能放进哪些容器槽位
    },
    {
      renderType: 'OrgPicker',
      globalPath: 'MyBizLib.OrgPicker',
      category: 'lineElement',
    },
  ],
};
```

### 示例 4：框架引导初始化（旧版 Vue3WebFramework）

```ts
const assets: IframeAssetsManifest = {
  ...DEFAULT_PC_ASSETS,
  js: [
    { src: `${CDN}/vue3-web-framework/x.js`, global: 'Vue3WebFramework',
      bootstrap: { ctorPath: 'WebFramework', args: [{}] } }, // new window.Vue3WebFramework.WebFramework({})
    ...DEFAULT_PC_ASSETS.js!,
  ],
};
```

### 示例 5：条件注册（包不存在则跳过）

渲染器对 `window[global] == null` 自动跳过，因此可直接列出可选包：

```ts
{ src: `${CDN}/vue3-com-components/x.js`, global: 'Vue3ComComponents', asPlugin: true },
// 若该 CDN 不可达 / 未暴露全局，asPlugin 注册被跳过，不影响其余组件
```

---

## 五、使用方式（三种）

### 方式 1：构造时传入

```ts
import { PcIframeRenderer, DEFAULT_PC_ASSETS } from '@/simulator/iframe/pc-iframe-renderer';

const renderer = new PcIframeRenderer(DEFAULT_PC_ASSETS);
// 或自定义：new PcIframeRenderer(customAssets)
```

### 方式 2：mount 前动态切换

```ts
const renderer = new PcIframeRenderer();
renderer.setAssets(mobileAssets); // 必须在 mount 之前调用
await renderer.mount(container, schema);
```

### 方式 3：场景档案默认提供（推荐）

在 `src/scenarios/<scenario>/index.ts` 的 `ScenarioProfile.createIframeRenderer` 里返回带默认清单的实例：

```ts
import { PcIframeRenderer } from '@/simulator/iframe/pc-iframe-renderer';

export const mobileProfile: ScenarioProfile = {
  // ...
  createIframeRenderer: () => new PcIframeRenderer(mobileAssets),
};
```

`createEditor({ scenario: 'mobile', canvasMode: 'iframe' })` 时自动选用。

---

## 六、装配时序（单 Vue 实例保证）

```
host.mount(container, schema)
  ├─ 创建 <iframe src="/canvas.html">
  └─ connect(): iframe load 后注入
        win.__ASSEM_HOST__ = { ...hostCallbacks, assets }

iframe entry (iframe-renderer-entry.ts):
  ├─ waitForHost()        // 轮询拿到 { callbacks, assets }
  ├─ window.Vue = Vue     // ★ ESM Vue 先挂全局（CDN 包读它）
  ├─ for js in assets.js: await loadScript(js.src)   // 顺序加载，保证依赖
  ├─ for css in assets.css: loadStyle(css)           // link 注入
  └─ new IframeCanvasRenderer(host, assets) → win.__ASSEM_RENDERER__

host 轮询拿到 __ASSEM_RENDERER__ → api.init(schema) → renderer.mount():
  ├─ createApp(...)
  ├─ 遍历 assets.js 逐条注册：
  │    bootstrap → asPlugin(+pluginOptions/ElementPlus locale)
  │              → asIcons(图标遍历) → components(别名)
  │    + assets.plugins 额外 app.use
  ├─ app.use(AssemPlugin, config)
  ├─ registerDefaults()                      // 内置组件 manifest
  ├─ for ext in assets.externals: registerExternal(...)  // 外部组件
  └─ app.mount('#app')
```

**关键点**：
- `loadScript` 用 `await` 顺序加载，保证 element-pro 在 element-plus 之后。
- 所有插件/图标/组件注册都在 `app.mount()` **之前**完成。
- `window.Vue` 在加载任何 CDN JS 前就绪，CDN IIFE 包据此与 assembox-desktop-next 共用同一 Vue。

---

## 七、与旧版 registerPlugin 对照

| 旧版（plugin-vue-renderer-desktop） | 现在 assets 配置 |
|---|---|
| `new window.Vue3WebFramework.WebFramework({})` | `bootstrap: { ctorPath: 'WebFramework', args: [{}] }` |
| `app.use(window.ElementPlus, { locale: zhCn })` | `asPlugin: true`（locale 自动注入）或 `pluginOptions: { locale }` |
| `app.use(window.ElementPro)` | `asPlugin: true` |
| `if (window.Vue3ComComponents) app.use(...)` | `asPlugin: true`（target 为空自动跳过） |
| `app.use(window.TablePro)` | `asPlugin: true` |
| `app.component('box', ElementPro.Box)` | `components: [{ name: 'box', path: 'Box' }]` |
| 遍历 `ElementPlusIconsVue` 注册图标 | `asIcons: true` |
| —（旧版无） | `externals: [{ renderType, globalPath, category }]`（外部组件 registerExternal） |

---

## 八、常见问题

**Q1：为什么图标不显示（`<el-icon>` 为空）？**
A：缺少 `asIcons: true`。element-plus 的图标是独立全局包 `ElementPlusIconsVue`，必须遍历注册为全局组件，否则 `icon="Search"` 解析不到组件。

**Q2：报 `未注册的组件类型: "XXX"`（UNKNOWN_RENDER_TYPE）？**
A：该组件不在 `registerDefaults()` 的内置 manifest。若它存在于某已加载的全局包，用 `externals` 配置 `registerExternal`；若是纯业务组件，需通过 `registerExternal` 传入组件本身（参考 `@cs/assembox-desktop-next` 第 12 章外部组件接入）。

**Q3：报 `Cannot read properties of null (reading 'isCE')`？**
A：双 Vue 实例。检查是否在 `assets.js` 里加载了独立的 `vue.global.prod.js`——**不要**重复加载 Vue，iframe entry 已把 ESM Vue 挂到 `window.Vue`，CDN 包应复用它。

**Q4：`pluginOptions` 里的对象能跨 host→iframe 传递吗？**
A：能。assets 通过 `__ASSEM_HOST__` 注入，普通对象经结构化克隆传递。但 **函数/类实例不可克隆**——locale 等纯数据对象可以，自定义插件选项需保证可结构化克隆。`element-plus` 的 `zhCn` 已由 iframe 渲染器在内部 import，无需 host 传递。

**Q5：CSS 在哪加载？**
A：`assets.css` 由 iframe entry 用 `<link rel="stylesheet">` 动态注入。`canvas.html` 本身不写死任何 CDN link（已移除），全部由清单驱动。`element-plus/dist/index.css`（基础样式）由 entry 的 `import` 提供。

**Q6：换 CDN 源/版本只需改清单？**
A：是。改 `DEFAULT_PC_ASSETS` 的 `src`/`global`/版本号即可，无需改渲染器代码。

---

## 九、相关源码索引

| 文件 | 职责 |
|---|---|
| `src/simulator/iframe/protocol.ts` | assets 类型定义（JsAsset / IframeAssetsManifest / IframeHostPayload） |
| `src/simulator/iframe/pc-iframe-renderer.ts` | `DEFAULT_PC_ASSETS` 默认清单；`PcIframeRenderer` 构造/setAssets/注入 |
| `src/simulator/iframe/iframe-renderer-entry.ts` | waitForHost → window.Vue → loadScript/loadStyle → 创建 renderer |
| `src/simulator/iframe/iframe-canvas-renderer.ts` | `mount()` 遍历 assets.js 注册（bootstrap/asPlugin/asIcons/components）+ externals |
