/**
 * Tip 组件（参考 lowcode-engine tip 设计）
 * hover 延迟显示，Teleport to body 避免 overflow 裁剪
 * 支持 top/right/bottom/left 四方向 + 淡入动画
 */
import {defineComponent, ref, Teleport, type PropType} from 'vue';
import './tip.less';

export const Tip = defineComponent({
  name: 'AssemTip',
  props: {
    content: {type: String, default: ''},
    placement: {
      type: String as PropType<'top' | 'right' | 'bottom' | 'left'>,
      default: 'right'
    },
    delay: {type: Number, default: 300}
  },
  setup(props, {slots}) {
    const visible = ref(false);
    const pos = ref({left: '0px', top: '0px', transform: ''});
    let timer: ReturnType<typeof setTimeout> | null = null;

    const onEnter = (e: MouseEvent) => {
      const el = e.currentTarget as HTMLElement;
      timer = setTimeout(() => {
        const r = el.getBoundingClientRect();
        const p = props.placement;
        const h = r.height / 2;
        const w = r.width / 2;
        const gap = 8;
        switch (p) {
          case 'right':
            pos.value = {
              left: `${r.right + gap}px`,
              top: `${r.top + h}px`,
              transform: 'translateY(-50%)'
            };
            break;
          case 'left':
            pos.value = {
              left: `${r.left - gap}px`,
              top: `${r.top + h}px`,
              transform: 'translate(-100%, -50%)'
            };
            break;
          case 'top':
            pos.value = {
              left: `${r.left + w}px`,
              top: `${r.top - gap}px`,
              transform: 'translate(-50%, -100%)'
            };
            break;
          default:
            pos.value = {
              left: `${r.left + w}px`,
              top: `${r.bottom + gap}px`,
              transform: 'translateX(-50%)'
            };
        }
        visible.value = true;
      }, props.delay);
    };

    const onLeave = () => {
      if (timer) clearTimeout(timer);
      visible.value = false;
    };

    return () => (
      <>
        <div
          style="display:inline-flex"
          onMouseenter={onEnter}
          onMouseleave={onLeave}
        >
          {slots.default?.()}
        </div>
        {visible.value ? (
          <Teleport to="body">
            <div
              class={['assem-tip', `assem-tip--${props.placement}`]}
              style={pos.value}
            >
              {props.content}
            </div>
          </Teleport>
        ) : null}
      </>
    );
  }
});
