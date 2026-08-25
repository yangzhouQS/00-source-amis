import type { Editor } from "../../../core/editor";
import type { DsDocHandle } from "../doc/use-data-source-doc";
import type { DsIssue, DsParamsConfig, DsServiceItem } from "../doc/types";
import { ElMessage } from "element-plus";
/**
 * 服务编辑器（Drawer 800px）
 * 基本信息（url/method 内联）→ 参数配置（paramsConfig + ParamsModelEditor）→ 拦截器
 * 草稿式保存：本地 draft → 整体校验 → doc.commit
 */
import { computed, defineComponent, PropType, reactive, ref } from "vue";
import { useAssemNamespace } from "../../../hooks/use-assem-namespace";
import { hasBlockingIssues, validateService } from "../doc/validate";
import {
  DATA_MODEL_TYPE_OPTIONS,
  METHOD_OPTIONS,
  PARAMS_TYPE_OPTIONS,
} from "../constants";
import { DEFAULT_GROUP_NAME, cloneDoc } from "../doc/normalize";
import { DsValueInput } from "../shared/type-value-input";
import { ParamsModelEditor } from "./params-model-editor";
import { InterceptorEditor } from "./interceptor-editor";
import "../data-source-pane-style.less";

const ns = useAssemNamespace("ds-editor");

/** 新服务草稿骨架 */
function emptyDraft(): { id: string; item: DsServiceItem } {
  return {
    id: "",
    item: {
      url: "",
      method: "post",
      groupName: DEFAULT_GROUP_NAME,
      sort: 1,
      description: "",
      paramsConfig: {
        paramsType: "kvParams",
        dataModelType: "single",
        dataModelName: "",
        advancedFilterModelName: "",
        paramsModel: {},
      },
    },
  };
}

/** 选定数据模型后，paramsModel 快速带入（每张对象表生成空字段骨架，供用户勾选） */
function ensureParamsConfig(item: DsServiceItem): DsParamsConfig {
  if (!item.paramsConfig) {
    item.paramsConfig = {
      paramsType: "kvParams",
      dataModelType: "single",
      dataModelName: "",
      advancedFilterModelName: "",
      paramsModel: {},
    };
  }
  return item.paramsConfig;
}

export const ServiceEditor = defineComponent({
  name: "DsServiceEditor",
  props: {
    editor: { type: Object as PropType<Editor>, required: true },
    doc: { type: Object as PropType<DsDocHandle>, required: true },
    mode: { type: String as PropType<"add" | "edit" | "copy">, required: true },
    name: { type: String, default: "" },
    onClose: { type: Function as PropType<() => void>, required: true },
  },
  setup(props) {
    const visible = ref(true);
    const original = props.mode !== "add" ? props.doc.state.requestConfig[props.name] : undefined;

    const createDraft = (): { id: string; item: DsServiceItem } => {
      if (props.mode === "add" || !original) {
        return emptyDraft();
      }
      const cloned = cloneDoc(original);
      if (props.mode === "copy") {
        return { id: "", item: cloned };
      }
      return { id: props.name, item: cloned };
    };
    /** 草稿（reactive：表单编辑直接写穿草稿） */
    const draft = reactive(createDraft());

    const issues = ref<DsIssue[]>([]);
    const showItemConfig = ref(false);

    const modelNames = computed(() => Object.keys(props.doc.state.dataModelConfig));
    const groupNames = computed(() => {
      const set = new Set<string>([DEFAULT_GROUP_NAME]);
      for (const item of Object.values(props.doc.state.requestConfig)) {
        if (item.groupName) {
          set.add(item.groupName);
        }
      }
      return Array.from(set);
    });

    /** 选模型 → 提示可带入（不自动覆盖既有 paramsModel） */
    const onModelChange = (name: string) => {
      ensureParamsConfig(draft.item).dataModelName = name;
      const model = props.doc.state.dataModelConfig[name];
      if (model) {
        const tables = Object.keys(model).filter(k => k !== "description");
        ElMessage.info(`已绑定模型 ${name}，可在参数表格中「从模型带入字段」（${tables.length} 张表）`);
      }
    };

    const save = () => {
      const list = validateService(draft.id, draft.item, props.doc.state, {
        excludeId: props.mode === "edit" ? props.name : undefined,
      });
      issues.value = list;
      if (hasBlockingIssues(list)) {
        return;
      }
      props.doc.commit(
        `${props.mode === "add" ? "新增" : props.mode === "copy" ? "复制" : "编辑"}服务 ${draft.id}`,
        (doc) => {
          if (props.mode === "edit" && props.name !== draft.id) {
            delete doc.requestConfig[props.name];
          }
          // 空参数配置瘦身：无字段且无模型绑定时移除，保持 JSON 干净
          const pc = draft.item.paramsConfig;
          if (pc && !pc.dataModelName && Object.keys(pc.paramsModel).length === 0) {
            draft.item.paramsConfig = undefined;
          }
          doc.requestConfig[draft.id] = cloneDoc(draft.item);
        },
      );
      ElMessage.success("服务已保存");
      visible.value = false;
    };

    const pc = computed(() => ensureParamsConfig(draft.item));

    return () => (
      <el-drawer
        v-model={visible.value}
        title={props.mode === "add" ? "新增服务" : props.mode === "copy" ? `复制服务：${props.name}` : `编辑服务：${props.name}`}
        size="800px"
        appendToBody
        destroyOnClose
        onClose={props.onClose}
      >
        {{
          default: () => (
            <div class={ns.b()}>
              <el-form labelWidth="110px" size="small" class={ns.e("form")}>
                <div class={ns.e("row-2")}>
                  <el-form-item label="请求编码" required>
                    <el-input
                      modelValue={draft.id}
                      onUpdate:modelValue={(v: string) => (draft.id = v)}
                      placeholder="如 queryPayments（标识符，唯一）"
                    />
                  </el-form-item>
                  <el-form-item label="描述" required>
                    <el-input
                      modelValue={draft.item.description}
                      onUpdate:modelValue={(v: string) => (draft.item.description = v)}
                      maxlength={30}
                      showWordLimit
                      placeholder="接口用途描述"
                    />
                  </el-form-item>
                </div>
                <div class={ns.e("row-2")}>
                  <el-form-item label="url" required class={ns.e("url-item")}>
                    <el-input
                      modelValue={draft.item.url}
                      onUpdate:modelValue={(v: string) => (draft.item.url = v)}
                      placeholder="/demo/xxx/getMany，路由占位 :id"
                    />
                  </el-form-item>
                  <el-form-item label="method" required>
                    <el-select modelValue={draft.item.method} onUpdate:modelValue={(v: any) => (draft.item.method = v)}>
                      {METHOD_OPTIONS.map(m => (
                        <el-option key={m} value={m} label={m.toUpperCase()} />
                      ))}
                    </el-select>
                  </el-form-item>
                </div>
                <div class={ns.e("row-2")}>
                  <el-form-item label="分组">
                    <el-select
                      modelValue={draft.item.groupName}
                      onUpdate:modelValue={(v: string) => (draft.item.groupName = v)}
                      filterable
                      allowCreate
                      defaultFirstOption
                    >
                      {groupNames.value.map(g => (
                        <el-option key={g} value={g} label={g} />
                      ))}
                    </el-select>
                  </el-form-item>
                  <el-form-item label="排序">
                    <el-input-number
                      modelValue={draft.item.sort ?? 1}
                      onUpdate:modelValue={(v: number | undefined) => (draft.item.sort = v ?? 1)}
                      min={1}
                      controlsPosition="right"
                    />
                  </el-form-item>
                </div>
                <el-form-item label="项级 config">
                  <div class={ns.e("item-config")}>
                    <el-button size="small" onClick={() => (showItemConfig.value = !showItemConfig.value)}>
                      {showItemConfig.value ? "收起" : "展开"}
                      （覆盖全局 api.config 的 axios 配置）
                    </el-button>
                    {showItemConfig.value
                      ? (
                          <DsValueInput
                            modelValue={draft.item.config ?? {}}
                            valueType="object"
                            onChange={(v: any) => (draft.item.config = v ?? {})}
                          />
                        )
                      : null}
                  </div>
                </el-form-item>
              </el-form>

              <div class={ns.e("section")}>
                <div class={ns.e("section-title")}>参数配置 paramsConfig</div>
                <el-form labelWidth="110px" size="small">
                  <div class={ns.e("row-2")}>
                    <el-form-item label="参数类型" required>
                      <el-select modelValue={pc.value.paramsType} onUpdate:modelValue={(v: any) => (pc.value.paramsType = v)}>
                        {PARAMS_TYPE_OPTIONS.map(o => (
                          <el-option key={o.value} value={o.value} label={o.label} />
                        ))}
                      </el-select>
                    </el-form-item>
                    <el-form-item label="参数结构">
                      <el-select modelValue={pc.value.dataModelType} onUpdate:modelValue={(v: any) => (pc.value.dataModelType = v)}>
                        {DATA_MODEL_TYPE_OPTIONS.map(o => (
                          <el-option key={o.value} value={o.value} label={o.label} />
                        ))}
                      </el-select>
                    </el-form-item>
                  </div>
                  <div class={ns.e("row-2")}>
                    <el-form-item label="数据模型">
                      <el-select
                        modelValue={pc.value.dataModelName}
                        onUpdate:modelValue={onModelChange}
                        filterable
                        clearable
                        placeholder="参数取值模型"
                      >
                        {modelNames.value.map(m => (
                          <el-option key={m} value={m} label={m} />
                        ))}
                      </el-select>
                    </el-form-item>
                    {pc.value.paramsType === "paginationParams"
                      ? (
                          <el-form-item label="高级筛选模型">
                            <el-select
                              modelValue={pc.value.advancedFilterModelName}
                              onUpdate:modelValue={(v: any) => (pc.value.advancedFilterModelName = v)}
                              filterable
                              clearable
                            >
                              {modelNames.value.map(m => (
                                <el-option key={m} value={m} label={m} />
                              ))}
                            </el-select>
                          </el-form-item>
                        )
                      : null}
                  </div>
                </el-form>
                <ParamsModelEditor doc={props.doc} paramsConfig={pc.value} />
              </div>

              <div class={ns.e("section")}>
                <div class={ns.e("section-title")}>拦截器</div>
                <div class={ns.e("interceptors")}>
                  <div class={ns.e("interceptor")}>
                    <span class={ns.e("interceptor-name")}>前置 beforeReq</span>
                    <el-tag size="small" type={draft.item.beforeReq?.enabled ? "success" : "info"}>
                      {draft.item.beforeReq?.enabled ? "已启用" : "未启用"}
                    </el-tag>
                    <InterceptorEditor
                      type="beforeReq"
                      modelValue={draft.item.beforeReq}
                      onSave={(cfg) => (draft.item.beforeReq = cfg)}
                    />
                  </div>
                  <div class={ns.e("interceptor")}>
                    <span class={ns.e("interceptor-name")}>后置 afterReq</span>
                    <el-tag size="small" type={draft.item.afterReq?.enabled ? "success" : "info"}>
                      {draft.item.afterReq?.enabled ? "已启用" : "未启用"}
                    </el-tag>
                    <InterceptorEditor
                      type="afterReq"
                      modelValue={draft.item.afterReq}
                      onSave={(cfg) => (draft.item.afterReq = cfg)}
                    />
                  </div>
                </div>
              </div>

              {issues.value.length
                ? (
                    <div class={ns.e("issues")}>
                      {issues.value.map((i, idx) => (
                        <div class={ns.e(`issue-${i.level}`)} key={idx}>
                          {i.level === "error" ? "✕" : "⚠"}
                          {" "}
                          {i.message}
                        </div>
                      ))}
                    </div>
                  )
                : null}

              <div class={ns.e("footer")}>
                <el-button size="small" onClick={() => (visible.value = false)}>取消</el-button>
                <el-button size="small" type="primary" onClick={save}>保存</el-button>
              </div>
            </div>
          ),
        }}
      </el-drawer>
    );
  },
});
