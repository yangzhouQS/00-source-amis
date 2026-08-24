import type { IframeAssetsManifest, RenderDependencyItem } from "../simulator/iframe/protocol";
import { describe, expect, it } from "vitest";
import { DEFAULT_PC_ASSETS } from "../simulator/iframe/pc-iframe-renderer";
import {

  mergeAssets,
  normalizeRenderDependencies,
} from "../simulator/iframe/protocol";

/** 服务端「模块依赖版本解析」真实返回样例（test/parser-module-dependencies-version.ts 同构） */
const serverDeps: RenderDependencyItem[] = [
  { fileType: "script", scope: "public", packageName: "vue3", fileUrl: "https://cdn.yearrow.com/files/vue/3.4.34/vue.global.prod.js" },
  { fileType: "script", scope: "public", packageName: "vue-router", fileUrl: "https://cdn.yearrow.com/files/vue-router/4.2.5/vue-router.global.prod.js" },
  { fileType: "script", scope: "public", packageName: "axios", fileUrl: "https://cdn.yearrow.com/files/axios/1.7.0/axios.min.js" },
  { fileType: "script", scope: "public", packageName: "decimal", fileUrl: "https://cdn.yearrow.com/files/decimal.js/10.4.3/decimal.js" },
  { fileType: "script", scope: "public", packageName: "@antv/g2plot", fileUrl: "https://cdn.yearrow.com/files/@antv/g2plot/2.4.32/g2plot.min.js" },
  { fileType: "style", scope: "public", packageName: "fonts/cs-common", fileUrl: "https://cdn.yearrow.com/fonts/cs-common/1.0.0/iconfont.css" },
  { fileType: "script", scope: "public", packageName: "element-plus-js", fileUrl: "https://cdn.yearrow.com/files/element-plus/2.13.7/index.full.min.js" },
  { fileType: "script", scope: "public", packageName: "@element-plus/icons-vue", fileUrl: "https://cdn.yearrow.com/files/@element-plus/icons-vue/2.3.1/global.iife.min.js" },
  { fileType: "script", scope: "public", packageName: "@cs/element-plus-ui-js", fileUrl: "https://cdn.yearrow.com/files/@cs/element-plus-ui/1.1.0/element-plus-ui.iife.js" },
  { fileType: "style", scope: "public", packageName: "@cs/element-plus-ui-css", fileUrl: "https://cdn.yearrow.com/files/@cs/element-plus-ui/1.1.0/theme/yun-que.css" },
  { fileType: "style", scope: "public", packageName: "@cs/table-pro-css", fileUrl: "https://cdn.yearrow.com/files/@cs/table-pro/3.0.3/theme/yun-que.css" },
  { fileType: "script", scope: "public", packageName: "@cs/table-pro-js", fileUrl: "https://cdn.yearrow.com/files/@cs/table-pro/3.0.3/table-pro.iife.js" },
  { fileType: "script", scope: "public", packageName: "js-web-frameworky", fileUrl: "https://cdn.yearrow.com/files/@cs/js-web-framework/1.2.0/js-web-framework.umd.js" },
  { fileType: "script", scope: "public", packageName: "vue3-biz-components-library", fileUrl: "https://cdn.yearrow.com/files/@cs/vue3-biz-components-library/test-2026-8-18/vue3-biz-components-library.umd.js" },
  { fileType: "script", scope: "public", packageName: "@cs/better-print", fileUrl: "https://cdn.yearrow.com/files/@cs/better-print/1.2.16/better-print.iife.js" },
  { fileType: "script", scope: "public", packageName: "@cs/excel-conduct-library", fileUrl: "https://cdn.yearrow.com/files/@cs/excel-conduct-library/2.1.19/excel-conduct-library.iife.js" },
  { fileType: "script", scope: "private", packageName: "@cs/excel-conduct-library", fileUrl: "https://cdn.yearrow.com/files/assem-component/desktop/test-yanshi-receive/1.0.3/lib/assembox-renderer-test-yanshi-receive.umd.js" },
];

describe("normalizeRenderDependencies（服务端扁平依赖 → iframe 资产清单）", () => {
  const manifest = normalizeRenderDependencies(serverDeps)!;

  it("过滤 vue/vue.global，保护 iframe 内 ESM Vue 单实例", () => {
    expect(manifest.js!.some(a => a.src.includes("vue.global"))).toBe(false);
  });

  it("packageName/url 推断 global 与注册标记（含 js-web-frameworky 拼写容错）", () => {
    const bySrc = (frag: string) => manifest.js!.find(a => a.src.includes(frag))!;
    expect(bySrc("element-plus/2.13.7")).toMatchObject({ global: "ElementPlus", asPlugin: true });
    expect(bySrc("icons-vue")).toMatchObject({ global: "ElementPlusIconsVue", asIcons: true });
    expect(bySrc("element-plus-ui")).toMatchObject({ global: "ElementPlusUi", asPlugin: true });
    expect(bySrc("table-pro/3.0.3")).toMatchObject({ global: "TablePro", asPlugin: true });
    expect(bySrc("js-web-framework")).toMatchObject({ global: "JsWebFramework" });
    expect(bySrc("vue3-biz-components")).toMatchObject({ global: "Vue3BizComponentsLibrary", asPlugin: true });
    expect(bySrc("vue-router")).toMatchObject({ global: "VueRouter" });
  });

  it("无映射的普通脚本仅挂 src（decimal/g2plot/better-print/private 渲染器）", () => {
    for (const frag of ["decimal.js", "g2plot", "better-print", "excel-conduct", "test-yanshi-receive"]) {
      const a = manifest.js!.find(x => x.src.includes(frag))!;
      expect(a.global).toBeUndefined();
      expect(a.asPlugin).toBeUndefined();
    }
  });

  it("同名包不同 URL 的 private 渲染器与 public 包共存（按 fileUrl 去重而非包名）", () => {
    expect(manifest.js!.filter(a => a.src.includes("excel-conduct")).length).toBe(1);
    expect(manifest.js!.some(a => a.src.includes("test-yanshi-receive"))).toBe(true);
  });

  it("样式进 css 列表", () => {
    expect(manifest.css).toHaveLength(3);
    expect(manifest.css!.some(h => h.includes("cs-common"))).toBe(true);
  });

  it("本地 UMD 包（public/@cs）：显式 global 直通，位于依赖序可行位（element 家族之后）", () => {
    const localDeps: RenderDependencyItem[] = [
      { fileType: "script", packageName: "@cs/assembox-core-next", fileUrl: "/@cs/assembox-core-next/dist/index.umd.cjs", global: "AssemboxPackage" },
      { fileType: "script", packageName: "@cs/assembox-desktop-next", fileUrl: "/@cs/assembox-desktop-next/dist/index.umd.cjs", global: "AssemBoxDesktopNext" },
      { fileType: "style", packageName: "@cs/assembox-desktop-next-css", fileUrl: "/@cs/assembox-desktop-next/dist/index.css" },
    ];
    const m = normalizeRenderDependencies(localDeps)!;
    expect(m.js).toHaveLength(2);
    expect(m.js!.find(a => a.src.includes("desktop-next"))).toMatchObject({ global: "AssemBoxDesktopNext" });
    expect(m.css).toEqual(["/@cs/assembox-desktop-next/dist/index.css"]);
    // core 在 desktop 之前（desktop 工厂不依赖 core 全局，但保持声明顺序）
    expect(m.js![0].src).toContain("core-next");
  });
});

describe("mergeAssets（宿主下发 + 场景内置兜底）", () => {
  const host = normalizeRenderDependencies(serverDeps)!;
  const merged = mergeAssets(host, DEFAULT_PC_ASSETS)!;

  it("宿主同 global 的内置项去重（table-pro 3.0.3 覆盖内置 1.0.13，仅加载一份）", () => {
    const tablePro = merged.js!.filter(a => a.src.includes("table-pro"));
    expect(tablePro).toHaveLength(1);
    expect(tablePro[0].src).toContain("3.0.3");
    expect(tablePro[0].global).toBe("TablePro");
  });

  it("宿主已提供的 element-plus/framework/biz-lib 内置不再重复", () => {
    expect(merged.js!.filter(a => a.global === "ElementPlus")).toHaveLength(1);
    expect(merged.js!.filter(a => a.global === "JsWebFramework")).toHaveLength(1);
    expect(merged.js!.filter(a => a.global === "Vue3BizComponentsLibrary")).toHaveLength(1);
  });

  it("宿主缺失的内置项兜底保留（element-pro 及其主题）", () => {
    expect(merged.js!.some(a => a.global === "ElementPro" && a.asPlugin)).toBe(true);
    expect(merged.css!.some(h => h.includes("element-pro"))).toBe(true);
  });

  it("css 按库家族去重（宿主 yun-que 1.1.0 生效，内置 1.0.8 不再加载）", () => {
    expect(merged.css!.filter(h => h.includes("element-plus-ui"))).toHaveLength(1);
    expect(merged.css!.filter(h => h.includes("table-pro"))).toHaveLength(1);
    expect(merged.css!.some(h => h.includes("1.1.0"))).toBe(true);
  });

  it("宿主项整体先于内置兜底项（element-plus 先于 element-pro 求值）", () => {
    const epIdx = merged.js!.findIndex(a => a.global === "ElementPlus");
    const proIdx = merged.js!.findIndex(a => a.global === "ElementPro");
    expect(epIdx).toBeGreaterThan(-1);
    expect(proIdx).toBeGreaterThan(epIdx);
  });

  it("无宿主下发时回退内置默认", () => {
    expect(mergeAssets(undefined, DEFAULT_PC_ASSETS)).toBe(DEFAULT_PC_ASSETS);
  });

  it("空清单直接透传（manifest 形态）", () => {
    const direct: IframeAssetsManifest = { js: [{ src: "x.js", global: "X" }] };
    expect(normalizeRenderDependencies(direct)).toBe(direct);
    expect(normalizeRenderDependencies(undefined)).toBeUndefined();
  });
});
