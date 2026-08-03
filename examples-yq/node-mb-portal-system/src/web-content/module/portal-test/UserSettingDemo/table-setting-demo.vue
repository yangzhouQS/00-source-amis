<template>
  <yq-flex-box :is-row="true" :item-num="flexConfig.length" :item-config="flexConfig">
    <template #item-1>
      <yq-box border padding-size="small" :clear-padding="[]">
        <yq-table-async
          :table-loading="tableloading" :table-data="tableData" :show-summary="true" :pagination="{
            currentSize: tablePageSize,
            pageSizes: [10, 20, 50, 100],
            layout: 'sizes, prev, pager, next, total',
          }"
          :column-configs="tableConfig" :stripe="tableStripe" :summary-method="customSummary"
          @reload="loadData"
        >
          <template #isaudit="scope">
            <el-tag v-if="scope.row.isAudit" type="success">
              已提交
            </el-tag>
            <el-tag v-else type="error">
              未提交
            </el-tag>
          </template>
          <template #setting>
            <yq-table-setting table-code="receive_module_table" />
          </template>
        </yq-table-async>
      </yq-box>
    </template>

    <template #item-2>
      <yq-box border padding-size="small" :clear-padding="[]">
        <yq-table-report
          :table-loading="tableloading1"
          :table-data="tableData1"
          :column-configs="tableConfigReport1"
          :pagination="pagination1"
          @reload="loadData1"
        >
          <template #setting>
            <yq-table-setting
              table-code="receive_module_table_1"
            />
          </template>
        </yq-table-report>
      </yq-box>
    </template>
    <template #item-3>
      <yq-box border padding-size="small" :clear-padding="[]">
        <el-button @click="saveData">
          保存
        </el-button>
        <table-edit-v2
          ref="tableEditRef" :table-data="tableEditData" :column-configs="tableConfigEdit" :map-config="dataMap"
          not-repeat-filed="id" :rules="rules"
          :edit-config="{ trigger: 'click', mode: 'row', autoClear: true }"
          :keyboard-config="{ isArrow: true, isEnter: true, isTab: true, isEdit: true }"
          :row-config="{ isCurrent: true }"
        >
          <template #column1="{ row }">
            <el-input v-model="row.column1" size="small" />
          </template>
          <template #column2="{ row }">
            <el-input v-model="row.column2" size="small" />
          </template>
          <template #column3="{ row }">
            <el-select v-model="row.column3" clearable style="width: 100%" size="small">
              <el-option v-for="item in options" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </template>
          <template #column5="{ row }">
            <el-tag type="primary">
              {{ row.column5 || "空" }}
            </el-tag>
          </template>
          <template #column6="{ row }">
            <el-select v-model="row.column6" style="width: 100%" size="small">
              <el-option
                v-for="item in [{ value: '西安', label: '西安' }, { value: '咸阳', label: '咸阳' }]" :key="item.value"
                :label="item.label" :value="item.value"
              />
            </el-select>
          </template>
          <template #setting>
            <yq-table-setting
              table-code="receive_module_table_edit" :show-page-size-setting="false"
              :show-stripe-setting="true" :show-thousands-separator-setting="true" :show-decimal-padding-setting="true"
              :show-field-visibility-switch="false"
            />
          </template>
        </table-edit-v2>
      </yq-box>
    </template>
  </yq-flex-box>
</template>

<script setup lang="ts">
import { useTableSetting } from "@cs/vue3-biz-components-library";
import { ElMessage } from "element-plus";
import { onMounted, reactive, ref } from "vue";

const tableloading = ref(false);
const flexConfig = [
  {
    tag: "item-1",
    isFixed: false,
    size: "",
    clearPadding: [],
  },
  {
    tag: "item-2",
    isFixed: false,
    size: "",
    clearPadding: [],
  },
  {
    tag: "item-3",
    isFixed: false,
    size: "",
    clearPadding: [],
  },
];

const tableData = ref({});

const columns = [
  { attr: { prop: "code", type: "index", label: "编码", width: 60, headerAlign: "left", align: "left", resizable: false } },
  { attr: { prop: "isAudit", label: "提交状态", width: 100, headerAlign: "left", scopedSlot: "isaudit", align: "left", cannotHide: true } },
  { attr: { prop: "orderCode", label: "单据编号", width: 150, headerAlign: "left", cannotHide: true } },
  { attr: { prop: "orderDate", label: "账期", width: 120, headerAlign: "left", cannotHide: true } },
  { attr: { prop: "planType", label: "计划类型", width: 120, headerAlign: "left" } },
  { attr: { prop: "recordedDate", label: "入账日期", width: 120, headerAlign: "left" } },
  { attr: { prop: "quantity", label: "数量", width: 120, headerAlign: "right", align: "right", cannotHide: true } },
  { attr: { prop: "price", label: "单价", width: 120, headerAlign: "right", align: "right" } },
  { attr: { prop: "totalAmount", label: "金额", width: 120, headerAlign: "right", align: "right" } },
  {
    isParent: true,
    attr: { prop: "versionCode", label: "版本信息", headerAlign: "center" },
    items: [
      { attr: { prop: "auditor", label: "提交人", width: 120, headerAlign: "left" } },
      { attr: { prop: "maker", label: "制单人", width: 120, headerAlign: "left" } },
      { attr: { prop: "makerDate", label: "制单时间", width: 120, headerAlign: "left" } },
    ],
  },
  { attr: { prop: "orgName", label: "组织名称" } },
];

const { tableConfig, tableStripe, tablePageSize, formatCurrentValue } = useTableSetting("receive_module_table", columns);

// 分页直接用 computed，无需 watch 同步
const pagination = reactive({
  get currentSize() {
    return tablePageSize.value;
  },
  set currentSize(val) { },
  pageSizes: [10, 20, 30, 50, 100],
  layout: "sizes, prev, pager, next, total",
});

// // 监听页码变化，同步赋值 + 刷新表格数据
// watch(defaultPageSize, (newNum) => {
//   pagination.currentSize = newNum;
//   console.log("pagination.currentSize", pagination.currentSize);
// });

async function loadData(isReset) {
  tableloading.value = true;
  setTimeout(() => {
    tableData.value = {
      result: [
        { code: "1", isAudit: true, orderCode: "PO001", quantity: 100.2345, price: 100, totalAmount: 10000.78, orderDate: "2024-01", planType: "采购计划", recordedDate: "2024-01-01", auditor: "张三", maker: "李四", makerDate: "2024-01-01 10:00", orgName: "生产部" },
        { code: "2", isAudit: false, orderCode: "PO002", quantity: 200.34, price: 200, totalAmount: 40000.33, orderDate: "2024-01", planType: "销售计划", recordedDate: "2024-01-02", auditor: "", maker: "王五", makerDate: "2024-01-02 14:00", orgName: "销售部" },
        { code: "3", isAudit: true, orderCode: "PO003", quantity: 12000.23, price: 300, totalAmount: 9034.45, orderDate: "2024-02", planType: "采购计划", recordedDate: "2024-02-01", auditor: "赵六", maker: "钱七", makerDate: "2024-02-01 09:00", orgName: "采购部" },
      ],
      count: 40,
    };
    tableloading.value = false;
  }, 500);
}

// 自定义汇总方法
function customSummary({ columns, data }) {
  const summaryArr: any[] = [];

  columns.forEach((col, index) => {
    // 第一列固定显示“合计”
    if (index === 0) {
      summaryArr[index] = "合计";
      return;
    }
    const prop = col.property;
    if (prop === "quantity") {
      // 求和逻辑，兼容空/字符串数字
      const total = data.reduce((sum, row) => {
        const val = Number(row.quantity) || 0;
        return sum + val;
      }, 0);
      summaryArr[index] = formatCurrentValue(total, "quantityDecimalDigit") ?? String(total);
    } else {
      // 不需要合计的列，填空
      summaryArr[index] = "";
    }
  });
  return summaryArr;
}

const tableloading1 = ref(false);
const tableData1 = ref<any[]>([]);

const columns1 = [
  { attr: { prop: "code", type: "index", label: "序号", width: 50, headerAlign: "center", align: "center" } },
  { attr: { prop: "code", label: "编码", width: 90, headerAlign: "center" } },
  { attr: { prop: "name", label: "名称", width: 120 } },
  { attr: { prop: "spec", label: "规格", width: 120 } },
  { attr: { prop: "unit", label: "单位", width: 60 } },
  { attr: { prop: "quantity", label: "数量" } },
  { attr: { prop: "orgName", label: "组织名称" } },
];

const { tableConfig: tableConfigReport1, tablePageSize: tablePageSize1 } = useTableSetting("receive_module_table_1", columns1);
const pagination1 = reactive({
  get currentSize() {
    return tablePageSize1.value;
  },
  set currentSize(val) { },
  pageSizes: [5, 10, 20, 30, 50, 150],
  layout: "sizes, prev, pager, next, total",
});
async function loadData1(_isReset) {
  tableloading1.value = true;
  setTimeout(() => {
    tableData1.value = [
      { code: "M001", name: "钢材", spec: "Q235", unit: "吨", quantity: 100, orgName: "生产部" },
      { code: "M002", name: "铝材", spec: "6061", unit: "吨", quantity: 50, orgName: "采购部" },
      { code: "M003", name: "塑料", spec: "PP", unit: "kg", quantity: 500, orgName: "仓库" },
    ];
    tableloading1.value = false;
  }, 500);
}

// 编辑表格配置
const length = ref(20);
const tableEditRef = ref();
const tableEditData = ref([
  { column0: 0, column1: null, column2: 2, column3: "选项一", id: 3 },
  { column0: 0, column1: null, column2: null, column3: "", id: 1 },
  { column0: 0, column1: null, column2: null, column3: "", id: 2 },
]);
const options = [
  { value: "选项一", label: "选项一" },
  { value: "选项二", label: "选项二" },
];
const tableEdit1 = [
  { attr: { prop: "code", type: "index", label: "序号", width: 80, align: "center" } },
  { attr: { prop: "column1", label: "column1", width: 120, sortable: true, editRender: {}, editSlot: "column1" } },
  { attr: { prop: "column2", label: "column2", width: 120, sortable: true, editRender: {}, editSlot: "column2", decimalCode: "quantityDecimalDigit" } },
  { attr: { prop: "column3", label: "column3", width: 120, editRender: {}, editSlot: "column3", rules: [{ required: true, message: "column3不能为空" }] } },
  { attr: { prop: "column4", label: "column4", width: 120, editRender: {}, editSlot: "column4" } },
  { attr: { prop: "column5", label: "column5", width: 120, editRender: {}, editSlot: "column5" } },
  { attr: { prop: "column6", label: "column6", width: 120, editRender: {}, editSlot: "column6" } },
];

const { tableConfig: tableConfigEdit } = useTableSetting("receive_module_table_edit", tableEdit1);

const rules = {
  column1: [{ required: true, message: "column1不能为空" }],
  column2: [{ required: true, message: "column2不能为空" }],
  column3: [{ required: true, message: "column2不能为空" }],
};
const dataMap = {
  dataSource1: [
    { prop: "column0", isReplace: true, defaultVal: "", selprop: "mcolumn0" },
    { prop: "column1", isReplace: true, defaultVal: "", selprop: "mcolumn1" },
    { prop: "column2", isReplace: true, defaultVal: "", selprop: "mcolumn2" },
    { prop: "column3", isReplace: true, defaultVal: "", selprop: "mcolumn3" },
    { prop: "column4", isReplace: true, defaultVal: "", selprop: "mcolumn4" },
    { prop: "column5", isReplace: true, defaultVal: "", selprop: "mcolumn5", eventConf: { isOn: true, calculate: (row) => {
      return 999;
    } } },
    { prop: "column6", isReplace: true, defaultVal: "", selprop: "mcolumn6" },
    { prop: "id", isReplace: true, defaultVal: "", selprop: "mid" },
  ],
  dataSource3: [
    { prop: "column0", isReplace: true, defaultVal: "", selprop: "mcolumn0" },
    { prop: "column1", isReplace: true, defaultVal: "", selprop: "mcolumn1" },
    { prop: "column2", isReplace: true, defaultVal: "", selprop: "mcolumn2" },
    { prop: "column3", isReplace: true, defaultVal: "", selprop: "mcolumn3" },
    { prop: "column4", isReplace: true, defaultVal: "", selprop: "mcolumn4" },
    { prop: "column5", isReplace: true, defaultVal: "", selprop: "mcolumn5", eventConf: { isOn: true, calculate: (row) => {
      return 999;
    } } },
    { prop: "column6", isReplace: true, defaultVal: "", selprop: "mcolumn6" },
    { prop: "id", isReplace: true, defaultVal: "", selprop: "mid" },
  ],
};
let id = 0;
function initData(length = 10) {
  const rows = Array.from({ length }).map((item, index) => {
    id += 1;
    return {
      mcolumn0: id,
      mcolumn1: `文字列${index + 1}`,
      mcolumn2: Math.ceil(Math.random() * 100),
      mcolumn3: "选项一",
      mcolumn4: new Date(),
      mcolumn5: "哈哈哈哈",
      mcolumn6: "西安",
      mid: id,
    };
  });
  tableEditData.value.push(...rows);
}
function saveData() {
  const { valid, rows, message } = tableEditRef.value.validate();
  console.log("valid", valid, rows, message);
  if (valid) {
    ElMessage({
      message: "保存成功！",
      type: "success",
    });
  } else {
    ElMessage({
      message: `保存失败！${message.join("；")}`,
      type: "warning",
    });
  }
}

onMounted(async () => {
  // 2. 请求表格数据
  await loadData(false);
  await loadData1(false);
  initData();
});
</script>
