import type { DsDocHandle } from "../doc/use-data-source-doc";
import type { DsImportedModel } from "../doc/types";
import { ElMessage } from "element-plus";
/**
 * 后端模型导入弹窗（options.fetchModels 注入时可用）
 * 选择模型表 → 合入当前编辑模型
 */
import { computed, defineComponent, PropType, ref } from "vue";
import { useAssemNamespace } from "../../../hooks/use-assem-namespace";
import "../data-source-pane-style.less";

const ns = useAssemNamespace("ds-import");

export const ImportModelsDialog = defineComponent({
  name: "DsImportModelsDialog",
  props: {
    doc: { type: Object as PropType<DsDocHandle>, required: true },
    /** 导入目标模型草稿（合入其 dataModelConfig 条目） */
    onImport: {
      type: Function as PropType<(tables: Record<string, any>) => void>,
      required: true,
    },
  },
  setup(props) {
    const visible = ref(false);
    const loading = ref(false);
    const models = ref<DsImportedModel[]>([]);
    const selectedModel = ref("");
    const checkedTables = ref<string[]>([]);

    const currentModel = computed(() => models.value.find(m => m.modelCode === selectedModel.value));
    const checkedCount = computed(() => {
      const m = currentModel.value;
      if (!m) {
        return 0;
      }
      return m.tables.filter(t => checkedTables.value.includes(t.name)).length;
    });

    const open = async () => {
      visible.value = true;
      if (models.value.length) {
        return;
      }
      const fetchModels = props.doc.hostOptions.value.fetchModels;
      if (!fetchModels) {
        ElMessage.warning("宿主未提供模型导入能力");
        return;
      }
      loading.value = true;
      try {
        models.value = await fetchModels(props.doc.hostOptions.value.moduleId);
      }
      catch (e) {
        ElMessage.error("模型获取失败");
        console.error("[data-source-pane] fetchModels:", e);
      }
      finally {
        loading.value = false;
      }
    };

    const doImport = () => {
      const m = currentModel.value;
      if (!m || checkedCount.value === 0) {
        ElMessage.info("请选择要导入的表");
        return;
      }
      const tables: Record<string, any> = {};
      for (const t of m.tables) {
        if (!checkedTables.value.includes(t.name)) {
          continue;
        }
        const fields: Record<string, any> = {};
        for (const f of t.fields) {
          fields[f.code] = {
            valueType: f.valueType,
            ...(f.defaultValue !== undefined ? { defaultValue: f.defaultValue } : {}),
            ...(f.comment ? { comment: f.comment } : {}),
          };
        }
        tables[t.name] = fields;
      }
      props.onImport(tables);
      visible.value = false;
    };

    return () => (
      <>
        <el-button size="small" onClick={open}>从后端导入</el-button>
        <el-dialog
          v-model={visible.value}
          title="从后端导入模型表"
          width="560px"
          appendToBody
          destroyOnClose
        >
          {{
            default: () => (
              <div class={ns.b()} v-loading={loading.value}>
                <el-select
                  modelValue={selectedModel.value}
                  onUpdate:modelValue={(v: string) => {
                    selectedModel.value = v;
                    checkedTables.value = [];
                  }}
                  placeholder="选择后端模型"
                  filterable
                  style="width:100%"
                >
                  {models.value.map(m => (
                    <el-option
                      key={m.modelCode}
                      value={m.modelCode}
                      label={`${m.modelCode}（${m.modelName ?? ""}）`}
                    />
                  ))}
                </el-select>
                {currentModel.value
                  ? (
                      <div class={ns.e("tables")}>
                        <el-checkbox-group modelValue={checkedTables.value} onUpdate:modelValue={(v: any[]) => (checkedTables.value = v as string[])}>
                          {currentModel.value.tables.map(t => (
                            <el-checkbox key={t.name} value={t.name}>
                              {t.name}
                              <span class={ns.e("field-count")}>{t.fields.length} 字段</span>
                            </el-checkbox>
                          ))}
                        </el-checkbox-group>
                      </div>
                    )
                  : null}
              </div>
            ),
            footer: () => (
              <>
                <el-button size="small" onClick={() => (visible.value = false)}>取消</el-button>
                <el-button size="small" type="primary" disabled={checkedCount.value === 0} onClick={doImport}>
                  导入 {checkedCount.value || ""} 张表
                </el-button>
              </>
            ),
          }}
        </el-dialog>
      </>
    );
  },
});
