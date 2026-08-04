/**
 * 顶部工具栏（预览/设计切换 + 撤销/重做 + 设备预设）
 */
import {defineComponent, PropType} from 'vue';
import {
  ElButton,
  ElButtonGroup,
  ElTooltip,
  ElDivider,
  ElRadioGroup,
  ElRadioButton
} from 'element-plus';
import {
  RefreshLeft,
  RefreshRight,
  View,
  Edit,
  CopyDocument,
  Delete
} from '@element-plus/icons-vue';
import type {Editor} from '../../core/editor';
import {DEVICE_PRESETS} from '../../core/store';
import {useAssemNamespace} from '../../hooks/use-assem-namespace';
import './../pane.less';

const ns = useAssemNamespace('toolbar');

export const EditorToolbar = defineComponent({
  name: 'EditorToolbar',
  props: {
    editor: {type: Object as PropType<Editor>, required: true}
  },
  setup(props) {
    return () => {
      const store = props.editor.store;
      return (
        <div
          class={ns.b()}
          style={{
            'display': 'flex',
            'flex-wrap': 'nowrap',
            'align-items': 'center',
            'gap': '6px',
            'padding': '0 12px',
            'width': '100%',
            'height': '100%',
            'overflow': 'hidden'
          }}
        >
          {/* 设计/预览切换 */}
          <ElButtonGroup>
            <ElButton
              size="small"
              type={store.state.designMode === 'design' ? 'primary' : 'default'}
              icon={Edit}
              onClick={() => {
                if (store.state.designMode !== 'design')
                  props.editor.setDesignMode('design');
              }}
            >
              设计
            </ElButton>
            <ElButton
              size="small"
              type={
                store.state.designMode === 'preview' ? 'primary' : 'default'
              }
              icon={View}
              onClick={() => {
                if (store.state.designMode !== 'preview')
                  props.editor.setDesignMode('preview');
              }}
            >
              预览
            </ElButton>
          </ElButtonGroup>

          <ElDivider direction="vertical" />

          {/* 撤销/重做 */}
          <ElButtonGroup>
            <ElTooltip content="撤销 (Ctrl+Z)" placement="bottom">
              <ElButton
                size="small"
                disabled={!store.canUndo}
                icon={RefreshLeft}
                onClick={() => props.editor.undo()}
              />
            </ElTooltip>
            <ElTooltip content="重做 (Ctrl+Y)" placement="bottom">
              <ElButton
                size="small"
                disabled={!store.canRedo}
                icon={RefreshRight}
                onClick={() => props.editor.redo()}
              />
            </ElTooltip>
          </ElButtonGroup>

          <ElDivider direction="vertical" />

          {/* 节点操作（有选中时可用） */}
          {store.state.activeId && (
            <ElButtonGroup>
              <ElTooltip content="复制 (Ctrl+D)" placement="bottom">
                <ElButton
                  size="small"
                  icon={CopyDocument}
                  onClick={() => props.editor.duplicate(store.state.activeId!)}
                />
              </ElTooltip>
              <ElTooltip content="删除 (Delete)" placement="bottom">
                <ElButton
                  size="small"
                  icon={Delete}
                  type="danger"
                  onClick={() => props.editor.remove(store.state.activeId!)}
                />
              </ElTooltip>
            </ElButtonGroup>
          )}

          <div style={{flex: 1}} />

          {/* 右侧面板切换 */}
          <ElButton size="small" link onClick={() => store.toggleRightPanel()}>
            {store.state.rightPanelVisible ? '隐藏面板' : '显示面板'}
          </ElButton>
        </div>
      );
    };
  }
});
