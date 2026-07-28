/**
 * 历史记录面板
 * 本地版本数组（取代旧版服务端 Redis history）
 * 支持撤销/重做
 */
import {defineComponent, PropType} from 'vue';
import {ElButton, ElButtonGroup, ElEmpty, ElTooltip} from 'element-plus';
import {RefreshLeft, RefreshRight, Document} from '@element-plus/icons-vue';
import type {Editor} from '../../core/editor';
import './../pane.less';

export const HistoryPane = defineComponent({
  name: 'HistoryPane',
  props: {
    editor: {type: Object as PropType<Editor>, required: true}
  },
  setup(props) {
    return () => {
      const store = props.editor.store;
      const history = store.history;
      return (
        <div class="assem-history-pane">
          <div class="assem-history-toolbar">
            <ElButtonGroup>
              <ElTooltip content="撤销" placement="top">
                <ElButton
                  size="small"
                  disabled={!store.canUndo}
                  onClick={() => props.editor.undo()}
                >
                  <RefreshLeft />
                </ElButton>
              </ElTooltip>
              <ElTooltip content="重做" placement="top">
                <ElButton
                  size="small"
                  disabled={!store.canRedo}
                  onClick={() => props.editor.redo()}
                >
                  <RefreshRight />
                </ElButton>
              </ElTooltip>
            </ElButtonGroup>
          </div>
          <div class="assem-history-list">
            {history.length ? (
              history
                .slice()
                .reverse()
                .map((entry, idx) => (
                  <div class="assem-history-item" key={entry.timestamp}>
                    <Document class="assem-history-icon" />
                    <span class="assem-history-label">{entry.label}</span>
                    <span class="assem-history-index">
                      #{history.length - idx}
                    </span>
                  </div>
                ))
            ) : (
              <ElEmpty description="暂无历史记录" imageSize={50} />
            )}
          </div>
        </div>
      );
    };
  }
});
