/**
 * renderType → 渲染层嵌套分类（ComponentCategory）静态映射
 *
 * 渲染库 assembox-desktop-next 的 componentMap 是**运行时注册表**
 * （registerManifest/registerDefaults 之后才有数据）。编辑器 iframe 画布模式下
 * host 侧库副本不执行注册，纯 lookupMeta 恒 undefined → canNest 误判全拒绝。
 * 故编辑器侧维护一份静态对齐表，模块加载即可用（渲染库零编辑器特化）。
 *
 * ⚠️ 数据源：assembox-desktop-next src/components/manifest.ts 的 COMPONENTS 表。
 * 渲染库新增组件 / 调整 category 时**必须同步本表**——由
 * src/__tests__/nesting-categories.test.ts 对齐守护测试强制校验
 * （registerDefaults() 后逐条比对，漂移即红）。
 *
 * 分类语义（渲染库 nesting.ts SLOTS 白名单用语）：
 * - layout        布局（可嵌套任意子类型）
 * - container     容器
 * - element       块级元素（表格/列表/表单…）
 * - lineElement   内联元素（按钮/输入框…）
 * - columnElement 列元素
 * - placeholder   UI 骨架区块占位（任意槽位允许）
 */
export type RenderCategory
  = | "layout"
    | "container"
    | "element"
    | "lineElement"
    | "columnElement"
    | "placeholder";

export const RENDER_TYPE_CATEGORIES: Readonly<Record<string, RenderCategory>> = {
  // ── layout ──────────────────────────────────────
  YqFlexBox: "layout",
  YqFlexLine: "layout",
  GridBox: "layout",
  GridItem: "layout",

  // ── container ───────────────────────────────────
  YqBox: "container",
  YqToolBar: "container",
  TabPanel: "container",
  YqPanel: "container",
  YqNavigationBar: "container",

  // ── lineElement：显示类 ──────────────────────────
  YqLabel: "lineElement",
  Tag: "lineElement",
  FilterSummary: "lineElement",
  Image: "lineElement",
  Icon: "lineElement",
  RawHtml: "lineElement",
  UiSkeletonBlockSlot: "placeholder",
  Dropdown: "lineElement",
  Button: "lineElement",
  YqAdvancedFilter: "lineElement",

  // ── lineElement：输入类 ──────────────────────────
  YqBasisCommonSelectApi: "lineElement",
  YqDictionarySelect: "lineElement",
  YqDictionaryTree: "lineElement",
  InputNumber: "lineElement",
  Switch: "lineElement",
  Checkbox: "lineElement",
  CheckboxGroup: "lineElement",
  RadioGroup: "lineElement",
  DatePicker: "lineElement",
  YqDateRangePicker: "lineElement",
  TimePicker: "lineElement",
  YqSearchSelect: "lineElement",
  YqSearchTreeSelect: "lineElement",
  Input: "lineElement",
  Select: "lineElement",
  YqOrganizationTreeSelect: "lineElement",
  YqFileSimpleUpload: "lineElement",
  FormItem: "lineElement",
  YqFilterItem: "lineElement",

  // ── element：表格族 ──────────────────────────────
  YqTableAsync: "element",
  YqTableOnly: "element",
  YqTableReport: "element",
  YqTableTree: "element",
  YqTableEdit: "element",

  // ── element：列表族 ──────────────────────────────
  YqListAsync: "element",
  YqListOnly: "element",
  YqListReport: "element",

  // ── element：其他 ────────────────────────────────
  YqSearchTreePanel: "element",
  YqImageCardPreview: "element",
  YqOrganizationTreePanel: "element",
  Chart: "element",
  Step: "element",
  Form: "element",
  YqSelectComMaterial: "element",
  YqFileTableUpload: "element",
  YqFileImageCardUpload: "element",

  // ── columnElement ───────────────────────────────
  ListElement: "columnElement",
};
