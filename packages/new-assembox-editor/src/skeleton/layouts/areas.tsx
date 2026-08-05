import type { Area, Skeleton } from "../skeleton";
/**
 * 区域渲染组件
 * 读取 skeleton.<area>.container.items 响应式渲染
 * TopArea 支持 left/center/right 三槽；LeftFloatPane 接入 FocusTracker 失焦关闭
 */
import { computed, defineComponent, h, inject, PropType, ref } from "vue";
import { useAssemNamespace } from "../../hooks/use-assem-namespace";
import { useFocusOut } from "../focus-tracker";
import { Tip } from "../widgets/tip";

const ns = useAssemNamespace("workbench");
const dockNs = useAssemNamespace("dock");

/**
 * leftArea 中 Widget 类型（非 PanelDock）的 item 补 dock 包裹，
 * 使其与 PanelDock 图标视觉一致（居中 + 尺寸 + hover 样式）。
 * PanelDock 自带 .lc-assem-dock 包裹（widgets.ts），无需重复。
 * 若 Widget 有 description 配置，额外包裹 Tip（与 PanelDock 行为对齐）。
 */
function wrapDockContent(w: any): any {
  if (w.type === "PanelDock" || w.type === "Dock") {
    return w.content;
  }
  const dockEl = h("div", { class: dockNs.b() }, [w.content]);
  const tip = w.config?.props?.description;
  return tip
    ? h(Tip, { content: tip, placement: "right" }, { default: () => dockEl })
    : dockEl;
}

/** 顶部区域（left/center/right 三槽） */
export const TopArea = defineComponent({
  name: "TopArea",
  props: { area: { type: Object as PropType<Area>, required: true } },
  setup(props) {
    const isEmpty = computed(() => props.area.container.isEmpty());
    const groups = computed(() => {
      const left: any[] = [];
      const center: any[] = [];
      const right: any[] = [];
      props.area.container.items.forEach((w) => {
        const align = w.config.props?.align ?? "left";
        const node = w.content;
        if (align === "center") {
          center.push(node);
        } else if (align === "right") {
          right.push(node);
        } else {
          left.push(node);
        }
      });
      return { left, center, right };
    });
    return () => {
      if (isEmpty.value || !props.area.visible.value) {
        return null;
      }
      const { left, center, right } = groups.value;
      return (
        <div class={[ns.e("top-area"), ns.is("visible")]}>
          <div class={ns.e("top-area-left")}>{left}</div>
          <div class={ns.e("top-area-center")}>{center}</div>
          <div class={ns.e("top-area-right")}>{right}</div>
        </div>
      );
    };
  },
});

/** 左侧图标轨道（top/bottom 分段） */
export const LeftArea = defineComponent({
  name: "LeftArea",
  props: { area: { type: Object as PropType<Area>, required: true } },
  setup(props) {
    const isEmpty = computed(() => props.area.container.isEmpty());
    const groups = computed(() => {
      const top: any[] = [];
      const bottom: any[] = [];
      props.area.container.items.forEach((w) => {
        const content = wrapDockContent(w);
        if ((w.config.props?.align ?? "top") === "top") {
          top.push(content);
        } else {
          bottom.push(content);
        }
      });
      return { top, bottom };
    });
    return () => {
      if (isEmpty.value || !props.area.visible.value) {
        return null;
      }
      const { top, bottom } = groups.value;
      return (
        <div class={ns.e("left-area")}>
          <div class={ns.e("left-area-top")}>{top}</div>
          <div class={ns.e("left-area-bottom")}>{bottom}</div>
        </div>
      );
    };
  },
});

/** 左侧固定面板（互斥，单激活） */
export const LeftFixedPane = defineComponent({
  name: "LeftFixedPane",
  props: { area: { type: Object as PropType<Area>, required: true } },
  setup(props) {
    const skeleton = inject<Skeleton>("assem-skeleton");
    return () => {
      const area = skeleton?.getArea(props.area.name) ?? props.area;
      if (area.container.isEmpty() || !area.visible.value) {
        return null;
      }
      if (!area.container.items.some(w => w.active)) {
        return null;
      }
      return (
        <div class={ns.e("left-fixed-pane")}>
          {area.container.items.map(w => w.content)}
        </div>
      );
    };
  },
});

/** 左侧浮动面板（FocusTracker 失焦关闭） */
export const LeftFloatPane = defineComponent({
  name: "LeftFloatPane",
  props: { area: { type: Object as PropType<Area>, required: true } },
  setup(props) {
    const skeleton = inject<Skeleton>("assem-skeleton");
    const paneEl = ref<HTMLElement | null>(null);

    useFocusOut(
      paneEl,
      () => {
        const area = skeleton?.getArea(props.area.name);
        const cur = area?.container.getCurrent();
        if (cur) {
          area?.container.unactive(cur as any);
        }
      },
      (target) => {
        // 保护范围：左侧 dock 图标栏（点击切换而非关闭）
        return !!target.closest(".lc-assem-workbench__left-area");
      },
    );

    return () => {
      const area = skeleton?.getArea(props.area.name) ?? props.area;
      if (area.container.isEmpty() || !area.visible.value) {
        return null;
      }
      if (!area.container.items.some(w => w.active)) {
        return null;
      }
      return (
        <div ref={paneEl} class={ns.e("left-float-pane")}>
          {area.container.items.map(w => w.content)}
        </div>
      );
    };
  },
});

/** 中央画布区域 */
export const MainArea = defineComponent({
  name: "MainArea",
  props: { area: { type: Object as PropType<Area>, required: true } },
  setup(props) {
    return () => (
      <div class={ns.e("main-area")}>
        <div class={ns.e("design-container")}>
          {props.area.container.items.map(w => w.content)}
        </div>
      </div>
    );
  },
});

/** 右侧设置面板区域 */
export const RightArea = defineComponent({
  name: "RightArea",
  props: {
    area: { type: Object as PropType<Area>, required: true },
    visible: { type: Boolean, default: true },
  },
  setup(props) {
    return () => (
      <div class={[ns.e("right-area"), ns.is("hidden", !props.visible)]}>
        {props.area.container.items.map(w => w.content)}
      </div>
    );
  },
});
