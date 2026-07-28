/**
 * JSFunctionSetter - JS function editor
 * Distinct from FunctionSetter (generic code string): this edits a *function* with
 * declared params, compiles + validates it, and supports a mock test-run panel.
 *
 * Output value structure (structured, serializable):
 *   { type: 'JSFunction', params: string[], body: string }
 * Also accepts a plain string (treated as raw function source) for backward compat.
 */
import {defineComponent, ref, computed, watch} from 'vue';
import {
  ElInput,
  ElButton,
  ElMessage,
  ElDialog,
  ElFormItem,
  ElTabs,
  ElTabPane,
  ElAlert
} from 'element-plus';
import {
  FullScreen,
  Check,
  VideoPlay,
  Plus,
  Close
} from '@element-plus/icons-vue';
import './js-function-setter.less';

/** 结构化 JS 函数值 */
export interface JSFunctionValue {
  type: 'JSFunction';
  /** 形参名列表，如 ['data','event'] */
  params: string[];
  /** 函数体（不含外层 function(){ }） */
  body: string;
}

/** 判断是否为结构化 JSFunction 值 */
function isJSFunction(v: any): v is JSFunctionValue {
  return (
    v &&
    typeof v === 'object' &&
    v.type === 'JSFunction' &&
    Array.isArray(v.params)
  );
}

/** 把任意值归一化为 {params, body} */
function normalizeValue(v: any): {params: string[]; body: string} {
  if (isJSFunction(v)) {
    return {params: [...v.params], body: v.body ?? ''};
  }
  if (typeof v === 'string' && v.trim()) {
    // 尝试从 "function(a,b){...}" 解析
    const m = v.match(/^function\s*\(([^)]*)\)\s*\{([\s\S]*)\}\s*$/);
    if (m) {
      const params = m[1]
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      return {params, body: m[2]};
    }
    // 兜底：作为无参函数体
    return {params: [], body: v};
  }
  return {params: [], body: ''};
}

/** 编译函数（校验语法），返回编译后的函数或抛错 */
function compileFunction(params: string[], body: string): Function {
  // eslint-disable-next-line no-new-func
  return new Function(...params, body);
}

/** 执行函数（带 mock 参数），返回 { ok, result, error } */
function runFunction(
  fn: Function,
  args: any[]
): {ok: boolean; result?: any; error?: string} {
  try {
    const ret = fn(...args);
    if (ret && typeof ret.then === 'function') {
      return {ok: true, result: '[Promise]'};
    }
    return {ok: true, result: ret};
  } catch (e: any) {
    return {ok: false, error: e?.message ?? String(e)};
  }
}

export const JSFunctionSetter = defineComponent({
  name: 'JSFunctionSetter',
  props: {
    value: {type: null as any, default: undefined},
    onChange: {type: Function, required: true},
    /** 默认形参列表（首次使用时填充） */
    defaultParams: {
      type: Array as () => string[],
      default: () => ['data', 'event']
    },
    /** 函数体默认值 */
    defaultBody: {type: String, default: '// return ...\nreturn data;'},
    /** 是否显示测试运行面板 */
    showTestRun: {type: Boolean, default: true},
    /** 是否支持全屏 */
    supportFullScreen: {type: Boolean, default: true},
    /** 编辑器高度 */
    height: {type: Number, default: 140},
    disabled: {type: Boolean, default: false}
  },
  setup(props) {
    const normalized = normalizeValue(props.value);
    const params = ref<string[]>(
      normalized.params.length ? normalized.params : [...props.defaultParams]
    );
    const body = ref<string>(normalized.body || props.defaultBody);
    const fullscreen = ref(false);

    /** mock 参数输入（JSON 字符串） */
    const mockArgsText = ref<string>(
      props.defaultParams.map(() => '{}').join('\n')
    );
    const testResult = ref<{ok: boolean; result?: any; error?: string} | null>(
      null
    );

    // 外部 value 变化时同步（避免循环：仅当结构不同步时更新）
    watch(
      () => props.value,
      val => {
        const n = normalizeValue(val);
        const sameParams = n.params.join(',') === params.value.join(',');
        const sameBody = n.body === body.value;
        if (!sameParams)
          params.value = n.params.length ? n.params : [...props.defaultParams];
        if (!sameBody) body.value = n.body || props.defaultBody;
      }
    );

    /** 派发变更 */
    const emit = () => {
      const next: JSFunctionValue = {
        type: 'JSFunction',
        params: params.value.filter(p => p.trim() !== ''),
        body: body.value
      };
      props.onChange(next);
    };

    /** 校验 + 保存 */
    const commit = () => {
      try {
        compileFunction(
          params.value.filter(p => p.trim() !== ''),
          body.value
        );
        emit();
        ElMessage.success('Function saved');
        fullscreen.value = false;
      } catch (e: any) {
        ElMessage.error(`Syntax error: ${e?.message ?? e}`);
      }
    };

    /** 参数管理 */
    const addParam = () => {
      params.value.push(`arg${params.value.length + 1}`);
    };
    const removeParam = (index: number) => {
      params.value.splice(index, 1);
    };

    /** 测试运行 */
    const runTest = () => {
      const pNames = params.value.filter(p => p.trim() !== '');
      let fn: Function;
      try {
        fn = compileFunction(pNames, body.value);
      } catch (e: any) {
        testResult.value = {
          ok: false,
          error: `Compile error: ${e?.message ?? e}`
        };
        return;
      }
      // 解析 mock 参数（每行一个 JSON）
      const lines = mockArgsText.value.split('\n').filter(l => l.trim() !== '');
      const args: any[] = [];
      for (let i = 0; i < pNames.length; i++) {
        const line = lines[i] ?? 'undefined';
        try {
          args.push(JSON.parse(line));
        } catch {
          args.push(undefined);
        }
      }
      testResult.value = runFunction(fn, args);
    };

    /** 函数签名预览 */
    const signature = computed(
      () => `function(${params.value.filter(p => p.trim()).join(', ')}) { ... }`
    );

    const renderEditor = (fullHeight?: number) => (
      <div
        class="jsfn-editor"
        style={fullHeight ? {height: `${fullHeight}px`} : undefined}
      >
        <textarea
          class="jsfn-code-textarea"
          disabled={props.disabled}
          value={body.value}
          onInput={(e: Event) =>
            (body.value = (e.target as HTMLTextAreaElement).value)
          }
          spellcheck={false}
        />
      </div>
    );

    const renderParams = () => (
      <div class="jsfn-params">
        <div class="jsfn-params-label">Params:</div>
        <div class="jsfn-params-list">
          {params.value.map((p, i) => (
            <div class="jsfn-param-item" key={i}>
              <ElInput
                modelValue={p}
                size="small"
                disabled={props.disabled}
                onUpdate:modelValue={(v: string) => (params.value[i] = v)}
                style="width:120px"
              />
              {!props.disabled && (
                <ElButton
                  size="small"
                  link
                  icon={Close}
                  onClick={() => removeParam(i)}
                />
              )}
            </div>
          ))}
          {!props.disabled && (
            <ElButton size="small" link icon={Plus} onClick={addParam}>
              param
            </ElButton>
          )}
        </div>
      </div>
    );

    const renderTestRun = () => (
      <div class="jsfn-test">
        <ElFormItem label="Mock args">
          <ElInput
            type="textarea"
            rows={Math.max(2, params.value.length)}
            modelValue={mockArgsText.value}
            disabled={props.disabled}
            placeholder='one JSON per line, e.g. {"name":"test"}'
            onUpdate:modelValue={(v: string) => (mockArgsText.value = v)}
            class="jsfn-mock-input"
          />
        </ElFormItem>
        <div class="jsfn-test-actions">
          <ElButton
            size="small"
            type="primary"
            icon={VideoPlay}
            disabled={props.disabled}
            onClick={runTest}
          >
            Run
          </ElButton>
        </div>
        {testResult.value && (
          <ElAlert
            type={testResult.value.ok ? 'success' : 'error'}
            title={testResult.value.ok ? 'Result' : 'Error'}
            description={
              testResult.value.ok
                ? JSON.stringify(testResult.value.result, null, 2)
                : testResult.value.error
            }
            showIcon
            closable={false}
            class="jsfn-test-result"
          />
        )}
      </div>
    );

    return () => (
      <div class="jsfn-setter">
        <div class="jsfn-signature">{signature.value}</div>
        {renderParams()}
        {renderEditor(props.height)}
        <div class="jsfn-actions">
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
              onClick={() => (fullscreen.value = true)}
            >
              Fullscreen
            </ElButton>
          )}
        </div>
        {props.showTestRun && renderTestRun()}
        {props.supportFullScreen && (
          <ElDialog
            v-model={fullscreen.value}
            title="Function Editor"
            width="70%"
            destroyOnClose
            appendToBody
          >
            <div class="jsfn-fullscreen-body">
              {renderParams()}
              {renderEditor(360)}
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
