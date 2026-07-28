/**
 * 区域渲染组件
 * 读取 skeleton.<area>.container.items 响应式渲染
 * 保留旧版验证过的布局结构
 */
import {defineComponent, PropType, computed} from 'vue';
import type {Area} from '../skeleton';

/** 顶部区域 */
export const TopArea = defineComponent({
  name: 'TopArea',
  props: {area: {type: Object as PropType<Area>, required: true}},
  setup(props) {
    const isEmpty = computed(() => props.area.container.isEmpty());
    return () => {
      if (isEmpty.value || !props.area.visible.value) return null;
      return (
        <div class="editor-top-area editor-area-visible">
          {props.area.container.items.map(w => w.content)}
        </div>
      );
    };
  }
});

/** 左侧图标轨道（top/bottom 分段） */
export const LeftArea = defineComponent({
  name: 'LeftArea',
  props: {area: {type: Object as PropType<Area>, required: true}},
  setup(props) {
    const isEmpty = computed(() => props.area.container.isEmpty());
    const groups = computed(() => {
      const top: any[] = [];
      const bottom: any[] = [];
      props.area.container.items.forEach(w => {
        if ((w.config.props?.align ?? 'top') === 'top') top.push(w.content);
        else bottom.push(w.content);
      });
      return {top, bottom};
    });
    return () => {
      if (isEmpty.value || !props.area.visible.value) return null;
      const {top, bottom} = groups.value;
      return (
        <div class="editor-left-area">
          <div class="editor-left-area-top">{top}</div>
          <div class="editor-left-area-bottom">{bottom}</div>
        </div>
      );
    };
  }
});

/** 左侧固定面板（互斥，单激活） */
export const LeftFixedPane = defineComponent({
  name: 'LeftFixedPane',
  props: {area: {type: Object as PropType<Area>, required: true}},
  setup(props) {
    const hasActive = computed(() => !!props.area.container.current.value);
    return () => {
      if (props.area.container.isEmpty() || !props.area.visible.value)
        return null;
      return (
        <div class={['editor-left-fixed-pane', {'d-none': !hasActive.value}]}>
          {props.area.container.items.map(w => w.content)}
        </div>
      );
    };
  }
});

/** 左侧浮动面板 */
export const LeftFloatPane = defineComponent({
  name: 'LeftFloatPane',
  props: {area: {type: Object as PropType<Area>, required: true}},
  setup(props) {
    const hasActive = computed(() => !!props.area.container.current.value);
    return () => {
      if (props.area.container.isEmpty() || !props.area.visible.value)
        return null;
      return (
        <div class={['editor-left-float-pane', {'d-none': !hasActive.value}]}>
          {props.area.container.items.map(w => w.content)}
        </div>
      );
    };
  }
});

/** 中央画布区域 */
export const MainArea = defineComponent({
  name: 'MainArea',
  props: {area: {type: Object as PropType<Area>, required: true}},
  setup(props) {
    return () => (
      <div class="editor-main-area">
        <div class="design-container">
          {props.area.container.items.map(w => w.content)}
        </div>
      </div>
    );
  }
});

/** 右侧设置面板区域 */
export const RightArea = defineComponent({
  name: 'RightArea',
  props: {
    area: {type: Object as PropType<Area>, required: true},
    visible: {type: Boolean, default: true}
  },
  setup(props) {
    return () => (
      <div class={['editor-right-area', {hidden: !props.visible}]}>
        {props.area.container.items.map(w => w.content)}
      </div>
    );
  }
});
