/**
 * 历史记录面板
 * 本地版本数组（取代旧版服务端 Redis history）
 * 支持撤销/重做
 */
import {defineComponent, PropType} from 'vue';
import {RefreshLeft, RefreshRight, Document} from '@element-plus/icons-vue';
import type {Editor} from '../../core/editor';
import {useAssemNamespace} from '../../hooks/use-assem-namespace';
import './../pane.less';

const ns = useAssemNamespace('history-pane');

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
        <div class={ns.b()}>
          <div class={ns.e('toolbar')}>
            <el-button-group>
              <el-tooltip content="撤销" placement="top">
                <el-button
                  size="small"
                  disabled={!store.canUndo}
                  onClick={() => props.editor.undo()}
                >
                  <RefreshLeft />
                </el-button>
              </el-tooltip>
              <el-tooltip content="重做" placement="top">
                <el-button
                  size="small"
                  disabled={!store.canRedo}
                  onClick={() => props.editor.redo()}
                >
                  <RefreshRight />
                </el-button>
              </el-tooltip>
            </el-button-group>
          </div>
          <div class={ns.e('list')}>
            {history.length ? (
              history
                .slice()
                .reverse()
                .map((entry, idx) => (
                  <div class={ns.e('item')} key={entry.timestamp}>
                    <Document class={ns.e('icon')} />
                    <span class={ns.e('label')}>{entry.label}</span>
                    <span class={ns.e('index')}>#{history.length - idx}</span>
                  </div>
                ))
            ) : (
              <el-empty description="暂无历史记录" imageSize={50} />
            )}
          </div>
        </div>
      );
    };
  }
});
