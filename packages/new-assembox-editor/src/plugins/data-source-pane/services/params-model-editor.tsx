import type { DsParamsConfig } from "../doc/types";
import type { DsDocHandle } from "../doc/use-data-source-doc";
import { Delete, Plus } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
/**
 * paramsModel 编辑器（key/items 左右双栏，移植旧版交互）
 * 左：表 key 列表（对象表/数组表）；右：对象表字段内联编辑
 * 行数据引用底层字段对象（{ fieldName, def }），编辑直接写穿草稿
 */
import { computed, defineComponent, PropType, ref, watch } from "vue";
import { useAssemNamespace } from "../../../hooks/use-assem-namespace";
import { OP_OPTIONS, RESOLVE_TYPE_OPTIONS, VALUE_TYPE_OPTIONS } from "../constants";
import { DsValueInput } from "../shared/type-value-input";
import "../data-source-pane-style.less";

const ns = useAssemNamespace("ds-params");

export const ParamsModelEditor = defineComponent({
  name: "DsParamsModelEditor",
  props: {
    doc: { type: Object as PropType<DsDocHandle>, required: true },
    paramsConfig: { type: Object as PropType<DsParamsConfig>, required: true },
  },
  setup(props) {
    const activeKey = ref("");

    const keys = computed(() => Object.keys(props.paramsConfig.paramsModel));
    const activeTable = computed<Record<string, any> | undefined>(() => {
      const t = props.paramsConfig.paramsModel[activeKey.value];
      return Array.isArray(t) ? undefined : t;
    });
    const activeIsArray = computed(() => Array.isArray(props.paramsConfig.paramsModel[activeKey.value]));

    const pickDefault = () => {
      if (!activeKey.value || !(activeKey.value in props.paramsConfig.paramsModel)) {
        activeKey.value = keys.value[0] ?? "";
      }
    };
    watch(keys, pickDefault, { immediate: true });

    /** op 列仅 paginationParams 且 body 参数生效（对齐渲染层 R2） */
    const opEnabled = computed(() => props.paramsConfig.paramsType === "paginationParams");

    const addKey = (isArray: boolean) => {
      ElMessageBox.prompt(`请输入${isArray ? "数组表" : "表"} key（如 singleTable）`, "添加 key", {
        inputPattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/,
        inputErrorMessage: "须为合法标识符",
      })
        .then(({ value }) => {
          if (value in props.paramsConfig.paramsModel) {
            ElMessage.warning(`key "${value}" 已存在`);
            return;
          }
          props.paramsConfig.paramsModel[value] = isArray ? [] : {};
          activeKey.value = value;
        })
        .catch(() => {});
    };

    const removeKey = (key: string) => {
      ElMessageBox.confirm(`确认删除 key "${key}" 及其字段配置？`, "删除提示", { type: "warning" })
        .then(() => {
          delete props.paramsConfig.paramsModel[key];
          pickDefault();
        })
        .catch(() => {});
    };

    const addField = () => {
      if (!activeTable.value) {
        return;
      }
      // 优先从绑定模型带入字段（saveModelFields 提供一键带入，这里给空行）
      activeTable.value[""] = { valueType: "string" };
    };

    /** 一键带入绑定模型字段（对象表；覆盖合并，保留已配置项） */
    const bringModelFields = () => {
      const modelName = props.paramsConfig.dataModelName;
      const table = activeTable.value;
      if (!modelName || !table) {
        ElMessage.info("请先选择数据模型");
        return;
      }
      const model = props.doc.state.dataModelConfig[modelName];
      const modelTable = model?.[activeKey.value];
      if (!modelTable || Array.isArray(modelTable)) {
        ElMessage.warning(`模型 "${modelName}" 中不存在对象表 "${activeKey.value}"`);
        return;
      }
      let count = 0;
      for (const [fieldName, field] of Object.entries(modelTable as Record<string, any>)) {
        if (!(fieldName in table)) {
          table[fieldName] = { valueType: field.valueType };
          count += 1;
        }
      }
      ElMessage.success(count ? `已带入 ${count} 个字段` : "字段已全部存在，无需带入");
    };

    const removeField = (fieldName: string) => {
      if (!activeTable.value) {
        return;
      }
      delete activeTable.value[fieldName];
    };

    /** 字段重命名（键迁移，保持顺序） */
    const renameField = (row: any, newName: string) => {
      const table = activeTable.value!;
      const oldName = row.fieldName;
      if (!newName || newName === oldName) {
        return;
      }
      if (newName in table) {
        ElMessage.warning(`字段 "${newName}" 已存在`);
        return;
      }
      const rebuilt: Record<string, any> = {};
      for (const [k, v] of Object.entries(table)) {
        rebuilt[k === oldName ? newName : k] = v;
      }
      Object.keys(table).forEach(k => delete table[k]);
      Object.assign(table, rebuilt);
      row.fieldName = newName;
    };

    /** resolveType 逗号多值 ↔ checkbox 数组 */
    const resolveTypesOf = (def: any): string[] =>
      (def.resolveType ?? "").split(",").map((s: string) => s.trim()).filter(Boolean);

    const toggleResolveType = (def: any, values: string[]) => {
      def.resolveType = values.join(",");
    };

    const fieldRows = computed(() =>
      activeTable.value
        ? Object.entries(activeTable.value).map(([fieldName, def]) => ({ fieldName, def }))
        : [],
    );

    return () => (
      <div class={ns.b()}>
        <div class={ns.e("pane")}>
          <div class={ns.e("pane-actions")}>
            <el-button size="small" text type="primary" icon={Plus} onClick={() => addKey(false)}>
              添加 key
            </el-button>
            <el-button size="small" text type="primary" icon={Plus} onClick={() => addKey(true)}>
              数组表
            </el-button>
          </div>
          <el-scrollbar class={ns.e("list")}>
            {keys.value.map(key => (
              <div
                key={key}
                class={[
                  ns.e("item"),
                  { [ns.is("active").trim()]: activeKey.value === key },
                ]}
                onClick={() => (activeKey.value = key)}
              >
                <span class={ns.e("item-name")} title={key}>{key}</span>
                <span class={ns.em("item", Array.isArray(props.paramsConfig.paramsModel[key]) ? "array" : "object")}>
                  {Array.isArray(props.paramsConfig.paramsModel[key]) ? "[]" : "{}"}
                </span>
                <el-button
                  size="small"
                  text
                  type="danger"
                  icon={Delete}
                  onClick={(e: Event) => {
                    e.stopPropagation();
                    removeKey(key);
                  }}
                />
              </div>
            ))}
          </el-scrollbar>
        </div>
        <div class={ns.e("fields")}>
          {activeKey.value
            ? (
                activeIsArray.value
                  ? (
                      <div class={ns.e("array-hint")}>
                        数组表
                        {" "}
                        <code>{activeKey.value}</code>
                        {" "}
                        请求时取
                        <code>$dataModels[dataModelName].{activeKey.value}</code>
                        整组数据放入 body，无字段配置
                      </div>
                    )
                  : (
                      <>
                        <div class={ns.e("fields-actions")}>
                          <el-button size="small" type="primary" icon={Plus} onClick={addField}>添加字段</el-button>
                          <el-button size="small" onClick={bringModelFields}>从模型带入字段</el-button>
                        </div>
                        <el-table size="small" data={fieldRows.value} maxHeight={300}>
                          <el-table-column label="字段编码" minWidth={100}>
                            {{
                              default: ({ row }: any) => (
                                <el-input
                                  size="small"
                                  modelValue={row.fieldName}
                                  onUpdate:modelValue={(v: string) => renameField(row, v)}
                                  placeholder="fieldName"
                                />
                              ),
                            }}
                          </el-table-column>
                          <el-table-column label="类型" width={100}>
                            {{
                              default: ({ row }: any) => (
                                <el-select size="small" modelValue={row.def.valueType} onUpdate:modelValue={(v: any) => (row.def.valueType = v)}>
                                  {VALUE_TYPE_OPTIONS.map(o => (
                                    <el-option key={o.value} value={o.value} label={o.label} />
                                  ))}
                                </el-select>
                              ),
                            }}
                          </el-table-column>
                          <el-table-column label="操作符 op" width={100}>
                            {{
                              default: ({ row }: any) => (
                                <el-select
                                  size="small"
                                  modelValue={row.def.op}
                                  onUpdate:modelValue={(v: any) => (row.def.op = v)}
                                  disabled={!opEnabled.value}
                                  clearable
                                  placeholder="eq"
                                >
                                  {OP_OPTIONS.map(o => (
                                    <el-option key={o.value} value={o.value} label={o.label} />
                                  ))}
                                </el-select>
                              ),
                            }}
                          </el-table-column>
                          <el-table-column label="默认值" minWidth={120}>
                            {{
                              default: ({ row }: any) => (
                                <DsValueInput
                                  modelValue={row.def.isSkipVal ? undefined : row.def.defaultValue}
                                  valueType={row.def.valueType}
                                  onChange={(v: any) => {
                                    if (v === undefined) {
                                      delete row.def.defaultValue;
                                    }
                                    else {
                                      row.def.defaultValue = v;
                                    }
                                  }}
                                />
                              ),
                            }}
                          </el-table-column>
                          <el-table-column label="去向" width={120}>
                            {{
                              default: ({ row }: any) => (
                                <el-checkbox-group
                                  size="small"
                                  modelValue={resolveTypesOf(row.def)}
                                  onUpdate:modelValue={(vals: any[]) => toggleResolveType(row.def, vals)}
                                >
                                  {RESOLVE_TYPE_OPTIONS.map(o => (
                                    <el-checkbox key={o.value} value={o.value} label={o.value} />
                                  ))}
                                </el-checkbox-group>
                              ),
                            }}
                          </el-table-column>
                          <el-table-column width={76} align="center">
                            {{
                              header: () => (
                                <span title="isCache：请求时回写到页面模型">缓存</span>
                              ),
                              default: ({ row }: any) => (
                                <el-switch
                                  size="small"
                                  modelValue={!!row.def.isCache}
                                  onUpdate:modelValue={(v: boolean) => (row.def.isCache = v)}
                                />
                              ),
                            }}
                          </el-table-column>
                          <el-table-column width={44} align="center">
                            {{
                              default: ({ row }: any) => (
                                <el-button size="small" text type="danger" icon={Delete} onClick={() => removeField(row.fieldName)} />
                              ),
                            }}
                          </el-table-column>
                        </el-table>
                      </>
                    )
              )
            : <el-empty description="请先添加 key" imageSize={50} />}
        </div>
      </div>
    );
  },
});
