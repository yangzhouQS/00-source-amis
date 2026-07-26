import { defineComponent, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useEditorStore } from '@/store/editor-store';
import { buildHarnessSrcDoc } from '@/core/amis-harness';
import { IframeBridge } from '@/core/iframe-bridge';
import { addComponent } from '@/core/editor-actions';

const COMP_MIME = 'application/x-amis-component';

export default defineComponent({
  name: 'CanvasPanel',
  setup() {
    const store = useEditorStore();
    const { schema, amisVersion } = storeToRefs(store);
    const containerRef = ref<HTMLDivElement>();
    const dragOver = ref(false);
    let bridge: IframeBridge | null = null;

    const sendRender = () => {
      if (!bridge) return;
      bridge.render(store.exportSchema());
    };

    onMounted(() => {
      if (!containerRef.value) return;
      bridge = new IframeBridge(buildHarnessSrcDoc(amisVersion.value));
      bridge.mount(containerRef.value);
      bridge.onReady = () => sendRender();
      sendRender();
    });

    onBeforeUnmount(() => {
      bridge?.destroy();
      bridge = null;
    });

    watch(schema, () => sendRender(), { deep: true });

    const handleDragOver = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      const types = Array.from(e.dataTransfer.types || []);
      if (!types.includes(COMP_MIME)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      dragOver.value = true;
    };

    const handleDragLeave = () => {
      dragOver.value = false;
    };

    const handleDrop = (e: DragEvent) => {
      dragOver.value = false;
      const type =
        e.dataTransfer?.getData(COMP_MIME) ||
        e.dataTransfer?.getData('text/plain') ||
        '';
      if (!type) return;
      e.preventDefault();
      addComponent(type);
    };

    return () => (
      <div class="amis-canvas">
        <div class="amis-canvas__bar">
          <span class="amis-canvas__title">预览</span>
          <span class="amis-canvas__hint">
            拖拽左侧组件到此处添加，或点击组件直接添加
          </span>
        </div>
        <div
          class={{ 'amis-canvas__viewport': true, 'is-dragover': dragOver.value }}
          ref={containerRef}
          onDragover={handleDragOver}
          onDragleave={handleDragLeave}
          onDrop={handleDrop}
        >
          {dragOver.value && (
            <div class="amis-canvas__dropmask">松开以添加到当前选中容器</div>
          )}
        </div>
      </div>
    );
  }
});
