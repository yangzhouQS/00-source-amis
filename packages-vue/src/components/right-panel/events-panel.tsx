import { defineComponent, computed } from 'vue';
import { storeToRefs } from 'pinia';
import {
  ElEmpty,
  ElButton,
  ElTag,
  ElInput,
  ElIcon
} from 'element-plus';
import { Plus, Delete } from '@element-plus/icons-vue';
import { useEditorStore } from '@/store/editor-store';
import type { AmisSchema } from '@/types/schema';

export default defineComponent({
  name: 'EventsPanel',
  setup() {
    const store = useEditorStore();
    const { selectedNode, selectedPath } = storeToRefs(store);

    const events = computed(() => {
      const n = selectedNode.value as any;
      const oe = n?.onEvent || {};
      return Object.keys(oe).map(name => ({ name, conf: oe[name] as any }));
    });

    const setOnEvent = (newOnEvent: Record<string, any> | undefined) => {
      if (selectedPath.value == null) return;
      store.updateNode(selectedPath.value, { onEvent: newOnEvent });
    };

    const addClickEvent = () => {
      const n = selectedNode.value as any;
      const oe: Record<string, any> = { ...(n?.onEvent || {}) };
      if (!oe['click']) {
        oe['click'] = {
          actions: [
            { actionType: 'toast', args: { msgType: 'info', msg: '点击事件' } }
          ]
        };
        setOnEvent(oe);
      }
    };

    const removeEvent = (name: string) => {
      const n = selectedNode.value as any;
      const oe: Record<string, any> = { ...(n?.onEvent || {}) };
      delete oe[name];
      setOnEvent(Object.keys(oe).length ? oe : undefined);
    };

    const getToastMsg = (conf: any) => conf?.actions?.[0]?.args?.msg ?? '';

    const setToastMsg = (name: string, msg: string) => {
      const n = selectedNode.value as any;
      const oe: Record<string, any> = { ...(n?.onEvent || {}) };
      const actions = oe[name]?.actions ? [...oe[name].actions] : [];
      if (actions[0]) {
        actions[0] = {
          ...actions[0],
          args: { ...(actions[0].args || {}), msg }
        };
      }
      oe[name] = { ...oe[name], actions };
      setOnEvent(oe);
    };

    return () => {
      const node = selectedNode.value as AmisSchema | undefined;
      if (!node) {
        return (
          <div class="amis-events__empty">
            <ElEmpty description="请先选择一个节点" imageSize={60} />
          </div>
        );
      }
      return (
        <div class="amis-events">
          <div class="amis-events__add">
            <ElButton size="small" type="primary" plain onClick={addClickEvent}>
              <ElIcon>
                <Plus />
              </ElIcon>
              <span style="margin-left:4px">添加 click 事件</span>
            </ElButton>
          </div>
          {events.value.length === 0 ? (
            <ElEmpty description="暂无事件，点击上方按钮添加" imageSize={60} />
          ) : (
            <div class="amis-events__list">
              {events.value.map(ev => (
                <div class="amis-events__item">
                  <div class="amis-events__item-head">
                    <ElTag type="warning">{ev.name}</ElTag>
                    <span
                      class="amis-events__del"
                      title="删除事件"
                      onClick={() => removeEvent(ev.name)}
                    >
                      <ElIcon>
                        <Delete />
                      </ElIcon>
                    </span>
                  </div>
                  <div class="amis-events__row">
                    <span class="amis-events__label">提示消息</span>
                    <ElInput
                      size="small"
                      modelValue={getToastMsg(ev.conf)}
                      placeholder="toast 消息内容"
                      onUpdate:modelValue={(v: string) => setToastMsg(ev.name, v)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    };
  }
});
