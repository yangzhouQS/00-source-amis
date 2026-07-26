import { defineComponent } from 'vue';
import Toolbar from '@/components/toolbar/toolbar';
import LeftPanel from '@/components/left-panel/left-panel';
import CanvasPanel from '@/components/canvas/canvas-panel';
import RightPanel from '@/components/right-panel/right-panel';
import SourceCodePanel from '@/components/source-code/source-code-panel';

export default defineComponent({
  name: 'App',
  setup() {
    return () => (
      <div class="amis-editor">
        <Toolbar />
        <div class="amis-editor__body">
          <LeftPanel />
          <CanvasPanel />
          <RightPanel />
        </div>
        <SourceCodePanel />
      </div>
    );
  }
});
