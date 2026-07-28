/**
 * FunctionSetter - code editor (textarea + fullscreen + syntax validation)
 * Props contract kept compatible so Monaco can be swapped in later
 */
import {defineComponent, ref, computed} from 'vue';
import {ElButton, ElMessage, ElDialog} from 'element-plus';
import {FullScreen, Check} from '@element-plus/icons-vue';
import './function-setter.less';

export const FunctionSetter = defineComponent({
  name: 'FunctionSetter',
  props: {
    value: {type: String, default: ''},
    onChange: {type: Function, required: true},
    disabled: {type: Boolean, default: false},
    language: {type: String, default: 'javascript'},
    height: {type: Number, default: 120},
    supportFullScreen: {type: Boolean, default: true},
    wrapFunction: {type: Boolean, default: false}
  },
  setup(props) {
    const draft = ref(props.value ?? '');
    const fullscreen = ref(false);
    const displayValue = computed(() => props.value ?? '');

    const commit = () => {
      const code = draft.value;
      try {
        if (code.trim()) {
          // eslint-disable-next-line no-new-func
          new Function(code);
        }
        props.onChange(code);
        ElMessage.success('Code saved');
        fullscreen.value = false;
      } catch {
        ElMessage.error('Syntax error, please check');
      }
    };

    const onInput = (v: string) => {
      draft.value = v;
    };

    return () => (
      <div class="assem-function-setter">
        <div class="assem-code-editor" style={{height: `${props.height}px`}}>
          <textarea
            class="assem-code-textarea"
            disabled={props.disabled}
            value={displayValue.value}
            onInput={(e: Event) =>
              onInput((e.target as HTMLTextAreaElement).value)
            }
            placeholder={`// ${props.language}`}
          />
        </div>
        <div class="assem-function-actions">
          <ElButton
            size="small"
            type="primary"
            icon={Check}
            disabled={props.disabled}
            onClick={commit}
          >
            Save
          </ElButton>
          {props.supportFullScreen && (
            <ElButton
              size="small"
              icon={FullScreen}
              disabled={props.disabled}
              onClick={() => {
                draft.value = props.value ?? '';
                fullscreen.value = true;
              }}
            >
              Fullscreen
            </ElButton>
          )}
        </div>
        {props.supportFullScreen && (
          <ElDialog
            v-model={fullscreen.value}
            title="Code Editor"
            width="70%"
            destroyOnClose
            appendToBody
          >
            <div class="assem-code-editor assem-code-editor-fullscreen">
              <textarea
                class="assem-code-textarea"
                value={draft.value}
                onInput={(e: Event) =>
                  onInput((e.target as HTMLTextAreaElement).value)
                }
              />
            </div>
            {{
              footer: () => (
                <span>
                  <ElButton onClick={() => (fullscreen.value = false)}>
                    Cancel
                  </ElButton>
                  <ElButton type="primary" onClick={commit}>
                    Save
                  </ElButton>
                </span>
              )
            }}
          </ElDialog>
        )}
      </div>
    );
  }
});
