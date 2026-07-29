/**
 * 错误边界：捕获子组件渲染错误，崩溃时显示 Fallback + 刷新重挂
 * 借鉴 lowcode/amis 的 ErrorBoundary + resetKey 恢复机制
 */
import {defineComponent, h, ref, onErrorCaptured} from 'vue';

export const ErrorBoundary = defineComponent({
  name: 'ErrorBoundary',
  props: {
    /** 被包裹的组件 */
    content: {type: [Object, Function] as any, required: true},
    /** 透传给组件的 props */
    contentProps: {type: Object, default: () => ({})}
  },
  setup(props) {
    const error = ref<Error | null>(null);
    const resetKey = ref(0);

    onErrorCaptured((err: unknown) => {
      error.value = err as Error;
      console.error('[ErrorBoundary] 组件渲染出错:', err);
      return false; // 阻止错误向上传播
    });

    const reset = () => {
      error.value = null;
      resetKey.value++; // key 变化强制重新挂载，恢复干净状态
    };

    return () => {
      if (error.value) {
        return h('div', {style: 'padding:12px;color:#f56c6c;font-size:12px;'}, [
          h('div', {style: 'margin-bottom:8px'}, '组件渲染出错，已隔离'),
          h(
            'button',
            {onClick: reset, style: 'cursor:pointer;padding:2px 8px;'},
            '刷新'
          )
        ]);
      }
      return h(props.content as any, {
        ...props.contentProps,
        key: resetKey.value
      });
    };
  }
});
