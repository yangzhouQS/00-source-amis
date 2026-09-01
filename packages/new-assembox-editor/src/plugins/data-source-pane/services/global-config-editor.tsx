import type {DsDocHandle} from '../doc/use-data-source-doc';
import {ElMessage} from 'element-plus';
import {Setting} from '@element-plus/icons-vue';

/**
 * api.config 全局配置编辑器（Dialog + Monaco JSON）
 * 全局 axios 基底：baseURL/headers/timeout 等，每请求合并的第一层
 */
import {defineComponent, PropType, ref, watch} from 'vue';
import {useAssemNamespace} from '../../../hooks/use-assem-namespace';
import {CodeEditor} from '../../../components/code-editor';
import '../data-source-pane-style.less';

const ns = useAssemNamespace('ds-editor');

/**
 * 全局配置编辑器
 */
export const GlobalConfigEditor = defineComponent({
  name: 'DsGlobalConfigEditor',
  props: {
    doc: {type: Object as PropType<DsDocHandle>, required: true}
  },
  setup(props) {
    const visible = ref(false);
    const text = ref('{}');
    let lastApplied = '';

    watch(visible, (v) => {
      if (v) {
        text.value = JSON.stringify(props.doc.state.api.config ?? {}, null, 2);
        lastApplied = text.value;
      }
    });

    const save = () => {
      let parsed: Record<string, any>;
      try {
        parsed = JSON.parse(text.value || '{}');
      } catch {
        ElMessage.error('JSON 格式错误');
        return;
      }
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        ElMessage.error('全局配置必须是 JSON 对象');
        return;
      }
      props.doc.commit('更新全局请求配置', (doc) => {
        doc.api.config = parsed;
      });
      lastApplied = text.value;
      ElMessage.success('全局配置已保存');
      visible.value = false;
    };

    return () => (
      <>
        <el-button
          onClick={ () => (visible.value = true) }
          icon={ Setting }
        />
        <el-dialog
          v-model={ visible.value }
          title="全局请求配置（dataSource.api.config）"
          width="640px"
          appendToBody
          destroyOnClose
        >
          { {
            default: () => (
              // 纯 CSS 上下两区布局（不用 yq-flex-box —— CDN 组件与编辑器 ESM Vue 不兼容）
              <div class={ ns.e('dialog-flex') }>
                <div class={ ns.e('dialog-flex-main') }>
                  <CodeEditor
                    value={ text.value }
                    onUpdate:value={ (v: string) => (text.value = v) }
                    language="json"
                    height={ 360 }
                  />
                  <div class={ ns.e('section-hint') }>
                    每个请求的最终 axios 配置 = api.config（基底）→ 服务项 config 覆盖 → url/method。常用：baseURL / timeout / headers。
                  </div>
                </div>
                <div class={ ns.e('dialog-flex-footer') }>
                  <el-button onClick={ () => (visible.value = false) }>取消</el-button>
                  <el-button type="primary" disabled={ text.value === lastApplied } onClick={ save }>
                    保存
                  </el-button>
                </div>
              </div>
            )
          } }
        </el-dialog>
      </>
    );
  }
});
