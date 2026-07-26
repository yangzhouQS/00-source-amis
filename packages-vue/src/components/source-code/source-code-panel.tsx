import { defineComponent, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { ElIcon } from 'element-plus';
import { Close } from '@element-plus/icons-vue';
import { basicSetup, EditorView } from 'codemirror';
import { json } from '@codemirror/lang-json';
import { useEditorStore } from '@/store/editor-store';

export default defineComponent({
  name: 'SourceCodePanel',
  setup() {
    const store = useEditorStore();
    const { sourceVisible } = storeToRefs(store);
    const editorHost = ref<HTMLDivElement>();
    const errorMsg = ref('');
    let view: EditorView | null = null;
    let programmatic = false;

    const toJson = () => JSON.stringify(store.exportSchema(), null, 2);

    onMounted(() => {
      if (!editorHost.value) return;
      view = new EditorView({
        doc: toJson(),
        extensions: [
          basicSetup,
          json(),
          EditorView.lineWrapping,
          EditorView.updateListener.of(u => {
            if (!u.docChanged || programmatic) return;
            const text = u.state.doc.toString();
            try {
              const parsed = JSON.parse(text);
              programmatic = true;
              store.setSchema(parsed, true);
              errorMsg.value = '';
            } catch (e: any) {
              errorMsg.value = 'JSON 语法错误：' + (e?.message ?? e);
            }
          })
        ],
        parent: editorHost.value
      });
    });

    onBeforeUnmount(() => {
      view?.destroy();
      view = null;
    });

    // 外部 schema 变更（属性/大纲/画布）回写到编辑器
    watch(
      () => store.schema,
      () => {
        if (!view) return;
        if (programmatic) {
          programmatic = false;
          return;
        }
        const newText = toJson();
        if (newText === view.state.doc.toString()) return;
        programmatic = true;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: newText }
        });
        programmatic = false;
      },
      { deep: true }
    );

    return () => (
      <div class="amis-source" v-show={sourceVisible.value}>
        <div class="amis-source__bar">
          <span class="amis-source__title">源码 Schema（可编辑，实时双向同步）</span>
          <span class={{ 'amis-source__hint': true, 'is-error': !!errorMsg.value }}>
            {errorMsg.value || 'JSON · CodeMirror'}
          </span>
          <span
            class="amis-source__close"
            title="收起"
            onClick={() => (store.sourceVisible = false)}
          >
            <ElIcon><Close /></ElIcon>
          </span>
        </div>
        <div class="amis-source__editor" ref={editorHost} />
      </div>
    );
  }
});
