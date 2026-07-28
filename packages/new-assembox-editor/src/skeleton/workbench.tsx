/**
 * Workbench 根组件
 * 保留旧版验证过的布局结构，通过响应式驱动渲染（无需全量 refresh）
 */
import {defineComponent, PropType} from 'vue';
import type {Skeleton} from './skeleton';
import type {EditorStore} from '../core/store';
import {
  TopArea,
  LeftArea,
  LeftFixedPane,
  LeftFloatPane,
  MainArea,
  RightArea
} from './layouts/areas';
import './styles/workbench.less';

export interface WorkbenchProps {
  skeleton: Skeleton;
  store: EditorStore;
}

export const Workbench = defineComponent({
  name: 'EditorWorkbench',
  props: {
    skeleton: {type: Object as PropType<Skeleton>, required: true},
    store: {type: Object as PropType<EditorStore>, required: true}
  },
  setup(props) {
    return () => (
      <div class="editor-workbench">
        <TopArea area={props.skeleton.topArea} />
        <div class="editor-workbench-body">
          {/* 左侧图标轨道 */}
          <LeftArea area={props.skeleton.leftArea} />
          {/* 左侧固定面板 */}
          <LeftFixedPane area={props.skeleton.leftFixedArea} />
          {/* 左侧浮动面板 */}
          <LeftFloatPane area={props.skeleton.leftFloatArea} />
          {/* 中央画布 */}
          <MainArea area={props.skeleton.centerArea} />
          {/* 右侧设置面板 */}
          <RightArea
            area={props.skeleton.rightArea}
            visible={props.store.state.rightPanelVisible}
          />
        </div>
      </div>
    );
  }
});
