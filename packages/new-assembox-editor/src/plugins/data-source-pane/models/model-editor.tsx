import type { Editor } from "../../../core/editor";
import type { DsDocHandle } from "../doc/use-data-source-doc";
import type { DsIssue } from "../doc/types";
import { Delete, Plus } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
/**
 * 模型编辑器（Drawer）
 * 三级结构：模型 → 表（对象表/数组表） → 字段（对象表）
 * 保存时整体校验；引用检查在 Tab 列表删除/重命名时触发
 */
import { computed, defineComponent, PropType, ref } from "vue";
import { useAssemNamespace } from "../../../hooks/use-assem-namespace";
import { hasBlockingIssues, validateModel } from "../doc/validate";
import { VALUE_TYPE_OPTIONS } from "../constants";
import { cloneDoc } from "../doc/normalize";
import { DsValueInput } from "../shared/type-value-input";
import { ImportModelsDialog } from "./import-models-dialog";
import "../data-source-pane-style.less";

const ns = useAssemNamespace("ds-editor");
const nsTables = useAssemNamespace("ds-tables");

export const ModelEditor = defineComponent({
  name: "DsModelEditor",
  props: {
    editor: { type: Object as PropType<Editor>, required: true },
    doc: { type: Object as PropType<DsDocHandle>, required: true },
    mode: { type: String as PropType<"add" | "edit">, required: true },
    name: { type: String, default: "" },
    onClose: { type: Function as PropType<() => void>, required: true },
  },
  setup(props) {
    const visible = ref(true);
    const original = props.mode === "edit" ? props.doc.state.dataModelConfig[props.name] : undefined;
    /** 草稿：{ id, description, tables: {表名: 对象表|[]} }（编辑态即存储态） */
    const state = ref<{
      id: string;
      description: string;
      tables: Record<string, Record<string, any> | []>;
    }>({
      id: props.mode === "edit" ? props.name : "",
      description: typeof original?.description === "string" ? original.description : "",
      tables: (() => {
        const out: Record<string, Record<string, any> | []> = {};
        if (original) {
          for (const [k, v] of Object.entries(original)) {
            if (k === "description") {
              continue;
            }
            out[k] = Array.isArray(v) ? [] : cloneDoc(v as Record<string, any>);
          }
        }
        return out;
      })(),
    });

    const issues = ref<DsIssue[]>([]);
    const activeTable = ref("");

    const tableNames = computed(() => Object.keys(state.value.tables));
    const activeIsArray = computed(() => Array.isArray(state.value.tables[activeTable.value]));

    /** 当前激活对象表（数组表返回 undefined） */
    const activeTableObj = computed<Record<string, any> | undefined>(() => {
      const t = state.value.tables[activeTable.value];
      return Array.isArray(t) ? undefined : t;
    });

    const pickDefaultTable = () => {
      if (!activeTable.value || !(activeTable.value in state.value.tables)) {
        activeTable.value = tableNames.value[0] ?? "";
      }
    };
    pickDefaultTable();

    const addTable = (isArray: boolean) => {
      ElMessageBox.prompt(`请输入${isArray ? "数组表" : "对象表"}名称`, "添加表", {
        inputPattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/,
        inputErrorMessage: "须为合法标识符",
      })
        .then(({ value }) => {
          if (value in state.value.tables) {
            ElMessage.warning(`表 "${value}" 已存在`);
            return;
          }
          state.value.tables[value] = isArray ? [] : {};
          activeTable.value = value;
        })
        .catch(() => {});
    };

    const removeTable = (tableName: string) => {
      ElMessageBox.confirm(`确认删除表 "${tableName}"？`, "删除提示", { type: "warning" })
        .then(() => {
          delete state.value.tables[tableName];
          pickDefaultTable();
        })
        .catch(() => {});
    };

    const addField = () => {
      const table = state.value.tables[activeTable.value];
      if (Array.isArray(table)) {
        return;
      }
      table[""] = { valueType: "string" };
    };

    const removeField = (fieldName: string) => {
      const table = state.value.tables[activeTable.value];
      if (Array.isArray(table)) {
        return;
      }
      delete table[fieldName];
    };

    const save = () => {
      const modelDraft: Record<string, any> = { description: state.value.description };
      Object.assign(modelDraft, state.value.tables);
      const list = validateModel(state.value.id, modelDraft, props.doc.state, {
        excludeName: props.mode === "edit" ? props.name : undefined,
      });
      issues.value = list;
      if (hasBlockingIssues(list)) {
        return;
      }
      props.doc.commit(
        `${props.mode === "add" ? "新增" : "编辑"}模型 ${state.value.id}`,
        (doc) => {
          if (props.mode === "edit" && props.name !== state.value.id) {
            delete doc.dataModelConfig[props.name];
          }
          doc.dataModelConfig[state.value.id] = modelDraft as any;
        },
      );
      ElMessage.success("模型已保存");
      visible.value = false;
    };

    return () => (
      <el-drawer
        v-model={visible.value}
        title={props.mode === "add" ? "新增模型" : `编辑模型：${props.name}`}
        size="720px"
        appendToBody
        destroyOnClose
        onClose={props.onClose}
      >
        {{
          default: () => (
            <div class={ns.b()}>
              <el-form labelWidth="80px" size="small">
                <el-form-item label="模型名" required>
                  <el-input
                    modelValue={state.value.id}
                    onUpdate:modelValue={(v: string) => (state.value.id = v)}
                    placeholder="如 receiveFilter（标识符，唯一）"
                  />
                </el-form-item>
                <el-form-item label="描述" required>
                  <el-input
                    modelValue={state.value.description}
                    onUpdate:modelValue={(v: string) => (state.value.description = v)}
                    maxlength={30}
                    showWordLimit
                  />
                </el-form-item>
              </el-form>

              <div class={ns.e("section")}>
                <div class={[ns.e("section-title"), ns.em("section-title", "with-op")]}>
                  表结构
                  <span>
                    <ImportModelsDialog
                      doc={props.doc}
                      onImport={(tables) => {
                        Object.assign(state.value.tables, tables);
                        pickDefaultTable();
                      }}
                    />
                  </span>
                </div>
                <div class={nsTables.b()}>
                  <div class={nsTables.e("pane")}>
                    <div class={nsTables.e("pane-actions")}>
                      <el-button size="small" text type="primary" icon={Plus} onClick={() => addTable(false)}>
                        对象表
                      </el-button>
                      <el-button size="small" text type="primary" icon={Plus} onClick={() => addTable(true)}>
                        数组表
                      </el-button>
                    </div>
                    <el-scrollbar class={nsTables.e("list")}>
                      {tableNames.value.map(name => (
                        <div
                          key={name}
                          class={[
                            nsTables.e("item"),
                            { [nsTables.is("active").trim()]: activeTable.value === name },
                          ]}
                          onClick={() => (activeTable.value = name)}
                        >
                          <span class={nsTables.e("item-name")} title={name}>{name}</span>
                          <span class={nsTables.em("item", Array.isArray(state.value.tables[name]) ? "array" : "object")}>
                            {Array.isArray(state.value.tables[name]) ? "array" : "object"}
                          </span>
                          <el-button
                            size="small"
                            text
                            type="danger"
                            icon={Delete}
                            onClick={(e: Event) => {
                              e.stopPropagation();
                              removeTable(name);
                            }}
                          />
                        </div>
                      ))}
                    </el-scrollbar>
                  </div>
                  <div class={nsTables.e("fields")}>
                    {activeTable.value
                      ? (
                          activeIsArray.value
                            ? (
                                <div class={nsTables.e("array-hint")}>
                                  数组表
                                  {" "}
                                  <code>{activeTable.value}</code>
                                  {" "}
                                  为运行时数据占位（高级筛选条件/表格行数据），无字段配置
                                </div>
                              )
                            : (
                                <>
                                  <div class={nsTables.e("fields-actions")}>
                                    <el-button size="small" type="primary" icon={Plus} onClick={addField}>
                                      添加字段
                                    </el-button>
                                  </div>
                                  <el-table
                                    size="small"
                                    data={activeTableObj.value ? Object.entries(activeTableObj.value).map(([fieldName, def]) => ({ fieldName, def })) : []}
                                    maxHeight={320}
                                  >
                                    <el-table-column label="字段名" minWidth={110}>
                                      {{
                                        default: ({ row }: any) => (
                                          <el-input
                                            size="small"
                                            modelValue={row.fieldName}
                                            onUpdate:modelValue={(v: string) => activeTableObj.value && renameField(activeTableObj.value, row, v)}
                                          />
                                        ),
                                      }}
                                    </el-table-column>
                                    <el-table-column label="类型" width={110}>
                                      {{
                                        default: ({ row }: any) => (
                                          <el-select size="small" modelValue={row.def.valueType} onUpdate:modelValue={(v: any) => setFieldType(row, v)}>
                                            {VALUE_TYPE_OPTIONS.map(o => (
                                              <el-option key={o.value} value={o.value} label={o.label} />
                                            ))}
                                          </el-select>
                                        ),
                                      }}
                                    </el-table-column>
                                    <el-table-column label="默认值" minWidth={130}>
                                      {{
                                        default: ({ row }: any) => (
                                          <DsValueInput
                                            modelValue={row.def.isSkipVal ? undefined : row.def.defaultValue}
                                            valueType={row.def.valueType}
                                            onChange={(v: any) => setFieldDefault(row, v)}
                                          />
                                        ),
                                      }}
                                    </el-table-column>
                                    <el-table-column label="跳过默认值" width={90} align="center">
                                      {{
                                        default: ({ row }: any) => (
                                          <el-switch size="small" modelValue={!!row.def.isSkipVal} onUpdate:modelValue={(v: boolean) => setFieldSkip(row, v)} />
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
                      : <el-empty description="请先添加表" imageSize={50} />}
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

/** 字段重命名（表内原键迁移；row = { fieldName, def }，def 为底层字段对象引用） */
function renameField(table: Record<string, any>, row: any, newName: string): void {
  const oldName = row.fieldName;
  if (!table || !newName || newName === oldName) {
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
}

function setFieldType(row: any, vt: string): void {
  row.def.valueType = vt;
  // 类型切换后默认值语义变化，清掉避免脏数据
  delete row.def.defaultValue;
}

function setFieldDefault(row: any, v: any): void {
  if (v === undefined) {
    delete row.def.defaultValue;
  }
  else {
    row.def.defaultValue = v;
  }
}

function setFieldSkip(row: any, skip: boolean): void {
  row.def.isSkipVal = skip;
  if (skip) {
    delete row.def.defaultValue;
  }
}
